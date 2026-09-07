"""
TradeLogic - Continuous Trading Worker

This is the long-running bridge between TradeLogic's Supabase control plane
and the already-built Strategy 1 / MetaTrader 5 trading engine.

One worker process currently owns ONE MT5 account context at a time because
the MetaTrader5 Python module is process-global. Production scaling to many
customers must therefore launch isolated worker/terminal processes rather
than time-sharing multiple live customer accounts inside this process.

Responsibilities:
- identify this worker from TRADING_WORKER_ID
- send worker heartbeats to Supabase
- load the bot assigned to this worker
- process pending broker connect/verify/disconnect commands
- maintain the expected MT5 account session
- enforce subscription trading eligibility
- honor bot START / STOP runtime states
- recover Strategy 1 circuit-breaker state from persisted closed trades
- manage already-open persisted Strategy 1 positions
- reconcile naturally or programmatically closed MT5 positions
- evaluate XAUUSD / EURUSD Strategy 1 entry cycles
- persist newly opened trades and live position state
- repeat continuously with guarded error handling

This module deliberately does NOT:
- expose broker credentials
- run in the browser / Next.js process
- make strategy decisions outside Strategy 1
- guess final MT5 P/L from floating position values
"""

from __future__ import annotations

import os
import signal
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Iterable
from uuid import UUID

from config.strategy_1 import STRATEGY_1
from execution.orders import MT5ExecutionError
from execution.positions import get_strategy_1_position_for_symbol
from mt5.account import MT5AccountSnapshot
from mt5.history import (
    MT5ClosedPositionSummary,
    MT5HistoryError,
    get_closed_position_summary,
)
from mt5.session import (
    MT5SessionError,
    MT5SessionManager,
    MT5SessionSpec,
    get_mt5_session_manager,
)
from safety.circuit_breaker import (
    CircuitBreakerDecision,
    ExitReason,
    TradeExitEvent,
    evaluate_circuit_breaker,
    is_qualifying_loss,
)
from strategies.strategy_1.orchestrator import (
    PersistedStrategy1Position,
    PreviousLivePrices,
    Strategy1OrchestratorError,
    evaluate_strategy_1_entry_cycle,
    manage_persisted_strategy_1_position,
)
from worker_db.broker_command_handler import (
    BrokerCommandHandlerError,
    process_broker_command,
)
from worker_db.repository import (
    AssignedBotRecord,
    BrokerAccountRecord,
    ClosedTradeRecord,
    PersistedPositionRecord,
    WorkerRepository,
    WorkerRepositoryError,
)
from worker_db.trade_persistence import (
    Strategy1TradePersistenceError,
    persist_closed_strategy_1_trade,
    persist_opened_strategy_1_trade,
    sync_persisted_strategy_1_position,
)


class TradingWorkerError(RuntimeError):
    """Raised when the continuous TradeLogic worker cannot proceed safely."""


@dataclass(frozen=True)
class WorkerSettings:
    worker_id: UUID
    poll_interval_seconds: float = 2.0
    heartbeat_interval_seconds: float = 30.0
    terminal_path: str | None = None


@dataclass
class WorkerRuntimeState:
    previous_prices: dict[tuple[UUID, str], PreviousLivePrices] = field(
        default_factory=dict
    )
    last_heartbeat_monotonic: float = 0.0
    stopping: bool = False


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()

    if not value:
        raise TradingWorkerError(
            f"Required environment variable {name} is missing."
        )

    return value


def _positive_float_env(
    name: str,
    default: float,
) -> float:
    raw = os.getenv(name, "").strip()

    if not raw:
        return default

    try:
        value = float(raw)
    except ValueError as exc:
        raise TradingWorkerError(
            f"{name} must be a number."
        ) from exc

    if value <= 0:
        raise TradingWorkerError(
            f"{name} must be greater than zero."
        )

    return value


