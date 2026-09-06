"""
TradeLogic - MetaTrader 5 Terminal Interface

Provides the low-level MT5 terminal initialization, health checking,
terminal information, and clean shutdown functionality.

This module does NOT:
- store broker credentials
- log into a customer's trading account
- place trades
- implement strategy logic
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import MetaTrader5 as mt5


class MT5TerminalError(RuntimeError):
    """Raised when the MetaTrader 5 terminal cannot be initialized."""


@dataclass(frozen=True)
class MT5TerminalHealth:
    initialized: bool
    terminal_connected: bool
    trade_allowed: bool
    terminal_name: str | None
    terminal_path: str | None
    company: str | None
    build: int | None
    last_error_code: int | None = None
    last_error_message: str | None = None


def _last_error() -> tuple[int | None, str | None]:
    """Return the most recent MetaTrader5 error safely."""
    try:
        error = mt5.last_error()

        if not error:
            return None, None

        code = error[0] if len(error) > 0 else None
        message = str(error[1]) if len(error) > 1 else None

        return code, message

    except Exception as exc:
        return None, str(exc)


def initialize_terminal(terminal_path: str | None = None) -> None:
    """
    Initialize communication with an installed MetaTrader 5 terminal.

    If terminal_path is None, MetaTrader5 attempts to locate an installed
    MT5 terminal automatically.
    """
    if terminal_path:
        initialized = mt5.initialize(path=terminal_path)
    else:
        initialized = mt5.initialize()

    if initialized:
        return

    code, message = _last_error()

    raise MT5TerminalError(
        f"MetaTrader 5 initialization failed "
        f"(code={code}, message={message})."
    )


def get_terminal_health() -> MT5TerminalHealth:
    """
    Read the current MT5 terminal state.

    initialize_terminal() should normally be called first.
    """
    terminal_info = mt5.terminal_info()

    if terminal_info is None:
        code, message = _last_error()

        return MT5TerminalHealth(
            initialized=False,
            terminal_connected=False,
            trade_allowed=False,
            terminal_name=None,
            terminal_path=None,
            company=None,
            build=None,
            last_error_code=code,
            last_error_message=message,
        )

    return MT5TerminalHealth(
        initialized=True,
        terminal_connected=bool(
            getattr(terminal_info, "connected", False)
        ),
        trade_allowed=bool(
            getattr(terminal_info, "trade_allowed", False)
        ),
        terminal_name=getattr(terminal_info, "name", None),
        terminal_path=getattr(terminal_info, "path", None),
        company=getattr(terminal_info, "company", None),
        build=getattr(terminal_info, "build", None),
    )


def get_terminal_info() -> dict[str, Any]:
    """
    Return MT5 terminal information as a plain dictionary.

    Useful later for worker diagnostics and execution logs.
    """
    terminal_info = mt5.terminal_info()

    if terminal_info is None:
        code, message = _last_error()

        raise MT5TerminalError(
            f"Unable to read MetaTrader 5 terminal information "
            f"(code={code}, message={message})."
        )

    if hasattr(terminal_info, "_asdict"):
        return dict(terminal_info._asdict())

    return {
        "connected": getattr(terminal_info, "connected", None),
        "trade_allowed": getattr(terminal_info, "trade_allowed", None),
        "name": getattr(terminal_info, "name", None),
        "path": getattr(terminal_info, "path", None),
        "company": getattr(terminal_info, "company", None),
        "build": getattr(terminal_info, "build", None),
    }


def shutdown_terminal() -> None:
    """Cleanly close the Python connection to MetaTrader 5."""
    mt5.shutdown()