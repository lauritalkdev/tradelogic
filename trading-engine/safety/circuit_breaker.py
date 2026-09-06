"""
TradeLogic - Strategy 1 Circuit Breaker

Strategy 1 safety rule:

- Count genuine losing stop-loss exits across XAUUSD and EURUSD.
- 3 qualifying losses inside a rolling 6-hour window
  pause NEW Strategy 1 entries.
- Pause lasts 12 hours.
- Existing open positions continue to be managed.
- Profitable trailing-stop exits do NOT count as losses.
- The circuit breaker resumes automatically after the pause expires.

This module contains safety-state logic only.
It does NOT place or close trades.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Sequence

from config.strategy_1 import STRATEGY_1


class ExitReason(str, Enum):
    """
    Standard Strategy 1 trade exit classifications.
    """

    STOP_LOSS = "stop_loss"
    TRAILING_PROFIT = "trailing_profit"
    TAKE_PROFIT = "take_profit"
    HARD_8R_TARGET = "hard_8r_target"
    MANUAL = "manual"
    OTHER = "other"


@dataclass(frozen=True)
class TradeExitEvent:
    """
    A completed Strategy 1 trade.

    realized_r:
        Negative value = losing trade
        Positive value = profitable trade
        0 = break-even
    """

    symbol: str
    closed_at: datetime
    realized_r: float
    exit_reason: ExitReason


@dataclass(frozen=True)
class CircuitBreakerDecision:
    """
    Current Strategy 1 circuit-breaker state.
    """

    entries_allowed: bool
    is_paused: bool

    qualifying_losses_in_window: int

    window_start: datetime
    window_end: datetime

    triggered_at: datetime | None
    paused_until: datetime | None

    reason: str


def _ensure_utc(value: datetime) -> datetime:
    """
    Require timezone-aware datetimes and normalize them to UTC.
    """
    if value.tzinfo is None:
        raise ValueError(
            "Circuit breaker datetimes must be timezone-aware."
        )

    return value.astimezone(timezone.utc)


def is_qualifying_loss(
    event: TradeExitEvent,
) -> bool:
    """
    Return True only for a genuine negative stop-loss exit.

    Examples that DO count:
        STOP_LOSS with -1R
        STOP_LOSS with -0.8R

    Examples that DO NOT count:
        trailing stop closed at +1R
        take-profit closure
        8R hard target
        break-even stop
        manual profitable closure
    """
    return (
        event.exit_reason == ExitReason.STOP_LOSS
        and event.realized_r < 0
    )


def evaluate_circuit_breaker(
    *,
    exit_events: Sequence[TradeExitEvent],
    now: datetime,
    existing_paused_until: datetime | None = None,
) -> CircuitBreakerDecision:
    """
    Evaluate whether Strategy 1 may open new positions.

    If an existing pause is still active, it remains authoritative.
    New losses do not continually push that existing pause forward.

    Once the pause expires, new qualifying losses are evaluated
    using the rolling six-hour window.
    """

    now_utc = _ensure_utc(now)

    window_duration = timedelta(
        hours=STRATEGY_1.circuit_breaker_window_hours
    )

    pause_duration = timedelta(
        hours=STRATEGY_1.circuit_breaker_pause_hours
    )

    window_start = now_utc - window_duration

    # ---------------------------------------------------------
    # EXISTING ACTIVE PAUSE
    # ---------------------------------------------------------
    if existing_paused_until is not None:
        paused_until_utc = _ensure_utc(
            existing_paused_until
        )

        if now_utc < paused_until_utc:
            qualifying_during_window = [
                event
                for event in exit_events
                if (
                    is_qualifying_loss(event)
                    and window_start
                    <= _ensure_utc(event.closed_at)
                    <= now_utc
                )
            ]

            return CircuitBreakerDecision(
                entries_allowed=False,
                is_paused=True,
                qualifying_losses_in_window=len(
                    qualifying_during_window
                ),
                window_start=window_start,
                window_end=now_utc,
                triggered_at=None,
                paused_until=paused_until_utc,
                reason=(
                    "Strategy 1 circuit breaker is already active. "
                    "Existing positions may continue to be managed, "
                    "but no new entries are allowed."
                ),
            )

    # ---------------------------------------------------------
    # QUALIFYING LOSSES INSIDE CURRENT 6-HOUR WINDOW
    # ---------------------------------------------------------
    qualifying_losses = sorted(
        (
            event
            for event in exit_events
            if (
                is_qualifying_loss(event)
                and window_start
                <= _ensure_utc(event.closed_at)
                <= now_utc
            )
        ),
        key=lambda event: _ensure_utc(event.closed_at),
    )

    loss_count = len(qualifying_losses)

    required_losses = (
        STRATEGY_1.circuit_breaker_loss_count
    )

    if loss_count >= required_losses:
        # The breaker is triggered at the event that completed
        # the required loss count.
        trigger_event = qualifying_losses[
            required_losses - 1
        ]

        triggered_at = _ensure_utc(
            trigger_event.closed_at
        )

        paused_until = (
            triggered_at + pause_duration
        )

        # If for any reason historical data is evaluated after
        # the calculated pause has already expired, trading may
        # resume rather than reactivating an old pause.
        if now_utc >= paused_until:
            return CircuitBreakerDecision(
                entries_allowed=True,
                is_paused=False,
                qualifying_losses_in_window=loss_count,
                window_start=window_start,
                window_end=now_utc,
                triggered_at=triggered_at,
                paused_until=paused_until,
                reason=(
                    "A historical circuit-breaker condition was "
                    "found, but its 12-hour pause has expired."
                ),
            )

        return CircuitBreakerDecision(
            entries_allowed=False,
            is_paused=True,
            qualifying_losses_in_window=loss_count,
            window_start=window_start,
            window_end=now_utc,
            triggered_at=triggered_at,
            paused_until=paused_until,
            reason=(
                f"Strategy 1 paused after {required_losses} "
                f"genuine losing stop-loss exits inside the "
                f"{STRATEGY_1.circuit_breaker_window_hours}-hour "
                f"rolling window."
            ),
        )

    # ---------------------------------------------------------
    # NORMAL TRADING
    # ---------------------------------------------------------
    return CircuitBreakerDecision(
        entries_allowed=True,
        is_paused=False,
        qualifying_losses_in_window=loss_count,
        window_start=window_start,
        window_end=now_utc,
        triggered_at=None,
        paused_until=None,
        reason=(
            "Strategy 1 circuit breaker is clear. "
            "New entries are allowed."
        ),
    )