def load_worker_settings() -> WorkerSettings:
    try:
        worker_id = UUID(
            _required_env("TRADING_WORKER_ID")
        )
    except ValueError as exc:
        raise TradingWorkerError(
            "TRADING_WORKER_ID must be a valid UUID."
        ) from exc

    terminal_path = os.getenv(
        "MT5_TERMINAL_PATH",
        "",
    ).strip() or None

    return WorkerSettings(
        worker_id=worker_id,
        poll_interval_seconds=_positive_float_env(
            "TRADING_WORKER_POLL_SECONDS",
            2.0,
        ),
        heartbeat_interval_seconds=_positive_float_env(
            "TRADING_WORKER_HEARTBEAT_SECONDS",
            30.0,
        ),
        terminal_path=terminal_path,
    )


def _build_session_spec(
    *,
    broker: BrokerAccountRecord,
    terminal_path: str | None,
) -> MT5SessionSpec:
    return MT5SessionSpec(
        broker_account_id=broker.id,
        mt5_login=broker.mt5_login,
        mt5_server=broker.mt5_server,
        encrypted_password=broker.mt5_password_encrypted,
        terminal_path=terminal_path,
    )


def _normalize_reason(
    raw_reason: str | None,
) -> ExitReason:
    value = (
        raw_reason or ""
    ).strip().lower()

    mappings = {
        "stop_loss": ExitReason.STOP_LOSS,
        "trailing_profit": ExitReason.TRAILING_PROFIT,
        "take_profit": ExitReason.TAKE_PROFIT,
        "hard_8r_target": ExitReason.HARD_8R_TARGET,
        "manual": ExitReason.MANUAL,
        "manual_client": ExitReason.MANUAL,
        "manual_mobile": ExitReason.MANUAL,
        "manual_web": ExitReason.MANUAL,
    }

    return mappings.get(
        value,
        ExitReason.OTHER,
    )


def _closed_trade_to_exit_event(
    trade: ClosedTradeRecord,
) -> TradeExitEvent | None:
    if (
        trade.closed_at is None
        or trade.realized_r is None
    ):
        return None

    return TradeExitEvent(
        symbol=trade.symbol,
        closed_at=trade.closed_at,
        realized_r=float(trade.realized_r),
        exit_reason=_normalize_reason(
            trade.close_reason
        ),
    )


def _recent_exit_events(
    records: Iterable[ClosedTradeRecord],
) -> list[TradeExitEvent]:
    events: list[TradeExitEvent] = []

    for record in records:
        event = _closed_trade_to_exit_event(
            record
        )

        if event is not None:
            events.append(event)

    return sorted(
        events,
        key=lambda event: event.closed_at,
    )


def _recover_active_pause_until(
    *,
    exit_events: list[TradeExitEvent],
    now: datetime,
) -> datetime | None:
    """
    Recover an active Strategy 1 pause after worker restart.

    The normal circuit breaker needs existing_paused_until to preserve a
    12-hour pause even after the triggering losses have left the current
    rolling 6-hour window.

    We therefore search persisted qualifying losses for the EARLIEST trigger
    whose 12-hour pause is still active. Choosing the earliest active trigger
    prevents later losses occurring during that same pause from extending it.
    """

    now_utc = now.astimezone(timezone.utc)

    window = timedelta(
        hours=STRATEGY_1.circuit_breaker_window_hours
    )
    pause = timedelta(
        hours=STRATEGY_1.circuit_breaker_pause_hours
    )
    required = int(
        STRATEGY_1.circuit_breaker_loss_count
    )

    losses = sorted(
        (
            event
            for event in exit_events
            if is_qualifying_loss(event)
        ),
        key=lambda event: event.closed_at,
    )

    active_candidates: list[datetime] = []

    for index, event in enumerate(losses):
        event_time = event.closed_at.astimezone(
            timezone.utc
        )

        window_start = event_time - window

        losses_in_window = [
            candidate
            for candidate in losses[: index + 1]
            if (
                window_start
                <= candidate.closed_at.astimezone(timezone.utc)
                <= event_time
            )
        ]

        if len(losses_in_window) < required:
            continue

        trigger_time = event_time
        paused_until = trigger_time + pause

        if now_utc < paused_until:
            active_candidates.append(
                paused_until
            )

    if not active_candidates:
        return None

    return min(
        active_candidates
    )


