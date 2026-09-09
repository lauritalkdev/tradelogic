"""
TradeLogic - Strategy 1 Orchestrator

Coordinates the already-built Strategy 1 components.

Strategy 1 has three independent entry pathways:

Path A
------
M15 EMA trend + M15 MACD confirmation
-> M5 EMA21 live-price pullback entry
-> M5 EMA50 stop-loss reference

Path B
------
M1 EMA21 / EMA200 confirmed cross
-> move away
-> retest
-> M1 EMA50 stop-loss reference

Path C
------
M5 EMA21 / EMA200 confirmed cross
-> move away
-> retest
-> M5 EMA50 stop-loss reference

ENTRY ARBITRATION
-----------------
If multiple pathways generate ENTRY in the same direction during
the same evaluation cycle, only one Strategy 1 trade may open.

Priority:
    1. Path B - M1 cross/retest
    2. Path C - M5 cross/retest
    3. Path A - normal M15/M5 setup

If both BUY and SELL entry signals occur during the same cycle,
NO trade is opened for that cycle.

Cross/retest state is intentionally worker-runtime state only.
It is not persisted to Supabase and is not reconstructed after a
worker restart.

This module performs ONE orchestration cycle at a time.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from config.strategy_1 import STRATEGY_1
from execution.orders import OrderDirection
from execution.positions import can_open_strategy_1_symbol
from indicators.technical import Strategy1IndicatorSnapshot
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
    CrossRetestEvaluation,
    CrossRetestState,
    SignalDirection,
    SignalStatus,
    Strategy1EntryPath,
    Strategy1Signal,
    evaluate_cross_retest_path,
    evaluate_path_a_signal,
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
    Previous executable prices.

    BUY contact/retest logic uses Ask.
    SELL contact/retest logic uses Bid.
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

    m1_cross_state: CrossRetestState | None
    m5_cross_state: CrossRetestState | None

    m1_completed_at: datetime
    m5_completed_at: datetime

    entry_allowed: bool

    reason: str


@dataclass(frozen=True)
class PersistedStrategy1Position:
    """
    Minimum persisted state required to continue managing an
    already-open Strategy 1 position after subsequent worker cycles.

    These values come from TradeLogic's database rather than from
    temporary worker memory.
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


def _confirmed_cross_direction(
    snapshot: Strategy1IndicatorSnapshot,
) -> SignalDirection:
    """
    Determine whether the newest completed candle confirmed a
    genuine EMA21 / EMA200 crossover.

    This mirrors the signal engine's crossover definition so the
    orchestrator can choose the correct executable price side before
    evaluating the independent cross pathway.
    """

    bullish_cross = (
        snapshot.previous_ema21
        <= snapshot.previous_ema200
        and snapshot.ema21
        > snapshot.ema200
    )

    if bullish_cross:
        return SignalDirection.BUY

    bearish_cross = (
        snapshot.previous_ema21
        >= snapshot.previous_ema200
        and snapshot.ema21
        < snapshot.ema200
    )

    if bearish_cross:
        return SignalDirection.SELL

    return SignalDirection.NONE


def _executable_price(
    *,
    direction: SignalDirection,
    market: Strategy1MarketSnapshot,
) -> float:
    """
    Return the correct executable MT5 price for a strategy direction.

    BUY:
        Ask

    SELL:
        Bid
    """

    if direction == SignalDirection.BUY:
        return market.tick.ask

    if direction == SignalDirection.SELL:
        return market.tick.bid

    raise Strategy1OrchestratorError(
        "Executable price requires BUY or SELL direction."
    )


def _evaluate_path_a(
    *,
    market: Strategy1MarketSnapshot,
    previous_prices: PreviousLivePrices,
) -> list[Strategy1Signal]:
    """
    Evaluate both Path-A directions using the correct executable side.

    Normally only one direction can satisfy M15 EMA ordering.
    Returning both results keeps arbitration explicit.
    """

    buy_signal = evaluate_path_a_signal(
        m5=market.m5,
        m15=market.m15,
        current_price=market.tick.ask,
        previous_price=previous_prices.ask,
        point=market.point,
        direction=SignalDirection.BUY,
    )

    sell_signal = evaluate_path_a_signal(
        m5=market.m5,
        m15=market.m15,
        current_price=market.tick.bid,
        previous_price=previous_prices.bid,
        point=market.point,
        direction=SignalDirection.SELL,
    )

    return [
        buy_signal,
        sell_signal,
    ]


