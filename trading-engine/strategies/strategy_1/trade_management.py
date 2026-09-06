"""
TradeLogic - Strategy 1 Live Trade Management

Connects the Strategy 1 R-based position manager to MT5 execution.

Responsibilities:
- reconstruct Strategy 1 position state
- evaluate the current market price in R
- move SL/TP when a new ratchet level is reached
- close immediately when the hard 8R target is reached
- return the resulting management decision

This module does NOT:
- find entry signals
- open new positions
- calculate indicators
- calculate initial position size
- evaluate the circuit breaker
- decide subscription eligibility
"""

from __future__ import annotations

from dataclasses import dataclass

from execution.orders import (
    MT5ExecutionResult,
    OrderDirection,
    close_position,
    get_position,
    modify_position_protection,
)
from positions.manager import (
    PositionAction,
    PositionDecision,
    PositionDirection,
    PositionState,
    apply_position_decision,
    evaluate_position,
)


class Strategy1TradeManagementError(RuntimeError):
    """Raised when an open Strategy 1 position cannot be managed safely."""


@dataclass(frozen=True)
class Strategy1ManagementResult:
    position_ticket: int

    decision: PositionDecision

    updated_state: PositionState | None

    execution: MT5ExecutionResult | None


def _to_position_direction(
    direction: OrderDirection,
) -> PositionDirection:
    if direction == OrderDirection.BUY:
        return PositionDirection.BUY

    if direction == OrderDirection.SELL:
        return PositionDirection.SELL

    raise Strategy1TradeManagementError(
        "Unsupported MT5 position direction."
    )


def rebuild_position_state(
    *,
    position_ticket: int,
    original_entry_price: float,
    original_stop_loss: float,
    original_risk_distance: float,
    highest_r_reached: float,
) -> PositionState:
    """
    Reconstruct Strategy 1's persisted position-management state
    from the live MT5 position plus TradeLogic's stored original
    entry/risk information.

    The original entry price and original stop-loss must never be
    replaced by later trailing-stop values.
    """

    if original_entry_price <= 0:
        raise Strategy1TradeManagementError(
            "Original entry price must be greater than zero."
        )

    if original_stop_loss <= 0:
        raise Strategy1TradeManagementError(
            "Original stop-loss must be greater than zero."
        )

    if original_risk_distance <= 0:
        raise Strategy1TradeManagementError(
            "Original risk distance must be greater than zero."
        )

    if highest_r_reached < 0:
        highest_r_reached = 0.0

    live_position = get_position(
        position_ticket
    )

    return PositionState(
        direction=_to_position_direction(
            live_position.direction
        ),
        entry_price=original_entry_price,
        original_stop_loss=original_stop_loss,
        current_stop_loss=live_position.stop_loss,
        current_take_profit=live_position.take_profit,
        original_risk_distance=original_risk_distance,
        highest_r_reached=highest_r_reached,
    )


def manage_strategy_1_position(
    *,
    position_ticket: int,
    original_entry_price: float,
    original_stop_loss: float,
    original_risk_distance: float,
    highest_r_reached: float,
) -> Strategy1ManagementResult:
    """
    Evaluate and, when required, execute the next Strategy 1
    position-management action.

    HOLD:
        Nothing is sent to MT5.

    MODIFY:
        MT5 SL and TP are updated to the new ratchet level.

    CLOSE:
        Position is closed immediately at the hard 8R target.
    """

    live_position = get_position(
        position_ticket
    )

    state = PositionState(
        direction=_to_position_direction(
            live_position.direction
        ),
        entry_price=original_entry_price,
        original_stop_loss=original_stop_loss,
        current_stop_loss=live_position.stop_loss,
        current_take_profit=live_position.take_profit,
        original_risk_distance=original_risk_distance,
        highest_r_reached=max(
            highest_r_reached,
            0.0,
        ),
    )

    decision = evaluate_position(
        state=state,
        current_price=live_position.current_price,
    )

    # ---------------------------------------------------------
    # HOLD
    # ---------------------------------------------------------
    if decision.action == PositionAction.HOLD:
        updated_state = apply_position_decision(
            state=state,
            decision=decision,
        )

        return Strategy1ManagementResult(
            position_ticket=position_ticket,
            decision=decision,
            updated_state=updated_state,
            execution=None,
        )

    # ---------------------------------------------------------
    # MODIFY SL / TP
    # ---------------------------------------------------------
    if decision.action == PositionAction.MODIFY:
        if (
            decision.new_stop_loss is None
            or decision.new_take_profit is None
        ):
            raise Strategy1TradeManagementError(
                "MODIFY decision is missing the new SL or TP."
            )

        execution = modify_position_protection(
            position_ticket=position_ticket,
            stop_loss=decision.new_stop_loss,
            take_profit=decision.new_take_profit,
        )

        updated_state = apply_position_decision(
            state=state,
            decision=decision,
        )

        return Strategy1ManagementResult(
            position_ticket=position_ticket,
            decision=decision,
            updated_state=updated_state,
            execution=execution,
        )

    # ---------------------------------------------------------
    # HARD 8R CLOSE
    # ---------------------------------------------------------
    if decision.action == PositionAction.CLOSE:
        execution = close_position(
            position_ticket=position_ticket,
        )

        return Strategy1ManagementResult(
            position_ticket=position_ticket,
            decision=decision,
            updated_state=None,
            execution=execution,
        )

    raise Strategy1TradeManagementError(
        f"Unsupported Strategy 1 position action: "
        f"{decision.action}."
    )