def _load_circuit_breaker(
    *,
    repository: WorkerRepository,
    bot: AssignedBotRecord,
    now: datetime,
) -> tuple[list[TradeExitEvent], datetime | None, CircuitBreakerDecision]:
    # 6-hour trigger window + 12-hour pause = 18 hours of history is enough
    # to reconstruct any currently-active pause.
    since = now - timedelta(
        hours=(
            STRATEGY_1.circuit_breaker_window_hours
            + STRATEGY_1.circuit_breaker_pause_hours
        )
    )

    closed_trades = repository.get_recent_closed_trades(
        bot.id,
        since=since,
        strategy_name="strategy_1",
    )

    events = _recent_exit_events(
        closed_trades
    )

    paused_until = _recover_active_pause_until(
        exit_events=events,
        now=now,
    )

    decision = evaluate_circuit_breaker(
        exit_events=events,
        now=now,
        existing_paused_until=paused_until,
    )

    return events, paused_until, decision


def _validate_persisted_position(
    persisted: PersistedPositionRecord,
) -> None:
    if persisted.open_price is None:
        raise TradingWorkerError(
            f"Persisted position {persisted.id} is missing open_price."
        )

    if persisted.original_stop_loss is None:
        raise TradingWorkerError(
            f"Persisted position {persisted.id} is missing original_stop_loss."
        )

    if persisted.original_risk_distance is None:
        raise TradingWorkerError(
            f"Persisted position {persisted.id} is missing "
            "original_risk_distance."
        )


def _close_reason_from_management(
    raw_reason: object,
) -> str:
    if raw_reason is None:
        return "strategy_close"

    value = getattr(
        raw_reason,
        "value",
        raw_reason,
    )

    clean = str(value).strip().lower()

    return clean or "strategy_close"


def _finalize_closed_position(
    *,
    repository: WorkerRepository,
    persisted: PersistedPositionRecord,
    preferred_reason: str | None = None,
) -> MT5ClosedPositionSummary:
    history = get_closed_position_summary(
        persisted.mt5_position_ticket
    )

    close_reason = (
        preferred_reason.strip().lower()
        if preferred_reason
        and preferred_reason.strip()
        else history.close_reason
    )

    # The current database has commission and swap columns but no dedicated
    # fee column. MT5 fee is therefore folded into commission so broker costs
    # are not silently lost.
    commission_plus_fee = (
        history.commission
        + history.fee
    )

    persist_closed_strategy_1_trade(
        repository=repository,
        persisted=persisted,
        exit_price=history.exit_price,
        profit_loss=history.profit_loss,
        close_reason=close_reason,
        commission=commission_plus_fee,
        swap=history.swap,
        closed_at=history.closed_at,
    )

    return history


def _manage_one_persisted_position(
    *,
    repository: WorkerRepository,
    bot: AssignedBotRecord,
    persisted: PersistedPositionRecord,
) -> None:
    _validate_persisted_position(
        persisted
    )

    broker_symbol = (
        persisted.broker_symbol
        or persisted.symbol
    )

    live_position = get_strategy_1_position_for_symbol(
        broker_symbol
    )

    if live_position is None:
        history = _finalize_closed_position(
            repository=repository,
            persisted=persisted,
        )

        repository.record_execution_log(
            level="info",
            event_type="strategy_1_position_reconciled_closed",
            message=(
                f"Reconciled closed Strategy 1 position "
                f"{persisted.mt5_position_ticket} from MT5 deal history."
            ),
            user_id=bot.user_id,
            bot_instance_id=bot.id,
            broker_account_id=bot.broker_account_id,
            metadata={
                "symbol": persisted.symbol,
                "exit_price": history.exit_price,
                "profit_loss": history.profit_loss,
                "commission": history.commission,
                "swap": history.swap,
                "fee": history.fee,
                "close_reason": history.close_reason,
            },
        )
        return

    if live_position.ticket != persisted.mt5_position_ticket:
        raise TradingWorkerError(
            "Live Strategy 1 position ticket does not match persisted "
            f"ticket {persisted.mt5_position_ticket}."
        )

    result = manage_persisted_strategy_1_position(
        PersistedStrategy1Position(
            position_ticket=persisted.mt5_position_ticket,
            original_entry_price=float(
                persisted.open_price
            ),
            original_stop_loss=float(
                persisted.original_stop_loss
            ),
            original_risk_distance=float(
                persisted.original_risk_distance
            ),
            highest_r_reached=float(
                persisted.highest_r_reached
            ),
        )
    )

    action_value = str(
        getattr(
            result.decision.action,
            "value",
            result.decision.action,
        )
    ).strip().lower()

    if action_value == "close":
        preferred_reason = _close_reason_from_management(
            result.decision.close_reason
        )

        history = _finalize_closed_position(
            repository=repository,
            persisted=persisted,
            preferred_reason=preferred_reason,
        )

        repository.record_execution_log(
            level="info",
            event_type="strategy_1_position_closed",
            message=(
                f"Strategy 1 position {persisted.mt5_position_ticket} "
                "closed and persisted from MT5 deal history."
            ),
            user_id=bot.user_id,
            bot_instance_id=bot.id,
            broker_account_id=bot.broker_account_id,
            metadata={
                "symbol": persisted.symbol,
                "close_reason": preferred_reason,
                "exit_price": history.exit_price,
                "profit_loss": history.profit_loss,
                "commission": history.commission,
                "swap": history.swap,
                "fee": history.fee,
            },
        )
        return

    highest_r = (
        result.updated_state.highest_r_reached
        if result.updated_state is not None
        else result.decision.highest_r_reached
    )

    sync_persisted_strategy_1_position(
        repository=repository,
        persisted=persisted,
        highest_r_reached=highest_r,
    )