def _evaluate_cross_path(
    *,
    market: Strategy1MarketSnapshot,
    snapshot: Strategy1IndicatorSnapshot,
    completed_at: datetime,
    previous_completed_at: datetime | None,
    state: CrossRetestState | None,
    timeframe: str,
    path: Strategy1EntryPath,
) -> CrossRetestEvaluation | None:
    """
    Evaluate one cross/retest pathway safely.

    IMPORTANT RESTART RULE
    ----------------------
    If there is no runtime state and this completed candle was already
    observed previously, no new cross setup is reconstructed.

    This prevents:
    - worker restart
    - first market read
    - old already-completed crossover

    from becoming a fresh trading setup.

    A new setup may begin only when a genuinely new completed candle
    is observed after the worker has established its baseline.
    """

    normalized_timeframe = (
        timeframe
        .strip()
        .upper()
    )

    # ---------------------------------------------------------
    # ACTIVE SETUP
    #
    # Existing runtime state must be evaluated every worker poll
    # because move-away and retest use live prices.
    # ---------------------------------------------------------
    if state is not None:
        effective_direction = state.direction

        # If a genuinely new completed candle confirms an opposite
        # EMA21/EMA200 cross, that new cross replaces the old pending
        # setup. Choose the executable price from the NEW direction
        # before handing control to the signal engine.
        if (
            previous_completed_at is not None
            and completed_at > previous_completed_at
        ):
            new_cross_direction = _confirmed_cross_direction(
                snapshot
            )

            if (
                new_cross_direction
                in {
                    SignalDirection.BUY,
                    SignalDirection.SELL,
                }
            ):
                effective_direction = new_cross_direction

        price = _executable_price(
            direction=effective_direction,
            market=market,
        )

        return evaluate_cross_retest_path(
            snapshot=snapshot,
            completed_at=completed_at,
            current_price=price,
            point=market.point,
            timeframe=normalized_timeframe,
            path=path,
            state=state,
        )

    # ---------------------------------------------------------
    # NO ACTIVE SETUP
    #
    # On first observation we only establish the candle baseline.
    # ---------------------------------------------------------
    if previous_completed_at is None:
        return None

    # No new completed candle -> do not recreate an old cross.
    if completed_at <= previous_completed_at:
        return None

    cross_direction = _confirmed_cross_direction(
        snapshot
    )

    if cross_direction == SignalDirection.NONE:
        return None

    price = _executable_price(
        direction=cross_direction,
        market=market,
    )

    return evaluate_cross_retest_path(
        snapshot=snapshot,
        completed_at=completed_at,
        current_price=price,
        point=market.point,
        timeframe=normalized_timeframe,
        path=path,
        state=None,
    )


def _entry_signals(
    signals: list[Strategy1Signal],
) -> list[Strategy1Signal]:
    return [
        signal
        for signal in signals
        if signal.status == SignalStatus.ENTRY
        and signal.direction
        in {
            SignalDirection.BUY,
            SignalDirection.SELL,
        }
    ]


def _select_entry_signal(
    signals: list[Strategy1Signal],
) -> tuple[Strategy1Signal | None, str]:
    """
    Select exactly one ENTRY signal.

    Rules:

    1. No ENTRY signals:
       no trade.

    2. Both BUY and SELL ENTRY signals:
       no trade for this cycle.

    3. Multiple same-direction signals:
       priority is:

           Path B M1
           Path C M5
           Path A

    Existing one-position-per-symbol protection remains an additional
    safety layer after this arbitration.
    """

    entries = _entry_signals(
        signals
    )

    if not entries:
        return (
            None,
            "no_entry_signal",
        )

    directions = {
        signal.direction
        for signal in entries
    }

    if len(directions) > 1:
        return (
            None,
            "contradictory_entry_signals",
        )

    priority = {
        Strategy1EntryPath.PATH_B_M1_CROSS: 1,
        Strategy1EntryPath.PATH_C_M5_CROSS: 2,
        Strategy1EntryPath.PATH_A: 3,
    }

    selected = min(
        entries,
        key=lambda signal: priority[
            signal.path
        ],
    )

    return (
        selected,
        "entry_selected",
    )


def _stop_reference_for_signal(
    *,
    signal: Strategy1Signal,
    market: Strategy1MarketSnapshot,
) -> Strategy1IndicatorSnapshot:
    """
    Return the correct EMA50 snapshot for the selected pathway.

    Path A -> M5
    Path B -> M1
    Path C -> M5
    """

    if (
        signal.path
        == Strategy1EntryPath.PATH_B_M1_CROSS
    ):
        return market.m1

    if signal.path in {
        Strategy1EntryPath.PATH_A,
        Strategy1EntryPath.PATH_C_M5_CROSS,
    }:
        return market.m5

    raise Strategy1OrchestratorError(
        f"Unsupported Strategy 1 entry path '{signal.path}'."
    )


