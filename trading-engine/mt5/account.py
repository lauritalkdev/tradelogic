"""
TradeLogic - MetaTrader 5 Account Session

Handles:
- logging into an MT5 trading account
- reading the connected account information
- producing a safe account snapshot
- validating that the connected account matches the requested login/server

This module does NOT:
- store broker credentials
- encrypt/decrypt credentials
- place or modify trades
- implement strategy logic
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import MetaTrader5 as mt5


class MT5AccountError(RuntimeError):
    """Raised when an MT5 account operation fails."""


@dataclass(frozen=True)
class MT5AccountSnapshot:
    login: int
    name: str | None
    server: str | None
    company: str | None
    currency: str | None

    balance: float
    credit: float
    profit: float
    equity: float

    margin: float
    free_margin: float
    margin_level: float | None

    leverage: int | None

    trade_allowed: bool
    trade_expert_allowed: bool

    trade_mode: int | None


def _last_error() -> tuple[int | None, str | None]:
    """
    Safely return the latest MetaTrader5 error.
    """
    try:
        error = mt5.last_error()

        if not error:
            return None, None

        code = error[0] if len(error) > 0 else None
        message = (
            str(error[1])
            if len(error) > 1
            else None
        )

        return code, message

    except Exception as exc:
        return None, str(exc)


def _normalize_server(server: str) -> str:
    """
    Normalize a server name for comparison only.

    MT5 server names are not modified before being passed to MT5.
    """
    return server.strip().lower()


def login_account(
    *,
    login: int,
    password: str,
    server: str,
) -> None:
    """
    Log the currently initialized MT5 terminal into an account.

    initialize_terminal() must be called before this function.

    Credentials are passed directly to MetaTrader 5 and are never
    returned, logged, or persisted by this module.
    """

    if login <= 0:
        raise MT5AccountError(
            "MT5 login must be greater than zero."
        )

    if not password or not password.strip():
        raise MT5AccountError(
            "MT5 trading password is required."
        )

    if not server or not server.strip():
        raise MT5AccountError(
            "MT5 server is required."
        )

    terminal_info = mt5.terminal_info()

    if terminal_info is None:
        raise MT5AccountError(
            "MetaTrader 5 terminal is not initialized."
        )

    logged_in = mt5.login(
        login=int(login),
        password=password,
        server=server.strip(),
    )

    if not logged_in:
        code, message = _last_error()

        raise MT5AccountError(
            "Unable to log into the MT5 account "
            f"(code={code}, message={message})."
        )

    account_info = mt5.account_info()

    if account_info is None:
        code, message = _last_error()

        raise MT5AccountError(
            "MT5 login reported success but account information "
            f"could not be read "
            f"(code={code}, message={message})."
        )

    connected_login = int(
        getattr(account_info, "login", 0)
    )

    connected_server = str(
        getattr(account_info, "server", "")
    ).strip()

    if connected_login != int(login):
        raise MT5AccountError(
            "MT5 connected to a different account than requested."
        )

    if (
        connected_server
        and _normalize_server(connected_server)
        != _normalize_server(server)
    ):
        raise MT5AccountError(
            "MT5 connected to a different server than requested."
        )


def get_account_snapshot() -> MT5AccountSnapshot:
    """
    Return a safe snapshot of the currently connected MT5 account.

    No password or sensitive credential is included.
    """

    account_info = mt5.account_info()

    if account_info is None:
        code, message = _last_error()

        raise MT5AccountError(
            "Unable to read MT5 account information "
            f"(code={code}, message={message})."
        )

    margin_level_raw = getattr(
        account_info,
        "margin_level",
        None,
    )

    margin_level = (
        float(margin_level_raw)
        if margin_level_raw is not None
        else None
    )

    leverage_raw = getattr(
        account_info,
        "leverage",
        None,
    )

    leverage = (
        int(leverage_raw)
        if leverage_raw is not None
        else None
    )

    trade_mode_raw = getattr(
        account_info,
        "trade_mode",
        None,
    )

    trade_mode = (
        int(trade_mode_raw)
        if trade_mode_raw is not None
        else None
    )

    return MT5AccountSnapshot(
        login=int(
            getattr(account_info, "login", 0)
        ),
        name=getattr(
            account_info,
            "name",
            None,
        ),
        server=getattr(
            account_info,
            "server",
            None,
        ),
        company=getattr(
            account_info,
            "company",
            None,
        ),
        currency=getattr(
            account_info,
            "currency",
            None,
        ),
        balance=float(
            getattr(account_info, "balance", 0.0)
        ),
        credit=float(
            getattr(account_info, "credit", 0.0)
        ),
        profit=float(
            getattr(account_info, "profit", 0.0)
        ),
        equity=float(
            getattr(account_info, "equity", 0.0)
        ),
        margin=float(
            getattr(account_info, "margin", 0.0)
        ),
        free_margin=float(
            getattr(account_info, "margin_free", 0.0)
        ),
        margin_level=margin_level,
        leverage=leverage,
        trade_allowed=bool(
            getattr(account_info, "trade_allowed", False)
        ),
        trade_expert_allowed=bool(
            getattr(
                account_info,
                "trade_expert",
                False,
            )
        ),
        trade_mode=trade_mode,
    )


def get_account_info() -> dict[str, Any]:
    """
    Return the raw MT5 account information as a plain dictionary.

    Intended for trusted worker diagnostics.

    MT5 account_info() does not expose the account password.
    """

    account_info = mt5.account_info()

    if account_info is None:
        code, message = _last_error()

        raise MT5AccountError(
            "Unable to read MT5 account information "
            f"(code={code}, message={message})."
        )

    if hasattr(account_info, "_asdict"):
        return dict(account_info._asdict())

    snapshot = get_account_snapshot()

    return {
        "login": snapshot.login,
        "name": snapshot.name,
        "server": snapshot.server,
        "company": snapshot.company,
        "currency": snapshot.currency,
        "balance": snapshot.balance,
        "credit": snapshot.credit,
        "profit": snapshot.profit,
        "equity": snapshot.equity,
        "margin": snapshot.margin,
        "margin_free": snapshot.free_margin,
        "margin_level": snapshot.margin_level,
        "leverage": snapshot.leverage,
        "trade_allowed": snapshot.trade_allowed,
        "trade_expert": snapshot.trade_expert_allowed,
        "trade_mode": snapshot.trade_mode,
    }


def verify_connected_account(
    *,
    expected_login: int,
    expected_server: str,
) -> MT5AccountSnapshot:
    """
    Verify that MT5 is connected to the requested account.

    Returns the safe account snapshot if verification succeeds.
    """

    snapshot = get_account_snapshot()

    if snapshot.login != int(expected_login):
        raise MT5AccountError(
            "Connected MT5 account login does not match "
            "the expected customer account."
        )

    if snapshot.server:
        if (
            _normalize_server(snapshot.server)
            != _normalize_server(expected_server)
        ):
            raise MT5AccountError(
                "Connected MT5 server does not match "
                "the expected customer server."
            )

    return snapshot