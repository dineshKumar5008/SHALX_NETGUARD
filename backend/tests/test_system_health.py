import pytest
from datetime import datetime, timezone, timedelta
from backend.app.models.metrics import HealthMetric, AgentHeartbeat
from backend.app.models.device import Device
from backend.tests.conftest import TestSessionLocal, perform_test_login


@pytest.mark.asyncio
async def test_server_self_health_telemetry(async_client):
    token = await perform_test_login(async_client, username="testadmin", password="Password123!")
    headers = {"Authorization": f"Bearer {token}"}

    resp = await async_client.get("/api/v1/health/server-self", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert "hostname" in data
    assert "os_name" in data
    assert isinstance(data["cpu_percent"], (int, float))
    assert 0 <= data["cpu_percent"] <= 100
    assert isinstance(data["ram_percent"], (int, float))
    assert 0 <= data["ram_percent"] <= 100
    assert isinstance(data["disk_percent"], (int, float))
    assert 0 <= data["disk_percent"] <= 100
    assert data["uptime_seconds"] >= 0
    assert data["status"] in ["HEALTHY", "WARNING", "CRITICAL"]
    assert "thresholds" in data


@pytest.mark.asyncio
async def test_agent_telemetry_ingestion_and_deduplication(async_client):
    token = await perform_test_login(async_client, username="testadmin", password="Password123!")
    user_headers = {"Authorization": f"Bearer {token}"}
    agent_headers = {"X-Agent-Token": "netguard-agent-secret-auth-token-2026"}

    # 1. Register heartbeat for a Windows agent
    hb_payload = {
        "hostname": "WORKSTATION-01",
        "ip_address": "192.168.1.155",
        "mac_address": "00:15:5D:12:34:56",
        "vendor": "Dell Inc.",
        "os_name": "Windows 11 Pro",
        "agent_version": "1.0.0"
    }
    hb_res = await async_client.post("/api/v1/agent/heartbeat", json=hb_payload, headers=agent_headers)
    assert hb_res.status_code == 200

    # 2. Ingest multiple metrics for the same host over time
    for i in range(3):
        metric_payload = {
            "hostname": "WORKSTATION-01",
            "ip_address": "192.168.1.155",
            "os_name": "Windows 11 Pro",
            "cpu_percent": 15.5 + i,
            "ram_percent": 42.0 + i,
            "disk_percent": 60.0,
            "network_in_bytes": 1000 * (i + 1),
            "network_out_bytes": 500 * (i + 1),
            "uptime_seconds": 3600 + (i * 10)
        }
        m_res = await async_client.post("/api/v1/agent/metrics", json=metric_payload, headers=agent_headers)
        assert m_res.status_code == 200

    # 3. GET /health/hosts should return exactly 1 deduplicated entry for WORKSTATION-01 with latest metrics
    hosts_res = await async_client.get("/api/v1/health/hosts", headers=user_headers)
    assert hosts_res.status_code == 200
    hosts = hosts_res.json()

    matched = [h for h in hosts if h["hostname"] == "WORKSTATION-01"]
    assert len(matched) == 1
    host = matched[0]
    assert host["ip_address"] == "192.168.1.155"
    assert host["os_name"] == "Windows 11 Pro"
    assert host["cpu_percent"] == 17.5
    assert host["status"] == "HEALTHY"
    assert host["is_stale"] is False


@pytest.mark.asyncio
async def test_stale_agent_offline_detection(async_client):
    token = await perform_test_login(async_client, username="testadmin", password="Password123!")
    headers = {"Authorization": f"Bearer {token}"}

    stale_time = datetime.now(timezone.utc) - timedelta(minutes=5)
    async with TestSessionLocal() as session:
        metric = HealthMetric(
            host_id="host-stale-server",
            hostname="OLD-SERVER-01",
            os_name="Ubuntu 22.04",
            cpu_percent=10.0,
            ram_percent=30.0,
            disk_percent=50.0,
            uptime_seconds=86400,
            status="HEALTHY",
            recorded_at=stale_time
        )
        session.add(metric)
        await session.commit()

    hosts_res = await async_client.get("/api/v1/health/hosts", headers=headers)
    assert hosts_res.status_code == 200
    hosts = hosts_res.json()

    stale_host = next((h for h in hosts if h["hostname"] == "OLD-SERVER-01"), None)
    assert stale_host is not None
    assert stale_host["status"] == "OFFLINE"
    assert stale_host["is_stale"] is True


@pytest.mark.asyncio
async def test_discovered_devices_telemetry_separation(async_client):
    token = await perform_test_login(async_client, username="testadmin", password="Password123!")
    headers = {"Authorization": f"Bearer {token}"}
    now = datetime.now(timezone.utc)

    async with TestSessionLocal() as session:
        # Device 1: Un-agented printer
        dev1 = Device(
            ip_address="192.168.1.200",
            mac_address="00:1E:8F:11:22:33",
            hostname="HP-LaserJet-Office",
            vendor="Canon / HP",
            device_type="Printer",
            status="ONLINE",
            first_seen=now,
            last_seen=now
        )
        # Device 2: Agent-installed server
        dev2 = Device(
            ip_address="192.168.1.10",
            mac_address="52:54:00:AA:BB:CC",
            hostname="SRV-PROD-01",
            vendor="QEMU",
            device_type="Server",
            status="ONLINE",
            first_seen=now,
            last_seen=now
        )
        # Heartbeat for SRV-PROD-01
        hb = AgentHeartbeat(
            agent_id="AGT-srv-prod-01",
            hostname="SRV-PROD-01",
            ip_address="192.168.1.10",
            os_name="Linux",
            last_heartbeat=now,
            status="ONLINE"
        )
        # Device 3: Device with stopped/offline agent (last reported 10 minutes ago)
        dev3 = Device(
            ip_address="192.168.1.55",
            mac_address="00:50:56:11:22:33",
            hostname="WS-OFFLINE-01",
            vendor="VMware",
            device_type="Desktop",
            status="ONLINE",
            first_seen=now,
            last_seen=now
        )
        hb_offline = AgentHeartbeat(
            agent_id="AGT-ws-offline-01",
            hostname="WS-OFFLINE-01",
            ip_address="192.168.1.55",
            os_name="Windows",
            last_heartbeat=now - timedelta(minutes=10),
            status="ONLINE"
        )
        session.add_all([dev1, dev2, dev3, hb, hb_offline])
        await session.commit()

    resp = await async_client.get("/api/v1/health/discovered-devices", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    printer = next((d for d in data if d["ip_address"] == "192.168.1.200"), None)
    assert printer is not None
    assert printer["has_agent"] is False
    assert "host telemetry unavailable" in printer["telemetry_status"]

    srv = next((d for d in data if d["ip_address"] == "192.168.1.10"), None)
    assert srv is not None
    assert srv["has_agent"] is True
    assert srv["telemetry_status"] == "Active Host Agent Telemetry"

    ws_off = next((d for d in data if d["ip_address"] == "192.168.1.55"), None)
    assert ws_off is not None
    assert ws_off["has_agent"] is False
    assert "Host agent offline" in ws_off["telemetry_status"]


@pytest.mark.asyncio
async def test_agent_unauthorized_token_rejection(async_client):
    invalid_headers = {"X-Agent-Token": "invalid-secret-key"}
    payload = {"hostname": "FAKE-NODE", "ip_address": "1.2.3.4", "os_name": "Linux"}

    resp = await async_client.post("/api/v1/agent/heartbeat", json=payload, headers=invalid_headers)
    assert resp.status_code in [401, 403]
