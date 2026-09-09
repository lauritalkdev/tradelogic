"""
TradeLogic - Strategy 1 Trade Opening

Converts an already-approved Strategy 1 ENTRY signal into a
broker-valid MT5 market position.

Responsibilities:
- choose BUY Ask or SELL Bid as the intended entry price
- calculate the pathway-specific EMA50-based stop-loss
- calculate 5% account-equity position size
- calculate the initial 3R take-profit
- submit the MT5 market order

Strategy 1 stop-loss references:

Path A:
    M5 EMA50

Path B:
    M1 EMA50

Path C:
    M5 EMA50

Universal stop rule:

BUY:
    relevant EMA50 - configured broker-point buffer

SELL:
    relevant EMA50 + configured broker-point buffer

This module does NOT:
- decide whether a signal exists
- calculate EMA/MACD indicators
- choose the entry pathway
- manage open positions after entry
- enforce the circuit breaker
- enforce subscription eligibility
"""

from __future__ import annotations

from dataclasses import dataclass

from config.strategy_1 import STRATEGY_1
from execution.orders import (
    MT5ExecutionResult,
    OrderDirection,
    open_market_position,
)
from indicators.technical import Strategy1IndicatorSnapshot
from mt5.market import (
    MT5SymbolInfo,
    MT5Tick,
)
from positions.manager import (
    PositionDirection,
    create_initial_position_state,
)
from risk.position_sizing import (
    PositionSizeResult,
    RiskSizingError,
    calculate_position_size,
)


class Strategy1TradeOpeningError(RuntimeError):
    """Raised when a Strategy 1 trade cannot be opened safely."""


@dataclass(frozen=True)
class Strategy1TradePlan:
    symbol: str
    direction: OrderDirection

    account_equity: float

    intended_entry_price: float
    stop_loss_price: float
    take_profit_price: float

    original_risk_distance: float
    original_risk_amount: float

    volume: float

    sizing: PositionSizeResult


@dataclass(frozen=True)
class Strategy1OpenedTrade:
    plan: Strategy1TradePlan
    execution: MT5ExecutionResult


def _loss_tick_value(
    symbol_info: MT5SymbolInfo,
) -> float:
    """
    Return the best broker-provided loss tick value.

    trade_tick_value_loss is preferred because Strategy 1 sizes
    against the possible loss at the original stop.

    Some brokers may report zero in that field. In that case,
    trade_tick_value is used as a fallback.

    If neither value is usable, the trade is rejected.
    """

    if symbol_info.tick_value_loss > 0:
        return symbol_info.tick_value_loss

    if symbol_info.tick_value > 0:
        return symbol_info.tick_value

    raise Strategy1TradeOpeningError(
        f"Broker returned no usable tick value for "
        f"'{symbol_info.symbol}'."
    )


def _normalize_price(
    *,
    price: float,
    digits: int,
) -> float:
    return round(
        float(price),
        int(digits),
    )


