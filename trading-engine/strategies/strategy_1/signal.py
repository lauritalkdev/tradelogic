"""
TradeLogic - Strategy 1 Signal Engine

Determines whether Strategy 1 currently has a BUY, SELL,
waiting condition, or invalidated setup.

Strategy 1:
- Symbols: XAUUSD, EURUSD
- M15 confirms trend
- M5 confirms trend and MACD direction
- Entry occurs on first live-price contact with the M5 EMA21 zone
- No trendline break
- No fractal
- No swing breakout
- No extra confirmation candle

Indicator snapshots should normally come from completed candles.
The live market price is used for EMA21 contact detection.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from config.strategy_1 import STRATEGY_1
from indicators.technical import Strategy1IndicatorSnapshot


class SignalDirection(str, Enum):
    BUY = "buy"
    SELL = "sell"
    NONE = "none"


class SignalStatus(str, Enum):
    ENTRY = "entry"
    WAITING = "waiting"
    INVALIDATED = "invalidated"
    NO_SETUP = "no_setup"


@dataclass(frozen=True)
class Strategy1Signal:
    direction: SignalDirection
    status: SignalStatus
    reason: str

    current_price: float
    ema21: float
    ema50: float

    entry_threshold: float | None = None
    invalidation_price: float | None = None


def _validate_market_inputs(
    current_price: float,
    previous_price: float | None,
    point: float,
) -> None:
    if current_price <= 0:
        raise ValueError("Current market price must be greater than zero.")

    if previous_price is not None and previous_price <= 0:
        raise ValueError("Previous market price must be greater than zero.")

    if point <= 0:
        raise ValueError("Broker symbol point must be greater than zero.")


def _bullish_trend(
    snapshot: Strategy1IndicatorSnapshot,
) -> bool:
    """
    Bullish trend qualification.

    Completed candle must show:
        price > EMA21 > EMA50 > EMA200
    """
    return (
        snapshot.close > snapshot.ema21
        and snapshot.ema21 > snapshot.ema50
        and snapshot.ema50 > snapshot.ema200
    )


def _bearish_trend(
    snapshot: Strategy1IndicatorSnapshot,
) -> bool:
    """
    Bearish trend qualification.

    Completed candle must show:
        price < EMA21 < EMA50 < EMA200
    """
    return (
        snapshot.close < snapshot.ema21
        and snapshot.ema21 < snapshot.ema50
        and snapshot.ema50 < snapshot.ema200
    )


def _bullish_macd(
    snapshot: Strategy1IndicatorSnapshot,
) -> bool:
    """
    Strategy-1 BUY MACD condition.

    Both MACD main and signal must currently be above zero.
    """
    return (
        snapshot.macd_main > 0
        and snapshot.macd_signal > 0
    )


def _bearish_macd(
    snapshot: Strategy1IndicatorSnapshot,
) -> bool:
    """
    Strategy-1 SELL MACD condition.

    Both MACD main and signal must currently be below zero.
    """
    return (
        snapshot.macd_main < 0
        and snapshot.macd_signal < 0
    )


def evaluate_strategy_1_signal(
    *,
    m5: Strategy1IndicatorSnapshot,
    m15: Strategy1IndicatorSnapshot,
    current_price: float,
    previous_price: float | None,
    point: float,
) -> Strategy1Signal:
    """
    Evaluate Strategy 1.

    BUY:
    - M15 bullish trend
    - M5 bullish trend
    - M5 MACD main > 0
    - M5 MACD signal > 0
    - Live price pulls downward into EMA21 + 5 broker points
    - Entry occurs on FIRST contact

    SELL:
    - Exact mirror
    - Live price pulls upward into EMA21 - 5 broker points

    Setup invalidation before entry:

    BUY:
        EMA50 - 5 broker points

    SELL:
        EMA50 + 5 broker points
    """

    _validate_market_inputs(
        current_price=current_price,
        previous_price=previous_price,
        point=point,
    )

    entry_distance = (
        STRATEGY_1.entry_zone_points * point
    )

    invalidation_distance = (
        STRATEGY_1.stop_loss_buffer_points * point
    )

    # ---------------------------------------------------------
    # BUY SETUP
    # ---------------------------------------------------------
    buy_trend_valid = (
        _bullish_trend(m15)
        and _bullish_trend(m5)
    )

    buy_macd_valid = _bullish_macd(m5)

    if buy_trend_valid and buy_macd_valid:
        entry_threshold = (
            m5.ema21 + entry_distance
        )

        invalidation_price = (
            m5.ema50 - invalidation_distance
        )

        # Pending BUY setup is cancelled if price has already
        # reached its invalidation level before an entry.
        if current_price <= invalidation_price:
            return Strategy1Signal(
                direction=SignalDirection.BUY,
                status=SignalStatus.INVALIDATED,
                reason=(
                    "BUY setup invalidated because price reached "
                    "EMA50 minus the configured broker-point buffer."
                ),
                current_price=current_price,
                ema21=m5.ema21,
                ema50=m5.ema50,
                entry_threshold=entry_threshold,
                invalidation_price=invalidation_price,
            )

        # We need a previous live price in order to prove this is
        # the FIRST contact with the EMA21 entry threshold.
        if previous_price is None:
            return Strategy1Signal(
                direction=SignalDirection.BUY,
                status=SignalStatus.WAITING,
                reason=(
                    "Bullish setup is valid. Waiting for live-price "
                    "movement into the EMA21 pullback zone."
                ),
                current_price=current_price,
                ema21=m5.ema21,
                ema50=m5.ema50,
                entry_threshold=entry_threshold,
                invalidation_price=invalidation_price,
            )

        # Price was above the zone and has now reached it.
        first_contact = (
            previous_price > entry_threshold
            and current_price <= entry_threshold
        )

        if first_contact:
            return Strategy1Signal(
                direction=SignalDirection.BUY,
                status=SignalStatus.ENTRY,
                reason=(
                    "BUY entry: first valid live-price contact "
                    "with the M5 EMA21 pullback zone."
                ),
                current_price=current_price,
                ema21=m5.ema21,
                ema50=m5.ema50,
                entry_threshold=entry_threshold,
                invalidation_price=invalidation_price,
            )

        return Strategy1Signal(
            direction=SignalDirection.BUY,
            status=SignalStatus.WAITING,
            reason=(
                "Bullish trend and MACD are valid. "
                "Waiting for first EMA21-zone contact."
            ),
            current_price=current_price,
            ema21=m5.ema21,
            ema50=m5.ema50,
            entry_threshold=entry_threshold,
            invalidation_price=invalidation_price,
        )

    # ---------------------------------------------------------
    # SELL SETUP
    # ---------------------------------------------------------
    sell_trend_valid = (
        _bearish_trend(m15)
        and _bearish_trend(m5)
    )

    sell_macd_valid = _bearish_macd(m5)

    if sell_trend_valid and sell_macd_valid:
        entry_threshold = (
            m5.ema21 - entry_distance
        )

        invalidation_price = (
            m5.ema50 + invalidation_distance
        )

        if current_price >= invalidation_price:
            return Strategy1Signal(
                direction=SignalDirection.SELL,
                status=SignalStatus.INVALIDATED,
                reason=(
                    "SELL setup invalidated because price reached "
                    "EMA50 plus the configured broker-point buffer."
                ),
                current_price=current_price,
                ema21=m5.ema21,
                ema50=m5.ema50,
                entry_threshold=entry_threshold,
                invalidation_price=invalidation_price,
            )

        if previous_price is None:
            return Strategy1Signal(
                direction=SignalDirection.SELL,
                status=SignalStatus.WAITING,
                reason=(
                    "Bearish setup is valid. Waiting for live-price "
                    "movement into the EMA21 pullback zone."
                ),
                current_price=current_price,
                ema21=m5.ema21,
                ema50=m5.ema50,
                entry_threshold=entry_threshold,
                invalidation_price=invalidation_price,
            )

        # Price was below the zone and has now reached it.
        first_contact = (
            previous_price < entry_threshold
            and current_price >= entry_threshold
        )

        if first_contact:
            return Strategy1Signal(
                direction=SignalDirection.SELL,
                status=SignalStatus.ENTRY,
                reason=(
                    "SELL entry: first valid live-price contact "
                    "with the M5 EMA21 pullback zone."
                ),
                current_price=current_price,
                ema21=m5.ema21,
                ema50=m5.ema50,
                entry_threshold=entry_threshold,
                invalidation_price=invalidation_price,
            )

        return Strategy1Signal(
            direction=SignalDirection.SELL,
            status=SignalStatus.WAITING,
            reason=(
                "Bearish trend and MACD are valid. "
                "Waiting for first EMA21-zone contact."
            ),
            current_price=current_price,
            ema21=m5.ema21,
            ema50=m5.ema50,
            entry_threshold=entry_threshold,
            invalidation_price=invalidation_price,
        )

    # ---------------------------------------------------------
    # NO VALID SETUP
    # ---------------------------------------------------------
    return Strategy1Signal(
        direction=SignalDirection.NONE,
        status=SignalStatus.NO_SETUP,
        reason=(
            "M5/M15 EMA trend and M5 MACD conditions "
            "do not currently form a valid Strategy-1 setup."
        ),
        current_price=current_price,
        ema21=m5.ema21,
        ema50=m5.ema50,
    ) 