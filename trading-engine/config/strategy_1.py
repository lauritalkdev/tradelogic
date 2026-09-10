"""
TradeLogic - Strategy 1 Configuration

Central configuration for Strategy 1.

Strategy logic should import values from this file instead of
scattering strategy parameters throughout the trading engine.

Strategy 1 has four independent entry pathways:

Path A:
- M15 trend confirmation
- M15 MACD confirmation
- M5 EMA21 retracement/contact entry

Path B:
- M1 EMA21 / EMA200 confirmed cross
- wait for retest
- independent entry

Path C:
- M5 EMA21 / EMA200 confirmed cross
- wait for retest
- independent entry

Path D:
- M1 trend-continuation pullback
- EMA21 > EMA50 > EMA200 for BUY
- EMA21 < EMA50 < EMA200 for SELL
- EMA21 must slope in the trade direction
- live EMA21 or EMA50 pullback/contact entry

Existing EMA-based entries use EMA50 as the stop-loss reference:
- BUY  -> EMA50 minus the configured broker-point buffer
- SELL -> EMA50 plus the configured broker-point buffer

Path D stop-loss handling:
- EMA21 entry -> M1 EMA50 plus/minus the configured buffer
- EMA50 entry -> recent M1 pullback swing plus/minus the configured buffer
"""

from dataclasses import dataclass
from typing import Final, Tuple


