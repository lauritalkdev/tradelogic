"""
TradeLogic - Strategy 1 Market Snapshot

Builds the live market state required by Strategy 1 by combining:

- completed M5 candles
- completed M15 candles
- Strategy 1 EMA/MACD calculations
- broker symbol properties
- live MT5 bid/ask tick

This module does NOT:
- place trades
- size positions
- modify positions
- manage circuit-breaker state
"""

from __future__ import annotations

from dataclasses import dataclass

from indicators.technical import (
    Strategy1IndicatorSnapshot,
    strategy_1_snapshot,
)
from mt5.candles import get_completed_close_prices
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
    symbol: str

    m5: Strategy1IndicatorSnapshot
    m15: Strategy1IndicatorSnapshot

    symbol_info: MT5SymbolInfo
    tick: MT5Tick

    buy_price: float
    sell_price: float

    point: float


def build_strategy_1_market_snapshot(
    *,
    symbol: str,
    candle_count: int = 250,
) -> Strategy1MarketSnapshot:
    """
    Build the complete current Strategy 1 market state.

    Completed candles are used for EMA/MACD calculations.

    Live MT5 prices are kept separate:
        BUY execution price  = Ask
        SELL execution price = Bid

    The live price will later be passed into the Strategy 1 signal
    engine for first-contact detection around EMA21.
    """

    clean_symbol = symbol.strip()

    if not clean_symbol:
        raise Strategy1MarketSnapshotError(
            "Symbol is required."
        )

    if candle_count < 200:
        raise Strategy1MarketSnapshotError(
            "Strategy 1 requires at least 200 completed candles."
        )

    try:
        symbol_info = get_symbol_info(
            clean_symbol
        )

        tick = get_live_tick(
            clean_symbol
        )

        m5_closes = get_completed_close_prices(
            symbol=clean_symbol,
            timeframe="M5",
            count=candle_count,
        )

        m15_closes = get_completed_close_prices(
            symbol=clean_symbol,
            timeframe="M15",
            count=candle_count,
        )

        m5_snapshot = strategy_1_snapshot(
            m5_closes
        )

        m15_snapshot = strategy_1_snapshot(
            m15_closes
        )

    except Exception as exc:
        raise Strategy1MarketSnapshotError(
            f"Unable to build Strategy 1 market snapshot "
            f"for '{clean_symbol}': {exc}"
        ) from exc

    return Strategy1MarketSnapshot(
        symbol=clean_symbol,
        m5=m5_snapshot,
        m15=m15_snapshot,
        symbol_info=symbol_info,
        tick=tick,
        buy_price=tick.ask,
        sell_price=tick.bid,
        point=symbol_info.point,
    )