"""
TradeLogic - Strategy 1 Position Manager

Handles R-based trade management after a Strategy 1 trade is opened.

Rules:
- Initial TP = 3R
- At 2R  -> SL +1R, TP +4R
- At 3R  -> SL +2R, TP +5R
- At 4R  -> SL +3R, TP +6R
- At 5R  -> SL +4R, TP +7R
- At 6R  -> SL +5R, TP +8R
- At 7R  -> SL +6R, TP remains +8R
- At 8R  -> close immediately

R is frozen from the original trade risk at entry.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from config.strategy_1 import (
    RATCHET_RULES,
    STRATEGY_1,
)


class PositionDirection(str, Enum):
    BUY = "buy"
    SELL = "sell"


class PositionAction(str, Enum):
    HOLD = "hold"
    MODIFY = "modify"
    CLOSE = "close"


@dataclass(frozen=True)
class PositionState:
    direction: PositionDirection

    entry_price: float
    original_stop_loss: float
    current_stop_loss: float
    current_take_profit: float

    original_risk_distance: float
    highest_r_reached: float


@dataclass(frozen=True)
class PositionDecision:
    action: PositionAction

    current_r: float
    highest_r_reached: float

    new_stop_loss: float | None
    new_take_profit: float | None

    close_reason: str | None
    reason: str


def _validate_state(
    state: PositionState,
    current_price: float,
) -> None:
    if state.entry_price <= 0:
        raise ValueError("Entry price must be greater than zero.")

    if state.original_stop_loss <= 0:
        raise ValueError("Original stop-loss must be greater than zero.")

    if state.current_stop_loss <= 0:
        raise ValueError("Current stop-loss must be greater than zero.")

    if state.current_take_profit <= 0:
        raise ValueError("Current take-profit must be greater than zero.")

    if state.original_risk_distance <= 0:
        raise ValueError(
            "Original R distance must be greater than zero."
        )

    if current_price <= 0:
        raise ValueError(
            "Current market price must be greater than zero."
        )


def price_at_r(
    *,
    direction: PositionDirection,
    entry_price: float,
    risk_distance: float,
    r_multiple: float,
) -> float:
    """
    Convert an R level into an absolute market price.
    """
    if direction == PositionDirection.BUY:
        return entry_price + (
            risk_distance * r_multiple
        )

    return entry_price - (
        risk_distance * r_multiple
    )


def current_r_multiple(
    *,
    direction: PositionDirection,
    entry_price: float,
    current_price: float,
    risk_distance: float,
) -> float:
    """
    Calculate current floating profit/loss in R.
    """
    if risk_distance <= 0:
        raise ValueError(
            "Risk distance must be greater than zero."
        )

    if direction == PositionDirection.BUY:
        movement = current_price - entry_price
    else:
        movement = entry_price - current_price

    return movement / risk_distance


def create_initial_position_state(
    *,
    direction: PositionDirection,
    entry_price: float,
    stop_loss_price: float,
) -> PositionState:
    """
    Create the initial Strategy 1 position state.

    TP starts at 3R.
    """
    risk_distance = abs(
        entry_price - stop_loss_price
    )

    if risk_distance <= 0:
        raise ValueError(
            "Entry price and stop-loss cannot be equal."
        )

    take_profit = price_at_r(
        direction=direction,
        entry_price=entry_price,
        risk_distance=risk_distance,
        r_multiple=STRATEGY_1.initial_take_profit_r,
    )

    return PositionState(
        direction=direction,
        entry_price=entry_price,
        original_stop_loss=stop_loss_price,
        current_stop_loss=stop_loss_price,
        current_take_profit=take_profit,
        original_risk_distance=risk_distance,
        highest_r_reached=0.0,
    )


def evaluate_position(
    *,
    state: PositionState,
    current_price: float,
) -> PositionDecision:
    """
    Evaluate the current Strategy 1 position.

    The ratchet only moves forward.
    It never moves the stop-loss backward.
    """
    _validate_state(
        state,
        current_price,
    )

    current_r = current_r_multiple(
        direction=state.direction,
        entry_price=state.entry_price,
        current_price=current_price,
        risk_distance=state.original_risk_distance,
    )

    highest_r = max(
        state.highest_r_reached,
        current_r,
    )

    # ---------------------------------------------------------
    # HARD 8R EXIT
    # ---------------------------------------------------------
    if highest_r >= STRATEGY_1.hard_take_profit_r:
        return PositionDecision(
            action=PositionAction.CLOSE,
            current_r=current_r,
            highest_r_reached=highest_r,
            new_stop_loss=None,
            new_take_profit=None,
            close_reason="hard_8r_target",
            reason=(
                "Strategy 1 hard 8R profit target reached."
            ),
        )

    # ---------------------------------------------------------
    # FIND HIGHEST COMPLETED RATCHET LEVEL
    # ---------------------------------------------------------
    reached_level: int | None = None

    for trigger_r in sorted(
        RATCHET_RULES.keys(),
        reverse=True,
    ):
        if highest_r >= trigger_r:
            reached_level = trigger_r
            break

    if reached_level is None:
        return PositionDecision(
            action=PositionAction.HOLD,
            current_r=current_r,
            highest_r_reached=highest_r,
            new_stop_loss=None,
            new_take_profit=None,
            close_reason=None,
            reason=(
                "No new Strategy 1 ratchet level reached."
            ),
        )

    stop_r, take_profit_r = (
        RATCHET_RULES[reached_level]
    )

    desired_stop = price_at_r(
        direction=state.direction,
        entry_price=state.entry_price,
        risk_distance=state.original_risk_distance,
        r_multiple=stop_r,
    )

    desired_take_profit = price_at_r(
        direction=state.direction,
        entry_price=state.entry_price,
        risk_distance=state.original_risk_distance,
        r_multiple=take_profit_r,
    )

    # ---------------------------------------------------------
    # DO NOT RE-APPLY SAME OR OLDER RATCHET
    # ---------------------------------------------------------
    if state.direction == PositionDirection.BUY:
        stop_improved = (
            desired_stop > state.current_stop_loss
        )

        tp_changed = (
            desired_take_profit
            != state.current_take_profit
        )

    else:
        stop_improved = (
            desired_stop < state.current_stop_loss
        )

        tp_changed = (
            desired_take_profit
            != state.current_take_profit
        )

    if not stop_improved and not tp_changed:
        return PositionDecision(
            action=PositionAction.HOLD,
            current_r=current_r,
            highest_r_reached=highest_r,
            new_stop_loss=None,
            new_take_profit=None,
            close_reason=None,
            reason=(
                "Current position already reflects the "
                "highest reached Strategy 1 ratchet level."
            ),
        )

    return PositionDecision(
        action=PositionAction.MODIFY,
        current_r=current_r,
        highest_r_reached=highest_r,
        new_stop_loss=desired_stop,
        new_take_profit=desired_take_profit,
        close_reason=None,
        reason=(
            f"Strategy 1 reached {reached_level}R: "
            f"move SL to +{stop_r}R and "
            f"TP to +{take_profit_r}R."
        ),
    )


def apply_position_decision(
    *,
    state: PositionState,
    decision: PositionDecision,
) -> PositionState:
    """
    Produce the updated persisted state after applying a HOLD or
    MODIFY decision.

    CLOSE decisions should be handled by the execution layer.
    """
    if decision.action == PositionAction.CLOSE:
        raise ValueError(
            "A closed position cannot be converted into "
            "another active PositionState."
        )

    return PositionState(
        direction=state.direction,
        entry_price=state.entry_price,
        original_stop_loss=state.original_stop_loss,
        current_stop_loss=(
            decision.new_stop_loss
            if decision.new_stop_loss is not None
            else state.current_stop_loss
        ),
        current_take_profit=(
            decision.new_take_profit
            if decision.new_take_profit is not None
            else state.current_take_profit
        ),
        original_risk_distance=state.original_risk_distance,
        highest_r_reached=decision.highest_r_reached,
    )