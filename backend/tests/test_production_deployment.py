import pytest
from httpx import AsyncClient
from backend.app.core.config import Settings
from backend.app.models.device import Device
from sqlalchemy.future import select


@pytest.mark.asyncio
async def test_production_health_endpoints(async_client: AsyncClient):
    """Test both orchestrator /health and detailed /api/healthcheck endpoints."""
    # 1. Standard lightweight health check
    res = await async_client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}

    # 2. Detailed system health check
    res_api = await async_client.get("/api/healthcheck")
    assert res_api.status_code == 200
    data = res_api.json()
    assert data["status"] == "HEALTHY"
    assert data["database"] == "CONNECTED"


def test_database_url_normalization():
    """Verify PostgreSQL URL conversion to asyncpg driver."""
    s1 = Settings(DATABASE_URL="postgres://user:pass@host:5432/dbname")
    assert s1.DATABASE_URL == "postgresql+asyncpg://user:pass@host:5432/dbname"

    s2 = Settings(DATABASE_URL="postgresql://user:pass@host:5432/dbname")
    assert s2.DATABASE_URL == "postgresql+asyncpg://user:pass@host:5432/dbname"

    s3 = Settings(DATABASE_URL="sqlite+aiosqlite:///./custom.db")
    assert s3.DATABASE_URL == "sqlite+aiosqlite:///./custom.db"


def test_dynamic_cors_origins():
    """Verify dynamic CORS origin computation from FRONTEND_URL and CORS_ORIGINS."""
    s = Settings(
        FRONTEND_URL="https://netguard.example.com",
        CORS_ORIGINS="https://soc.example.com, https://admin.example.com/"
    )
    origins = s.cors_origins_list
    assert "https://netguard.example.com" in origins
    assert "https://soc.example.com" in origins
    assert "https://admin.example.com" in origins
    assert "http://localhost:5173" in origins


@pytest.mark.asyncio
async def test_remote_sensor_discovery_sync_flow(async_client: AsyncClient):
    """Test remote network sensor telemetry ingestion into cloud backend."""
    sync_payload = {
        "sensor_id": "SENSOR-HQ-FLOOR-2",
        "sensor_hostname": "HQ-SENSOR-01",
        "monitored_subnet": "192.168.100.0/24",
        "gateway_ip": "192.168.100.1",
        "devices": [
            {
                "ip_address": "192.168.100.1",
                "mac_address": "AA:BB:CC:11:22:33",
                "hostname": "gateway.hq.local",
                "vendor": "Cisco Systems",
                "os_type": "Cisco IOS",
                "os_confidence": "High",
                "device_type": "Router",
                "device_type_confidence": "High",
                "open_ports": [80, 443, 22, 53],
                "detected_services": ["HTTP", "HTTPS", "SSH", "DNS"],
                "is_gateway": True,
                "is_local_host": False
            },
            {
                "ip_address": "192.168.100.50",
                "mac_address": "11:22:33:44:55:66",
                "hostname": "PRINTER-OFFICE-01",
                "vendor": "HP Inc.",
                "os_type": "Embedded RTOS",
                "os_confidence": "Medium",
                "device_type": "Printer",
                "device_type_confidence": "High",
                "open_ports": [9100, 631, 80],
                "detected_services": ["RAW-Print", "IPP", "HTTP"],
                "is_gateway": False,
                "is_local_host": False
            }
        ]
    }

    # 1. Unauthenticated request rejected
    unauth_res = await async_client.post("/api/v1/agent/discovery-sync", json=sync_payload)
    assert unauth_res.status_code in [401, 403]

    # 2. Authenticated sensor sync accepted
    auth_res = await async_client.post(
        "/api/v1/agent/discovery-sync",
        json=sync_payload,
        headers={"X-Agent-Token": "netguard-agent-secret-auth-token-2026"}
    )
    assert auth_res.status_code == 200
    res_data = auth_res.json()
    assert res_data["status"] == "SUCCESS"
    assert res_data["synced_devices_count"] == 2
    assert res_data["sensor_id"] == "SENSOR-HQ-FLOOR-2"