def _manage_existing_positions(
    *,
    repository: WorkerRepository,
    bot: AssignedBotRecord,
) -> int:
    persisted_positions = repository.get_positions_for_bot(
        bot.id
    )

    for persisted in persisted_positions:
        _manage_one_persisted_position(
            repository=repository,
            bot=bot,
            persisted=persisted,
        )

    return len(
        repository.get_positions_for_bot(
            bot.id
        )
    )


def _process_pending_broker_command(
    *,
    repository: WorkerRepository,
    bot: AssignedBotRecord | None,
    broker: BrokerAccountRecord,
    settings: WorkerSettings,
    session_manager: MT5SessionManager,
) -> bool:
    """
    Process one pending broker command.

    bot is optional because an idle worker must be able to connect or verify
    a broker account before a subscription bot has been assigned.
    """
    if broker.worker_command.strip().lower() == "none":
        return False

    if broker.worker_command_status.strip().lower() != "pending":
        return False

    process_broker_command(
        repository=repository,
        broker=broker,
        terminal_path=settings.terminal_path,
        bot_instance_id=bot.id if bot is not None else None,
        session_manager=session_manager,
    )
    return True

def _ensure_trading_session(
    *,
    broker: BrokerAccountRecord,
    settings: WorkerSettings,
    session_manager: MT5SessionManager,
) -> MT5AccountSnapshot:
    if not broker.is_active:
        raise TradingWorkerError(
            "Broker account is not active."
        )

    if broker.verification_status.strip().lower() != "verified":
        raise TradingWorkerError(
            "Broker account has not been verified."
        )

    if broker.connection_status.strip().lower() != "connected":
        raise TradingWorkerError(
            "Broker account is not marked connected."
        )

    return session_manager.ensure_connected(
        _build_session_spec(
            broker=broker,
            terminal_path=settings.terminal_path,
        )
    )


def _update_account_snapshot(
    *,
    repository: WorkerRepository,
    broker: BrokerAccountRecord,
    snapshot: MT5AccountSnapshot,
) -> None:
    repository.update_broker_account_snapshot(
        broker.id,
        balance=snapshot.balance,
        equity=snapshot.equity,
        margin=snapshot.margin,
        free_margin=snapshot.free_margin,
        credit=snapshot.credit,
        profit=snapshot.profit,
        margin_level=snapshot.margin_level,
    )


def _bot_wants_trading(
    bot: AssignedBotRecord,
) -> bool:
    return bot.bot_status.strip().lower() in {
        "starting",
        "running",
    }


def _bot_wants_stop(
    bot: AssignedBotRecord,
) -> bool:
    return bot.bot_status.strip().lower() in {
        "stopping",
        "stopped",
        "paused",
        "error",
    }


