"""
TradeLogic - MetaTrader 5 Deal History

Provides authoritative close facts for a Strategy 1 position after MT5
reports that the position is no longer open.

Responsibilities:
- query MT5 deal history by position ticket
- identify closing deal(s)
- calculate the volume-weighted broker exit price
- return realized trade profit, commission, swap and fee
- return the latest close timestamp
- classify common MT5 close reasons such as stop-loss / take-profit

This module does NOT:
- decide when TradeLogic should close a position
- update Supabase
- calculate Strategy 1 realized R
- run the continuous worker loop

The caller must already have a healthy/logged-in MT5 session.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import MetaTrader5 as mt5


class MT5HistoryError(RuntimeError):
    """Raised when authoritative MT5 deal history cannot be resolved."""


@dataclass(frozen=True)
class MT5ClosedPositionSummary:
    position_ticket: int
    symbol: str

    exit_price: float
    closed_volume: float

    profit_loss: float
    commission: float
    swap: float
    fee: float

    closed_at: datetime

    close_reason: str
    mt5_reason_code: int | None

    deal_tickets: tuple[int, ...]


def _last_error() -> tuple[int | None, str | None]:
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


def _deal_entry_value(
    deal: Any,
) -> int:
    return int(
        getattr(deal, "entry", -1)
    )


def _is_closing_deal(
    deal: Any,
) -> bool:
    """
    Return True for MT5 deals that reduce/close an existing position.

    DEAL_ENTRY_OUT:
        normal closing deal

    DEAL_ENTRY_OUT_BY:
        close-by operation

    DEAL_ENTRY_INOUT:
        reversal deal. Strategy 1 does not intentionally reverse a live
        position, but treating it as an exit protects recovery logic if a
        broker/account operation creates such a history record.
    """

    entry = _deal_entry_value(
        deal
    )

    closing_entries = {
        int(mt5.DEAL_ENTRY_OUT),
        int(mt5.DEAL_ENTRY_OUT_BY),
        int(mt5.DEAL_ENTRY_INOUT),
    }

    return entry in closing_entries


def _classify_close_reason(
    reason_code: int | None,
) -> str:
    """
    Convert common MT5 deal reason codes to stable TradeLogic labels.

    These labels are intentionally simple because Strategy 1's persistence
    layer stores a textual close_reason and its circuit breaker specifically
    needs to distinguish genuine stop-loss exits.
    """

    if reason_code is None:
        return "mt5_close"

    mappings: list[tuple[str, str]] = [
        ("DEAL_REASON_SL", "stop_loss"),
        ("DEAL_REASON_TP", "take_profit"),
        ("DEAL_REASON_SO", "stop_out"),
        ("DEAL_REASON_EXPERT", "expert"),
        ("DEAL_REASON_CLIENT", "manual_client"),
        ("DEAL_REASON_MOBILE", "manual_mobile"),
        ("DEAL_REASON_WEB", "manual_web"),
    ]

    for constant_name, label in mappings:
        constant_value = getattr(
            mt5,
            constant_name,
            None,
        )

        if (
            constant_value is not None
            and int(constant_value) == reason_code
        ):
            return label

    return "mt5_close"


def get_closed_position_summary(
    position_ticket: int,
) -> MT5ClosedPositionSummary:
    """
    Return authoritative realized close facts for one MT5 position.

    MT5 history is queried by position ticket. All closing deals belonging
    to that position are aggregated because a broker can represent a full
    close with more than one deal.

    Profit, commission, swap and fee are returned separately. The persistence
    layer can therefore store the exact realized trade profit together with
    the broker costs rather than guessing from the last floating snapshot.
    """

    if position_ticket <= 0:
        raise MT5HistoryError(
            "Position ticket must be greater than zero."
        )

    deals = mt5.history_deals_get(
        position=int(position_ticket)
    )

    if deals is None:
        code, message = _last_error()

        raise MT5HistoryError(
            "Unable to read MT5 deal history for position "
            f"{position_ticket} (code={code}, message={message})."
        )

    matching_deals = [
        deal
        for deal in deals
        if int(
            getattr(
                deal,
                "position_id",
                0,
            )
            or 0
        )
        == int(position_ticket)
    ]

    if not matching_deals:
        raise MT5HistoryError(
            f"No MT5 deals were found for position {position_ticket}."
        )

    closing_deals = [
        deal
        for deal in matching_deals
        if _is_closing_deal(
            deal
        )
    ]

    if not closing_deals:
        raise MT5HistoryError(
            f"Position {position_ticket} has MT5 history, but no closing "
            "deal has been recorded yet."
        )

    total_volume = sum(
        float(
            getattr(
                deal,
                "volume",
                0.0,
            )
            or 0.0
        )
        for deal in closing_deals
    )

    if total_volume <= 0:
        raise MT5HistoryError(
            f"Closing deals for position {position_ticket} have no "
            "positive volume."
        )

    weighted_price_total = sum(
        float(
            getattr(
                deal,
                "price",
                0.0,
            )
            or 0.0
        )
        * float(
            getattr(
                deal,
                "volume",
                0.0,
            )
            or 0.0
        )
        for deal in closing_deals
    )

    exit_price = (
        weighted_price_total
        / total_volume
    )

    if exit_price <= 0:
        raise MT5HistoryError(
            f"Closing deals for position {position_ticket} have an "
            "invalid exit price."
        )

    profit_loss = sum(
        float(
            getattr(
                deal,
                "profit",
                0.0,
            )
            or 0.0
        )
        for deal in closing_deals
    )

    commission = sum(
        float(
            getattr(
                deal,
                "commission",
                0.0,
            )
            or 0.0
        )
        for deal in closing_deals
    )

    swap = sum(
        float(
            getattr(
                deal,
                "swap",
                0.0,
            )
            or 0.0
        )
        for deal in closing_deals
    )

    fee = sum(
        float(
            getattr(
                deal,
                "fee",
                0.0,
            )
            or 0.0
        )
        for deal in closing_deals
    )

    latest_deal = max(
        closing_deals,
        key=lambda deal: (
            int(
                getattr(
                    deal,
                    "time_msc",
                    0,
                )
                or 0
            ),
            int(
                getattr(
                    deal,
                    "time",
                    0,
                )
                or 0
            ),
            int(
                getattr(
                    deal,
                    "ticket",
                    0,
                )
                or 0
            ),
        ),
    )

    latest_time_msc = int(
        getattr(
            latest_deal,
            "time_msc",
            0,
        )
        or 0
    )

    if latest_time_msc > 0:
        closed_at = datetime.fromtimestamp(
            latest_time_msc / 1000.0,
            tz=timezone.utc,
        )
    else:
        latest_time = int(
            getattr(
                latest_deal,
                "time",
                0,
            )
            or 0
        )

        if latest_time <= 0:
            raise MT5HistoryError(
                f"Closing deal for position {position_ticket} has no "
                "valid MT5 timestamp."
            )

        closed_at = datetime.fromtimestamp(
            latest_time,
            tz=timezone.utc,
        )

    symbol = str(
        getattr(
            latest_deal,
            "symbol",
            "",
        )
        or ""
    ).strip()

    if not symbol:
        raise MT5HistoryError(
            f"Closing deal for position {position_ticket} has no symbol."
        )

    reason_code_raw = getattr(
        latest_deal,
        "reason",
        None,
    )

    reason_code = (
        int(reason_code_raw)
        if reason_code_raw is not None
        else None
    )

    deal_tickets = tuple(
        sorted(
            int(
                getattr(
                    deal,
                    "ticket",
                    0,
                )
                or 0
            )
            for deal in closing_deals
            if int(
                getattr(
                    deal,
                    "ticket",
                    0,
                )
                or 0
            )
            > 0
        )
    )

    return MT5ClosedPositionSummary(
        position_ticket=int(position_ticket),
        symbol=symbol,
        exit_price=exit_price,
        closed_volume=total_volume,
        profit_loss=profit_loss,
        commission=commission,
        swap=swap,
        fee=fee,
        closed_at=closed_at,
        close_reason=_classify_close_reason(
            reason_code
        ),
        mt5_reason_code=reason_code,
        deal_tickets=deal_tickets,
    )
