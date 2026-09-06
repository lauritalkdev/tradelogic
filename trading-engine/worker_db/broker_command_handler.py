"""
TradeLogic - Broker Command Handler

Processes one pending broker-account command at a time.

Supported commands:
- connect
- verify
- disconnect

Responsibilities:
- claim a pending worker command
- route all MT5 ownership through MT5SessionManager
- verify the requested account/login/server live in MT5
- validate the account can be used by TradeLogic
- persist connection success/failure through WorkerRepository
- safely disconnect only the expected broker account
- produce safe execution logs without credentials

This module does NOT:
- run an infinite worker loop
- assign workers to bots
- open or manage trades
- persist plaintext broker credentials
- decide subscription eligibility
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from uuid import UUID

import MetaTrader5 as mt5

from mt5.account import MT5AccountSnapshot
from mt5.session import (
    MT5SessionManager,
    MT5SessionSpec,
    get_mt5_session_manager,
)
from worker_db.repository import (
    BrokerAccountRecord,
    WorkerRepository,
)


class BrokerCommandHandlerError(RuntimeError):
    """Raised when a TradeLogic broker command cannot be processed safely."""


class BrokerCommand(str, Enum):
    CONNECT = "connect"
    VERIFY = "verify"
    DISCONNECT = "disconnect"


@dataclass(frozen=True)
class BrokerCommandResult:
    broker_account_id: UUID
    command: str
    processed: bool
    success: bool
    connection_status: str
    reason: str
    account_snapshot: MT5AccountSnapshot | None = None


_ALLOWED_ACCOUNT_CURRENCIES = {
    "USD",
    "EUR",
    "GBP",
}


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


def _account_type_from_trade_mode(
    trade_mode: int | None,
) -> str:
    """
    Convert MT5 trade mode to TradeLogic's broker account type.
    """

    if trade_mode == mt5.ACCOUNT_TRADE_MODE_DEMO:
        return "demo"

    if trade_mode == mt5.ACCOUNT_TRADE_MODE_REAL:
        return "real"

    if trade_mode == mt5.ACCOUNT_TRADE_MODE_CONTEST:
        raise BrokerCommandHandlerError(
            "MT5 contest accounts are not supported by TradeLogic."
        )

    raise BrokerCommandHandlerError(
        "Unable to determine whether the MT5 account is demo or real."
    )


def _validate_verified_snapshot(
    *,
    session_manager: MT5SessionManager,
    session_spec: MT5SessionSpec,
    snapshot: MT5AccountSnapshot,
) -> tuple[str, str]:
    """
    Validate both account-level and terminal-level trading readiness.

    Returns:
        (normalized_currency, account_type)
    """

    state = session_manager.inspect(
        expected_spec=session_spec
    )

    if not state.connected or not state.healthy:
        raise BrokerCommandHandlerError(
            "The MT5 session did not remain healthy after verification."
        )

    if not state.terminal_health.trade_allowed:
        raise BrokerCommandHandlerError(
            "MetaTrader 5 terminal does not currently allow trading."
        )

    currency = (
        snapshot.currency.strip().upper()
        if snapshot.currency
        else ""
    )

    if currency not in _ALLOWED_ACCOUNT_CURRENCIES:
        raise BrokerCommandHandlerError(
            "TradeLogic currently supports MT5 accounts denominated in "
            "USD, EUR or GBP only."
        )

    if snapshot.balance < 0:
        raise BrokerCommandHandlerError(
            "MT5 account balance cannot be negative."
        )

    if snapshot.equity < 0:
        raise BrokerCommandHandlerError(
            "MT5 account equity cannot be negative."
        )

    if not snapshot.trade_allowed:
        raise BrokerCommandHandlerError(
            "Trading is not allowed on this MT5 account."
        )

    if not snapshot.trade_expert_allowed:
        raise BrokerCommandHandlerError(
            "Algorithmic/Expert trading is not allowed on this MT5 account."
        )

    account_type = _account_type_from_trade_mode(
        snapshot.trade_mode
    )

    return currency, account_type


def _record_log_safely(
    repository: WorkerRepository,
    *,
    level: str,
    event_type: str,
    message: str,
    broker: BrokerAccountRecord,
    bot_instance_id: UUID | str | None,
    metadata: dict[str, object] | None = None,
) -> None:
    """
    Best-effort logging.

    A logging failure must never overwrite the real command result.
    """

    try:
        repository.record_execution_log(
            level=level,
            event_type=event_type,
            message=message,
            user_id=broker.user_id,
            bot_instance_id=bot_instance_id,
            broker_account_id=broker.id,
            metadata=metadata,
        )
    except Exception:
        pass


def _persist_connection_success(
    *,
    repository: WorkerRepository,
    broker: BrokerAccountRecord,
    snapshot: MT5AccountSnapshot,
    currency: str,
    account_type: str,
) -> None:
    repository.mark_broker_connection_success(
        broker.id,
        balance=snapshot.balance,
        equity=snapshot.equity,
        margin=snapshot.margin,
        free_margin=snapshot.free_margin,
        currency=currency,
        account_type=account_type,
        account_name=snapshot.name or "",
        company=snapshot.company or "",
        leverage=snapshot.leverage or 0,
        trade_allowed=snapshot.trade_allowed,
        trade_expert_allowed=snapshot.trade_expert_allowed,
    )


def process_broker_command(
    *,
    repository: WorkerRepository,
    broker: BrokerAccountRecord,
    terminal_path: str | None = None,
    bot_instance_id: UUID | str | None = None,
    session_manager: MT5SessionManager | None = None,
) -> BrokerCommandResult:
    """
    Process exactly one pending broker command.

    CONNECT and VERIFY force a fresh MT5 login so newly supplied credentials
    are genuinely tested before the database is marked verified.

    Successful CONNECT/VERIFY leaves the session open for the trading worker.
    """

    manager = (
        session_manager
        if session_manager is not None
        else get_mt5_session_manager()
    )

    raw_command = broker.worker_command.strip().lower()
    command_status = broker.worker_command_status.strip().lower()

    if raw_command == "none":
        return BrokerCommandResult(
            broker_account_id=broker.id,
            command="none",
            processed=False,
            success=True,
            connection_status=broker.connection_status,
            reason="no_pending_broker_command",
            account_snapshot=None,
        )

    if raw_command not in {
        BrokerCommand.CONNECT.value,
        BrokerCommand.VERIFY.value,
        BrokerCommand.DISCONNECT.value,
    }:
        raise BrokerCommandHandlerError(
            f"Unsupported broker worker command: {broker.worker_command}."
        )

    if command_status != "pending":
        return BrokerCommandResult(
            broker_account_id=broker.id,
            command=raw_command,
            processed=False,
            success=False,
            connection_status=broker.connection_status,
            reason=f"command_status_{command_status}",
            account_snapshot=None,
        )

    command = BrokerCommand(
        raw_command
    )

    repository.mark_broker_command_processing(
        broker.id,
        expected_command=command.value,
    )

    _record_log_safely(
        repository,
        level="info",
        event_type="broker_command_processing",
        message=f"Processing MT5 broker command '{command.value}'.",
        broker=broker,
        bot_instance_id=bot_instance_id,
        metadata={
            "command": command.value,
            "broker_name": broker.broker_name,
            "mt5_server": broker.mt5_server,
            "mt5_login": broker.mt5_login,
        },
    )

    session_spec = _build_session_spec(
        broker=broker,
        terminal_path=terminal_path,
    )

    if command == BrokerCommand.DISCONNECT:
        try:
            manager.disconnect(
                expected_broker_account_id=broker.id
            )

            repository.mark_broker_disconnect_success(
                broker.id
            )

            _record_log_safely(
                repository,
                level="info",
                event_type="broker_disconnected",
                message="MT5 broker account disconnected successfully.",
                broker=broker,
                bot_instance_id=bot_instance_id,
                metadata={
                    "command": command.value,
                },
            )

            return BrokerCommandResult(
                broker_account_id=broker.id,
                command=command.value,
                processed=True,
                success=True,
                connection_status="disconnected",
                reason="broker_disconnected",
                account_snapshot=None,
            )

        except Exception as exc:
            error_message = (
                f"Unable to disconnect MT5 broker account: {exc}"
            )

            try:
                repository.mark_broker_connection_failure(
                    broker.id,
                    error_message,
                )
            except Exception:
                pass

            _record_log_safely(
                repository,
                level="error",
                event_type="broker_disconnect_failed",
                message=error_message,
                broker=broker,
                bot_instance_id=bot_instance_id,
                metadata={
                    "command": command.value,
                },
            )

            raise BrokerCommandHandlerError(
                error_message
            ) from exc

    try:
        snapshot = manager.connect(
            session_spec,
            force_reconnect=True,
        )

        currency, account_type = _validate_verified_snapshot(
            session_manager=manager,
            session_spec=session_spec,
            snapshot=snapshot,
        )

        _persist_connection_success(
            repository=repository,
            broker=broker,
            snapshot=snapshot,
            currency=currency,
            account_type=account_type,
        )

        _record_log_safely(
            repository,
            level="info",
            event_type="broker_connected",
            message=(
                "MT5 broker account connected and verified successfully."
            ),
            broker=broker,
            bot_instance_id=bot_instance_id,
            metadata={
                "command": command.value,
                "currency": currency,
                "company": snapshot.company,
                "trade_allowed": snapshot.trade_allowed,
                "trade_expert_allowed": snapshot.trade_expert_allowed,
            },
        )

        return BrokerCommandResult(
            broker_account_id=broker.id,
            command=command.value,
            processed=True,
            success=True,
            connection_status="connected",
            reason="broker_connected_and_verified",
            account_snapshot=snapshot,
        )

    except Exception as exc:
        manager.disconnect(
            expected_broker_account_id=broker.id
        )

        error_message = (
            f"MT5 broker command '{command.value}' failed: {exc}"
        )

        try:
            repository.mark_broker_connection_failure(
                broker.id,
                error_message,
            )
        except Exception:
            pass

        _record_log_safely(
            repository,
            level="error",
            event_type="broker_connection_failed",
            message=error_message,
            broker=broker,
            bot_instance_id=bot_instance_id,
            metadata={
                "command": command.value,
                "broker_name": broker.broker_name,
                "mt5_server": broker.mt5_server,
                "mt5_login": broker.mt5_login,
            },
        )

        raise BrokerCommandHandlerError(
            error_message
        ) from exc
