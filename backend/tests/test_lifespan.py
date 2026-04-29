from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def build_settings(tmp_path: Path, **overrides) -> Settings:
    return Settings(
        **{
            "database_url": f"sqlite+aiosqlite:///{tmp_path / 'test.sqlite3'}",
            "seed_sample_data": True,
            "enable_scheduler": False,
            "collect_interval_seconds": 300,
            "manual_collect_min_interval_seconds": 300,
            "data_go_kr_service_key": None,
            "use_sample_client_when_no_key": True,
            "airport_codes_csv": "GMP,PUS,CJU",
            "cors_origins_csv": "http://localhost:3000",
            **overrides,
        }
    )


def test_sample_seed_runs_in_sample_mode(tmp_path: Path) -> None:
    settings = build_settings(tmp_path)

    with patch("app.main.seed_sample_database", new=AsyncMock()) as seed_mock:
        with TestClient(create_app(settings)):
            pass

    seed_mock.assert_awaited_once()


def test_sample_seed_is_skipped_in_live_mode(tmp_path: Path) -> None:
    settings = build_settings(
        tmp_path,
        data_go_kr_service_key="test-key",
        use_sample_client_when_no_key=False,
    )

    with patch("app.main.seed_sample_database", new=AsyncMock()) as seed_mock:
        with TestClient(create_app(settings)):
            pass

    seed_mock.assert_not_awaited()
