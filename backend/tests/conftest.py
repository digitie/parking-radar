from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


@pytest.fixture
def fixtures_dir() -> Path:
    return Path(__file__).parent / "fixtures"


@pytest.fixture
def test_settings(tmp_path: Path) -> Settings:
    return Settings(
        database_url=f"sqlite+aiosqlite:///{tmp_path / 'test.sqlite3'}",
        seed_sample_data=True,
        enable_scheduler=False,
        collect_interval_seconds=300,
        manual_collect_min_interval_seconds=300,
        data_go_kr_service_key=None,
        use_sample_client_when_no_key=True,
        airport_codes_csv="GMP,PUS,CJU",
        cors_origins_csv="http://localhost:3000",
    )


@pytest.fixture
def client(test_settings: Settings) -> TestClient:
    app = create_app(test_settings)
    with TestClient(app) as test_client:
        yield test_client
