"""
TradeLogic - MetaTrader 5 Market Data

Provides safe access to:
- broker-aware symbol resolution
- symbol metadata
- broker point size
- tick size and tick value
- volume constraints
- live bid / ask prices
- spread
- symbol visibility

This module does NOT:
- place orders
- implement strategy rules
- calculate indicators
- store broker credentials
"""

from __future__ import annotations

from dataclasses import dataclass

import MetaTrader5 as mt5


class MT5MarketError(RuntimeError):
    """Raised when MT5 symbol or market data cannot be read."""


@dataclass(frozen=True)
class MT5SymbolInfo:
    symbol: str

    digits: int
    point: float

    tick_size: float
    tick_value: float
    tick_value_profit: float
    tick_value_loss: float

    volume_min: float
    volume_max: float
    volume_step: float

    contract_size: float | None

    visible: bool
    selected: bool
    trade_mode: int | None


@dataclass(frozen=True)
class MT5Tick:
    symbol: str

    bid: float
    ask: float
    last: float | None

    spread_price: float
    spread_points: float

    time: int | None
    time_msc: int | None


def _last_error() -> tuple[int | None, str | None]:
    """
    Return the latest MT5 error safely.
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


def resolve_mt5_symbol(symbol: str) -> str:
    """
    Resolve a canonical TradeLogic symbol to the broker's
    actual MT5 symbol.

    The canonical Strategy 1 symbols remain broker-independent,
    for example:
        XAUUSD
        EURUSD

    Resolution rules:
    1. Prefer an exact MT5 symbol match.
    2. If no exact match exists, search broker symbols whose
       names begin with the canonical symbol.
    3. Prefer the shortest matching broker variant.
    4. Refuse ambiguous equally suitable variants.

    Examples:
        XAUUSD -> XAUUSD
        XAUUSD -> XAUUSDm
        EURUSD -> EURUSDm

    This deliberately does not hard-code a broker suffix.
    """
    clean_symbol = symbol.strip()

    if not clean_symbol:
        raise MT5MarketError(
            "Symbol is required."
        )

    exact_info = mt5.symbol_info(
        clean_symbol
    )

    if exact_info is not None:
        return clean_symbol

    symbols = mt5.symbols_get()

    if symbols is None:
        code, message = _last_error()

        raise MT5MarketError(
            f"Unable to load MT5 symbols while resolving "
            f"'{clean_symbol}' "
            f"(code={code}, message={message})."
        )

    canonical_upper = clean_symbol.upper()

    candidates = [
        str(item.name)
        for item in symbols
        if str(item.name).upper().startswith(
            canonical_upper
        )
    ]

    if not candidates:
        code, message = _last_error()

        raise MT5MarketError(
            f"MT5 symbol '{clean_symbol}' was not found "
            f"and no broker-specific variant exists "
            f"(code={code}, message={message})."
        )

    candidates.sort(
        key=lambda value: (
            len(value),
            value.upper(),
        )
    )

    shortest_length = len(
        candidates[0]
    )

    shortest_candidates = [
        value
        for value in candidates
        if len(value) == shortest_length
    ]

    if len(shortest_candidates) > 1:
        raise MT5MarketError(
            f"MT5 symbol '{clean_symbol}' has multiple "
            f"equally suitable broker variants: "
            f"{', '.join(shortest_candidates)}."
        )

    return candidates[0]


def ensure_symbol_selected(
    symbol: str,
) -> str:
    """
    Resolve a canonical symbol and ensure the broker's actual
    MT5 symbol is visible/selected in Market Watch.

    Some brokers do not expose tick/candle data for a symbol
    until it has been selected.

    Returns the broker's actual MT5 symbol name.
    """
    resolved_symbol = resolve_mt5_symbol(
        symbol
    )

    info = mt5.symbol_info(
        resolved_symbol
    )

    if info is None:
        code, message = _last_error()

        raise MT5MarketError(
            f"MT5 symbol '{resolved_symbol}' was not found "
            f"(code={code}, message={message})."
        )

    if bool(
        getattr(info, "visible", False)
    ):
        return resolved_symbol

    selected = mt5.symbol_select(
        resolved_symbol,
        True,
    )

    if not selected:
        code, message = _last_error()

        raise MT5MarketError(
            f"Unable to select MT5 symbol "
            f"'{resolved_symbol}' "
            f"(code={code}, message={message})."
        )

    return resolved_symbol


def get_symbol_info(
    symbol: str,
) -> MT5SymbolInfo:
    """
    Return the broker-specific trading properties for a symbol.
    """
    clean_symbol = ensure_symbol_selected(
        symbol
    )

    info = mt5.symbol_info(
        clean_symbol
    )

    if info is None:
        code, message = _last_error()

        raise MT5MarketError(
            f"Unable to read MT5 symbol information for "
            f"'{clean_symbol}' "
            f"(code={code}, message={message})."
        )

    point = float(
        getattr(info, "point", 0.0)
    )

    tick_size = float(
        getattr(
            info,
            "trade_tick_size",
            0.0,
        )
    )

    tick_value = float(
        getattr(
            info,
            "trade_tick_value",
            0.0,
        )
    )

    tick_value_profit = float(
        getattr(
            info,
            "trade_tick_value_profit",
            0.0,
        )
    )

    tick_value_loss = float(
        getattr(
            info,
            "trade_tick_value_loss",
            0.0,
        )
    )

    volume_min = float(
        getattr(info, "volume_min", 0.0)
    )

    volume_max = float(
        getattr(info, "volume_max", 0.0)
    )

    volume_step = float(
        getattr(info, "volume_step", 0.0)
    )

    if point <= 0:
        raise MT5MarketError(
            f"Symbol '{clean_symbol}' returned an invalid "
            "broker point size."
        )

    if tick_size <= 0:
        raise MT5MarketError(
            f"Symbol '{clean_symbol}' returned an invalid "
            "trade tick size."
        )

    if volume_min <= 0:
        raise MT5MarketError(
            f"Symbol '{clean_symbol}' returned an invalid "
            "minimum volume."
        )

    if volume_max <= 0:
        raise MT5MarketError(
            f"Symbol '{clean_symbol}' returned an invalid "
            "maximum volume."
        )

    if volume_step <= 0:
        raise MT5MarketError(
            f"Symbol '{clean_symbol}' returned an invalid "
            "volume step."
        )

    contract_size_raw = getattr(
        info,
        "trade_contract_size",
        None,
    )

    contract_size = (
        float(contract_size_raw)
        if contract_size_raw is not None
        else None
    )

    trade_mode_raw = getattr(
        info,
        "trade_mode",
        None,
    )

    trade_mode = (
        int(trade_mode_raw)
        if trade_mode_raw is not None
        else None
    )

    return MT5SymbolInfo(
        symbol=clean_symbol,
        digits=int(
            getattr(info, "digits", 0)
        ),
        point=point,
        tick_size=tick_size,
        tick_value=tick_value,
        tick_value_profit=tick_value_profit,
        tick_value_loss=tick_value_loss,
        volume_min=volume_min,
        volume_max=volume_max,
        volume_step=volume_step,
        contract_size=contract_size,
        visible=bool(
            getattr(info, "visible", False)
        ),
        selected=bool(
            getattr(info, "select", False)
        ),
        trade_mode=trade_mode,
    )


def get_live_tick(
    symbol: str,
) -> MT5Tick:
    """
    Return the latest bid/ask tick for a symbol.

    Canonical TradeLogic symbols are resolved to the broker's
    actual MT5 symbol before market data is requested.
    """
    clean_symbol = ensure_symbol_selected(
        symbol
    )

    info = get_symbol_info(
        clean_symbol
    )

    tick = mt5.symbol_info_tick(
        clean_symbol
    )

    if tick is None:
        code, message = _last_error()

        raise MT5MarketError(
            f"Unable to read live tick for "
            f"'{clean_symbol}' "
            f"(code={code}, message={message})."
        )

    bid = float(
        getattr(tick, "bid", 0.0)
    )

    ask = float(
        getattr(tick, "ask", 0.0)
    )

    if bid <= 0 or ask <= 0:
        raise MT5MarketError(
            f"Symbol '{clean_symbol}' returned an invalid "
            "live bid/ask price."
        )

    last_raw = getattr(
        tick,
        "last",
        None,
    )

    last = (
        float(last_raw)
        if last_raw is not None
        else None
    )

    spread_price = (
        ask - bid
    )

    spread_points = (
        spread_price / info.point
    )

    time_raw = getattr(
        tick,
        "time",
        None,
    )

    time_msc_raw = getattr(
        tick,
        "time_msc",
        None,
    )

    return MT5Tick(
        symbol=clean_symbol,
        bid=bid,
        ask=ask,
        last=last,
        spread_price=spread_price,
        spread_points=spread_points,
        time=(
            int(time_raw)
            if time_raw is not None
            else None
        ),
        time_msc=(
            int(time_msc_raw)
            if time_msc_raw is not None
            else None
        ),
    )


def get_entry_price(
    *,
    symbol: str,
    direction: str,
) -> float:
    """
    Return the correct executable market-side price.

    BUY orders execute at Ask.
    SELL orders execute at Bid.
    """
    tick = get_live_tick(
        symbol
    )

    normalized_direction = (
        direction.strip().lower()
    )

    if normalized_direction == "buy":
        return tick.ask

    if normalized_direction == "sell":
        return tick.bid

    raise MT5MarketError(
        "Direction must be 'buy' or 'sell'."
    )