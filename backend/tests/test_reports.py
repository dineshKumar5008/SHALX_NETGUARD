import pytest
import os
from datetime import datetime, timezone
from httpx import AsyncClient

from backend.app.models.device import Device
from backend.app.models.alert import Alert
from backend.app.models.incident import Incident
from backend.app.models.firewall import BlockedIP
from backend.tests.conftest import TestSessionLocal, perform_test_login


@pytest.mark.asyncio
async def test_pdf_report_generation_and_download_flow(async_client: AsyncClient):
    now = datetime.now(timezone.utc)

    # Populate database with real assets and telemetry
    async with TestSessionLocal() as session:
        d1 = Device(
            ip_address="192.168.1.10",
            mac_address="00:1E:67:11:22:33",
            hostname="web-server-01.local",
            vendor="Intel Corporation",
            os_type="Linux",
            device_type="server",
            status="ONLINE",
            first_seen=now,
            last_seen=now
        )
        d2 = Device(
            ip_address="192.168.1.55",
            mac_address="E8:9C:25:AA:BB:CC",
            hostname="workstation-pc.local",
            vendor="Realtek Semiconductor",
            os_type="Windows",
            device_type="workstation",
            status="ONLINE",
            first_seen=now,
            last_seen=now
        )
        alt1 = Alert(
            alert_id="ALT-TEST-001",
            title="Suspicious Port Scan Activity",
            category="Reconnaissance",
            severity="HIGH",
            status="NEW",
            source_ip="203.0.113.88",
            destination_ip="192.168.1.10",
            destination_port=80,
            protocol="TCP",
            created_at=now
        )
        inc1 = Incident(
            incident_id="INC-TEST-001",
            title="Active Network Reconnaissance Investigation",
            description="Investigating suspicious port scanning against web server.",
            severity="HIGH",
            status="INVESTIGATING",
            assigned_analyst="testanalyst",
            created_by="testanalyst",
            created_at=now
        )
        blk1 = BlockedIP(
            ip_address="192.168.1.200",
            reason="Port Scan Threat Actor",
            blocked_by="testanalyst",
            blocked_at=now,
            is_active=True
        )
        session.add_all([d1, d2, alt1, inc1, blk1])
        await session.commit()

    # 1. Login as Analyst using 2-step MFA
    token = await perform_test_login(async_client, username="testanalyst", password="Password123!")
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Generate Report
    gen_resp = await async_client.post(
        "/api/v1/reports/generate",
        json={"title": "Executive Posture Audit Report", "report_type": "daily"},
        headers=headers
    )
    assert gen_resp.status_code == 200
    meta = gen_resp.json()
    assert "report_id" in meta
    assert "report_name" in meta
    assert meta["file_size_bytes"] > 500
    filename = meta["report_name"]

    # 3. Authenticated Download Report
    download_resp = await async_client.get(f"/api/v1/reports/download/{filename}", headers=headers)
    assert download_resp.status_code == 200
    assert download_resp.headers["content-type"] == "application/pdf"
    assert "attachment" in download_resp.headers.get("content-disposition", "")
    assert len(download_resp.content) > 1000

    # 4. Unauthenticated Download (Must be rejected with 401 Unauthorized)
    unauth_resp = await async_client.get(f"/api/v1/reports/download/{filename}")
    assert unauth_resp.status_code == 401

    # 5. Non-existent report (Must return 404 Not Found)
    not_found_resp = await async_client.get("/api/v1/reports/download/nonexistent_report_12345.pdf", headers=headers)
    assert not_found_resp.status_code == 404

    # 6. Path traversal attempt (Must be blocked)
    traversal_resp = await async_client.get("/api/v1/reports/download/../../etc/passwd", headers=headers)
    assert traversal_resp.status_code in [400, 404]


@pytest.mark.asyncio
async def test_notification_settings_and_test_dispatch(async_client: AsyncClient):
    # Login as Admin using 2-step MFA
    token = await perform_test_login(async_client, username="testadmin", password="Password123!")
    headers = {"Authorization": f"Bearer {token}"}

    # Get settings
    settings_resp = await async_client.get("/api/v1/notifications/settings", headers=headers)
    assert settings_resp.status_code == 200

    # Dispatch test notification
    test_notif = await async_client.post(
        "/api/v1/notifications/test",
        json={"channel": "email", "recipient": "analyst@netguard.soc"},
        headers=headers
    )
    assert test_notif.status_code == 200