def evaluate_strategy_1_entry_cycle(
    *,
    symbol: str,
    previous_prices: PreviousLivePrices | None,
    exit_events: list[TradeExitEvent],
    m1_cross_state: CrossRetestState | None = None,
    m5_cross_state: CrossRetestState | None = None,
    previous_m1_completed_at: datetime | None = None,
    previous_m5_completed_at: datetime | None = None,
    paused_until: datetime | None = None,
    now: datetime | None = None,
) -> Strategy1EntryCycleResult:
    """
    Run one Strategy 1 new-entry evaluation cycle for one symbol.

    FIRST WORKER OBSERVATION
    ------------------------
    No trade is opened.

    Current:
    - Bid
    - Ask
    - latest completed M1 candle time
    - latest completed M5 candle time

    become runtime baselines.

    This protects both:
    - Path-A first-contact logic
    - Path-B/C cross freshness logic

    NORMAL CYCLE
    ------------
    1. Build M1/M5/M15 market snapshot.
    2. Evaluate circuit breaker.
    3. Evaluate Path A.
    4. Update/evaluate Path B.
    5. Update/evaluate Path C.
    6. Reject contradictory BUY/SELL entries.
    7. Apply same-direction pathway priority.
    8. Enforce position concurrency.
    9. Read live account equity.
    10. Choose pathway-specific EMA50 stop reference.
    11. Size and execute the trade.
    """

    clean_symbol = (
        symbol.strip()
    )

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
    # FIRST WORKER OBSERVATION
    #
    # Establish live-price and completed-candle baselines only.
    # Do not reconstruct an old pending cross.
    # ---------------------------------------------------------
    if (
        previous_prices is None
        or previous_m1_completed_at is None
        or previous_m5_completed_at is None
    ):
        return Strategy1EntryCycleResult(
            symbol=clean_symbol,
            signal=None,
            circuit_breaker=circuit,
            opened_trade=None,
            current_prices=current_prices,
            m1_cross_state=None,
            m5_cross_state=None,
            m1_completed_at=market.m1_completed_at,
            m5_completed_at=market.m5_completed_at,
            entry_allowed=False,
            reason="awaiting_runtime_baseline",
        )

    # ---------------------------------------------------------
    # CIRCUIT BREAKER
    #
    # Pending cross states are cleared while entry trading is
    # circuit-breaker paused so stale setups cannot survive a
    # potentially long trading suspension.
    # ---------------------------------------------------------
    if not circuit.entries_allowed:
        return Strategy1EntryCycleResult(
            symbol=clean_symbol,
            signal=None,
            circuit_breaker=circuit,
            opened_trade=None,
            current_prices=current_prices,
            m1_cross_state=None,
            m5_cross_state=None,
            m1_completed_at=market.m1_completed_at,
            m5_completed_at=market.m5_completed_at,
            entry_allowed=False,
            reason="circuit_breaker_paused",
        )

    # ---------------------------------------------------------
    # PATH A
    # ---------------------------------------------------------
    path_a_signals = _evaluate_path_a(
        market=market,
        previous_prices=previous_prices,
    )

    # ---------------------------------------------------------
    # PATH B - M1 CROSS / RETEST
    # ---------------------------------------------------------
    m1_evaluation = _evaluate_cross_path(
        market=market,
        snapshot=market.m1,
        completed_at=market.m1_completed_at,
        previous_completed_at=previous_m1_completed_at,
        state=m1_cross_state,
        timeframe="M1",
        path=Strategy1EntryPath.PATH_B_M1_CROSS,
    )

    updated_m1_state = (
        m1_evaluation.state
        if m1_evaluation is not None
        else m1_cross_state
    )

    # ---------------------------------------------------------
    # PATH C - M5 CROSS / RETEST
    # ---------------------------------------------------------
    m5_evaluation = _evaluate_cross_path(
        market=market,
        snapshot=market.m5,
        completed_at=market.m5_completed_at,
        previous_completed_at=previous_m5_completed_at,
        state=m5_cross_state,
        timeframe="M5",
        path=Strategy1EntryPath.PATH_C_M5_CROSS,
    )

    updated_m5_state = (
        m5_evaluation.state
        if m5_evaluation is not None
        else m5_cross_state
    )

    # ---------------------------------------------------------
    # COLLECT ALL PATHWAY SIGNALS
    # ---------------------------------------------------------
    all_signals: list[Strategy1Signal] = [
        *path_a_signals,
    ]

    if m1_evaluation is not None:
        all_signals.append(
            m1_evaluation.signal
        )

    if m5_evaluation is not None:
        all_signals.append(
            m5_evaluation.signal
        )

    selected_signal, selection_reason = (
        _select_entry_signal(
            all_signals
        )
    )

    # ---------------------------------------------------------
    # NO ENTRY / CONTRADICTORY ENTRY
    # ---------------------------------------------------------
    if selected_signal is None:
        informative_signal: Strategy1Signal | None = None

        # Prefer displaying an active waiting cross signal because it
        # represents a concrete pending setup.
        for candidate in all_signals:
            if (
                candidate.status
                == SignalStatus.WAITING
                and candidate.path
                == Strategy1EntryPath.PATH_B_M1_CROSS
            ):
                informative_signal = candidate
                break

        if informative_signal is None:
            for candidate in all_signals:
                if (
                    candidate.status
                    == SignalStatus.WAITING
                    and candidate.path
                    == Strategy1EntryPath.PATH_C_M5_CROSS
                ):
                    informative_signal = candidate
                    break

        if informative_signal is None:
            for candidate in all_signals:
                if (
                    candidate.status
                    in {
                        SignalStatus.WAITING,
                        SignalStatus.INVALIDATED,
                    }
                ):
                    informative_signal = candidate
                    break

        return Strategy1EntryCycleResult(
            symbol=clean_symbol,
            signal=informative_signal,
            circuit_breaker=circuit,
            opened_trade=None,
            current_prices=current_prices,
            m1_cross_state=updated_m1_state,
            m5_cross_state=updated_m5_state,
            m1_completed_at=market.m1_completed_at,
            m5_completed_at=market.m5_completed_at,
            entry_allowed=False,
            reason=selection_reason,
        )

    # ---------------------------------------------------------
    # DIRECTION MAPPING
    # ---------------------------------------------------------
    if (
        selected_signal.direction
        == SignalDirection.BUY
    ):
        order_direction = (
            OrderDirection.BUY
        )

    elif (
        selected_signal.direction
        == SignalDirection.SELL
    ):
        order_direction = (
            OrderDirection.SELL
        )

    else:
        return Strategy1EntryCycleResult(
            symbol=clean_symbol,
            signal=selected_signal,
            circuit_breaker=circuit,
            opened_trade=None,
            current_prices=current_prices,
            m1_cross_state=updated_m1_state,
            m5_cross_state=updated_m5_state,
            m1_completed_at=market.m1_completed_at,
            m5_completed_at=market.m5_completed_at,
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
            signal=selected_signal,
            circuit_breaker=circuit,
            opened_trade=None,
            current_prices=current_prices,
            m1_cross_state=updated_m1_state,
            m5_cross_state=updated_m5_state,
            m1_completed_at=market.m1_completed_at,
            m5_completed_at=market.m5_completed_at,
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
    # PATHWAY-SPECIFIC STOP REFERENCE
    # ---------------------------------------------------------
    stop_reference = (
        _stop_reference_for_signal(
            signal=selected_signal,
            market=market,
        )
    )

    # ---------------------------------------------------------
    # TRADE OPENING
    # ---------------------------------------------------------
    opened_trade = open_strategy_1_trade(
        symbol=clean_symbol,
        direction=order_direction,
        account_equity=account.equity,
        stop_reference=stop_reference,
        symbol_info=market.symbol_info,
        tick=market.tick,
    )

    # ---------------------------------------------------------
    # CONSUME CROSS STATES AFTER A SUCCESSFUL TRADE
    #
    # Any pending cross setup for this symbol is discarded once a
    # trade opens. This prevents a stale second pathway from opening
    # another trade after the first position later disappears.
    # ---------------------------------------------------------
    return Strategy1EntryCycleResult(
        symbol=clean_symbol,
        signal=selected_signal,
        circuit_breaker=circuit,
        opened_trade=opened_trade,
        current_prices=current_prices,
        m1_cross_state=None,
        m5_cross_state=None,
        m1_completed_at=market.m1_completed_at,
        m5_completed_at=market.m5_completed_at,
        entry_allowed=True,
        reason=(
            f"trade_opened_{selected_signal.path.value}"
        ),
    )


def manage_persisted_strategy_1_position(
    persisted: PersistedStrategy1Position,
) -> Strategy1ManagementResult:
    """
    Run one management cycle for an already-open Strategy 1 trade.

    Original entry, stop and R distance are persisted so a worker
    restart cannot change the trade's frozen R structure.
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