"""
TradeLogic - MetaTrader 5 Candle Data

Provides completed MT5 candle history for Strategy 1.

Important:
- M5 is the Strategy 1 execution timeframe.
- M15 is confirmation only.
- The currently forming candle is deliberately excluded.
- Live EMA21 contact is handled separately by live tick data.
- This module does not calculate indicators or place trades.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

import MetaTrader5 as mt5
import numpy as np

from mt5.market import ensure_symbol_selected


class MT5CandleError(RuntimeError):
    """Raised when MT5 candle history cannot be retrieved safely."""


@dataclass(frozen=True)
class MT5Candle:
    time: datetime
    open: float
    high: float
    low: float
    close: float
    tick_volume: int
    spread: int
    real_volume: int


_TIMEFRAMES: dict[str, int] = {
    "M5": mt5.TIMEFRAME_M5,
    "M15": mt5.TIMEFRAME_M15,
}


def _last_error() -> tuple[int | None, str | None]:
    """Return the most recent MetaTrader5 error safely."""
    try:
        error = mt5.last_error()

        if not error:
            return None, None

        code = error[0] if len(error) > 0 else None
        message = str(error[1]) if len(error) > 1 else None

        return code, message

    except Exception as exc:
        return None, str(exc)


def resolve_timeframe(timeframe: str) -> int:
    """
    Convert a TradeLogic timeframe name into its MT5 constant.

    Strategy 1 currently supports M5 and M15.
    """
    normalized = timeframe.strip().upper()

    mt5_timeframe = _TIMEFRAMES.get(normalized)

    if mt5_timeframe is None:
        raise MT5CandleError(
            f"Unsupported timeframe '{timeframe}'. "
            "Strategy 1 supports M5 and M15."
        )

    return mt5_timeframe


def get_completed_candles(
    *,
    symbol: str,
    timeframe: str,
    count: int = 250,
) -> list[MT5Candle]:
    """
    Retrieve completed candles from MT5.

    start_pos=1 is intentional:
    - position 0 = currently forming candle
    - position 1 = most recently completed candle

    MT5 returns the selected candle block chronologically, so the
    final item in the returned list is the latest completed candle.
    """

    if count <= 0:
        raise MT5CandleError(
            "Candle count must be greater than zero."
        )

    clean_symbol = symbol.strip()

    if not clean_symbol:
        raise MT5CandleError(
            "Symbol is required."
        )

    ensure_symbol_selected(clean_symbol)

    mt5_timeframe = resolve_timeframe(
        timeframe
    )

    rates = mt5.copy_rates_from_pos(
        clean_symbol,
        mt5_timeframe,
        1,
        count,
    )

    if rates is None:
        code, message = _last_error()

        raise MT5CandleError(
            f"Unable to retrieve {timeframe.upper()} candles "
            f"for '{clean_symbol}' "
            f"(code={code}, message={message})."
        )

    if len(rates) == 0:
        raise MT5CandleError(
            f"MT5 returned no {timeframe.upper()} candle data "
            f"for '{clean_symbol}'."
        )

    candles: list[MT5Candle] = []

    for rate in rates:
        candles.append(
            MT5Candle(
                time=datetime.fromtimestamp(
                    int(rate["time"]),
                    tz=timezone.utc,
                ),
                open=float(rate["open"]),
                high=float(rate["high"]),
                low=float(rate["low"]),
                close=float(rate["close"]),
                tick_volume=int(rate["tick_volume"]),
                spread=int(rate["spread"]),
                real_volume=int(rate["real_volume"]),
            )
        )

    return candles


def get_completed_close_prices(
    *,
    symbol: str,
    timeframe: str,
    count: int = 250,
) -> np.ndarray:
    """
    Return completed candle closing prices as a NumPy array.

    This output can be passed directly into:
        indicators.technical.strategy_1_snapshot()
    """

    candles = get_completed_candles(
        symbol=symbol,
        timeframe=timeframe,
        count=count,
    )

    return np.asarray(
        [candle.close for candle in candles],
        dtype=float,
    )


def get_latest_completed_candle(
    *,
    symbol: str,
    timeframe: str,
) -> MT5Candle:
    """
    Return only the latest fully completed candle.
    """

    candles = get_completed_candles(
        symbol=symbol,
        timeframe=timeframe,
        count=1,
    )

    return candles[-1]