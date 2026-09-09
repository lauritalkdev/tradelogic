"""
TradeLogic - Technical Indicators

Reusable technical-indicator calculations for the trading engine.

Strategy 1 requires:
- EMA 21
- EMA 50
- EMA 200
- MACD fast EMA 3
- MACD slow EMA 9
- MACD signal SMA 16
- Applied price: Close

The Strategy 1 snapshot exposes both:
- the latest completed-candle indicator values
- the immediately previous completed-candle EMA values

The previous EMA values are required so TradeLogic can prove that
an EMA21 / EMA200 crossover is genuinely NEW rather than merely
observing an old crossover that already existed before the worker
started.

This module contains indicator mathematics only.

It does NOT:
- connect to MetaTrader 5
- determine BUY/SELL entries
- maintain pending cross/retest state
- calculate risk
- place trades
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

import numpy as np


class IndicatorDataError(ValueError):
    """Raised when indicator input data is missing or invalid."""


@dataclass(frozen=True)
class MACDResult:
    """Complete MACD calculation result."""

    main: np.ndarray
    signal: np.ndarray


@dataclass(frozen=True)
class Strategy1IndicatorSnapshot:
    """
    Completed-candle indicator state required by Strategy 1.

    Latest values represent the most recently completed candle.

    Previous EMA values represent the completed candle immediately
    before the latest one and are used for genuine EMA21 / EMA200
    crossover detection.

    MACD values are exposed for the latest completed candle because
    Strategy 1 Path A uses the latest M15 MACD state only.
    """

    close: float

    ema21: float
    ema50: float
    ema200: float

    macd_main: float
    macd_signal: float

    previous_close: float

    previous_ema21: float
    previous_ema50: float
    previous_ema200: float


def _to_float_array(
    values: Sequence[float],
) -> np.ndarray:
    """
    Convert a sequence of prices to a one-dimensional float array.

    Raises IndicatorDataError for empty, non-finite, or malformed data.
    """

    try:
        array = np.asarray(
            values,
            dtype=float,
        )

    except (TypeError, ValueError) as exc:
        raise IndicatorDataError(
            "Indicator values must contain valid numeric prices."
        ) from exc

    if array.ndim != 1:
        raise IndicatorDataError(
            "Indicator input must be a one-dimensional price sequence."
        )

    if array.size == 0:
        raise IndicatorDataError(
            "Indicator input cannot be empty."
        )

    if not np.all(
        np.isfinite(array)
    ):
        raise IndicatorDataError(
            "Indicator input contains NaN or infinite values."
        )

    return array


def ema(
    values: Sequence[float],
    period: int,
) -> np.ndarray:
    """
    Calculate an Exponential Moving Average.

    Formula:
        multiplier = 2 / (period + 1)

        EMA[current] =
            price[current] * multiplier
            + EMA[previous] * (1 - multiplier)

    The first input price is used as the initial EMA seed.

    The returned array has the same length as the input.
    """

    if period <= 0:
        raise IndicatorDataError(
            "EMA period must be greater than zero."
        )

    prices = _to_float_array(
        values
    )

    result = np.empty(
        prices.size,
        dtype=float,
    )

    result[0] = prices[0]

    multiplier = (
        2.0
        / (period + 1.0)
    )

    for index in range(
        1,
        prices.size,
    ):
        result[index] = (
            prices[index] * multiplier
            + result[index - 1]
            * (1.0 - multiplier)
        )

    return result


def sma(
    values: Sequence[float],
    period: int,
) -> np.ndarray:
    """
    Calculate a Simple Moving Average.

    Values before enough observations exist are represented as NaN.

    Example for period 3:
        [NaN, NaN, avg(1..3), avg(2..4), ...]
    """

    if period <= 0:
        raise IndicatorDataError(
            "SMA period must be greater than zero."
        )

    prices = _to_float_array(
        values
    )

    result = np.full(
        prices.size,
        np.nan,
        dtype=float,
    )

    if prices.size < period:
        return result

    cumulative = np.cumsum(
        prices,
        dtype=float,
    )

    cumulative[period:] = (
        cumulative[period:]
        - cumulative[:-period]
    )

    result[period - 1:] = (
        cumulative[period - 1:]
        / period
    )

    return result


def macd(
    close_prices: Sequence[float],
    fast_period: int = 3,
    slow_period: int = 9,
    signal_period: int = 16,
) -> MACDResult:
    """
    Calculate Strategy-1 MACD.

    Main line:
        Fast EMA - Slow EMA

    Signal line:
        SMA of the MACD main line

    Strategy 1 parameters:
        Fast EMA   = 3
        Slow EMA   = 9
        Signal SMA = 16
        Applied to = Close
    """

    if fast_period <= 0:
        raise IndicatorDataError(
            "MACD fast period must be greater than zero."
        )

    if slow_period <= 0:
        raise IndicatorDataError(
            "MACD slow period must be greater than zero."
        )

    if signal_period <= 0:
        raise IndicatorDataError(
            "MACD signal period must be greater than zero."
        )

    if fast_period >= slow_period:
        raise IndicatorDataError(
            "MACD fast period must be smaller than slow period."
        )

    closes = _to_float_array(
        close_prices
    )

    fast_ema = ema(
        closes,
        fast_period,
    )

    slow_ema = ema(
        closes,
        slow_period,
    )

    main_line = (
        fast_ema
        - slow_ema
    )

    signal_line = sma(
        main_line,
        signal_period,
    )

    return MACDResult(
        main=main_line,
        signal=signal_line,
    )


def strategy_1_snapshot(
    close_prices: Sequence[float],
) -> Strategy1IndicatorSnapshot:
    """
    Calculate the completed-candle indicator snapshot required
    by Strategy 1.

    At least 201 completed closes are required.

    Why 201 instead of 200?

    Strategy 1 needs:
    - latest EMA200 state
    - immediately previous EMA200 state

    The previous EMA21 / EMA200 relationship is necessary for
    detecting an actual newly-completed crossover:

    Bullish:
        previous EMA21 <= previous EMA200
        latest   EMA21 >  latest   EMA200

    Bearish:
        previous EMA21 >= previous EMA200
        latest   EMA21 <  latest   EMA200

    This function does not determine trade direction.
    """

    closes = _to_float_array(
        close_prices
    )

    if closes.size < 201:
        raise IndicatorDataError(
            "Strategy 1 requires at least 201 completed close prices."
        )

    ema21_values = ema(
        closes,
        21,
    )

    ema50_values = ema(
        closes,
        50,
    )

    ema200_values = ema(
        closes,
        200,
    )

    macd_values = macd(
        closes,
        fast_period=3,
        slow_period=9,
        signal_period=16,
    )

    latest_macd_signal = (
        macd_values.signal[-1]
    )

    if not np.isfinite(
        latest_macd_signal
    ):
        raise IndicatorDataError(
            "Not enough price data to calculate the latest MACD signal."
        )

    return Strategy1IndicatorSnapshot(
        close=float(
            closes[-1]
        ),
        ema21=float(
            ema21_values[-1]
        ),
        ema50=float(
            ema50_values[-1]
        ),
        ema200=float(
            ema200_values[-1]
        ),
        macd_main=float(
            macd_values.main[-1]
        ),
        macd_signal=float(
            latest_macd_signal
        ),
        previous_close=float(
            closes[-2]
        ),
        previous_ema21=float(
            ema21_values[-2]
        ),
        previous_ema50=float(
            ema50_values[-2]
        ),
        previous_ema200=float(
            ema200_values[-2]
        ),
    )