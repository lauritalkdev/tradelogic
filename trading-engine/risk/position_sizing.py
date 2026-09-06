"""
TradeLogic - Position Sizing / Risk Engine

Calculates Strategy 1 position size so the monetary loss at the
original technical stop-loss is approximately 5% of account equity.

This module does NOT:
- connect to MetaTrader 5
- place orders
- determine BUY/SELL signals
- move stops after entry

Broker-specific values such as tick size, tick value and volume
constraints are supplied by the MT5 execution layer later.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from config.strategy_1 import STRATEGY_1


class RiskSizingError(ValueError):
    """Raised when a safe position size cannot be calculated."""


@dataclass(frozen=True)
class PositionSizeResult:
    account_equity: float
    risk_fraction: float
    target_risk_amount: float

    entry_price: float
    stop_loss_price: float
    stop_distance: float

    tick_size: float
    tick_value_loss: float

    loss_per_lot_at_stop: float

    raw_volume: float
    volume: float

    volume_min: float
    volume_max: float
    volume_step: float

    estimated_risk_amount: float
    estimated_risk_fraction: float


def _require_positive(name: str, value: float) -> None:
    if value <= 0:
        raise RiskSizingError(
            f"{name} must be greater than zero."
        )


def _volume_precision(volume_step: float) -> int:
    """
    Determine how many decimal places are required for a broker's
    volume step.

    Examples:
        1.0   -> 0
        0.1   -> 1
        0.01  -> 2
        0.001 -> 3
    """
    text = f"{volume_step:.10f}".rstrip("0")

    if "." not in text:
        return 0

    return len(text.split(".")[1])


def _floor_to_volume_step(
    volume: float,
    volume_step: float,
) -> float:
    """
    Round DOWN to the broker volume step.

    We intentionally round down rather than up so TradeLogic does
    not exceed the configured 5% risk because of lot normalization.
    """
    steps = math.floor(
        (volume / volume_step) + 1e-12
    )

    normalized = steps * volume_step

    precision = _volume_precision(volume_step)

    return round(normalized, precision)


def calculate_position_size(
    *,
    account_equity: float,
    entry_price: float,
    stop_loss_price: float,
    tick_size: float,
    tick_value_loss: float,
    volume_min: float,
    volume_max: float,
    volume_step: float,
    risk_fraction: float | None = None,
) -> PositionSizeResult:
    """
    Calculate a broker-valid position size.

    Strategy 1 normally uses:
        risk_fraction = 0.05

    Core calculation:

        target risk =
            account equity * risk fraction

        ticks to stop =
            abs(entry - stop) / tick_size

        loss per 1.0 lot =
            ticks to stop * tick_value_loss

        raw volume =
            target risk / loss per 1.0 lot

    The resulting lot size is rounded DOWN to the broker's volume
    step so the normalized order does not exceed the target risk.

    If even the broker's minimum lot size would exceed the target
    risk, the trade is rejected rather than deliberately risking
    more than Strategy 1 permits.
    """

    actual_risk_fraction = (
        STRATEGY_1.risk_fraction
        if risk_fraction is None
        else risk_fraction
    )

    _require_positive(
        "Account equity",
        account_equity,
    )

    _require_positive(
        "Entry price",
        entry_price,
    )

    _require_positive(
        "Stop-loss price",
        stop_loss_price,
    )

    _require_positive(
        "Tick size",
        tick_size,
    )

    _require_positive(
        "Tick value loss",
        tick_value_loss,
    )

    _require_positive(
        "Minimum volume",
        volume_min,
    )

    _require_positive(
        "Maximum volume",
        volume_max,
    )

    _require_positive(
        "Volume step",
        volume_step,
    )

    if not 0 < actual_risk_fraction < 1:
        raise RiskSizingError(
            "Risk fraction must be greater than 0 and less than 1."
        )

    if volume_min > volume_max:
        raise RiskSizingError(
            "Minimum volume cannot exceed maximum volume."
        )

    stop_distance = abs(
        entry_price - stop_loss_price
    )

    if stop_distance <= 0:
        raise RiskSizingError(
            "Entry price and stop-loss price cannot be equal."
        )

    target_risk_amount = (
        account_equity * actual_risk_fraction
    )

    ticks_to_stop = (
        stop_distance / tick_size
    )

    loss_per_lot_at_stop = (
        ticks_to_stop * tick_value_loss
    )

    if loss_per_lot_at_stop <= 0:
        raise RiskSizingError(
            "Calculated loss per lot must be greater than zero."
        )

    raw_volume = (
        target_risk_amount / loss_per_lot_at_stop
    )

    # Never exceed the broker's maximum volume.
    capped_volume = min(
        raw_volume,
        volume_max,
    )

    normalized_volume = _floor_to_volume_step(
        capped_volume,
        volume_step,
    )

    if normalized_volume < volume_min:
        minimum_lot_risk = (
            loss_per_lot_at_stop * volume_min
        )

        raise RiskSizingError(
            "Trade rejected: the broker minimum lot size would "
            f"risk approximately {minimum_lot_risk:.2f}, which "
            f"exceeds the allowed target risk of "
            f"{target_risk_amount:.2f}."
        )

    estimated_risk_amount = (
        loss_per_lot_at_stop * normalized_volume
    )

    estimated_risk_fraction = (
        estimated_risk_amount / account_equity
    )

    # Safety guard: normalized position size must never exceed
    # the requested monetary risk because of floating-point or
    # broker-step normalization.
    if estimated_risk_amount > (
        target_risk_amount + 1e-8
    ):
        raise RiskSizingError(
            "Calculated position size exceeds the allowed risk."
        )

    return PositionSizeResult(
        account_equity=account_equity,
        risk_fraction=actual_risk_fraction,
        target_risk_amount=target_risk_amount,
        entry_price=entry_price,
        stop_loss_price=stop_loss_price,
        stop_distance=stop_distance,
        tick_size=tick_size,
        tick_value_loss=tick_value_loss,
        loss_per_lot_at_stop=loss_per_lot_at_stop,
        raw_volume=raw_volume,
        volume=normalized_volume,
        volume_min=volume_min,
        volume_max=volume_max,
        volume_step=volume_step,
        estimated_risk_amount=estimated_risk_amount,
        estimated_risk_fraction=estimated_risk_fraction,
    )