"""
TradeLogic - Strategy 1 Trade Persistence Integration

Bridges successful Strategy 1 MT5 execution with TradeLogic's
Supabase worker repository.

Responsibilities:
- identify the authoritative live MT5 position after an order opens
- freeze Strategy 1 R from the actual broker open price
- reconcile the initial TP so it remains exactly 3R after slippage
- persist the trade row and live position row
- synchronize mutable live-position state
- finalize a closed trade and remove its live position row

This module does NOT:
- decide whether an entry signal exists
- calculate EMA/MACD indicators
- decide subscription eligibility
- evaluate the circuit breaker
- run the continuous worker loop
- query MT5 deal history for final realized P/L

Final close P/L, commission and swap must come from the worker's
MT5 close/deal-history layer and be passed into this module.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from execution.orders import (
    OrderDirection,
    modify_position_protection,
)
from execution.positions import (
    Strategy1OpenPosition,
    get_strategy_1_position_for_symbol,
)
from positions.manager import (
    PositionDirection,
    current_r_multiple,
    price_at_r,
)
from strategies.strategy_1.trade_opening import Strategy1OpenedTrade
from config.strategy_1 import STRATEGY_1
from worker_db.repository import (
    PersistedPositionRecord,
    WorkerRepository,
    WorkerRepositoryError,
)


class Strategy1TradePersistenceError(RuntimeError):
    """Raised when Strategy 1 persistence cannot be completed safely."""


@dataclass(frozen=True)
class PersistedOpenedStrategy1Trade:
    """Database identifiers and frozen state for one newly opened trade."""

    trade_id: UUID
    position_id: UUID

    mt5_position_ticket: int

    actual_entry_price: float
    original_stop_loss: float
    original_risk_distance: float
    original_risk_amount: float

    stop_loss: float
    take_profit: float


@dataclass(frozen=True)
class PersistedClosedStrategy1Trade:
    """Summary of a successfully finalized persisted trade."""

    trade_id: UUID
    position_id: UUID

    exit_price: float
    profit_loss: float
    realized_r: float
    close_reason: str



def _to_position_direction(
    direction: OrderDirection,
) -> PositionDirection:
    if direction == OrderDirection.BUY:
        return PositionDirection.BUY

    if direction == OrderDirection.SELL:
        return PositionDirection.SELL

    raise Strategy1TradePersistenceError(
        "Unsupported Strategy 1 position direction."
    )



def _validate_actual_position(
    *,
    opened_trade: Strategy1OpenedTrade,
    live_position: Strategy1OpenPosition,
) -> None:
    """Ensure the discovered MT5 position matches the executed plan."""

    plan = opened_trade.plan

    if live_position.ticket <= 0:
        raise Strategy1TradePersistenceError(
            "The discovered MT5 position has an invalid ticket."
        )

    if live_position.direction != plan.direction:
        raise Strategy1TradePersistenceError(
            "The discovered MT5 position direction does not match "
            "the Strategy 1 order direction."
        )

    if live_position.volume <= 0:
        raise Strategy1TradePersistenceError(
            "The discovered MT5 position volume must be greater than zero."
        )

    if live_position.open_price <= 0:
        raise Strategy1TradePersistenceError(
            "The discovered MT5 position open price must be greater than zero."
        )

    if plan.stop_loss_price <= 0:
        raise Strategy1TradePersistenceError(
            "The original Strategy 1 stop-loss must be greater than zero."
        )

    if plan.direction == OrderDirection.BUY:
        if plan.stop_loss_price >= live_position.open_price:
            raise Strategy1TradePersistenceError(
                "Actual BUY fill is not above the frozen original stop-loss."
            )

    elif plan.direction == OrderDirection.SELL:
        if plan.stop_loss_price <= live_position.open_price:
            raise Strategy1TradePersistenceError(
                "Actual SELL fill is not below the frozen original stop-loss."
            )



def _actual_risk_amount(
    *,
    opened_trade: Strategy1OpenedTrade,
    actual_risk_distance: float,
) -> float:
    """
    Convert the pre-execution monetary risk estimate to the actual fill.

    Lot size is fixed before order execution. If slippage changes the
    entry-to-SL distance, the actual monetary risk changes proportionally.
    """

    planned_distance = float(
        opened_trade.plan.original_risk_distance
    )

    planned_amount = float(
        opened_trade.plan.original_risk_amount
    )

    if planned_distance <= 0:
        raise Strategy1TradePersistenceError(
            "Planned original risk distance must be greater than zero."
        )

    if planned_amount <= 0:
        raise Strategy1TradePersistenceError(
            "Planned original risk amount must be greater than zero."
        )

    return planned_amount * (
        actual_risk_distance / planned_distance
    )



def _reconcile_initial_protection(
    *,
    live_position: Strategy1OpenPosition,
    original_stop_loss: float,
    actual_risk_distance: float,
) -> Strategy1OpenPosition:
    """
    Ensure the broker's initial TP is exactly 3R from the actual fill.

    The order is planned before MT5 fills it, so small slippage can make
    the pre-submitted TP differ from exactly 3R relative to the actual
    broker open price. We correct that immediately after the fill.
    """

    direction = _to_position_direction(
        live_position.direction
    )

    corrected_take_profit = price_at_r(
        direction=direction,
        entry_price=live_position.open_price,
        risk_distance=actual_risk_distance,
        r_multiple=STRATEGY_1.initial_take_profit_r,
    )

    execution = modify_position_protection(
        position_ticket=live_position.ticket,
        stop_loss=original_stop_loss,
        take_profit=corrected_take_profit,
    )

    if not execution.success:
        raise Strategy1TradePersistenceError(
            "MT5 did not confirm the corrected initial Strategy 1 "
            "stop-loss/take-profit protection."
        )

    refreshed = get_strategy_1_position_for_symbol(
        symbol=live_position.symbol
    )

    if refreshed is None:
        raise Strategy1TradePersistenceError(
            "The Strategy 1 position disappeared while reconciling "
            "its initial protection."
        )

    if refreshed.ticket != live_position.ticket:
        raise Strategy1TradePersistenceError(
            "The Strategy 1 position ticket changed unexpectedly during "
            "initial protection reconciliation."
        )

    return refreshed



def persist_opened_strategy_1_trade(
    *,
    repository: WorkerRepository,
    user_id: UUID | str,
    bot_instance_id: UUID | str,
    broker_account_id: UUID | str,
    opened_trade: Strategy1OpenedTrade,
    opened_at: datetime | None = None,
) -> PersistedOpenedStrategy1Trade:
    """
    Persist one successful Strategy 1 MT5 open.

    Sequence:
    1. Confirm the MT5 execution succeeded.
    2. Discover the authoritative live MT5 position for the symbol.
    3. Freeze R using the actual broker open price and original SL.
    4. Reconcile the broker TP to exactly 3R from that actual fill.
    5. Create the trades row.
    6. Create/upsert the live positions row.

    The repository intentionally remains persistence-only; MT5 discovery
    and fill reconciliation live here in this integration layer.
    """

    execution = opened_trade.execution
    plan = opened_trade.plan

    if not execution.success:
        raise Strategy1TradePersistenceError(
            "Cannot persist a Strategy 1 trade whose MT5 execution failed."
        )

    live_position = get_strategy_1_position_for_symbol(
        symbol=plan.symbol
    )

    if live_position is None:
        raise Strategy1TradePersistenceError(
            f"MT5 reported a successful open for '{plan.symbol}', but no "
            "matching live Strategy 1 position was found."
        )

    _validate_actual_position(
        opened_trade=opened_trade,
        live_position=live_position,
    )

    original_stop_loss = float(
        plan.stop_loss_price
    )

    actual_risk_distance = abs(
        live_position.open_price
        - original_stop_loss
    )

    if actual_risk_distance <= 0:
        raise Strategy1TradePersistenceError(
            "Actual Strategy 1 risk distance must be greater than zero."
        )

    actual_risk_amount = _actual_risk_amount(
        opened_trade=opened_trade,
        actual_risk_distance=actual_risk_distance,
    )

    live_position = _reconcile_initial_protection(
        live_position=live_position,
        original_stop_loss=original_stop_loss,
        actual_risk_distance=actual_risk_distance,
    )

    try:
        trade_id = repository.create_open_trade(
            user_id=user_id,
            bot_instance_id=bot_instance_id,
            broker_account_id=broker_account_id,
            mt5_ticket=live_position.ticket,
            symbol=plan.symbol,
            broker_symbol=live_position.symbol,
            trade_type=live_position.direction.value,
            lot_size=live_position.volume,
            entry_price=live_position.open_price,
            stop_loss=original_stop_loss,
            take_profit=live_position.take_profit,
            original_risk_amount=actual_risk_amount,
            strategy_name="strategy_1",
            opened_at=opened_at,
        )

        position_id = repository.create_position(
            user_id=user_id,
            bot_instance_id=bot_instance_id,
            broker_account_id=broker_account_id,
            trade_id=trade_id,
            mt5_position_ticket=live_position.ticket,
            symbol=plan.symbol,
            broker_symbol=live_position.symbol,
            position_type=live_position.direction.value,
            lot_size=live_position.volume,
            open_price=live_position.open_price,
            current_price=live_position.current_price,
            stop_loss=live_position.stop_loss,
            take_profit=live_position.take_profit,
            floating_profit_loss=live_position.profit,
            original_stop_loss=original_stop_loss,
            original_risk_distance=actual_risk_distance,
            original_risk_amount=actual_risk_amount,
            highest_r_reached=0.0,
            opened_at=opened_at,
        )

    except WorkerRepositoryError as exc:
        raise Strategy1TradePersistenceError(
            "MT5 position opened successfully, but TradeLogic could not "
            f"persist its trade/position state: {exc}"
        ) from exc

    return PersistedOpenedStrategy1Trade(
        trade_id=trade_id,
        position_id=position_id,
        mt5_position_ticket=live_position.ticket,
        actual_entry_price=live_position.open_price,
        original_stop_loss=original_stop_loss,
        original_risk_distance=actual_risk_distance,
        original_risk_amount=actual_risk_amount,
        stop_loss=live_position.stop_loss,
        take_profit=live_position.take_profit,
    )



def sync_persisted_strategy_1_position(
    *,
    repository: WorkerRepository,
    persisted: PersistedPositionRecord,
    highest_r_reached: Decimal | float | None = None,
) -> None:
    """Refresh mutable database state from the authoritative live MT5 position."""

    live_position = get_strategy_1_position_for_symbol(
        symbol=(
            persisted.broker_symbol
            or persisted.symbol
        )
    )

    if live_position is None:
        raise Strategy1TradePersistenceError(
            f"Persisted Strategy 1 position {persisted.mt5_position_ticket} "
            "is no longer open in MT5. It must be reconciled as a close "
            "before its database position row is removed."
        )

    if live_position.ticket != persisted.mt5_position_ticket:
        raise Strategy1TradePersistenceError(
            "The live MT5 position ticket does not match the persisted "
            "Strategy 1 position ticket."
        )

    try:
        repository.update_position_runtime_state(
            persisted.id,
            current_price=live_position.current_price,
            stop_loss=live_position.stop_loss,
            take_profit=live_position.take_profit,
            floating_profit_loss=live_position.profit,
            highest_r_reached=highest_r_reached,
        )
    except WorkerRepositoryError as exc:
        raise Strategy1TradePersistenceError(
            f"Unable to synchronize Strategy 1 position state: {exc}"
        ) from exc



def persist_closed_strategy_1_trade(
    *,
    repository: WorkerRepository,
    persisted: PersistedPositionRecord,
    exit_price: Decimal | float,
    profit_loss: Decimal | float,
    close_reason: str,
    commission: Decimal | float | None = None,
    swap: Decimal | float | None = None,
    closed_at: datetime | None = None,
) -> PersistedClosedStrategy1Trade:
    """
    Finalize a Strategy 1 trade after MT5 confirms the position is closed.

    The caller must provide the authoritative MT5 close/deal-history facts.
    This function intentionally does not guess final P/L from the last
    floating position snapshot.
    """

    if persisted.trade_id is None:
        raise Strategy1TradePersistenceError(
            "Cannot close persisted Strategy 1 position without trade_id."
        )

    if persisted.open_price is None:
        raise Strategy1TradePersistenceError(
            "Cannot calculate realized R without the original open price."
        )

    if persisted.original_risk_distance is None:
        raise Strategy1TradePersistenceError(
            "Cannot calculate realized R without original risk distance."
        )

    clean_reason = close_reason.strip()
    if not clean_reason:
        raise Strategy1TradePersistenceError(
            "Strategy 1 close reason is required."
        )

    exit_price_float = float(exit_price)
    entry_price_float = float(persisted.open_price)
    risk_distance_float = float(
        persisted.original_risk_distance
    )

    if exit_price_float <= 0:
        raise Strategy1TradePersistenceError(
            "Strategy 1 exit price must be greater than zero."
        )

    if risk_distance_float <= 0:
        raise Strategy1TradePersistenceError(
            "Strategy 1 original risk distance must be greater than zero."
        )

    try:
        direction = PositionDirection(
            persisted.position_type.lower()
        )
    except ValueError as exc:
        raise Strategy1TradePersistenceError(
            f"Unsupported persisted position type: {persisted.position_type}"
        ) from exc

    realized_r = current_r_multiple(
        direction=direction,
        entry_price=entry_price_float,
        current_price=exit_price_float,
        risk_distance=risk_distance_float,
    )

    try:
        repository.close_trade(
            persisted.trade_id,
            exit_price=exit_price,
            profit_loss=profit_loss,
            close_reason=clean_reason,
            realized_r=realized_r,
            commission=commission,
            swap=swap,
            closed_at=closed_at,
        )

        repository.delete_position(
            persisted.id
        )

    except WorkerRepositoryError as exc:
        raise Strategy1TradePersistenceError(
            f"Unable to finalize Strategy 1 trade persistence: {exc}"
        ) from exc

    return PersistedClosedStrategy1Trade(
        trade_id=persisted.trade_id,
        position_id=persisted.id,
        exit_price=exit_price_float,
        profit_loss=float(profit_loss),
        realized_r=realized_r,
        close_reason=clean_reason,
    )