def _start_bot_runtime(
    *,
    repository: WorkerRepository,
    bot: AssignedBotRecord,
) -> None:
    if (
        bot.bot_status.strip().lower() == "running"
        and bot.runtime_status.strip().lower() == "running"
    ):
        repository.update_bot_runtime_state(
            bot.id,
            bot_status="running",
            runtime_status="running",
            clear_last_error=True,
        )
        return

    repository.update_bot_runtime_state(
        bot.id,
        bot_status="running",
        runtime_status="running",
        clear_last_error=True,
    )

    repository.record_bot_activity(
        user_id=bot.user_id,
        bot_instance_id=bot.id,
        activity_type="bot_started",
        description="TradeLogic automated trading is running.",
    )


def _stop_bot_if_flat(
    *,
    repository: WorkerRepository,
    bot: AssignedBotRecord,
    remaining_positions: int,
) -> bool:
    """
    STOP is intentionally safe:
    - no new entries are opened
    - existing Strategy 1 positions continue to be managed
    - once flat, the bot becomes fully stopped and releases its worker

    This avoids abandoning live positions merely because the website STOP
    control was pressed.
    """

    if remaining_positions > 0:
        repository.update_bot_runtime_state(
            bot.id,
            bot_status="stopping",
            runtime_status="stopping",
            clear_last_error=True,
        )
        return False

    repository.update_bot_runtime_state(
        bot.id,
        bot_status="stopped",
        runtime_status="stopped",
        clear_last_error=True,
    )

    repository.record_bot_activity(
        user_id=bot.user_id,
        bot_instance_id=bot.id,
        activity_type="bot_stopped",
        description=(
            "TradeLogic automated trading stopped after all managed "
            "positions were closed."
        ),
    )

    repository.release_worker_from_bot(
        bot.id
    )

    return True


def _evaluate_entries(
    *,
    repository: WorkerRepository,
    bot: AssignedBotRecord,
    runtime: WorkerRuntimeState,
    exit_events: list[TradeExitEvent],
    paused_until: datetime | None,
) -> None:
    for symbol in STRATEGY_1.symbols:
        key = (
            bot.id,
            symbol,
        )

        previous = runtime.previous_prices.get(
            key
        )

        result = evaluate_strategy_1_entry_cycle(
            symbol=symbol,
            previous_prices=previous,
            exit_events=exit_events,
            paused_until=paused_until,
        )

        runtime.previous_prices[key] = (
            result.current_prices
        )

        if result.opened_trade is None:
            continue

        persisted = persist_opened_strategy_1_trade(
            repository=repository,
            user_id=bot.user_id,
            bot_instance_id=bot.id,
            broker_account_id=bot.broker_account_id,
            opened_trade=result.opened_trade,
        )

        repository.record_execution_log(
            level="info",
            event_type="strategy_1_trade_opened",
            message=(
                f"Strategy 1 opened {symbol} position "
                f"{persisted.mt5_position_ticket}."
            ),
            user_id=bot.user_id,
            bot_instance_id=bot.id,
            broker_account_id=bot.broker_account_id,
            metadata={
                "symbol": symbol,
                "position_ticket": (
                    persisted.mt5_position_ticket
                ),
                "entry_price": (
                    persisted.actual_entry_price
                ),
                "stop_loss": persisted.stop_loss,
                "take_profit": persisted.take_profit,
                "original_risk_distance": (
                    persisted.original_risk_distance
                ),
                "original_risk_amount": (
                    persisted.original_risk_amount
                ),
            },
        )

        repository.record_bot_activity(
            user_id=bot.user_id,
            bot_instance_id=bot.id,
            activity_type="trade_opened",
            description=(
                f"Strategy 1 opened a {symbol} trade."
            ),
            metadata={
                "symbol": symbol,
                "position_ticket": (
                    persisted.mt5_position_ticket
                ),
            },
        )


