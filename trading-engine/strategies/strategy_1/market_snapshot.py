"""
TradeLogic - Strategy 1 Market Snapshot

Builds the live market state required by Strategy 1 by combining:

- completed M1 candles
- completed M5 candles
- completed M15 candles
- Strategy 1 EMA/MACD calculations
- latest completed-candle timestamps
- broker symbol properties
- live MT5 bid/ask tick

Strategy 1 pathways:

Path A:
- M15 EMA trend + M15 MACD confirmation
- M5 EMA21 live-price retracement/contact

Path B:
- M1 EMA21 / EMA200 completed-candle cross
- wait for live-price retest

Path C:
- M5 EMA21 / EMA200 completed-candle cross
- wait for live-price retest

The completed-candle timestamps are exposed so the worker can age
pending cross/retest setups by actual completed candles rather than
by worker polling cycles.

This module does NOT:
- decide BUY/SELL entries
- maintain pending cross state
- place trades
- size positions
- modify positions
- manage circuit-breaker state
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from indicators.technical import (
    Strategy1IndicatorSnapshot,
    strategy_1_snapshot,
)
from mt5.candles import get_completed_candles
from mt5.market import (
    MT5SymbolInfo,
    MT5Tick,
    get_live_tick,
    get_symbol_info,
)


class Strategy1MarketSnapshotError(RuntimeError):
    """Raised when a complete Strategy 1 market snapshot cannot be built."""


@dataclass(frozen=True)
class Strategy1MarketSnapshot:
    """
    Complete market state required for one Strategy 1 evaluation cycle.

    Indicator snapshots use fully completed candles only.

    Live executable prices:
        BUY  -> Ask
        SELL -> Bid
    """

    symbol: str

    m1: Strategy1IndicatorSnapshot
    m5: Strategy1IndicatorSnapshot
    m15: Strategy1IndicatorSnapshot

    m1_completed_at: datetime
    m5_completed_at: datetime
    m15_completed_at: datetime

    symbol_info: MT5SymbolInfo
    tick: MT5Tick

    buy_price: float
    sell_price: float

    point: float


def _close_prices(
    candles: list,
) -> list[float]:
    """
    Extract completed close prices from MT5 candle records.
    """

    return [
        float(candle.close)
        for candle in candles
    ]


def build_strategy_1_market_snapshot(
    *,
    symbol: str,
    candle_count: int = 250,
) -> Strategy1MarketSnapshot:
    """
    Build the complete current Strategy 1 market state.

    At least 201 completed candles are required because the Strategy 1
    indicator snapshot now needs both:

    - the latest completed EMA state
    - the immediately previous completed EMA state

    This is required for genuine EMA21 / EMA200 crossover detection.

    M1:
        independent cross/retest Path B

    M5:
        normal Path-A execution
        plus independent cross/retest Path C

    M15:
        normal Path-A trend + MACD confirmation

    Live MT5 prices remain separate from completed-candle indicators:

        BUY execution/contact price  = Ask
        SELL execution/contact price = Bid
    """

    clean_symbol = symbol.strip()

    if not clean_symbol:
        raise Strategy1MarketSnapshotError(
            "Symbol is required."
        )

    if candle_count < 201:
        raise Strategy1MarketSnapshotError(
            "Strategy 1 requires at least 201 completed candles."
        )

    try:
        symbol_info = get_symbol_info(
            clean_symbol
        )

        tick = get_live_tick(
            clean_symbol
        )

        # ---------------------------------------------------------
        # COMPLETED M1 CANDLES
        # ---------------------------------------------------------
        m1_candles = get_completed_candles(
            symbol=clean_symbol,
            timeframe="M1",
            count=candle_count,
        )

        if len(m1_candles) < 201:
            raise Strategy1MarketSnapshotError(
                f"MT5 returned only {len(m1_candles)} completed M1 "
                f"candles for '{clean_symbol}'. At least 201 are required."
            )

        m1_snapshot = strategy_1_snapshot(
            _close_prices(
                m1_candles
            )
        )

        # ---------------------------------------------------------
        # COMPLETED M5 CANDLES
        # ---------------------------------------------------------
        m5_candles = get_completed_candles(
            symbol=clean_symbol,
            timeframe="M5",
            count=candle_count,
        )

        if len(m5_candles) < 201:
            raise Strategy1MarketSnapshotError(
                f"MT5 returned only {len(m5_candles)} completed M5 "
                f"candles for '{clean_symbol}'. At least 201 are required."
            )

        m5_snapshot = strategy_1_snapshot(
            _close_prices(
                m5_candles
            )
        )

        # ---------------------------------------------------------
        # COMPLETED M15 CANDLES
        # ---------------------------------------------------------
        m15_candles = get_completed_candles(
            symbol=clean_symbol,
            timeframe="M15",
            count=candle_count,
        )

        if len(m15_candles) < 201:
            raise Strategy1MarketSnapshotError(
                f"MT5 returned only {len(m15_candles)} completed M15 "
                f"candles for '{clean_symbol}'. At least 201 are required."
            )

        m15_snapshot = strategy_1_snapshot(
            _close_prices(
                m15_candles
            )
        )

    except Strategy1MarketSnapshotError:
        raise

    except Exception as exc:
        raise Strategy1MarketSnapshotError(
            f"Unable to build Strategy 1 market snapshot "
            f"for '{clean_symbol}': {exc}"
        ) from exc

    return Strategy1MarketSnapshot(
        symbol=clean_symbol,

        m1=m1_snapshot,
        m5=m5_snapshot,
        m15=m15_snapshot,

        m1_completed_at=m1_candles[-1].time,
        m5_completed_at=m5_candles[-1].time,
        m15_completed_at=m15_candles[-1].time,

        symbol_info=symbol_info,
        tick=tick,

        buy_price=tick.ask,
        sell_price=tick.bid,

        point=symbol_info.point,
    )