def build_trade_plan(
    *,
    symbol: str,
    direction: OrderDirection,
    account_equity: float,
    stop_reference: Strategy1IndicatorSnapshot,
    symbol_info: MT5SymbolInfo,
    tick: MT5Tick,
) -> Strategy1TradePlan:
    """
    Build the complete Strategy 1 order plan.

    stop_reference must be the indicator snapshot belonging to the
    pathway that generated the approved entry:

        Path A -> M5
        Path B -> M1
        Path C -> M5

    BUY:
        intended entry = current Ask
        SL = relevant EMA50 - configured broker-point buffer

    SELL:
        intended entry = current Bid
        SL = relevant EMA50 + configured broker-point buffer

    Position size is calculated so the original stop represents
    approximately 5% of account equity.

    Initial TP is exactly 3R from the intended entry.
    """

    clean_symbol = symbol.strip()

    if not clean_symbol:
        raise Strategy1TradeOpeningError(
            "Symbol is required."
        )

    if account_equity <= 0:
        raise Strategy1TradeOpeningError(
            "Account equity must be greater than zero."
        )

    if symbol_info.symbol != clean_symbol:
        raise Strategy1TradeOpeningError(
            "Symbol information does not match the requested symbol."
        )

    if stop_reference.ema50 <= 0:
        raise Strategy1TradeOpeningError(
            "EMA50 stop-loss reference must be greater than zero."
        )

    point_buffer = (
        STRATEGY_1.stop_loss_buffer_points
        * symbol_info.point
    )

    # ---------------------------------------------------------
    # BUY
    # ---------------------------------------------------------
    if direction == OrderDirection.BUY:
        intended_entry = tick.ask

        stop_loss = (
            stop_reference.ema50
            - point_buffer
        )

        if stop_loss >= intended_entry:
            raise Strategy1TradeOpeningError(
                "Invalid BUY setup: pathway EMA50-based stop-loss "
                "is not below the intended entry price."
            )

        position_direction = (
            PositionDirection.BUY
        )

    # ---------------------------------------------------------
    # SELL
    # ---------------------------------------------------------
    elif direction == OrderDirection.SELL:
        intended_entry = tick.bid

        stop_loss = (
            stop_reference.ema50
            + point_buffer
        )

        if stop_loss <= intended_entry:
            raise Strategy1TradeOpeningError(
                "Invalid SELL setup: pathway EMA50-based stop-loss "
                "is not above the intended entry price."
            )

        position_direction = (
            PositionDirection.SELL
        )

    else:
        raise Strategy1TradeOpeningError(
            "Direction must be BUY or SELL."
        )

    intended_entry = _normalize_price(
        price=intended_entry,
        digits=symbol_info.digits,
    )

    stop_loss = _normalize_price(
        price=stop_loss,
        digits=symbol_info.digits,
    )

    # Re-check geometry after broker-digit normalization.
    if (
        direction == OrderDirection.BUY
        and stop_loss >= intended_entry
    ):
        raise Strategy1TradeOpeningError(
            "Invalid BUY setup after price normalization: "
            "stop-loss is not below entry."
        )

    if (
        direction == OrderDirection.SELL
        and stop_loss <= intended_entry
    ):
        raise Strategy1TradeOpeningError(
            "Invalid SELL setup after price normalization: "
            "stop-loss is not above entry."
        )

    tick_value_loss = _loss_tick_value(
        symbol_info
    )

    try:
        sizing = calculate_position_size(
            account_equity=account_equity,
            entry_price=intended_entry,
            stop_loss_price=stop_loss,
            tick_size=symbol_info.tick_size,
            tick_value_loss=tick_value_loss,
            volume_min=symbol_info.volume_min,
            volume_max=symbol_info.volume_max,
            volume_step=symbol_info.volume_step,
        )

    except RiskSizingError as exc:
        raise Strategy1TradeOpeningError(
            f"Unable to size Strategy 1 position: {exc}"
        ) from exc

    initial_state = create_initial_position_state(
        direction=position_direction,
        entry_price=intended_entry,
        stop_loss_price=stop_loss,
    )

    take_profit = _normalize_price(
        price=initial_state.current_take_profit,
        digits=symbol_info.digits,
    )

    # ---------------------------------------------------------
    # FINAL TP GEOMETRY SAFETY CHECK
    # ---------------------------------------------------------
    if (
        direction == OrderDirection.BUY
        and take_profit <= intended_entry
    ):
        raise Strategy1TradeOpeningError(
            "Invalid BUY setup: calculated take-profit "
            "is not above the intended entry price."
        )

    if (
        direction == OrderDirection.SELL
        and take_profit >= intended_entry
    ):
        raise Strategy1TradeOpeningError(
            "Invalid SELL setup: calculated take-profit "
            "is not below the intended entry price."
        )

    return Strategy1TradePlan(
        symbol=clean_symbol,
        direction=direction,
        account_equity=account_equity,
        intended_entry_price=intended_entry,
        stop_loss_price=stop_loss,
        take_profit_price=take_profit,
        original_risk_distance=(
            initial_state.original_risk_distance
        ),
        original_risk_amount=(
            sizing.estimated_risk_amount
        ),
        volume=sizing.volume,
        sizing=sizing,
    )


def open_strategy_1_trade(
    *,
    symbol: str,
    direction: OrderDirection,
    account_equity: float,
    stop_reference: Strategy1IndicatorSnapshot,
    symbol_info: MT5SymbolInfo,
    tick: MT5Tick,
) -> Strategy1OpenedTrade:
    """
    Build and immediately execute a Strategy 1 market order.

    stop_reference MUST correspond to the pathway that produced
    the approved signal:

        Path A -> M5 snapshot
        Path B -> M1 snapshot
        Path C -> M5 snapshot

    This function must only be called AFTER:
    - Strategy 1 returned ENTRY
    - pathway arbitration passed
    - subscription/cycle eligibility passed
    - circuit breaker passed
    - concurrency rules passed

    Those checks intentionally remain outside this module.
    """

    plan = build_trade_plan(
        symbol=symbol,
        direction=direction,
        account_equity=account_equity,
        stop_reference=stop_reference,
        symbol_info=symbol_info,
        tick=tick,
    )

    execution = open_market_position(
        symbol=plan.symbol,
        direction=plan.direction,
        volume=plan.volume,
        stop_loss=plan.stop_loss_price,
        take_profit=plan.take_profit_price,
    )

    return Strategy1OpenedTrade(
        plan=plan,
        execution=execution,
    )