def _process_bot_cycle(
    *,
    repository: WorkerRepository,
    bot: AssignedBotRecord,
    settings: WorkerSettings,
    runtime: WorkerRuntimeState,
    session_manager: MT5SessionManager,
) -> None:
    broker = repository.get_broker_account(
        bot.broker_account_id,
        user_id=bot.user_id,
    )

    if broker is None:
        raise TradingWorkerError(
            "Assigned bot broker account was not found."
        )

    command_processed = _process_pending_broker_command(
        repository=repository,
        bot=bot,
        broker=broker,
        settings=settings,
        session_manager=session_manager,
    )

    if command_processed:
        # Reload because the command handler persisted a new connection state.
        broker = repository.get_broker_account(
            bot.broker_account_id,
            user_id=bot.user_id,
        )

        if broker is None:
            raise TradingWorkerError(
                "Broker account disappeared after command processing."
            )

    # A pure disconnect command may intentionally leave the bot without an
    # active session. Do not immediately reconnect unless the bot wants to run.
    if not _bot_wants_trading(bot):
        if _bot_wants_stop(bot):
            # Existing positions still need MT5 access in order to manage them.
            persisted_positions = repository.get_positions_for_bot(
                bot.id
            )

            if not persisted_positions:
                _stop_bot_if_flat(
                    repository=repository,
                    bot=bot,
                    remaining_positions=0,
                )
                session_manager.disconnect(
                    expected_broker_account_id=broker.id
                )
                return

    if bot.subscription_id is None:
        raise TradingWorkerError(
            "Assigned bot has no subscription."
        )

    subscription_allowed = repository.subscription_can_trade(
        bot.subscription_id
    )

    # Existing positions remain managed even when new subscription entries
    # are no longer allowed. This prevents the worker from abandoning risk.
    need_mt5 = (
        _bot_wants_trading(bot)
        or bool(
            repository.get_positions_for_bot(
                bot.id
            )
        )
    )

    if not need_mt5:
        return

    snapshot = _ensure_trading_session(
        broker=broker,
        settings=settings,
        session_manager=session_manager,
    )

    _update_account_snapshot(
        repository=repository,
        broker=broker,
        snapshot=snapshot,
    )

    remaining_positions = _manage_existing_positions(
        repository=repository,
        bot=bot,
    )

    if _bot_wants_stop(bot):
        stopped = _stop_bot_if_flat(
            repository=repository,
            bot=bot,
            remaining_positions=remaining_positions,
        )

        if stopped:
            session_manager.disconnect(
                expected_broker_account_id=broker.id
            )

        return

    if not subscription_allowed:
        repository.update_bot_runtime_state(
            bot.id,
            bot_status="paused",
            runtime_status="running",
            last_error=(
                "Subscription is not currently eligible for new trading."
            ),
        )
        return

    _start_bot_runtime(
        repository=repository,
        bot=bot,
    )

    now = _utc_now()

    exit_events, paused_until, circuit = (
        _load_circuit_breaker(
            repository=repository,
            bot=bot,
            now=now,
        )
    )

    if not circuit.entries_allowed:
        repository.update_bot_runtime_state(
            bot.id,
            bot_status="paused",
            runtime_status="running",
            last_error=circuit.reason,
        )

        repository.record_execution_log(
            level="warning",
            event_type="strategy_1_circuit_breaker_active",
            message=circuit.reason,
            user_id=bot.user_id,
            bot_instance_id=bot.id,
            broker_account_id=bot.broker_account_id,
            metadata={
                "qualifying_losses": (
                    circuit.qualifying_losses_in_window
                ),
                "paused_until": (
                    circuit.paused_until.isoformat()
                    if circuit.paused_until is not None
                    else None
                ),
            },
        )
        return

    _evaluate_entries(
        repository=repository,
        bot=bot,
        runtime=runtime,
        exit_events=exit_events,
        paused_until=paused_until,
    )


def _record_heartbeat_if_due(
    *,
    repository: WorkerRepository,
    settings: WorkerSettings,
    runtime: WorkerRuntimeState,
    active_bot_count: int,
) -> None:
    now_mono = time.monotonic()

    if (
        runtime.last_heartbeat_monotonic > 0
        and (
            now_mono
            - runtime.last_heartbeat_monotonic
        )
        < settings.heartbeat_interval_seconds
    ):
        return

    repository.record_worker_heartbeat(
        settings.worker_id,
        active_bot_count,
        metadata={
            "runtime": "tradelogic_python_worker",
            "poll_interval_seconds": (
                settings.poll_interval_seconds
            ),
            "one_mt5_account_per_process": True,
        },
    )

    runtime.last_heartbeat_monotonic = (
        now_mono
    )


