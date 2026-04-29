from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from app.services.fee_calculator import calculate_total_fee
from app.services.parsers import ParsedFeeRule


def _rule(vehicle_size: str, day_type: str, basic_fee: int, unit_fee: int, daily_max_fee: int) -> ParsedFeeRule:
    return ParsedFeeRule(
        airport_code="GMP",
        airport_name="김포국제공항",
        parking_lot_name="국내선 제1주차장",
        vehicle_size=vehicle_size,
        day_type=day_type,
        free_minutes=30,
        basic_minutes=30,
        basic_fee=basic_fee,
        unit_minutes=15,
        unit_fee=unit_fee,
        daily_max_fee=daily_max_fee,
        source_updated_at=datetime.now(tz=ZoneInfo("UTC")),
        raw_item={},
    )


def test_calculate_total_fee_weekday() -> None:
    entry_at = datetime(2026, 4, 24, 9, 0, tzinfo=ZoneInfo("Asia/Seoul"))
    exit_at = datetime(2026, 4, 24, 11, 0, tzinfo=ZoneInfo("Asia/Seoul"))
    result = calculate_total_fee(
        entry_at,
        exit_at,
        [_rule("small", "weekday", 1000, 500, 20000), _rule("small", "holiday", 1500, 700, 25000)],
    )

    assert result.total_fee == 3000
    assert result.breakdown[0]["day_type"] == "weekday"


def test_calculate_total_fee_multi_day_cap() -> None:
    entry_at = datetime(2026, 4, 25, 10, 0, tzinfo=ZoneInfo("Asia/Seoul"))
    exit_at = datetime(2026, 4, 26, 13, 0, tzinfo=ZoneInfo("Asia/Seoul"))
    result = calculate_total_fee(
        entry_at,
        exit_at,
        [_rule("small", "weekday", 1000, 500, 20000), _rule("small", "holiday", 1500, 700, 25000)],
    )

    assert result.total_fee == 50000
    assert len(result.breakdown) == 2
