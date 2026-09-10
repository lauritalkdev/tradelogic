"""
TradeLogic - Strategy 1 Signal Engine

Implements the four independent Strategy 1 entry pathways.

PATH A
------
M15 trend:
    BUY:
        EMA21 > EMA50 > EMA200
        MACD main > 0
        MACD signal > 0

    SELL:
        EMA21 < EMA50 < EMA200
        MACD main < 0
        MACD signal < 0

M5 is used only for the EMA21 pullback entry and EMA50 stop
reference.

No M5 MACD confirmation is required.
No M5 full EMA ordering is required.

PATH B
------
Independent M1 EMA21 / EMA200 cross-retest.

Bullish cross:
    previous completed candle EMA21 <= EMA200
    newest completed candle EMA21 > EMA200

Bearish cross:
    previous completed candle EMA21 >= EMA200
    newest completed candle EMA21 < EMA200

After the cross:
    - price must first move away from the EMA21/EMA200 area
    - price must then return to that area
    - the return creates the entry
    - EMA50 does not need to cross EMA200
    - M15 and MACD are irrelevant
    - setup expires after 10 completed M1 candles

PATH C
------
Same independent cross-retest logic as Path B, but on M5.
Setup expires after 10 completed M5 candles.

PATH D
------
Independent M1 trend-continuation pullback.

BUY:
    EMA21 > EMA50 > EMA200
    EMA21 is rising versus the previous completed M1 candle
    live Ask reaches the EMA21 or EMA50 contact zone

SELL:
    EMA21 < EMA50 < EMA200
    EMA21 is falling versus the previous completed M1 candle
    live Bid reaches the EMA21 or EMA50 contact zone

Path D does not use MACD and does not require a multi-candle
trend-persistence counter. EMA21 contact has priority over EMA50
when both contact zones could qualify.

Cross state exists only in worker runtime memory. It is deliberately
not reconstructed after a worker restart.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
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


class Strategy1EntryPath(str, Enum):
    PATH_A = "path_a"
    PATH_B_M1_CROSS = "path_b_m1_cross"
    PATH_C_M5_CROSS = "path_c_m5_cross"
    PATH_D_M1_PULLBACK = "path_d_m1_pullback"


@dataclass(frozen=True)
class Strategy1Signal:
    direction: SignalDirection
    status: SignalStatus
    path: Strategy1EntryPath

    reason: str

    current_price: float

    ema21: float
    ema50: float
    ema200: float

    stop_loss_timeframe: str

    entry_threshold: float | None = None
    invalidation_price: float | None = None

    retest_lower: float | None = None
    retest_upper: float | None = None

    # Path D only: identifies whether the live pullback contacted
    # M1 EMA21 or M1 EMA50. Existing Paths A/B/C leave this as None.
    path_d_contact_ema: str | None = None


@dataclass(frozen=True)
class CrossRetestState:
    """
    Runtime-only state for one independent cross/retest setup.

    cross_completed_at:
        completed candle that confirmed the cross.

    last_completed_at:
        latest completed candle timestamp already accounted for.

    completed_candles_elapsed:
        number of completed timeframe candles that have elapsed
        after the crossover candle.

    moved_away:
        True once live price has moved far enough away from the
        EMA21/EMA200 area before retesting.
    """

    direction: SignalDirection

    cross_completed_at: datetime
    last_completed_at: datetime

    completed_candles_elapsed: int

    moved_away: bool


@dataclass(frozen=True)
class CrossRetestEvaluation:
    signal: Strategy1Signal
    state: CrossRetestState | None


def _validate_market_inputs(
    *,
    current_price: float,
    point: float,
) -> None:
    if current_price <= 0:
        raise ValueError(
            "Current market price must be greater than zero."
        )

    if point <= 0:
        raise ValueError(
            "Broker symbol point must be greater than zero."
        )


def _bullish_trend(
    snapshot: Strategy1IndicatorSnapshot,
) -> bool:
    """
    Path-A bullish M15 trend condition.

    Close position relative to EMA21 is intentionally NOT part
    of the revised rule.
    """

    return (
        snapshot.ema21
        > snapshot.ema50
        > snapshot.ema200
    )


def _bearish_trend(
    snapshot: Strategy1IndicatorSnapshot,
) -> bool:
    """
    Path-A bearish M15 trend condition.
    """

    return (
        snapshot.ema21
        < snapshot.ema50
        < snapshot.ema200
    )


def _bullish_macd(
    snapshot: Strategy1IndicatorSnapshot,
) -> bool:
    return (
        snapshot.macd_main > 0
        and snapshot.macd_signal > 0
    )


def _bearish_macd(
    snapshot: Strategy1IndicatorSnapshot,
) -> bool:
    return (
        snapshot.macd_main < 0
        and snapshot.macd_signal < 0
    )


def evaluate_path_a_signal(
    *,
    m5: Strategy1IndicatorSnapshot,
    m15: Strategy1IndicatorSnapshot,
    current_price: float,
    previous_price: float | None,
    point: float,
    direction: SignalDirection,
) -> Strategy1Signal:
    """
    Evaluate revised Strategy 1 Path A.

    BUY:
        M15 EMA21 > EMA50 > EMA200
        M15 MACD main > 0
        M15 MACD signal > 0
        live Ask first contacts M5 EMA21 pullback zone

    SELL:
        exact mirror using live Bid

    M5 MACD is NOT used.
    M5 full EMA ordering is NOT required.

    Existing pre-entry EMA50 invalidation protection is preserved.
    """

    _validate_market_inputs(
        current_price=current_price,
        point=point,
    )

    if (
        previous_price is not None
        and previous_price <= 0
    ):
        raise ValueError(
            "Previous market price must be greater than zero."
        )

    entry_distance = (
        STRATEGY_1.entry_zone_points
        * point
    )

    invalidation_distance = (
        STRATEGY_1.stop_loss_buffer_points
        * point
    )

    if direction == SignalDirection.BUY:
        setup_valid = (
            _bullish_trend(m15)
            and _bullish_macd(m15)
        )

        entry_threshold = (
            m5.ema21
            + entry_distance
        )

        invalidation_price = (
            m5.ema50
            - invalidation_distance
        )

        if not setup_valid:
            return Strategy1Signal(
                direction=SignalDirection.BUY,
                status=SignalStatus.NO_SETUP,
                path=Strategy1EntryPath.PATH_A,
                reason=(
                    "Path A BUY conditions are not currently valid."
                ),
                current_price=current_price,
                ema21=m5.ema21,
                ema50=m5.ema50,
                ema200=m5.ema200,
                stop_loss_timeframe="M5",
                entry_threshold=entry_threshold,
                invalidation_price=invalidation_price,
            )

        if current_price <= invalidation_price:
            return Strategy1Signal(
                direction=SignalDirection.BUY,
                status=SignalStatus.INVALIDATED,
                path=Strategy1EntryPath.PATH_A,
                reason=(
                    "Path A BUY setup invalidated because price "
                    "reached M5 EMA50 minus the configured buffer."
                ),
                current_price=current_price,
                ema21=m5.ema21,
                ema50=m5.ema50,
                ema200=m5.ema200,
                stop_loss_timeframe="M5",
                entry_threshold=entry_threshold,
                invalidation_price=invalidation_price,
            )

        if previous_price is None:
            return Strategy1Signal(
                direction=SignalDirection.BUY,
                status=SignalStatus.WAITING,
                path=Strategy1EntryPath.PATH_A,
                reason=(
                    "Path A BUY setup is valid. Waiting for "
                    "first live-price contact with M5 EMA21."
                ),
                current_price=current_price,
                ema21=m5.ema21,
                ema50=m5.ema50,
                ema200=m5.ema200,
                stop_loss_timeframe="M5",
                entry_threshold=entry_threshold,
                invalidation_price=invalidation_price,
            )

        first_contact = (
            previous_price > entry_threshold
            and current_price <= entry_threshold
        )

        if first_contact:
            return Strategy1Signal(
                direction=SignalDirection.BUY,
                status=SignalStatus.ENTRY,
                path=Strategy1EntryPath.PATH_A,
                reason=(
                    "Path A BUY entry: first valid M5 EMA21 "
                    "pullback-zone contact."
                ),
                current_price=current_price,
                ema21=m5.ema21,
                ema50=m5.ema50,
                ema200=m5.ema200,
                stop_loss_timeframe="M5",
                entry_threshold=entry_threshold,
                invalidation_price=invalidation_price,
            )

        return Strategy1Signal(
            direction=SignalDirection.BUY,
            status=SignalStatus.WAITING,
            path=Strategy1EntryPath.PATH_A,
            reason=(
                "Path A BUY conditions remain valid. Waiting for "
                "first M5 EMA21-zone contact."
            ),
            current_price=current_price,
            ema21=m5.ema21,
            ema50=m5.ema50,
            ema200=m5.ema200,
            stop_loss_timeframe="M5",
            entry_threshold=entry_threshold,
            invalidation_price=invalidation_price,
        )

    if direction == SignalDirection.SELL:
        setup_valid = (
            _bearish_trend(m15)
            and _bearish_macd(m15)
        )

        entry_threshold = (
            m5.ema21
            - entry_distance
        )

        invalidation_price = (
            m5.ema50
            + invalidation_distance
        )

        if not setup_valid:
            return Strategy1Signal(
                direction=SignalDirection.SELL,
                status=SignalStatus.NO_SETUP,
                path=Strategy1EntryPath.PATH_A,
                reason=(
                    "Path A SELL conditions are not currently valid."
                ),
                current_price=current_price,
                ema21=m5.ema21,
                ema50=m5.ema50,
                ema200=m5.ema200,
                stop_loss_timeframe="M5",
                entry_threshold=entry_threshold,
                invalidation_price=invalidation_price,
            )

        if current_price >= invalidation_price:
            return Strategy1Signal(
                direction=SignalDirection.SELL,
                status=SignalStatus.INVALIDATED,
                path=Strategy1EntryPath.PATH_A,
                reason=(
                    "Path A SELL setup invalidated because price "
                    "reached M5 EMA50 plus the configured buffer."
                ),
                current_price=current_price,
                ema21=m5.ema21,
                ema50=m5.ema50,
                ema200=m5.ema200,
                stop_loss_timeframe="M5",
                entry_threshold=entry_threshold,
                invalidation_price=invalidation_price,
            )

        if previous_price is None:
            return Strategy1Signal(
                direction=SignalDirection.SELL,
                status=SignalStatus.WAITING,
                path=Strategy1EntryPath.PATH_A,
                reason=(
                    "Path A SELL setup is valid. Waiting for "
                    "first live-price contact with M5 EMA21."
                ),
                current_price=current_price,
                ema21=m5.ema21,
                ema50=m5.ema50,
                ema200=m5.ema200,
                stop_loss_timeframe="M5",
                entry_threshold=entry_threshold,
                invalidation_price=invalidation_price,
            )

        first_contact = (
            previous_price < entry_threshold
            and current_price >= entry_threshold
        )

        if first_contact:
            return Strategy1Signal(
                direction=SignalDirection.SELL,
                status=SignalStatus.ENTRY,
                path=Strategy1EntryPath.PATH_A,
                reason=(
                    "Path A SELL entry: first valid M5 EMA21 "
                    "pullback-zone contact."
                ),
                current_price=current_price,
                ema21=m5.ema21,
                ema50=m5.ema50,
                ema200=m5.ema200,
                stop_loss_timeframe="M5",
                entry_threshold=entry_threshold,
                invalidation_price=invalidation_price,
            )

        return Strategy1Signal(
            direction=SignalDirection.SELL,
            status=SignalStatus.WAITING,
            path=Strategy1EntryPath.PATH_A,
            reason=(
                "Path A SELL conditions remain valid. Waiting for "
                "first M5 EMA21-zone contact."
            ),
            current_price=current_price,
            ema21=m5.ema21,
            ema50=m5.ema50,
            ema200=m5.ema200,
            stop_loss_timeframe="M5",
            entry_threshold=entry_threshold,
            invalidation_price=invalidation_price,
        )

    return Strategy1Signal(
        direction=SignalDirection.NONE,
        status=SignalStatus.NO_SETUP,
        path=Strategy1EntryPath.PATH_A,
        reason="Path A requires BUY or SELL direction.",
        current_price=current_price,
        ema21=m5.ema21,
        ema50=m5.ema50,
        ema200=m5.ema200,
        stop_loss_timeframe="M5",
    )



def evaluate_path_d_signal(
    *,
    m1: Strategy1IndicatorSnapshot,
    current_price: float,
    point: float,
    direction: SignalDirection,
) -> Strategy1Signal:
    """
    Evaluate Strategy 1 Path D.

    Path D is intentionally simple and independent.

    BUY:
        M1 EMA21 > EMA50 > EMA200
        EMA21 is rising versus the previous completed M1 candle
        live Ask is inside the EMA21 or EMA50 contact zone

    SELL:
        M1 EMA21 < EMA50 < EMA200
        EMA21 is falling versus the previous completed M1 candle
        live Bid is inside the EMA21 or EMA50 contact zone

    No MACD confirmation is used.
    No five-candle persistence requirement is used.

    EMA21 contact is checked before EMA50 contact.
    """

    _validate_market_inputs(
        current_price=current_price,
        point=point,
    )

    contact_distance = (
        STRATEGY_1.path_d_contact_zone_points
        * point
    )

    ema21_lower = m1.ema21 - contact_distance
    ema21_upper = m1.ema21 + contact_distance

    ema50_lower = m1.ema50 - contact_distance
    ema50_upper = m1.ema50 + contact_distance

    if direction == SignalDirection.BUY:
        setup_valid = (
            m1.ema21 > m1.ema50 > m1.ema200
            and m1.ema21 > m1.previous_ema21
        )

        if not setup_valid:
            return Strategy1Signal(
                direction=SignalDirection.BUY,
                status=SignalStatus.NO_SETUP,
                path=Strategy1EntryPath.PATH_D_M1_PULLBACK,
                reason=(
                    "Path D BUY conditions are not currently valid."
                ),
                current_price=current_price,
                ema21=m1.ema21,
                ema50=m1.ema50,
                ema200=m1.ema200,
                stop_loss_timeframe="M1",
            )

        if ema21_lower <= current_price <= ema21_upper:
            return Strategy1Signal(
                direction=SignalDirection.BUY,
                status=SignalStatus.ENTRY,
                path=Strategy1EntryPath.PATH_D_M1_PULLBACK,
                reason=(
                    "Path D BUY entry: live Ask contacted the "
                    "M1 EMA21 pullback zone."
                ),
                current_price=current_price,
                ema21=m1.ema21,
                ema50=m1.ema50,
                ema200=m1.ema200,
                stop_loss_timeframe="M1",
                entry_threshold=m1.ema21,
                path_d_contact_ema="EMA21",
            )

        if ema50_lower <= current_price <= ema50_upper:
            return Strategy1Signal(
                direction=SignalDirection.BUY,
                status=SignalStatus.ENTRY,
                path=Strategy1EntryPath.PATH_D_M1_PULLBACK,
                reason=(
                    "Path D BUY entry: live Ask contacted the "
                    "M1 EMA50 pullback zone."
                ),
                current_price=current_price,
                ema21=m1.ema21,
                ema50=m1.ema50,
                ema200=m1.ema200,
                stop_loss_timeframe="M1",
                entry_threshold=m1.ema50,
                path_d_contact_ema="EMA50",
            )

        return Strategy1Signal(
            direction=SignalDirection.BUY,
            status=SignalStatus.WAITING,
            path=Strategy1EntryPath.PATH_D_M1_PULLBACK,
            reason=(
                "Path D BUY trend is valid. Waiting for live Ask "
                "to contact M1 EMA21 or EMA50."
            ),
            current_price=current_price,
            ema21=m1.ema21,
            ema50=m1.ema50,
            ema200=m1.ema200,
            stop_loss_timeframe="M1",
        )

    if direction == SignalDirection.SELL:
        setup_valid = (
            m1.ema21 < m1.ema50 < m1.ema200
            and m1.ema21 < m1.previous_ema21
        )

        if not setup_valid:
            return Strategy1Signal(
                direction=SignalDirection.SELL,
                status=SignalStatus.NO_SETUP,
                path=Strategy1EntryPath.PATH_D_M1_PULLBACK,
                reason=(
                    "Path D SELL conditions are not currently valid."
                ),
                current_price=current_price,
                ema21=m1.ema21,
                ema50=m1.ema50,
                ema200=m1.ema200,
                stop_loss_timeframe="M1",
            )

        if ema21_lower <= current_price <= ema21_upper:
            return Strategy1Signal(
                direction=SignalDirection.SELL,
                status=SignalStatus.ENTRY,
                path=Strategy1EntryPath.PATH_D_M1_PULLBACK,
                reason=(
                    "Path D SELL entry: live Bid contacted the "
                    "M1 EMA21 pullback zone."
                ),
                current_price=current_price,
                ema21=m1.ema21,
                ema50=m1.ema50,
                ema200=m1.ema200,
                stop_loss_timeframe="M1",
                entry_threshold=m1.ema21,
                path_d_contact_ema="EMA21",
            )

        if ema50_lower <= current_price <= ema50_upper:
            return Strategy1Signal(
                direction=SignalDirection.SELL,
                status=SignalStatus.ENTRY,
                path=Strategy1EntryPath.PATH_D_M1_PULLBACK,
                reason=(
                    "Path D SELL entry: live Bid contacted the "
                    "M1 EMA50 pullback zone."
                ),
                current_price=current_price,
                ema21=m1.ema21,
                ema50=m1.ema50,
                ema200=m1.ema200,
                stop_loss_timeframe="M1",
                entry_threshold=m1.ema50,
                path_d_contact_ema="EMA50",
            )

        return Strategy1Signal(
            direction=SignalDirection.SELL,
            status=SignalStatus.WAITING,
            path=Strategy1EntryPath.PATH_D_M1_PULLBACK,
            reason=(
                "Path D SELL trend is valid. Waiting for live Bid "
                "to contact M1 EMA21 or EMA50."
            ),
            current_price=current_price,
            ema21=m1.ema21,
            ema50=m1.ema50,
            ema200=m1.ema200,
            stop_loss_timeframe="M1",
        )

    raise ValueError(
        "Path D direction must be BUY or SELL."
    )

def _confirmed_cross_direction(
    snapshot: Strategy1IndicatorSnapshot,
) -> SignalDirection:
    bullish_cross = (
        snapshot.previous_ema21
        <= snapshot.previous_ema200
        and snapshot.ema21
        > snapshot.ema200
    )

    if bullish_cross:
        return SignalDirection.BUY

    bearish_cross = (
        snapshot.previous_ema21
        >= snapshot.previous_ema200
        and snapshot.ema21
        < snapshot.ema200
    )

    if bearish_cross:
        return SignalDirection.SELL

    return SignalDirection.NONE


def _cross_area(
    *,
    snapshot: Strategy1IndicatorSnapshot,
    point: float,
) -> tuple[float, float]:
    """
    Build the live retest area.

    The raw area is the price space between EMA21 and EMA200.
    It is expanded on both sides by the configured broker-point
    tolerance.
    """

    tolerance = (
        STRATEGY_1.cross_retest_zone_points
        * point
    )

    raw_lower = min(
        snapshot.ema21,
        snapshot.ema200,
    )

    raw_upper = max(
        snapshot.ema21,
        snapshot.ema200,
    )

    return (
        raw_lower - tolerance,
        raw_upper + tolerance,
    )


def _price_moved_away(
    *,
    direction: SignalDirection,
    current_price: float,
    lower: float,
    upper: float,
    point: float,
) -> bool:
    """
    Require price to leave the cross area directionally before
    a later return can qualify as a retest.
    """

    move_distance = (
        STRATEGY_1.cross_move_away_points
        * point
    )

    if direction == SignalDirection.BUY:
        return (
            current_price
            > upper + move_distance
        )

    if direction == SignalDirection.SELL:
        return (
            current_price
            < lower - move_distance
        )

    return False


def _price_inside_retest_area(
    *,
    current_price: float,
    lower: float,
    upper: float,
) -> bool:
    return (
        lower
        <= current_price
        <= upper
    )


def _timeframe_seconds(
    timeframe: str,
) -> int:
    """
    Return the exact Strategy 1 timeframe duration in seconds.

    Only the independent cross pathways call this function.
    """

    normalized = (
        timeframe
        .strip()
        .upper()
    )

    if normalized == "M1":
        return 60

    if normalized == "M5":
        return 300

    raise ValueError(
        "Cross/retest timeframe must be M1 or M5."
    )


def _completed_candles_since(
    *,
    previous_completed_at: datetime,
    current_completed_at: datetime,
    timeframe: str,
) -> int:
    """
    Count how many complete timeframe intervals occurred between
    two completed-candle timestamps.

    This is intentionally timestamp-based rather than worker-poll-based.

    Example:
        M1 last observed candle = 10:00
        next worker observation = 10:03

        elapsed completed candles = 3

    Therefore a temporary worker delay cannot accidentally extend a
    10-candle cross setup.
    """

    if current_completed_at <= previous_completed_at:
        return 0

    timeframe_seconds = _timeframe_seconds(
        timeframe
    )

    elapsed_seconds = (
        current_completed_at
        - previous_completed_at
    ).total_seconds()

    if elapsed_seconds <= 0:
        return 0

    return int(
        elapsed_seconds
        // timeframe_seconds
    )


def _cross_signal(
    *,
    direction: SignalDirection,
    status: SignalStatus,
    path: Strategy1EntryPath,
    reason: str,
    current_price: float,
    snapshot: Strategy1IndicatorSnapshot,
    timeframe: str,
    lower: float,
    upper: float,
) -> Strategy1Signal:
    return Strategy1Signal(
        direction=direction,
        status=status,
        path=path,
        reason=reason,
        current_price=current_price,
        ema21=snapshot.ema21,
        ema50=snapshot.ema50,
        ema200=snapshot.ema200,
        stop_loss_timeframe=timeframe,
        retest_lower=lower,
        retest_upper=upper,
    )


def evaluate_cross_retest_path(
    *,
    snapshot: Strategy1IndicatorSnapshot,
    completed_at: datetime,
    current_price: float,
    point: float,
    timeframe: str,
    path: Strategy1EntryPath,
    state: CrossRetestState | None,
) -> CrossRetestEvaluation:
    """
    Evaluate one independent EMA21/EMA200 cross-retest pathway.

    The caller supplies:
        M1 snapshot + M1 time + Path B
    or:
        M5 snapshot + M5 time + Path C

    Rules:
    - cross must be confirmed using completed candles
    - price must first move away
    - price must then return to the EMA21/EMA200 area
    - setup expires after configured number of completed candles
    - a reverse crossover invalidates/replaces the previous direction
    - successful entry consumes the pending state
    """

    _validate_market_inputs(
        current_price=current_price,
        point=point,
    )

    normalized_timeframe = (
        timeframe
        .strip()
        .upper()
    )

    if normalized_timeframe not in {
        "M1",
        "M5",
    }:
        raise ValueError(
            "Cross/retest timeframe must be M1 or M5."
        )

    if path not in {
        Strategy1EntryPath.PATH_B_M1_CROSS,
        Strategy1EntryPath.PATH_C_M5_CROSS,
    }:
        raise ValueError(
            "Cross/retest evaluator requires Path B or Path C."
        )

    if (
        path
        == Strategy1EntryPath.PATH_B_M1_CROSS
        and normalized_timeframe != "M1"
    ):
        raise ValueError(
            "Path B must use M1."
        )

    if (
        path
        == Strategy1EntryPath.PATH_C_M5_CROSS
        and normalized_timeframe != "M5"
    ):
        raise ValueError(
            "Path C must use M5."
        )

    lower, upper = _cross_area(
        snapshot=snapshot,
        point=point,
    )

    cross_direction = (
        _confirmed_cross_direction(
            snapshot
        )
    )

    # ---------------------------------------------------------
    # NO EXISTING RUNTIME SETUP
    # ---------------------------------------------------------
    if state is None:
        if (
            cross_direction
            == SignalDirection.NONE
        ):
            return CrossRetestEvaluation(
                signal=_cross_signal(
                    direction=SignalDirection.NONE,
                    status=SignalStatus.NO_SETUP,
                    path=path,
                    reason=(
                        f"{normalized_timeframe} has no newly "
                        "confirmed EMA21/EMA200 cross."
                    ),
                    current_price=current_price,
                    snapshot=snapshot,
                    timeframe=normalized_timeframe,
                    lower=lower,
                    upper=upper,
                ),
                state=None,
            )

        moved_away = _price_moved_away(
            direction=cross_direction,
            current_price=current_price,
            lower=lower,
            upper=upper,
            point=point,
        )

        new_state = CrossRetestState(
            direction=cross_direction,
            cross_completed_at=completed_at,
            last_completed_at=completed_at,
            completed_candles_elapsed=0,
            moved_away=moved_away,
        )

        return CrossRetestEvaluation(
            signal=_cross_signal(
                direction=cross_direction,
                status=SignalStatus.WAITING,
                path=path,
                reason=(
                    f"{normalized_timeframe} EMA21/EMA200 "
                    "cross confirmed. "
                    + (
                        "Price has moved away; waiting for retest."
                        if moved_away
                        else "Waiting for price to move away before retest."
                    )
                ),
                current_price=current_price,
                snapshot=snapshot,
                timeframe=normalized_timeframe,
                lower=lower,
                upper=upper,
            ),
            state=new_state,
        )

    # ---------------------------------------------------------
    # AGE THE ACTIVE SETUP USING ACTUAL COMPLETED CANDLES
    # ---------------------------------------------------------
    newly_elapsed = _completed_candles_since(
        previous_completed_at=(
            state.last_completed_at
        ),
        current_completed_at=completed_at,
        timeframe=normalized_timeframe,
    )

    completed_candles_elapsed = (
        state.completed_candles_elapsed
        + newly_elapsed
    )

    updated_last_completed_at = (
        completed_at
        if completed_at > state.last_completed_at
        else state.last_completed_at
    )

    # ---------------------------------------------------------
    # OPPOSITE / NEW CROSS
    #
    # A genuine new cross becomes the newest independent setup.
    # This also cancels the previous direction immediately.
    # ---------------------------------------------------------
    if (
        cross_direction
        != SignalDirection.NONE
        and (
            cross_direction
            != state.direction
            or completed_at
            > state.cross_completed_at
        )
    ):
        moved_away = _price_moved_away(
            direction=cross_direction,
            current_price=current_price,
            lower=lower,
            upper=upper,
            point=point,
        )

        replacement_state = (
            CrossRetestState(
                direction=cross_direction,
                cross_completed_at=completed_at,
                last_completed_at=completed_at,
                completed_candles_elapsed=0,
                moved_away=moved_away,
            )
        )

        return CrossRetestEvaluation(
            signal=_cross_signal(
                direction=cross_direction,
                status=SignalStatus.WAITING,
                path=path,
                reason=(
                    f"New {normalized_timeframe} "
                    "EMA21/EMA200 cross replaced the previous "
                    "pending cross setup."
                ),
                current_price=current_price,
                snapshot=snapshot,
                timeframe=normalized_timeframe,
                lower=lower,
                upper=upper,
            ),
            state=replacement_state,
        )

    # ---------------------------------------------------------
    # EXPIRY
    # ---------------------------------------------------------
    if (
        completed_candles_elapsed
        >= STRATEGY_1.cross_setup_expiry_candles
    ):
        return CrossRetestEvaluation(
            signal=_cross_signal(
                direction=state.direction,
                status=SignalStatus.INVALIDATED,
                path=path,
                reason=(
                    f"{normalized_timeframe} cross/retest setup "
                    f"expired after "
                    f"{completed_candles_elapsed} completed candles."
                ),
                current_price=current_price,
                snapshot=snapshot,
                timeframe=normalized_timeframe,
                lower=lower,
                upper=upper,
            ),
            state=None,
        )

    moved_away = state.moved_away

    # ---------------------------------------------------------
    # WAITING FOR MOVE-AWAY
    # ---------------------------------------------------------
    if not moved_away:
        moved_away = _price_moved_away(
            direction=state.direction,
            current_price=current_price,
            lower=lower,
            upper=upper,
            point=point,
        )

        updated_state = CrossRetestState(
            direction=state.direction,
            cross_completed_at=(
                state.cross_completed_at
            ),
            last_completed_at=(
                updated_last_completed_at
            ),
            completed_candles_elapsed=(
                completed_candles_elapsed
            ),
            moved_away=moved_away,
        )

        return CrossRetestEvaluation(
            signal=_cross_signal(
                direction=state.direction,
                status=SignalStatus.WAITING,
                path=path,
                reason=(
                    (
                        f"{normalized_timeframe} cross setup "
                        "has moved away. Waiting for retest."
                    )
                    if moved_away
                    else (
                        f"{normalized_timeframe} cross setup is "
                        "waiting for price to move away."
                    )
                ),
                current_price=current_price,
                snapshot=snapshot,
                timeframe=normalized_timeframe,
                lower=lower,
                upper=upper,
            ),
            state=updated_state,
        )

    # ---------------------------------------------------------
    # RETEST AFTER MOVE-AWAY
    # ---------------------------------------------------------
    retest = _price_inside_retest_area(
        current_price=current_price,
        lower=lower,
        upper=upper,
    )

    if retest:
        return CrossRetestEvaluation(
            signal=_cross_signal(
                direction=state.direction,
                status=SignalStatus.ENTRY,
                path=path,
                reason=(
                    f"{normalized_timeframe} EMA21/EMA200 "
                    "cross-retest entry confirmed after valid "
                    "move-away."
                ),
                current_price=current_price,
                snapshot=snapshot,
                timeframe=normalized_timeframe,
                lower=lower,
                upper=upper,
            ),
            state=None,
        )

    updated_state = CrossRetestState(
        direction=state.direction,
        cross_completed_at=(
            state.cross_completed_at
        ),
        last_completed_at=(
            updated_last_completed_at
        ),
        completed_candles_elapsed=(
            completed_candles_elapsed
        ),
        moved_away=True,
    )

    return CrossRetestEvaluation(
        signal=_cross_signal(
            direction=state.direction,
            status=SignalStatus.WAITING,
            path=path,
            reason=(
                f"{normalized_timeframe} cross setup has moved "
                "away and is waiting for retest."
            ),
            current_price=current_price,
            snapshot=snapshot,
            timeframe=normalized_timeframe,
            lower=lower,
            upper=upper,
        ),
        state=updated_state,
    )