def _safe_bot_error(
    *,
    repository: WorkerRepository,
    bot: AssignedBotRecord,
    exc: Exception,
) -> None:
    message = str(exc)

    try:
        repository.update_bot_runtime_state(
            bot.id,
            bot_status="error",
            runtime_status="error",
            last_error=message,
        )
    except Exception:
        pass

    try:
        repository.record_execution_log(
            level="error",
            event_type="trading_worker_bot_cycle_error",
            message=message,
            user_id=bot.user_id,
            bot_instance_id=bot.id,
            broker_account_id=bot.broker_account_id,
            metadata={
                "exception_type": (
                    type(exc).__name__
                ),
            },
        )
    except Exception:
        pass


def run_worker_forever(
    *,
    settings: WorkerSettings | None = None,
    repository: WorkerRepository | None = None,
    session_manager: MT5SessionManager | None = None,
) -> None:
    """
    Run the TradeLogic worker until SIGINT/SIGTERM.

    Current safety boundary:
    this process refuses to trade more than one assigned bot because MT5 is
    process-global. Multi-customer scaling must use isolated worker processes /
    terminal instances. That supervisor layer belongs to scaling hardening.
    """

    worker_settings = (
        settings
        if settings is not None
        else load_worker_settings()
    )

    repo = (
        repository
        if repository is not None
        else WorkerRepository()
    )

    manager = (
        session_manager
        if session_manager is not None
        else get_mt5_session_manager()
    )

    runtime = WorkerRuntimeState()

    def request_stop(
        _signum: int,
        _frame: object,
    ) -> None:
        runtime.stopping = True

    signal.signal(
        signal.SIGINT,
        request_stop,
    )

    if hasattr(
        signal,
        "SIGTERM",
    ):
        signal.signal(
            signal.SIGTERM,
            request_stop,
        )

    while not runtime.stopping:
        try:
            assigned_bots = repo.get_assigned_bots(
                worker_settings.worker_id
            )

            if len(assigned_bots) > 1:
                raise TradingWorkerError(
                    "This MT5 worker process has more than one assigned bot. "
                    "TradeLogic currently requires one isolated MT5 account "
                    "context per Python worker process."
                )

            _record_heartbeat_if_due(
                repository=repo,
                settings=worker_settings,
                runtime=runtime,
                active_bot_count=len(
                    assigned_bots
                ),
            )

            if not assigned_bots:
                pending_broker = repo.get_pending_broker_command()

                if pending_broker is not None:
                    try:
                        _process_pending_broker_command(
                            repository=repo,
                            bot=None,
                            broker=pending_broker,
                            settings=worker_settings,
                            session_manager=manager,
                        )
                    except (
                        WorkerRepositoryError,
                        BrokerCommandHandlerError,
                        MT5SessionError,
                    ) as exc:
                        print(
                            f"[TradeLogic worker] Broker command error: {exc}",
                            flush=True,
                        )
                    finally:
                        try:
                            manager.disconnect(
                                expected_broker_account_id=pending_broker.id
                            )
                        except Exception:
                            pass
                else:
                    manager.disconnect()

                time.sleep(
                    worker_settings.poll_interval_seconds
                )
                continue

            bot = assigned_bots[0]

            try:
                _process_bot_cycle(
                    repository=repo,
                    bot=bot,
                    settings=worker_settings,
                    runtime=runtime,
                    session_manager=manager,
                )

            except (
                TradingWorkerError,
                WorkerRepositoryError,
                BrokerCommandHandlerError,
                MT5SessionError,
                MT5HistoryError,
                MT5ExecutionError,
                Strategy1OrchestratorError,
                Strategy1TradePersistenceError,
                ValueError,
            ) as exc:
                _safe_bot_error(
                    repository=repo,
                    bot=bot,
                    exc=exc,
                )

            except Exception as exc:
                _safe_bot_error(
                    repository=repo,
                    bot=bot,
                    exc=TradingWorkerError(
                        f"Unexpected worker cycle failure: {exc}"
                    ),
                )

        except WorkerRepositoryError:
            # Supabase/network outages should not crash the process. The next
            # cycle retries after the normal poll delay.
            pass

        finally:
            if not runtime.stopping:
                time.sleep(
                    worker_settings.poll_interval_seconds
                )

    manager.disconnect()


def main() -> None:
    run_worker_forever()


if __name__ == "__main__":
    main()
