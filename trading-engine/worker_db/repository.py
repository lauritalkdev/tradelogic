"""
TradeLogic - Trading Worker Database Repository

Server-side data-access layer used by TradeLogic Python trading workers.

This module deliberately keeps database access separate from:
- MT5 terminal execution
- strategy calculations
- credential decryption
- continuous worker orchestration

SECURITY:
- Uses the privileged server-side Supabase client.
- Must never run in the browser.
- Broker passwords remain encrypted here.
- This repository never prints secrets.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from worker_db.supabase_client import get_supabase_client


class WorkerRepositoryError(RuntimeError):
    """Raised when a TradeLogic worker database operation fails."""


def _as_uuid(value: Any) -> UUID:
    if isinstance(value, UUID):
        return value

    return UUID(str(value))


def _as_decimal(value: Any) -> Decimal | None:
    if value is None:
        return None

    return Decimal(str(value))


def _as_datetime(value: Any) -> datetime | None:
    if value is None:
        return None

    if isinstance(value, datetime):
        return value

    parsed = datetime.fromisoformat(
        str(value).replace("Z", "+00:00")
    )

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    return parsed


@dataclass(frozen=True)
class AssignedBotRecord:
    id: UUID
    user_id: UUID
    broker_account_id: UUID
    subscription_id: UUID | None
    bot_status: str
    strategy_name: str | None
    assigned_worker_id: UUID | None
    worker_assigned_at: datetime | None
    worker_last_seen_at: datetime | None
    runtime_status: str
    started_at: datetime | None
    stopped_at: datetime | None
    last_heartbeat_at: datetime | None
    last_error: str | None


@dataclass(frozen=True)
class BrokerAccountRecord:
    id: UUID
    user_id: UUID
    broker_name: str
    mt5_server: str
    mt5_login: int
    mt5_password_encrypted: str
    account_label: str | None
    account_currency: str | None
    account_type: str | None
    connection_status: str
    verification_status: str
    is_active: bool
    worker_command: str
    worker_command_status: str
    mt5_account_name: str | None
    mt5_company: str | None
    mt5_leverage: int | None
    mt5_trade_allowed: bool | None
    mt5_trade_expert_allowed: bool | None
    last_balance: Decimal | None
    last_equity: Decimal | None
    last_margin: Decimal | None
    last_free_margin: Decimal | None
    last_balance_usd: Decimal | None
    last_equity_usd: Decimal | None
    conversion_rate_to_usd: Decimal | None
    last_snapshot_at: datetime | None


@dataclass(frozen=True)
class PersistedPositionRecord:
    id: UUID
    user_id: UUID
    bot_instance_id: UUID
    broker_account_id: UUID
    trade_id: UUID | None
    mt5_position_ticket: int
    symbol: str
    broker_symbol: str | None
    position_type: str
    lot_size: Decimal
    open_price: Decimal | None
    current_price: Decimal | None
    stop_loss: Decimal | None
    take_profit: Decimal | None
    floating_profit_loss: Decimal | None
    opened_at: datetime | None
    last_synced_at: datetime
    original_stop_loss: Decimal | None
    original_risk_distance: Decimal | None
    original_risk_amount: Decimal | None
    highest_r_reached: Decimal


@dataclass(frozen=True)
class ClosedTradeRecord:
    id: UUID
    user_id: UUID
    bot_instance_id: UUID
    broker_account_id: UUID
    mt5_ticket: int | None
    symbol: str
    trade_type: str
    profit_loss: Decimal | None
    closed_at: datetime | None
    close_reason: str | None
    strategy_name: str | None
    original_risk_amount: Decimal | None
    realized_r: Decimal | None


class WorkerRepository:
    """
    Supabase-backed repository for TradeLogic trading workers.

    The repository exposes controlled database operations and converts
    raw Supabase dictionaries into typed worker records.
    """

    def __init__(self) -> None:
        self._client = get_supabase_client()

    def get_assigned_bots(
        self,
        worker_id: UUID | str,
    ) -> list[AssignedBotRecord]:
        """
        Return all bot instances currently assigned to this worker.

        No bot-status assumption is made here. The worker runtime decides
        whether an assigned bot should start, stop, remain idle or recover.
        """

        try:
            response = (
                self._client
                .table("bot_instances")
                .select(
                    (
                        "id,user_id,broker_account_id,subscription_id,"
                        "bot_status,strategy_name,assigned_worker_id,"
                        "worker_assigned_at,worker_last_seen_at,"
                        "runtime_status,started_at,stopped_at,"
                        "last_heartbeat_at,last_error"
                    )
                )
                .eq("assigned_worker_id", str(worker_id))
                .execute()
            )
        except Exception as exc:
            raise WorkerRepositoryError(
                f"Unable to load assigned bot instances: {exc}"
            ) from exc

        records: list[AssignedBotRecord] = []

        for row in response.data or []:
            assigned_worker_id = row.get("assigned_worker_id")
            subscription_id = row.get("subscription_id")

            records.append(
                AssignedBotRecord(
                    id=_as_uuid(row["id"]),
                    user_id=_as_uuid(row["user_id"]),
                    broker_account_id=_as_uuid(
                        row["broker_account_id"]
                    ),
                    subscription_id=(
                        _as_uuid(subscription_id)
                        if subscription_id
                        else None
                    ),
                    bot_status=str(row["bot_status"]),
                    strategy_name=row.get("strategy_name"),
                    assigned_worker_id=(
                        _as_uuid(assigned_worker_id)
                        if assigned_worker_id
                        else None
                    ),
                    worker_assigned_at=_as_datetime(
                        row.get("worker_assigned_at")
                    ),
                    worker_last_seen_at=_as_datetime(
                        row.get("worker_last_seen_at")
                    ),
                    runtime_status=str(
                        row.get("runtime_status") or "idle"
                    ),
                    started_at=_as_datetime(
                        row.get("started_at")
                    ),
                    stopped_at=_as_datetime(
                        row.get("stopped_at")
                    ),
                    last_heartbeat_at=_as_datetime(
                        row.get("last_heartbeat_at")
                    ),
                    last_error=row.get("last_error"),
                )
            )

        return records

    def get_pending_broker_command(
        self,
    ) -> BrokerAccountRecord | None:
        """
        Return the oldest pending broker command waiting for an idle worker.

        Broker connection and verification can happen before a trading bot is
        assigned, so command discovery must not depend on bot_instances.
        Claiming remains atomic in mark_broker_command_processing().
        """
        try:
            response = (
                self._client
                .table("broker_accounts")
                .select("id")
                .eq("worker_command_status", "pending")
                .neq("worker_command", "none")
                .order("worker_command_updated_at", desc=False)
                .limit(1)
                .execute()
            )
        except Exception as exc:
            raise WorkerRepositoryError(
                f"Unable to load pending broker command: {exc}"
            ) from exc

        rows = response.data or []
        if not rows:
            return None

        broker_account_id = rows[0].get("id")
        if not broker_account_id:
            raise WorkerRepositoryError(
                "Pending broker command returned no broker account ID."
            )

        return self.get_broker_account(broker_account_id)

    def get_broker_account(
        self,
        broker_account_id: UUID | str,
        user_id: UUID | str | None = None,
    ) -> BrokerAccountRecord | None:
        """
        Load one broker account, including its encrypted MT5 password.

        The password remains encrypted. Decryption will be handled by a
        dedicated server-only credential module later.
        """

        try:
            query = (
                self._client
                .table("broker_accounts")
                .select(
                    (
                        "id,user_id,broker_name,mt5_server,mt5_login,"
                        "mt5_password_encrypted,account_label,"
                        "account_currency,account_type,"
                        "connection_status,verification_status,"
                        "is_active,worker_command,worker_command_status,"
                        "mt5_account_name,mt5_company,mt5_leverage,"
                        "mt5_trade_allowed,mt5_trade_expert_allowed,"
                        "last_balance,last_equity,last_margin,"
                        "last_free_margin,last_balance_usd,"
                        "last_equity_usd,conversion_rate_to_usd,"
                        "last_snapshot_at"
                    )
                )
                .eq("id", str(broker_account_id))
            )

            if user_id is not None:
                query = query.eq(
                    "user_id",
                    str(user_id),
                )

            response = query.limit(1).execute()

        except Exception as exc:
            raise WorkerRepositoryError(
                f"Unable to load broker account: {exc}"
            ) from exc

        rows = response.data or []

        if not rows:
            return None

        row = rows[0]

        return BrokerAccountRecord(
            id=_as_uuid(row["id"]),
            user_id=_as_uuid(row["user_id"]),
            broker_name=str(row["broker_name"]),
            mt5_server=str(row["mt5_server"]),
            mt5_login=int(row["mt5_login"]),
            mt5_password_encrypted=str(
                row["mt5_password_encrypted"]
            ),
            account_label=row.get("account_label"),
            account_currency=row.get("account_currency"),
            account_type=row.get("account_type"),
            connection_status=str(
                row["connection_status"]
            ),
            verification_status=str(
                row["verification_status"]
            ),
            is_active=bool(row["is_active"]),
            worker_command=str(row["worker_command"]),
            worker_command_status=str(
                row["worker_command_status"]
            ),
            mt5_account_name=row.get("mt5_account_name"),
            mt5_company=row.get("mt5_company"),
            mt5_leverage=(
                int(row["mt5_leverage"])
                if row.get("mt5_leverage") is not None
                else None
            ),
            mt5_trade_allowed=row.get(
                "mt5_trade_allowed"
            ),
            mt5_trade_expert_allowed=row.get(
                "mt5_trade_expert_allowed"
            ),
            last_balance=_as_decimal(
                row.get("last_balance")
            ),
            last_equity=_as_decimal(
                row.get("last_equity")
            ),
            last_margin=_as_decimal(
                row.get("last_margin")
            ),
            last_free_margin=_as_decimal(
                row.get("last_free_margin")
            ),
            last_balance_usd=_as_decimal(
                row.get("last_balance_usd")
            ),
            last_equity_usd=_as_decimal(
                row.get("last_equity_usd")
            ),
            conversion_rate_to_usd=_as_decimal(
                row.get("conversion_rate_to_usd")
            ),
            last_snapshot_at=_as_datetime(
                row.get("last_snapshot_at")
            ),
        )

    def get_positions_for_bot(
        self,
        bot_instance_id: UUID | str,
    ) -> list[PersistedPositionRecord]:
        """
        Return persisted currently-managed positions for one bot.

        The positions table represents positions TradeLogic is currently
        tracking. Closed-trade history lives in the trades table.
        """

        try:
            response = (
                self._client
                .table("positions")
                .select(
                    (
                        "id,user_id,bot_instance_id,broker_account_id,"
                        "trade_id,mt5_position_ticket,symbol,"
                        "broker_symbol,position_type,lot_size,"
                        "open_price,current_price,stop_loss,take_profit,"
                        "floating_profit_loss,opened_at,last_synced_at,"
                        "original_stop_loss,original_risk_distance,"
                        "original_risk_amount,highest_r_reached"
                    )
                )
                .eq(
                    "bot_instance_id",
                    str(bot_instance_id),
                )
                .execute()
            )
        except Exception as exc:
            raise WorkerRepositoryError(
                f"Unable to load persisted positions: {exc}"
            ) from exc

        records: list[PersistedPositionRecord] = []

        for row in response.data or []:
            trade_id = row.get("trade_id")

            last_synced_at = _as_datetime(
                row["last_synced_at"]
            )

            if last_synced_at is None:
                raise WorkerRepositoryError(
                    "Persisted position is missing last_synced_at."
                )

            records.append(
                PersistedPositionRecord(
                    id=_as_uuid(row["id"]),
                    user_id=_as_uuid(row["user_id"]),
                    bot_instance_id=_as_uuid(
                        row["bot_instance_id"]
                    ),
                    broker_account_id=_as_uuid(
                        row["broker_account_id"]
                    ),
                    trade_id=(
                        _as_uuid(trade_id)
                        if trade_id
                        else None
                    ),
                    mt5_position_ticket=int(
                        row["mt5_position_ticket"]
                    ),
                    symbol=str(row["symbol"]),
                    broker_symbol=row.get("broker_symbol"),
                    position_type=str(row["position_type"]),
                    lot_size=Decimal(
                        str(row["lot_size"])
                    ),
                    open_price=_as_decimal(
                        row.get("open_price")
                    ),
                    current_price=_as_decimal(
                        row.get("current_price")
                    ),
                    stop_loss=_as_decimal(
                        row.get("stop_loss")
                    ),
                    take_profit=_as_decimal(
                        row.get("take_profit")
                    ),
                    floating_profit_loss=_as_decimal(
                        row.get("floating_profit_loss")
                    ),
                    opened_at=_as_datetime(
                        row.get("opened_at")
                    ),
                    last_synced_at=last_synced_at,
                    original_stop_loss=_as_decimal(
                        row.get("original_stop_loss")
                    ),
                    original_risk_distance=_as_decimal(
                        row.get("original_risk_distance")
                    ),
                    original_risk_amount=_as_decimal(
                        row.get("original_risk_amount")
                    ),
                    highest_r_reached=Decimal(
                        str(
                            row.get(
                                "highest_r_reached",
                                0,
                            )
                        )
                    ),
                )
            )

        return records

    def get_recent_closed_trades(
        self,
        bot_instance_id: UUID | str,
        since: datetime,
        strategy_name: str | None = None,
    ) -> list[ClosedTradeRecord]:
        """
        Return trades closed on or after the supplied timestamp.

        We filter using closed_at rather than assuming a particular
        database trade-status value.
        """

        if since.tzinfo is None:
            since = since.replace(
                tzinfo=timezone.utc
            )

        try:
            query = (
                self._client
                .table("trades")
                .select(
                    (
                        "id,user_id,bot_instance_id,broker_account_id,"
                        "mt5_ticket,symbol,trade_type,profit_loss,"
                        "closed_at,close_reason,strategy_name,"
                        "original_risk_amount,realized_r"
                    )
                )
                .eq(
                    "bot_instance_id",
                    str(bot_instance_id),
                )
                .gte(
                    "closed_at",
                    since.isoformat(),
                )
            )

            if strategy_name is not None:
                query = query.eq(
                    "strategy_name",
                    strategy_name,
                )

            response = query.execute()

        except Exception as exc:
            raise WorkerRepositoryError(
                f"Unable to load recent closed trades: {exc}"
            ) from exc

        records: list[ClosedTradeRecord] = []

        for row in response.data or []:
            records.append(
                ClosedTradeRecord(
                    id=_as_uuid(row["id"]),
                    user_id=_as_uuid(row["user_id"]),
                    bot_instance_id=_as_uuid(
                        row["bot_instance_id"]
                    ),
                    broker_account_id=_as_uuid(
                        row["broker_account_id"]
                    ),
                    mt5_ticket=(
                        int(row["mt5_ticket"])
                        if row.get("mt5_ticket") is not None
                        else None
                    ),
                    symbol=str(row["symbol"]),
                    trade_type=str(row["trade_type"]),
                    profit_loss=_as_decimal(
                        row.get("profit_loss")
                    ),
                    closed_at=_as_datetime(
                        row.get("closed_at")
                    ),
                    close_reason=row.get("close_reason"),
                    strategy_name=row.get("strategy_name"),
                    original_risk_amount=_as_decimal(
                        row.get("original_risk_amount")
                    ),
                    realized_r=_as_decimal(
                        row.get("realized_r")
                    ),
                )
            )

        return records

    def update_position_runtime_state(
        self,
        position_id: UUID | str,
        *,
        current_price: Decimal | float | None = None,
        stop_loss: Decimal | float | None = None,
        take_profit: Decimal | float | None = None,
        floating_profit_loss: Decimal | float | None = None,
        highest_r_reached: Decimal | float | None = None,
    ) -> None:
        """
        Update live mutable position state.

        Frozen fields such as original_stop_loss and original_risk_distance
        are intentionally not modified by this method.
        """

        payload: dict[str, Any] = {
            "last_synced_at": datetime.now(
                timezone.utc
            ).isoformat(),
        }

        if current_price is not None:
            payload["current_price"] = str(
                current_price
            )

        if stop_loss is not None:
            payload["stop_loss"] = str(stop_loss)

        if take_profit is not None:
            payload["take_profit"] = str(
                take_profit
            )

        if floating_profit_loss is not None:
            payload["floating_profit_loss"] = str(
                floating_profit_loss
            )

        if highest_r_reached is not None:
            payload["highest_r_reached"] = str(
                highest_r_reached
            )

        try:
            (
                self._client
                .table("positions")
                .update(payload)
                .eq("id", str(position_id))
                .execute()
            )
        except Exception as exc:
            raise WorkerRepositoryError(
                f"Unable to update position runtime state: {exc}"
            ) from exc

    def record_execution_log(
        self,
        *,
        level: str,
        event_type: str,
        message: str,
        user_id: UUID | str | None = None,
        bot_instance_id: UUID | str | None = None,
        broker_account_id: UUID | str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Insert a server-side execution log entry."""

        payload: dict[str, Any] = {
            "level": level,
            "event_type": event_type,
            "message": message,
        }

        if user_id is not None:
            payload["user_id"] = str(user_id)

        if bot_instance_id is not None:
            payload["bot_instance_id"] = str(
                bot_instance_id
            )

        if broker_account_id is not None:
            payload["broker_account_id"] = str(
                broker_account_id
            )

        if metadata is not None:
            payload["metadata"] = metadata

        try:
            (
                self._client
                .table("execution_logs")
                .insert(payload)
                .execute()
            )
        except Exception as exc:
            raise WorkerRepositoryError(
                f"Unable to record execution log: {exc}"
            ) from exc

    def record_bot_activity(
        self,
        *,
        user_id: UUID | str,
        bot_instance_id: UUID | str,
        activity_type: str,
        description: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Insert a user-visible bot activity record."""

        payload: dict[str, Any] = {
            "user_id": str(user_id),
            "bot_instance_id": str(
                bot_instance_id
            ),
            "activity_type": activity_type,
        }

        if description is not None:
            payload["description"] = description

        if metadata is not None:
            payload["metadata"] = metadata

        try:
            (
                self._client
                .table("bot_activity")
                .insert(payload)
                .execute()
            )
        except Exception as exc:
            raise WorkerRepositoryError(
                f"Unable to record bot activity: {exc}"
            ) from exc

    def subscription_can_trade(
        self,
        subscription_id: UUID | str,
    ) -> bool:
        """Return whether the subscription is currently allowed to trade."""

        try:
            response = self._client.rpc(
                "subscription_can_trade",
                {
                    "target_subscription_id": str(subscription_id),
                },
            ).execute()
        except Exception as exc:
            raise WorkerRepositoryError(
                f"Unable to check subscription trading eligibility: {exc}"
            ) from exc

        return bool(response.data)

    def record_worker_heartbeat(
        self,
        worker_id: UUID | str,
        active_bot_count: int,
        *,
        cpu_percent: Decimal | float | None = None,
        memory_percent: Decimal | float | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Record a worker heartbeat through the database RPC."""

        params: dict[str, Any] = {
            "target_worker_id": str(worker_id),
            "reported_bot_count": max(int(active_bot_count), 0),
            "reported_cpu_percent": (
                float(cpu_percent) if cpu_percent is not None else None
            ),
            "reported_memory_percent": (
                float(memory_percent) if memory_percent is not None else None
            ),
            "heartbeat_metadata": metadata,
        }

        try:
            self._client.rpc(
                "record_worker_heartbeat",
                params,
            ).execute()
        except Exception as exc:
            raise WorkerRepositoryError(
                f"Unable to record worker heartbeat: {exc}"
            ) from exc

    def assign_worker_to_bot(
        self,
        bot_instance_id: UUID | str,
    ) -> UUID:
        """Assign the least-loaded available worker to a bot."""

        try:
            response = self._client.rpc(
                "assign_worker_to_bot",
                {
                    "target_bot_instance_id": str(bot_instance_id),
                },
            ).execute()
        except Exception as exc:
            raise WorkerRepositoryError(
                f"Unable to assign worker to bot: {exc}"
            ) from exc

        if not response.data:
            raise WorkerRepositoryError(
                "Worker assignment returned no worker ID."
            )

        return _as_uuid(response.data)

    def release_worker_from_bot(
        self,
        bot_instance_id: UUID | str,
    ) -> None:
        """Release the worker currently assigned to a bot."""

        try:
            self._client.rpc(
                "release_worker_from_bot",
                {
                    "target_bot_instance_id": str(bot_instance_id),
                },
            ).execute()
        except Exception as exc:
            raise WorkerRepositoryError(
                f"Unable to release worker from bot: {exc}"
            ) from exc

    def mark_broker_connection_success(
        self,
        broker_account_id: UUID | str,
        *,
        balance: Decimal | float,
        equity: Decimal | float,
        margin: Decimal | float,
        free_margin: Decimal | float,
        currency: str,
        account_type: str,
        account_name: str,
        company: str,
        leverage: int,
        trade_allowed: bool,
        trade_expert_allowed: bool,
    ) -> None:
        """Persist a successful MT5 account verification."""

        params: dict[str, Any] = {
            "target_broker_account_id": str(broker_account_id),
            "verified_balance": str(balance),
            "verified_equity": str(equity),
            "verified_margin": str(margin),
            "verified_free_margin": str(free_margin),
            "verified_currency": currency,
            "verified_account_type": account_type,
            "verified_account_name": account_name,
            "verified_company": company,
            "verified_leverage": int(leverage),
            "verified_trade_allowed": bool(trade_allowed),
            "verified_trade_expert_allowed": bool(trade_expert_allowed),
        }

        try:
            self._client.rpc(
                "mark_broker_connection_success",
                params,
            ).execute()
        except Exception as exc:
            raise WorkerRepositoryError(
                f"Unable to mark broker connection successful: {exc}"
            ) from exc

    def mark_broker_connection_failure(
        self,
        broker_account_id: UUID | str,
        error_message: str,
    ) -> None:
        """Persist a failed MT5 connection or verification."""

        try:
            self._client.rpc(
                "mark_broker_connection_failure",
                {
                    "target_broker_account_id": str(broker_account_id),
                    "error_message": error_message,
                },
            ).execute()
        except Exception as exc:
            raise WorkerRepositoryError(
                f"Unable to mark broker connection failure: {exc}"
            ) from exc

    def update_broker_account_snapshot(
        self,
        broker_account_id: UUID | str,
        *,
        balance: Decimal | float,
        equity: Decimal | float,
        margin: Decimal | float,
        free_margin: Decimal | float,
        credit: Decimal | float,
        profit: Decimal | float,
        margin_level: Decimal | float,
    ) -> None:
        """Persist the latest live MT5 account snapshot."""

        params: dict[str, Any] = {
            "target_broker_account_id": str(broker_account_id),
            "current_balance": str(balance),
            "current_equity": str(equity),
            "current_margin": str(margin),
            "current_free_margin": str(free_margin),
            "current_credit": str(credit),
            "current_profit": str(profit),
            "current_margin_level": str(margin_level),
        }

        try:
            self._client.rpc(
                "update_broker_account_snapshot",
                params,
            ).execute()
        except Exception as exc:
            raise WorkerRepositoryError(
                f"Unable to update broker account snapshot: {exc}"
            ) from exc

    def update_bot_runtime_state(
        self,
        bot_instance_id: UUID | str,
        *,
        bot_status: str | None = None,
        runtime_status: str | None = None,
        last_error: str | None = None,
        clear_last_error: bool = False,
    ) -> None:
        """Update controlled worker-owned bot runtime fields."""

        allowed_bot_statuses = {
            "stopped",
            "starting",
            "running",
            "paused",
            "stopping",
            "error",
        }

        allowed_runtime_statuses = {
            "idle",
            "waiting_for_worker",
            "starting",
            "running",
            "stopping",
            "stopped",
            "stale",
            "error",
        }

        payload: dict[str, Any] = {
            "last_heartbeat_at": datetime.now(timezone.utc).isoformat(),
        }

        if bot_status is not None:
            if bot_status not in allowed_bot_statuses:
                raise WorkerRepositoryError(
                    f"Invalid bot status: {bot_status}"
                )
            payload["bot_status"] = bot_status

        if runtime_status is not None:
            if runtime_status not in allowed_runtime_statuses:
                raise WorkerRepositoryError(
                    f"Invalid runtime status: {runtime_status}"
                )
            payload["runtime_status"] = runtime_status

        if clear_last_error:
            payload["last_error"] = None
        elif last_error is not None:
            payload["last_error"] = last_error

        try:
            (
                self._client
                .table("bot_instances")
                .update(payload)
                .eq("id", str(bot_instance_id))
                .execute()
            )
        except Exception as exc:
            raise WorkerRepositoryError(
                f"Unable to update bot runtime state: {exc}"
            ) from exc


    def mark_broker_command_processing(
        self,
        broker_account_id: UUID | str,
        *,
        expected_command: str,
    ) -> None:
        """
        Atomically move a pending broker command into processing state.

        The expected command is included in the update filter so a worker
        cannot accidentally claim a different/newer command.
        """

        clean_command = expected_command.strip().lower()

        if clean_command not in {"connect", "verify", "disconnect"}:
            raise WorkerRepositoryError(
                f"Unsupported broker worker command: {expected_command}."
            )

        try:
            response = (
                self._client
                .table("broker_accounts")
                .update(
                    {
                        "worker_command_status": "processing",
                    }
                )
                .eq("id", str(broker_account_id))
                .eq("worker_command", clean_command)
                .eq("worker_command_status", "pending")
                .execute()
            )
        except Exception as exc:
            raise WorkerRepositoryError(
                f"Unable to mark broker command as processing: {exc}"
            ) from exc

        if not response.data:
            raise WorkerRepositoryError(
                "Broker command is no longer pending or no longer matches "
                "the command this worker attempted to claim."
            )

    def mark_broker_disconnect_success(
        self,
        broker_account_id: UUID | str,
    ) -> None:
        """
        Persist successful worker-side MT5 disconnection.

        Verification metadata is intentionally preserved. Disconnecting a
        verified broker account does not erase previous verification.
        """

        try:
            response = (
                self._client
                .table("broker_accounts")
                .update(
                    {
                        "connection_status": "disconnected",
                        "worker_command": "none",
                        "worker_command_status": "completed",
                        "is_active": False,
                    }
                )
                .eq("id", str(broker_account_id))
                .execute()
            )
        except Exception as exc:
            raise WorkerRepositoryError(
                f"Unable to persist broker disconnection: {exc}"
            ) from exc

        if not response.data:
            raise WorkerRepositoryError(
                "Broker disconnection update returned no broker account."
            )

    def create_open_trade(
        self,
        *,
        user_id: UUID | str,
        bot_instance_id: UUID | str,
        broker_account_id: UUID | str,
        mt5_ticket: int,
        symbol: str,
        trade_type: str,
        lot_size: Decimal | float,
        entry_price: Decimal | float,
        stop_loss: Decimal | float,
        take_profit: Decimal | float,
        original_risk_amount: Decimal | float,
        broker_symbol: str | None = None,
        strategy_name: str = "strategy_1",
        opened_at: datetime | None = None,
    ) -> UUID:
        """Insert one successfully opened MT5 trade and return its database ID."""

        clean_symbol = symbol.strip()
        clean_trade_type = trade_type.strip().lower()

        if not clean_symbol:
            raise WorkerRepositoryError("Trade symbol is required.")

        if clean_trade_type not in {"buy", "sell"}:
            raise WorkerRepositoryError(
                "Trade type must be 'buy' or 'sell'."
            )

        if int(mt5_ticket) <= 0:
            raise WorkerRepositoryError(
                "MT5 trade ticket must be greater than zero."
            )

        if Decimal(str(lot_size)) <= 0:
            raise WorkerRepositoryError(
                "Trade lot size must be greater than zero."
            )

        if Decimal(str(entry_price)) <= 0:
            raise WorkerRepositoryError(
                "Trade entry price must be greater than zero."
            )

        if Decimal(str(original_risk_amount)) <= 0:
            raise WorkerRepositoryError(
                "Original risk amount must be greater than zero."
            )

        opened_time = opened_at or datetime.now(timezone.utc)
        if opened_time.tzinfo is None:
            opened_time = opened_time.replace(tzinfo=timezone.utc)

        payload: dict[str, Any] = {
            "user_id": str(user_id),
            "bot_instance_id": str(bot_instance_id),
            "broker_account_id": str(broker_account_id),
            "mt5_ticket": int(mt5_ticket),
            "symbol": clean_symbol,
            "broker_symbol": broker_symbol,
            "trade_type": clean_trade_type,
            "lot_size": str(lot_size),
            "entry_price": str(entry_price),
            "stop_loss": str(stop_loss),
            "take_profit": str(take_profit),
            "status": "open",
            "opened_at": opened_time.isoformat(),
            "strategy_name": strategy_name,
            "original_risk_amount": str(original_risk_amount),
        }

        try:
            response = (
                self._client
                .table("trades")
                .insert(payload)
                .execute()
            )
        except Exception as exc:
            raise WorkerRepositoryError(
                f"Unable to create open trade record: {exc}"
            ) from exc

        rows = response.data or []
        if not rows or not rows[0].get("id"):
            raise WorkerRepositoryError(
                "Trade insert succeeded but returned no trade ID."
            )

        return _as_uuid(rows[0]["id"])

    def create_position(
        self,
        *,
        user_id: UUID | str,
        bot_instance_id: UUID | str,
        broker_account_id: UUID | str,
        trade_id: UUID | str,
        mt5_position_ticket: int,
        symbol: str,
        position_type: str,
        lot_size: Decimal | float,
        open_price: Decimal | float,
        current_price: Decimal | float,
        stop_loss: Decimal | float,
        take_profit: Decimal | float,
        floating_profit_loss: Decimal | float,
        original_stop_loss: Decimal | float,
        original_risk_distance: Decimal | float,
        original_risk_amount: Decimal | float,
        broker_symbol: str | None = None,
        highest_r_reached: Decimal | float = 0,
        opened_at: datetime | None = None,
    ) -> UUID:
        """Persist one live MT5 position, safely handling duplicate ticket recovery."""

        clean_symbol = symbol.strip()
        clean_position_type = position_type.strip().lower()

        if not clean_symbol:
            raise WorkerRepositoryError("Position symbol is required.")

        if clean_position_type not in {"buy", "sell"}:
            raise WorkerRepositoryError(
                "Position type must be 'buy' or 'sell'."
            )

        if int(mt5_position_ticket) <= 0:
            raise WorkerRepositoryError(
                "MT5 position ticket must be greater than zero."
            )

        if Decimal(str(lot_size)) <= 0:
            raise WorkerRepositoryError(
                "Position lot size must be greater than zero."
            )

        if Decimal(str(open_price)) <= 0:
            raise WorkerRepositoryError(
                "Position open price must be greater than zero."
            )

        if Decimal(str(original_risk_distance)) <= 0:
            raise WorkerRepositoryError(
                "Original risk distance must be greater than zero."
            )

        if Decimal(str(original_risk_amount)) <= 0:
            raise WorkerRepositoryError(
                "Original risk amount must be greater than zero."
            )

        if Decimal(str(highest_r_reached)) < 0:
            raise WorkerRepositoryError(
                "Highest R reached cannot be negative."
            )

        opened_time = opened_at or datetime.now(timezone.utc)
        if opened_time.tzinfo is None:
            opened_time = opened_time.replace(tzinfo=timezone.utc)

        sync_time = datetime.now(timezone.utc).isoformat()

        payload: dict[str, Any] = {
            "user_id": str(user_id),
            "bot_instance_id": str(bot_instance_id),
            "broker_account_id": str(broker_account_id),
            "trade_id": str(trade_id),
            "mt5_position_ticket": int(mt5_position_ticket),
            "symbol": clean_symbol,
            "broker_symbol": broker_symbol,
            "position_type": clean_position_type,
            "lot_size": str(lot_size),
            "open_price": str(open_price),
            "current_price": str(current_price),
            "stop_loss": str(stop_loss),
            "take_profit": str(take_profit),
            "floating_profit_loss": str(floating_profit_loss),
            "opened_at": opened_time.isoformat(),
            "last_synced_at": sync_time,
            "original_stop_loss": str(original_stop_loss),
            "original_risk_distance": str(original_risk_distance),
            "original_risk_amount": str(original_risk_amount),
            "highest_r_reached": str(highest_r_reached),
        }

        try:
            response = (
                self._client
                .table("positions")
                .upsert(
                    payload,
                    on_conflict="broker_account_id,mt5_position_ticket",
                )
                .execute()
            )
        except Exception as exc:
            raise WorkerRepositoryError(
                f"Unable to persist live position: {exc}"
            ) from exc

        rows = response.data or []
        if not rows or not rows[0].get("id"):
            raise WorkerRepositoryError(
                "Position persistence succeeded but returned no position ID."
            )

        return _as_uuid(rows[0]["id"])

    def close_trade(
        self,
        trade_id: UUID | str,
        *,
        exit_price: Decimal | float,
        profit_loss: Decimal | float,
        close_reason: str,
        realized_r: Decimal | float,
        commission: Decimal | float | None = None,
        swap: Decimal | float | None = None,
        closed_at: datetime | None = None,
    ) -> None:
        """Finalize a TradeLogic trade after its MT5 position has closed."""

        if Decimal(str(exit_price)) <= 0:
            raise WorkerRepositoryError(
                "Trade exit price must be greater than zero."
            )

        clean_reason = close_reason.strip()
        if not clean_reason:
            raise WorkerRepositoryError(
                "Trade close reason is required."
            )

        closed_time = closed_at or datetime.now(timezone.utc)
        if closed_time.tzinfo is None:
            closed_time = closed_time.replace(tzinfo=timezone.utc)

        payload: dict[str, Any] = {
            "exit_price": str(exit_price),
            "profit_loss": str(profit_loss),
            "status": "closed",
            "closed_at": closed_time.isoformat(),
            "close_reason": clean_reason,
            "realized_r": str(realized_r),
        }

        if commission is not None:
            payload["commission"] = str(commission)

        if swap is not None:
            payload["swap"] = str(swap)

        try:
            (
                self._client
                .table("trades")
                .update(payload)
                .eq("id", str(trade_id))
                .execute()
            )
        except Exception as exc:
            raise WorkerRepositoryError(
                f"Unable to close trade record: {exc}"
            ) from exc

    def delete_position(
        self,
        position_id: UUID | str,
    ) -> None:
        """Remove a position row after the corresponding MT5 position is closed."""

        try:
            (
                self._client
                .table("positions")
                .delete()
                .eq("id", str(position_id))
                .execute()
            )
        except Exception as exc:
            raise WorkerRepositoryError(
                f"Unable to delete closed position record: {exc}"
            ) from exc

