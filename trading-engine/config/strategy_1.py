"""
TradeLogic - Strategy 1 Configuration

Central configuration for Strategy 1.

Strategy logic should import values from this file instead of
scattering strategy parameters throughout the trading engine.
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
    # ---------------------------------------------------------
    symbols: Tuple[str, ...] = (
        "XAUUSD",
        "EURUSD",
    )

    # ---------------------------------------------------------
    # Timeframes
    #
    # M5  = execution / entry timeframe
    # M15 = trend confirmation timeframe
    # ---------------------------------------------------------
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
    # Strategy uses MACD on M5 only.
    # Both main and signal must be on the required side of zero.
    # ---------------------------------------------------------
    macd_fast_period: int = 3
    macd_slow_period: int = 9
    macd_signal_period: int = 16

    # ---------------------------------------------------------
    # EMA21 pullback entry zone
    #
    # IMPORTANT:
    # This is BROKER POINTS, not conventional forex pips.
    #
    # Actual price distance:
    # entry_zone_points * symbol_info.point
    # ---------------------------------------------------------
    entry_zone_points: int = 5

    # ---------------------------------------------------------
    # Stop-loss buffer
    #
    # BUY:
    #   EMA50 at entry - 5 broker points
    #
    # SELL:
    #   EMA50 at entry + 5 broker points
    # ---------------------------------------------------------
    stop_loss_buffer_points: int = 5

    # ---------------------------------------------------------
    # Risk
    #
    # 0.05 = 5% of account equity at trade entry.
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
    # Therefore XAUUSD + EURUSD may be open simultaneously.
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