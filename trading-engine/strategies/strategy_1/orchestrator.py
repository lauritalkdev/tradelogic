"""
TradeLogic - Strategy 1 Orchestrator

Coordinates the already-built Strategy 1 components.

For a possible new entry it combines:

- completed M5/M15 market snapshot
- live Bid/Ask prices
- EMA/MACD signal evaluation
- first EMA21 contact detection
- rolling circuit breaker
- MT5 concurrency protection
- live account equity
- 5% risk sizing
- EMA50-based stop-loss
- initial 3R take-profit
- MT5 order execution

For existing positions it delegates to the Strategy 1 live
trade-management module.

IMPORTANT:
This module performs ONE orchestration cycle at a time.

It does not contain an infinite worker loop. The future TradeLogic
worker will repeatedly call this orchestrator while also handling
Supabase commands, heartbeats, account ownership, subscriptions,
recovery and persistence.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from config.strategy_1 import STRATEGY_1
from execution.orders import OrderDirection
from execution.positions import can_open_strategy_1_symbol
from mt5.account import get_account_snapshot
from safety.circuit_breaker import (
    CircuitBreakerDecision,
    TradeExitEvent,
    evaluate_circuit_breaker,
)
from strategies.strategy_1.market_snapshot import (
    Strategy1MarketSnapshot,
    build_strategy_1_market_snapshot,
)
from strategies.strategy_1.signal import (
    SignalDirection,
    SignalStatus,
    Strategy1Signal,
    evaluate_strategy_1_signal,
)
from strategies.strategy_1.trade_management import (
    Strategy1ManagementResult,
    manage_strategy_1_position,
)
from strategies.strategy_1.trade_opening import (
    Strategy1OpenedTrade,
    open_strategy_1_trade,
)


class Strategy1OrchestratorError(RuntimeError):
    """Raised when a Strategy 1 orchestration cycle cannot run safely."""


@dataclass(frozen=True)
class PreviousLivePrices:
    """
    Previous executable prices for first-contact detection.

    BUY setup contact is evaluated using Ask.
    SELL setup contact is evaluated using Bid.
    """

    bid: float
    ask: float


@dataclass(frozen=True)
class Strategy1EntryCycleResult:
    symbol: str

    signal: Strategy1Signal | None

    circuit_breaker: CircuitBreakerDecision

    opened_trade: Strategy1OpenedTrade | None

    current_prices: PreviousLivePrices

    entry_allowed: bool

    reason: str


@dataclass(frozen=True)
class PersistedStrategy1Position:
    """
    Minimum persisted state required to continue managing an
    already-open Strategy 1 position after subsequent worker cycles.

    These values must eventually come from TradeLogic's database,
    not only worker memory.
    """

    position_ticket: int
    original_entry_price: float
    original_stop_loss: float
    original_risk_distance: float
    highest_r_reached: float


def _utc_now() -> datetime:
    return datetime.now(
        timezone.utc
    )


def _validate_previous_prices(
    previous_prices: PreviousLivePrices | None,
) -> None:
    if previous_prices is None:
        return

    if previous_prices.bid <= 0:
        raise Strategy1OrchestratorError(
            "Previous Bid price must be greater than zero."
        )

    if previous_prices.ask <= 0:
        raise Strategy1OrchestratorError(
            "Previous Ask price must be greater than zero."
        )


def _evaluate_live_signal(
    *,
    market: Strategy1MarketSnapshot,
    previous_prices: PreviousLivePrices,
) -> Strategy1Signal:
    """
    Evaluate Strategy 1 using the correct executable side.

    The existing signal engine accepts one live current/previous
    price pair.

    Therefore:
    - BUY first-contact detection uses Ask
    - SELL first-contact detection uses Bid

    We evaluate both price sides but only accept the result whose
    strategy direction matches that executable side.
    """

    buy_side_signal = evaluate_strategy_1_signal(
        m5=market.m5,
        m15=market.m15,
        current_price=market.tick.ask,
        previous_price=previous_prices.ask,
        point=market.point,
    )

    if buy_side_signal.direction == SignalDirection.BUY:
        return buy_side_signal

    sell_side_signal = evaluate_strategy_1_signal(
        m5=market.m5,
        m15=market.m15,
        current_price=market.tick.bid,
        previous_price=previous_prices.bid,
        point=market.point,
    )

    return sell_side_signal


def evaluate_strategy_1_entry_cycle(
    *,
    symbol: str,
    previous_prices: PreviousLivePrices | None,
    exit_events: list[TradeExitEvent],
    paused_until: datetime | None = None,
    now: datetime | None = None,
) -> Strategy1EntryCycleResult:
    """
    Run one Strategy 1 new-entry evaluation cycle for one symbol.

    First worker observation:
        If previous_prices is None, no entry is allowed yet.

        The current Bid/Ask becomes the baseline so that TradeLogic
        can detect a genuine subsequent first contact with EMA21.

        This prevents a worker restart from immediately entering
        merely because price already happens to be inside the zone.

    Normal cycle:
        1. Build live market snapshot.
        2. Evaluate rolling circuit breaker.
        3. Evaluate M5/M15 trend + M5 MACD + EMA21 contact.
        4. Enforce one position per symbol / two total.
        5. Read live account equity.
        6. Build and execute the Strategy 1 order.
    """

    clean_symbol = symbol.strip()

    if not clean_symbol:
        raise Strategy1OrchestratorError(
            "Symbol is required."
        )

    if clean_symbol not in STRATEGY_1.symbols:
        raise Strategy1OrchestratorError(
            f"'{clean_symbol}' is not enabled for Strategy 1."
        )

    _validate_previous_prices(
        previous_prices
    )

    current_time = (
        now
        if now is not None
        else _utc_now()
    )

    market = build_strategy_1_market_snapshot(
        symbol=clean_symbol
    )

    current_prices = PreviousLivePrices(
        bid=market.tick.bid,
        ask=market.tick.ask,
    )

    circuit = evaluate_circuit_breaker(
        exit_events=exit_events,
        now=current_time,
        existing_paused_until=paused_until,
    )

    # ---------------------------------------------------------
    # FIRST OBSERVATION
    # ---------------------------------------------------------
    if previous_prices is None:
        return Strategy1EntryCycleResult(
            symbol=clean_symbol,
            signal=None,
            circuit_breaker=circuit,
            opened_trade=None,
            current_prices=current_prices,
            entry_allowed=False,
            reason="awaiting_previous_live_price",
        )

    # ---------------------------------------------------------
    # CIRCUIT BREAKER
    # ---------------------------------------------------------
    if not circuit.entries_allowed:
        return Strategy1EntryCycleResult(
            symbol=clean_symbol,
            signal=None,
            circuit_breaker=circuit,
            opened_trade=None,
            current_prices=current_prices,
            entry_allowed=False,
            reason="circuit_breaker_paused",
        )

    # ---------------------------------------------------------
    # STRATEGY SIGNAL
    # ---------------------------------------------------------
    signal = _evaluate_live_signal(
        market=market,
        previous_prices=previous_prices,
    )

    if signal.status != SignalStatus.ENTRY:
        return Strategy1EntryCycleResult(
            symbol=clean_symbol,
            signal=signal,
            circuit_breaker=circuit,
            opened_trade=None,
            current_prices=current_prices,
            entry_allowed=False,
            reason=f"signal_{signal.status.value}",
        )

    # ---------------------------------------------------------
    # DIRECTION MAPPING
    # ---------------------------------------------------------
    if signal.direction == SignalDirection.BUY:
        order_direction = OrderDirection.BUY

    elif signal.direction == SignalDirection.SELL:
        order_direction = OrderDirection.SELL

    else:
        return Strategy1EntryCycleResult(
            symbol=clean_symbol,
            signal=signal,
            circuit_breaker=circuit,
            opened_trade=None,
            current_prices=current_prices,
            entry_allowed=False,
            reason="signal_has_no_trade_direction",
        )

    # ---------------------------------------------------------
    # MT5 CONCURRENCY
    # ---------------------------------------------------------
    can_open, concurrency_reason = (
        can_open_strategy_1_symbol(
            symbol=clean_symbol,
            max_total_positions=(
                STRATEGY_1.max_total_positions
            ),
        )
    )

    if not can_open:
        return Strategy1EntryCycleResult(
            symbol=clean_symbol,
            signal=signal,
            circuit_breaker=circuit,
            opened_trade=None,
            current_prices=current_prices,
            entry_allowed=False,
            reason=concurrency_reason,
        )

    # ---------------------------------------------------------
    # ACCOUNT EQUITY
    # ---------------------------------------------------------
    account = get_account_snapshot()

    if account.equity <= 0:
        raise Strategy1OrchestratorError(
            "MT5 account equity must be greater than zero "
            "before Strategy 1 can open a trade."
        )

    # ---------------------------------------------------------
    # TRADE OPENING
    # ---------------------------------------------------------
    opened_trade = open_strategy_1_trade(
        symbol=clean_symbol,
        direction=order_direction,
        account_equity=account.equity,
        m5=market.m5,
        symbol_info=market.symbol_info,
        tick=market.tick,
    )

    return Strategy1EntryCycleResult(
        symbol=clean_symbol,
        signal=signal,
        circuit_breaker=circuit,
        opened_trade=opened_trade,
        current_prices=current_prices,
        entry_allowed=True,
        reason="trade_opened",
    )


def manage_persisted_strategy_1_position(
    persisted: PersistedStrategy1Position,
) -> Strategy1ManagementResult:
    """
    Run one management cycle for an already-open Strategy 1 trade.

    The worker will eventually load these original values from
    Supabase so that a process restart cannot lose the trade's
    frozen R structure.
    """

    if persisted.position_ticket <= 0:
        raise Strategy1OrchestratorError(
            "Position ticket must be greater than zero."
        )

    return manage_strategy_1_position(
        position_ticket=persisted.position_ticket,
        original_entry_price=(
            persisted.original_entry_price
        ),
        original_stop_loss=(
            persisted.original_stop_loss
        ),
        original_risk_distance=(
            persisted.original_risk_distance
        ),
        highest_r_reached=(
            persisted.highest_r_reached
        ),
    )