@dataclass(frozen=True)
class Strategy1Config:
    # ---------------------------------------------------------
    # Identity
    # ---------------------------------------------------------
    strategy_id: str = "strategy_1"
    strategy_name: str = "Strategy 1"

    # ---------------------------------------------------------
    # Tradable symbols
    #
    # Canonical TradeLogic symbol names are kept here.
    # Broker-specific names such as:
    #   XAUUSDm
    #   EURUSDm
    #   GBPUSDm
    #   US30m
    # are resolved by the MT5 symbol-resolution layer.
    # ---------------------------------------------------------
    symbols: Tuple[str, ...] = (
        "XAUUSD",
        "EURUSD",
        "GBPUSD",
        "US30",
    )

    # ---------------------------------------------------------
    # Timeframes
    #
    # M1:
    #   Independent EMA21 / EMA200 cross-retest pathway.
    #   Path-D trend-continuation pullback pathway.
    #
    # M5:
    #   Normal Path-A execution timeframe.
    #   Also has its own independent EMA21 / EMA200
    #   cross-retest pathway.
    #
    # M15:
    #   Normal Path-A trend + MACD confirmation timeframe.
    # ---------------------------------------------------------
    cross_timeframe_fast: str = "M1"
    entry_timeframe: str = "M5"
    confirmation_timeframe: str = "M15"

    # ---------------------------------------------------------
    # EMA configuration
    # ---------------------------------------------------------
    ema_fast_period: int = 21
    ema_medium_period: int = 50
    ema_slow_period: int = 200

    # ---------------------------------------------------------
    # MACD configuration
    #
    # IMPORTANT:
    # MACD is a confirmation filter for Path A on M15 only.
    #
    # BUY Path A:
    #   M15 MACD main > 0
    #   M15 MACD signal > 0
    #
    # SELL Path A:
    #   M15 MACD main < 0
    #   M15 MACD signal < 0
    #
    # Paths B, C and D do NOT require MACD.
    # ---------------------------------------------------------
    macd_fast_period: int = 3
    macd_slow_period: int = 9
    macd_signal_period: int = 16

    # ---------------------------------------------------------
    # Path-A M5 EMA21 pullback entry zone
    #
    # IMPORTANT:
    # This is BROKER POINTS, not conventional forex pips.
    #
    # Actual price distance:
    # entry_zone_points * symbol_info.point
    # ---------------------------------------------------------
    entry_zone_points: int = 5

    # ---------------------------------------------------------
    # EMA21 / EMA200 cross-retest pathways
    #
    # A valid cross is confirmed using COMPLETED candles:
    #
    # Bullish:
    #   previous EMA21 <= previous EMA200
    #   newest   EMA21 >  newest   EMA200
    #
    # Bearish:
    #   previous EMA21 >= previous EMA200
    #   newest   EMA21 <  newest   EMA200
    #
    # After the confirmed cross, the setup waits for price to
    # move away from the EMA21/EMA200 area and then return.
    #
    # The setup expires after this number of completed candles
    # on its own timeframe:
    #   M1 setup -> 10 completed M1 candles
    #   M5 setup -> 10 completed M5 candles
    #
    # A reverse EMA21/EMA200 cross cancels the pending setup.
    # ---------------------------------------------------------
    cross_setup_expiry_candles: int = 10

    # ---------------------------------------------------------
    # Cross-retest contact zone
    #
    # The retest is allowed when live price:
    # - touches EMA21, or
    # - touches EMA200, or
    # - enters the price area between EMA21 and EMA200.
    #
    # This broker-point tolerance expands the two EMA boundaries
    # slightly so a near-touch is not rejected due to tick noise.
    # ---------------------------------------------------------
    cross_retest_zone_points: int = 5

    # ---------------------------------------------------------
    # Cross move-away requirement
    #
    # A newly confirmed cross does NOT immediately qualify as
    # its own retest.
    #
    # Price must first move away from the EMA21/EMA200 area by
    # at least this many broker points before a later return can
    # trigger the retest entry.
    # ---------------------------------------------------------
    cross_move_away_points: int = 5

    # ---------------------------------------------------------
    # Path-D M1 trend qualification
    #
    # BUY:
    #   EMA21 > EMA50 > EMA200
    #   EMA21 is currently rising
    #
    # SELL:
    #   EMA21 < EMA50 < EMA200
    #   EMA21 is currently falling
    #
    # No multi-candle persistence requirement is used.
    # ---------------------------------------------------------

    # ---------------------------------------------------------
    # Path-D live EMA contact zone
    #
    # Path D does NOT wait for a completed rejection candle.
    #
    # BUY uses live Ask.
    # SELL uses live Bid.
    #
    # A pullback may qualify when live executable price reaches
    # the EMA21 or EMA50 contact zone from the correct side.
    #
    # IMPORTANT:
    # This is BROKER POINTS, not conventional forex pips.
    # ---------------------------------------------------------
    path_d_contact_zone_points: int = 5

    # ---------------------------------------------------------
    # Stop-loss buffer
    #
    # EXISTING EMA-BASED SL RULE:
    #
    # BUY:
    #   relevant timeframe EMA50 - 5 broker points
    #
    # SELL:
    #   relevant timeframe EMA50 + 5 broker points
    #
    # Path A uses M5 EMA50.
    # Path B uses M1 EMA50.
    # Path C uses M5 EMA50.
    #
    # PATH D:
    #
    # EMA21 entry:
    #   BUY  -> M1 EMA50 - 5 broker points
    #   SELL -> M1 EMA50 + 5 broker points
    #
    # EMA50 entry:
    #   BUY  -> recent M1 pullback swing low - 5 broker points
    #   SELL -> recent M1 pullback swing high + 5 broker points
    # ---------------------------------------------------------
    stop_loss_buffer_points: int = 5

    # ---------------------------------------------------------
    # Risk
    #
    # 0.05 = 5% of account equity at trade entry.
    #
    # Position sizing remains based on the actual distance
    # between entry price and the selected stop loss.
    # ---------------------------------------------------------
    risk_fraction: float = 0.05

    # ---------------------------------------------------------
    # R-based trade management
    #
    # Initial TP = 3R
    # Hard maximum = 8R
    # ---------------------------------------------------------
    initial_take_profit_r: int = 3
    hard_take_profit_r: int = 8

    # ---------------------------------------------------------
    # Maximum simultaneous positions
    #
    # One Strategy-1 position per symbol.
    #
    # Even though Strategy 1 now supports four symbols,
    # no more than two Strategy-1 positions may be open
    # simultaneously.
    # ---------------------------------------------------------
    max_positions_per_symbol: int = 1
    max_total_positions: int = 2

    # ---------------------------------------------------------
    # Circuit breaker
    #
    # Three genuine losing SL exits within a rolling six-hour
    # window halt NEW Strategy-1 entries for twelve hours.
    #
    # Existing positions continue to be managed.
    # Profitable trailing-stop exits do NOT count as losses.
    # ---------------------------------------------------------
    circuit_breaker_loss_count: int = 3
    circuit_breaker_window_hours: int = 6
    circuit_breaker_pause_hours: int = 12


STRATEGY_1: Final[Strategy1Config] = Strategy1Config()


# -------------------------------------------------------------
# RATCHET RULES
#
# Key   = profit level reached in R
# Value = (new stop level in R, new take-profit level in R)
#
# At 7R the TP remains at the 8R hard cap.
# Reaching 8R closes the trade immediately.
# -------------------------------------------------------------
RATCHET_RULES: Final[dict[int, tuple[int, int]]] = {
    2: (1, 4),
    3: (2, 5),
    4: (3, 6),
    5: (4, 7),
    6: (5, 8),
    7: (6, 8),
}