"""
TradeLogic - MT5 Open Position Discovery

Reads currently open MT5 positions belonging to TradeLogic Strategy 1.

Used for:
- one-position-per-symbol enforcement
- maximum Strategy 1 position count
- worker restart/recovery
- locating positions that must continue to be managed

This module does NOT:
- open trades
- modify trades
- close trades
- make strategy decisions
"""

from __future__ import annotations

from dataclasses import dataclass

import MetaTrader5 as mt5

from execution.orders import (
    DEFAULT_MAGIC,
    MT5ExecutionError,
    OrderDirection,
)


@dataclass(frozen=True)
class Strategy1OpenPosition:
    ticket: int
    symbol: str
    direction: OrderDirection

    volume: float

    open_price: float
    current_price: float

    stop_loss: float
    take_profit: float

    profit: float

    magic: int
    comment: str | None


def _position_direction(
    mt5_position_type: int,
) -> OrderDirection:
    if mt5_position_type == mt5.POSITION_TYPE_BUY:
        return OrderDirection.BUY

    if mt5_position_type == mt5.POSITION_TYPE_SELL:
        return OrderDirection.SELL

    raise MT5ExecutionError(
        f"Unsupported MT5 position type: {mt5_position_type}."
    )


def get_strategy_1_positions(
    *,
    magic: int = DEFAULT_MAGIC,
) -> list[Strategy1OpenPosition]:
    """
    Return all currently open Strategy 1 positions.

    Only positions whose MT5 magic number matches TradeLogic
    Strategy 1 are returned.
    """

    positions = mt5.positions_get()

    if positions is None:
        error = mt5.last_error()

        code = (
            error[0]
            if error and len(error) > 0
            else None
        )

        message = (
            str(error[1])
            if error and len(error) > 1
            else None
        )

        raise MT5ExecutionError(
            "Unable to retrieve open MT5 positions "
            f"(code={code}, message={message})."
        )

    result: list[Strategy1OpenPosition] = []

    for position in positions:
        position_magic = int(
            getattr(position, "magic", 0)
        )

        if position_magic != int(magic):
            continue

        result.append(
            Strategy1OpenPosition(
                ticket=int(position.ticket),
                symbol=str(position.symbol),
                direction=_position_direction(
                    int(position.type)
                ),
                volume=float(position.volume),
                open_price=float(position.price_open),
                current_price=float(position.price_current),
                stop_loss=float(position.sl),
                take_profit=float(position.tp),
                profit=float(position.profit),
                magic=position_magic,
                comment=getattr(
                    position,
                    "comment",
                    None,
                ),
            )
        )

    return result


def get_strategy_1_position_for_symbol(
    *,
    symbol: str,
    magic: int = DEFAULT_MAGIC,
) -> Strategy1OpenPosition | None:
    """
    Return the currently open Strategy 1 position for one symbol.

    Strategy 1 permits only one position per symbol.

    If more than one matching position somehow exists, execution
    is stopped rather than silently choosing one.
    """

    clean_symbol = symbol.strip()

    if not clean_symbol:
        raise MT5ExecutionError(
            "Symbol is required."
        )

    matches = [
        position
        for position in get_strategy_1_positions(
            magic=magic
        )
        if position.symbol == clean_symbol
    ]

    if len(matches) > 1:
        raise MT5ExecutionError(
            f"More than one Strategy 1 position exists for "
            f"'{clean_symbol}'. Manual investigation is required."
        )

    if not matches:
        return None

    return matches[0]


def count_strategy_1_positions(
    *,
    magic: int = DEFAULT_MAGIC,
) -> int:
    """
    Return the number of currently open Strategy 1 positions.
    """

    return len(
        get_strategy_1_positions(
            magic=magic
        )
    )


def can_open_strategy_1_symbol(
    *,
    symbol: str,
    max_total_positions: int,
    magic: int = DEFAULT_MAGIC,
) -> tuple[bool, str]:
    """
    Check Strategy 1's MT5 position concurrency rules.

    Returns:
        (True, "allowed")
    or:
        (False, reason)
    """

    clean_symbol = symbol.strip()

    if not clean_symbol:
        return False, "symbol_required"

    positions = get_strategy_1_positions(
        magic=magic
    )

    if any(
        position.symbol == clean_symbol
        for position in positions
    ):
        return False, "symbol_position_already_open"

    if len(positions) >= max_total_positions:
        return False, "maximum_strategy_positions_reached"

    return True, "allowed"