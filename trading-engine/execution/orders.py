"""
TradeLogic - MetaTrader 5 Order Execution

Low-level execution functions for:

- opening BUY / SELL market positions
- attaching stop-loss and take-profit
- modifying SL / TP
- closing an open position
- reading a single MT5 position

This module does NOT:
- determine strategy signals
- calculate indicators
- calculate position size
- manage circuit-breaker rules
- decide when the R-ratchet should advance

Those decisions are made elsewhere and passed into this layer.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any

import MetaTrader5 as mt5

from mt5.market import ensure_symbol_selected


class MT5ExecutionError(RuntimeError):
    """Raised when an MT5 trading operation cannot be completed."""


class OrderDirection(str, Enum):
    BUY = "buy"
    SELL = "sell"


@dataclass(frozen=True)
class MT5ExecutionResult:
    success: bool

    action: str
    symbol: str

    order_ticket: int | None
    deal_ticket: int | None
    position_ticket: int | None

    volume: float | None
    price: float | None

    stop_loss: float | None
    take_profit: float | None

    retcode: int | None
    comment: str | None


@dataclass(frozen=True)
class MT5PositionSnapshot:
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


DEFAULT_MAGIC = 5101001
DEFAULT_DEVIATION_POINTS = 20
DEFAULT_COMMENT = "TradeLogic Strategy 1"


def _last_error() -> tuple[int | None, str | None]:
    """Return the most recent MetaTrader5 error safely."""
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


def _normalize_price(
    *,
    symbol: str,
    price: float,
) -> float:
    """
    Normalize a price to the broker's symbol digits.
    """
    info = mt5.symbol_info(symbol)

    if info is None:
        raise MT5ExecutionError(
            f"Unable to read symbol information for '{symbol}'."
        )

    digits = int(
        getattr(info, "digits", 0)
    )

    return round(
        float(price),
        digits,
    )


def _validate_volume(
    *,
    symbol: str,
    volume: float,
) -> None:
    """
    Validate that volume respects the broker's lot constraints.

    The risk engine should already normalize the volume before
    reaching this layer. This validation is an additional safeguard.
    """
    if volume <= 0:
        raise MT5ExecutionError(
            "Order volume must be greater than zero."
        )

    info = mt5.symbol_info(symbol)

    if info is None:
        raise MT5ExecutionError(
            f"Unable to read symbol information for '{symbol}'."
        )

    volume_min = float(
        getattr(info, "volume_min", 0.0)
    )

    volume_max = float(
        getattr(info, "volume_max", 0.0)
    )

    if volume < volume_min:
        raise MT5ExecutionError(
            f"Volume {volume} is below broker minimum "
            f"{volume_min} for '{symbol}'."
        )

    if volume > volume_max:
        raise MT5ExecutionError(
            f"Volume {volume} exceeds broker maximum "
            f"{volume_max} for '{symbol}'."
        )


def _preferred_filling_mode(
    symbol: str,
) -> int:
    """
    Return the broker-reported filling mode when possible.

    If MT5 does not provide a usable value, IOC is used as the
    conservative fallback for market execution.

    Broker-specific execution behaviour will be validated during
    the Exness demo integration stage.
    """
    info = mt5.symbol_info(symbol)

    if info is None:
        raise MT5ExecutionError(
            f"Unable to read filling mode for '{symbol}'."
        )

    filling_mode = getattr(
        info,
        "filling_mode",
        None,
    )

    supported_modes = {
        mt5.ORDER_FILLING_FOK,
        mt5.ORDER_FILLING_IOC,
        mt5.ORDER_FILLING_RETURN,
    }

    if filling_mode in supported_modes:
        return int(filling_mode)

    return mt5.ORDER_FILLING_IOC


def _result_to_execution_result(
    *,
    result: Any,
    action: str,
    symbol: str,
    stop_loss: float | None = None,
    take_profit: float | None = None,
    position_ticket: int | None = None,
) -> MT5ExecutionResult:
    """
    Convert an MT5 order result into TradeLogic's safe result model.
    """
    return MT5ExecutionResult(
        success=(
            getattr(result, "retcode", None)
            == mt5.TRADE_RETCODE_DONE
        ),
        action=action,
        symbol=symbol,
        order_ticket=(
            int(getattr(result, "order", 0))
            if getattr(result, "order", 0)
            else None
        ),
        deal_ticket=(
            int(getattr(result, "deal", 0))
            if getattr(result, "deal", 0)
            else None
        ),
        position_ticket=position_ticket,
        volume=(
            float(getattr(result, "volume", 0.0))
            if getattr(result, "volume", None) is not None
            else None
        ),
        price=(
            float(getattr(result, "price", 0.0))
            if getattr(result, "price", None) is not None
            else None
        ),
        stop_loss=stop_loss,
        take_profit=take_profit,
        retcode=getattr(result, "retcode", None),
        comment=getattr(result, "comment", None),
    )


def _raise_order_failure(
    *,
    action: str,
    symbol: str,
    result: Any | None,
) -> None:
    """
    Raise a useful execution error without exposing credentials.
    """
    if result is None:
        code, message = _last_error()

        raise MT5ExecutionError(
            f"MT5 {action} failed for '{symbol}' "
            f"(code={code}, message={message})."
        )

    raise MT5ExecutionError(
        f"MT5 {action} failed for '{symbol}' "
        f"(retcode={getattr(result, 'retcode', None)}, "
        f"comment={getattr(result, 'comment', None)})."
    )


def open_market_position(
    *,
    symbol: str,
    direction: OrderDirection,
    volume: float,
    stop_loss: float,
    take_profit: float,
    magic: int = DEFAULT_MAGIC,
    deviation_points: int = DEFAULT_DEVIATION_POINTS,
    comment: str = DEFAULT_COMMENT,
) -> MT5ExecutionResult:
    """
    Open a market BUY or SELL position with SL and TP.

    BUY:
        executes using Ask

    SELL:
        executes using Bid
    """
    clean_symbol = symbol.strip()

    if not clean_symbol:
        raise MT5ExecutionError(
            "Symbol is required."
        )

    broker_symbol = ensure_symbol_selected(
        clean_symbol
    )

    _validate_volume(
        symbol=broker_symbol,
        volume=volume,
    )

    tick = mt5.symbol_info_tick(
        broker_symbol
    )

    if tick is None:
        code, message = _last_error()

        raise MT5ExecutionError(
            f"Unable to read live price for '{clean_symbol}' "
            f"(code={code}, message={message})."
        )

    if direction == OrderDirection.BUY:
        order_type = mt5.ORDER_TYPE_BUY
        entry_price = float(tick.ask)

        if stop_loss >= entry_price:
            raise MT5ExecutionError(
                "BUY stop-loss must be below the market entry price."
            )

        if take_profit <= entry_price:
            raise MT5ExecutionError(
                "BUY take-profit must be above the market entry price."
            )

    elif direction == OrderDirection.SELL:
        order_type = mt5.ORDER_TYPE_SELL
        entry_price = float(tick.bid)

        if stop_loss <= entry_price:
            raise MT5ExecutionError(
                "SELL stop-loss must be above the market entry price."
            )

        if take_profit >= entry_price:
            raise MT5ExecutionError(
                "SELL take-profit must be below the market entry price."
            )

    else:
        raise MT5ExecutionError(
            "Direction must be BUY or SELL."
        )

    normalized_price = _normalize_price(
        symbol=broker_symbol,
        price=entry_price,
    )

    normalized_sl = _normalize_price(
        symbol=broker_symbol,
        price=stop_loss,
    )

    normalized_tp = _normalize_price(
        symbol=broker_symbol,
        price=take_profit,
    )

    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": broker_symbol,
        "volume": float(volume),
        "type": order_type,
        "price": normalized_price,
        "sl": normalized_sl,
        "tp": normalized_tp,
        "deviation": int(deviation_points),
        "magic": int(magic),
        "comment": comment,
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": _preferred_filling_mode(
            broker_symbol
        ),
    }

    result = mt5.order_send(
        request
    )

    if (
        result is None
        or getattr(result, "retcode", None)
        != mt5.TRADE_RETCODE_DONE
    ):
        _raise_order_failure(
            action="market order",
            symbol=broker_symbol,
            result=result,
        )

    position_ticket = None

    order_ticket = int(
        getattr(result, "order", 0)
        or 0
    )

    if order_ticket > 0:
        positions = mt5.positions_get(
            ticket=order_ticket
        )

        if positions:
            position_ticket = int(
                positions[0].ticket
            )

    return _result_to_execution_result(
        result=result,
        action="open",
        symbol=broker_symbol,
        stop_loss=normalized_sl,
        take_profit=normalized_tp,
        position_ticket=position_ticket,
    )


def get_position(
    position_ticket: int,
) -> MT5PositionSnapshot:
    """
    Return one currently open MT5 position.
    """
    if position_ticket <= 0:
        raise MT5ExecutionError(
            "Position ticket must be greater than zero."
        )

    positions = mt5.positions_get(
        ticket=int(position_ticket)
    )

    if not positions:
        raise MT5ExecutionError(
            f"Open MT5 position {position_ticket} was not found."
        )

    position = positions[0]

    position_type = int(
        getattr(position, "type", -1)
    )

    if position_type == mt5.POSITION_TYPE_BUY:
        direction = OrderDirection.BUY

    elif position_type == mt5.POSITION_TYPE_SELL:
        direction = OrderDirection.SELL

    else:
        raise MT5ExecutionError(
            f"Unsupported MT5 position type {position_type}."
        )

    return MT5PositionSnapshot(
        ticket=int(position.ticket),
        symbol=str(position.symbol),
        direction=direction,
        volume=float(position.volume),
        open_price=float(position.price_open),
        current_price=float(position.price_current),
        stop_loss=float(position.sl),
        take_profit=float(position.tp),
        profit=float(position.profit),
        magic=int(
            getattr(position, "magic", 0)
        ),
        comment=getattr(
            position,
            "comment",
            None,
        ),
    )


def modify_position_protection(
    *,
    position_ticket: int,
    stop_loss: float,
    take_profit: float,
) -> MT5ExecutionResult:
    """
    Modify the stop-loss and take-profit of an open position.

    Used by Strategy 1's R-based ratchet.
    """
    position = get_position(
        position_ticket
    )

    normalized_sl = _normalize_price(
        symbol=position.symbol,
        price=stop_loss,
    )

    normalized_tp = _normalize_price(
        symbol=position.symbol,
        price=take_profit,
    )

    request = {
        "action": mt5.TRADE_ACTION_SLTP,
        "position": int(position_ticket),
        "symbol": position.symbol,
        "sl": normalized_sl,
        "tp": normalized_tp,
    }

    result = mt5.order_send(
        request
    )

    if (
        result is None
        or getattr(result, "retcode", None)
        != mt5.TRADE_RETCODE_DONE
    ):
        _raise_order_failure(
            action="SL/TP modification",
            symbol=position.symbol,
            result=result,
        )

    return _result_to_execution_result(
        result=result,
        action="modify",
        symbol=position.symbol,
        stop_loss=normalized_sl,
        take_profit=normalized_tp,
        position_ticket=position_ticket,
    )


def close_position(
    *,
    position_ticket: int,
    deviation_points: int = DEFAULT_DEVIATION_POINTS,
    comment: str = DEFAULT_COMMENT,
) -> MT5ExecutionResult:
    """
    Close the full remaining volume of an MT5 position.

    A BUY position is closed by sending a SELL deal.
    A SELL position is closed by sending a BUY deal.
    """
    position = get_position(
        position_ticket
    )

    ensure_symbol_selected(
        position.symbol
    )

    tick = mt5.symbol_info_tick(
        position.symbol
    )

    if tick is None:
        code, message = _last_error()

        raise MT5ExecutionError(
            f"Unable to read close price for "
            f"'{position.symbol}' "
            f"(code={code}, message={message})."
        )

    if position.direction == OrderDirection.BUY:
        closing_type = mt5.ORDER_TYPE_SELL
        closing_price = float(tick.bid)

    else:
        closing_type = mt5.ORDER_TYPE_BUY
        closing_price = float(tick.ask)

    normalized_price = _normalize_price(
        symbol=position.symbol,
        price=closing_price,
    )

    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": position.symbol,
        "position": int(position_ticket),
        "volume": float(position.volume),
        "type": closing_type,
        "price": normalized_price,
        "deviation": int(deviation_points),
        "magic": int(position.magic or DEFAULT_MAGIC),
        "comment": comment,
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": _preferred_filling_mode(
            position.symbol
        ),
    }

    result = mt5.order_send(
        request
    )

    if (
        result is None
        or getattr(result, "retcode", None)
        != mt5.TRADE_RETCODE_DONE
    ):
        _raise_order_failure(
            action="position close",
            symbol=position.symbol,
            result=result,
        )

    return _result_to_execution_result(
        result=result,
        action="close",
        symbol=position.symbol,
        position_ticket=position_ticket,
    )