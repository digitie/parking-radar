from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from math import ceil
from zoneinfo import ZoneInfo

from app.core.time_utils import split_by_local_day


@dataclass(slots=True)
class CalculatedFee:
    total_fee: int
    breakdown: list[dict[str, int | str]]


def resolve_day_type(value: datetime, tz_name: str = "Asia/Seoul") -> str:
    local = value.astimezone(ZoneInfo(tz_name))
    return "holiday" if local.weekday() >= 5 else "weekday"


def calculate_total_fee(
    entry_at: datetime,
    exit_at: datetime,
    rules: list[object],
    tz_name: str = "Asia/Seoul",
) -> CalculatedFee:
    if exit_at <= entry_at:
        raise ValueError("출차 시각은 입차 시각보다 늦어야 합니다.")

    rules_by_day_type = {rule.day_type: rule for rule in rules}
    if "weekday" not in rules_by_day_type or "holiday" not in rules_by_day_type:
        raise ValueError("평일/휴일 요금 규칙이 모두 필요합니다.")

    total_fee = 0
    breakdown: list[dict[str, int | str]] = []

    for chunk_start, chunk_end in split_by_local_day(entry_at, exit_at, tz_name):
        rule = rules_by_day_type[resolve_day_type(chunk_start, tz_name)]
        duration_minutes = max(1, ceil((chunk_end - chunk_start).total_seconds() / 60))
        billable_minutes = max(0, duration_minutes - rule.free_minutes)

        if billable_minutes == 0:
            fee = 0
        else:
            fee = rule.basic_fee
            remaining = max(0, billable_minutes - max(rule.basic_minutes, 1))
            if remaining:
                fee += ceil(remaining / max(rule.unit_minutes, 1)) * rule.unit_fee
            if rule.daily_max_fee > 0:
                fee = min(fee, rule.daily_max_fee)

        total_fee += fee
        breakdown.append(
            {
                "date": chunk_start.astimezone(ZoneInfo(tz_name)).date().isoformat(),
                "day_type": rule.day_type,
                "duration_minutes": duration_minutes,
                "applied_fee": fee,
            }
        )

    return CalculatedFee(total_fee=total_fee, breakdown=breakdown)

