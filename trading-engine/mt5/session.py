"""
TradeLogic - MetaTrader 5 Session Manager

Manages the single active MT5 account session owned by one TradeLogic
worker process / terminal instance.

Responsibilities:
- bind one MT5 terminal instance to one customer account at a time
- initialize the terminal
- decrypt the broker credential only when login/relogin is required
- verify that the live MT5 account matches the expected login/server
- detect stale or unhealthy terminal/account sessions
- reconnect the expected account when necessary
- prevent accidental reuse of a terminal session for another account
- shut down the terminal cleanly

This module does NOT:
- read/write Supabase
- process worker commands
- decide subscription eligibility
- open, modify, or close trades
- implement strategy logic

IMPORTANT:
The MetaTrader5 Python module is process-global. A worker process must treat
one initialized terminal session as one active account context at a time.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from threading import RLock
from uuid import UUID

from mt5.account import (
    MT5AccountError,
    MT5AccountSnapshot,
    login_account,
    verify_connected_account,
)
from mt5.terminal import (
    MT5TerminalError,
    MT5TerminalHealth,
    get_terminal_health,
    initialize_terminal,
    shutdown_terminal,
)
from security.broker_credentials import (
    BrokerCredentialError,
    decrypt_broker_credential,
)


class MT5SessionError(RuntimeError):
    """Raised when an MT5 account session cannot be established safely."""


@dataclass(frozen=True)
class MT5SessionSpec:
    """
    Expected account/terminal identity for one TradeLogic broker account.

    encrypted_password remains encrypted at rest/in application state.
    Plaintext exists only transiently during login.
    """

    broker_account_id: UUID
    mt5_login: int
    mt5_server: str
    encrypted_password: str
    terminal_path: str | None = None


@dataclass(frozen=True)
class MT5SessionState:
    broker_account_id: UUID
    mt5_login: int
    mt5_server: str

    connected: bool
    healthy: bool

    terminal_health: MT5TerminalHealth
    account_snapshot: MT5AccountSnapshot | None


def _normalize_server(server: str) -> str:
    return server.strip().lower()


def _normalize_terminal_path(
    terminal_path: str | None,
) -> str | None:
    if terminal_path is None:
        return None

    clean_path = str(
        Path(terminal_path).expanduser()
    ).strip()

    if not clean_path:
        raise MT5SessionError(
            "MT5 terminal path cannot be empty."
        )

    return clean_path


def _validate_spec(
    spec: MT5SessionSpec,
) -> None:
    if spec.mt5_login <= 0:
        raise MT5SessionError(
            "MT5 login must be greater than zero."
        )

    if not spec.mt5_server.strip():
        raise MT5SessionError(
            "MT5 server is required."
        )

    if not spec.encrypted_password.strip():
        raise MT5SessionError(
            "Encrypted MT5 password is required."
        )

    _normalize_terminal_path(
        spec.terminal_path
    )


class MT5SessionManager:
    """
    Own one process-global MT5 account session.

    Session operations are serialized because MetaTrader5 communicates with
    one terminal/account context per Python process.

    A credential change is treated as a different binding even when the
    broker account ID/login/server are unchanged. This guarantees that a
    newly submitted trading password is actually tested on reconnect.
    """

    def __init__(self) -> None:
        self._lock = RLock()
        self._active_spec: MT5SessionSpec | None = None

    @property
    def active_spec(
        self,
    ) -> MT5SessionSpec | None:
        with self._lock:
            return self._active_spec

    def _same_binding(
        self,
        left: MT5SessionSpec,
        right: MT5SessionSpec,
    ) -> bool:
        return (
            left.broker_account_id
            == right.broker_account_id
            and left.mt5_login
            == right.mt5_login
            and _normalize_server(left.mt5_server)
            == _normalize_server(right.mt5_server)
            and left.encrypted_password
            == right.encrypted_password
            and _normalize_terminal_path(left.terminal_path)
            == _normalize_terminal_path(right.terminal_path)
        )

    def _shutdown_unlocked(
        self,
    ) -> None:
        try:
            shutdown_terminal()
        finally:
            self._active_spec = None

    def disconnect(
        self,
        *,
        expected_broker_account_id: UUID | None = None,
    ) -> bool:
        """
        Shut down the current MT5 session.

        If expected_broker_account_id is supplied and another account is bound
        to this process, that unrelated session is left untouched.

        Returns True when this call shut down the active session, otherwise
        False.
        """

        with self._lock:
            if self._active_spec is None:
                # Best-effort cleanup in case MT5 was initialized outside this
                # manager before the worker adopted centralized ownership.
                try:
                    shutdown_terminal()
                except Exception:
                    pass
                return False

            if (
                expected_broker_account_id is not None
                and self._active_spec.broker_account_id
                != expected_broker_account_id
            ):
                return False

            self._shutdown_unlocked()
            return True

    def _login_unlocked(
        self,
        spec: MT5SessionSpec,
    ) -> MT5AccountSnapshot:
        """
        Initialize and log into the requested MT5 account.

        Caller must hold self._lock.
        """

        _validate_spec(
            spec
        )

        terminal_path = _normalize_terminal_path(
            spec.terminal_path
        )

        try:
            initialize_terminal(
                terminal_path=terminal_path
            )

            password = decrypt_broker_credential(
                spec.encrypted_password
            )

            try:
                login_account(
                    login=spec.mt5_login,
                    password=password,
                    server=spec.mt5_server,
                )
            finally:
                password = ""

            snapshot = verify_connected_account(
                expected_login=spec.mt5_login,
                expected_server=spec.mt5_server,
            )

            health = get_terminal_health()

            if not health.initialized:
                raise MT5SessionError(
                    "MetaTrader 5 terminal is not initialized."
                )

            if not health.terminal_connected:
                raise MT5SessionError(
                    "MetaTrader 5 terminal is not connected to the broker."
                )

            self._active_spec = spec

            return snapshot

        except (
            MT5TerminalError,
            MT5AccountError,
            BrokerCredentialError,
            MT5SessionError,
        ) as exc:
            try:
                shutdown_terminal()
            finally:
                self._active_spec = None

            raise MT5SessionError(
                f"Unable to establish MT5 session: {exc}"
            ) from exc

        except Exception as exc:
            try:
                shutdown_terminal()
            finally:
                self._active_spec = None

            raise MT5SessionError(
                f"Unexpected MT5 session failure: {exc}"
            ) from exc

    def connect(
        self,
        spec: MT5SessionSpec,
        *,
        force_reconnect: bool = False,
    ) -> MT5AccountSnapshot:
        """
        Establish the requested account session.

        If the exact same account/credential binding is already healthy, its
        current safe snapshot is returned unless force_reconnect=True.

        If another account is currently bound, that session is shut down
        before the requested account is initialized.
        """

        with self._lock:
            _validate_spec(
                spec
            )

            if (
                self._active_spec is not None
                and self._same_binding(
                    self._active_spec,
                    spec,
                )
                and not force_reconnect
            ):
                state = self._inspect_unlocked(
                    expected_spec=spec
                )

                if (
                    state.healthy
                    and state.account_snapshot is not None
                ):
                    return state.account_snapshot

            if self._active_spec is not None:
                self._shutdown_unlocked()

            return self._login_unlocked(
                spec
            )

    def _inspect_unlocked(
        self,
        *,
        expected_spec: MT5SessionSpec | None,
    ) -> MT5SessionState:
        """
        Inspect the current MT5 terminal/account context.

        Caller must hold self._lock.
        """

        health = get_terminal_health()

        spec = (
            expected_spec
            if expected_spec is not None
            else self._active_spec
        )

        if spec is None:
            raise MT5SessionError(
                "No MT5 session binding is currently available."
            )

        if (
            not health.initialized
            or not health.terminal_connected
        ):
            return MT5SessionState(
                broker_account_id=spec.broker_account_id,
                mt5_login=spec.mt5_login,
                mt5_server=spec.mt5_server,
                connected=False,
                healthy=False,
                terminal_health=health,
                account_snapshot=None,
            )

        try:
            snapshot = verify_connected_account(
                expected_login=spec.mt5_login,
                expected_server=spec.mt5_server,
            )
        except MT5AccountError:
            return MT5SessionState(
                broker_account_id=spec.broker_account_id,
                mt5_login=spec.mt5_login,
                mt5_server=spec.mt5_server,
                connected=True,
                healthy=False,
                terminal_health=health,
                account_snapshot=None,
            )

        return MT5SessionState(
            broker_account_id=spec.broker_account_id,
            mt5_login=spec.mt5_login,
            mt5_server=spec.mt5_server,
            connected=True,
            healthy=True,
            terminal_health=health,
            account_snapshot=snapshot,
        )

    def inspect(
        self,
        *,
        expected_spec: MT5SessionSpec | None = None,
    ) -> MT5SessionState:
        """
        Return the current session state without changing account bindings.
        """

        with self._lock:
            if (
                expected_spec is not None
                and self._active_spec is not None
                and not self._same_binding(
                    self._active_spec,
                    expected_spec,
                )
            ):
                health = get_terminal_health()

                return MT5SessionState(
                    broker_account_id=expected_spec.broker_account_id,
                    mt5_login=expected_spec.mt5_login,
                    mt5_server=expected_spec.mt5_server,
                    connected=bool(
                        health.terminal_connected
                    ),
                    healthy=False,
                    terminal_health=health,
                    account_snapshot=None,
                )

            return self._inspect_unlocked(
                expected_spec=expected_spec
            )

    def ensure_connected(
        self,
        spec: MT5SessionSpec,
    ) -> MT5AccountSnapshot:
        """
        Ensure that the requested MT5 account is the live healthy session.

        Healthy matching session:
            return current account snapshot.

        Missing/stale/wrong/credential-changed session:
            safely reconnect the requested account.
        """

        with self._lock:
            _validate_spec(
                spec
            )

            if (
                self._active_spec is not None
                and self._same_binding(
                    self._active_spec,
                    spec,
                )
            ):
                state = self._inspect_unlocked(
                    expected_spec=spec
                )

                if (
                    state.healthy
                    and state.account_snapshot is not None
                ):
                    return state.account_snapshot

            if self._active_spec is not None:
                self._shutdown_unlocked()

            return self._login_unlocked(
                spec
            )


_default_session_manager = MT5SessionManager()


def get_mt5_session_manager() -> MT5SessionManager:
    """
    Return the worker process's default MT5 session manager.
    """

    return _default_session_manager
