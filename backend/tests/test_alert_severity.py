import pytest
from datetime import datetime, timezone
from sqlalchemy import delete
from backend.app.models.alert import Alert
from backend.tests.conftest import perform_test_login, TestSessionLocal


@pytest.mark.asyncio
async def test_health_summary_empty_alerts_severity_distribution(async_client):
    """Verify that when there are zero active alerts, severity_distribution returns all zeros."""
    token = await perform_test_login(async_client, username="testadmin", password="Password123!")
    headers = {"Authorization": f"Bearer {token}"}

    # Clear any existing real alerts for clean test state
    async with TestSessionLocal() as session:
        await session.execute(delete(Alert))
        await session.commit()

    resp = await async_client.get("/api/v1/health/summary", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["active_alerts"] == 0
    assert data["critical_alerts"] == 0
    assert "severity_distribution" in data
    assert data["severity_distribution"] == {
        "CRITICAL": 0,
        "HIGH": 0,
        "MEDIUM": 0,
        "LOW": 0
    }


@pytest.mark.asyncio
async def test_health_summary_real_alerts_severity_distribution(async_client):
    """Verify exact severity counting across real active alerts with case normalization."""
    token = await perform_test_login(async_client, username="testadmin", password="Password123!")
    headers = {"Authorization": f"Bearer {token}"}

    now = datetime.now(timezone.utc)
    async with TestSessionLocal() as session:
        await session.execute(delete(Alert))

        # Add real active alerts with varied casing: 2 CRITICAL, 5 HIGH, 1 MEDIUM, 3 LOW
        alerts_to_add = [
            # 2 Critical
            Alert(alert_id="ALT-C1", title="Critical 1", severity="CRITICAL", status="NEW", category="malware", source="suricata", is_synthetic=False, created_at=now),
            Alert(alert_id="ALT-C2", title="Critical 2", severity="critical", status="INVESTIGATING", category="malware", source="suricata", is_synthetic=False, created_at=now),
            # 5 High
            Alert(alert_id="ALT-H1", title="High 1", severity="HIGH", status="NEW", category="port_scan", source="suricata", is_synthetic=False, created_at=now),
            Alert(alert_id="ALT-H2", title="High 2", severity="high", status="ACKNOWLEDGED", category="port_scan", source="suricata", is_synthetic=False, created_at=now),
            Alert(alert_id="ALT-H3", title="High 3", severity="High", status="NEW", category="port_scan", source="suricata", is_synthetic=False, created_at=now),
            Alert(alert_id="ALT-H4", title="High 4", severity="HIGH", status="INVESTIGATING", category="port_scan", source="suricata", is_synthetic=False, created_at=now),
            Alert(alert_id="ALT-H5", title="High 5", severity="HIGH", status="NEW", category="port_scan", source="suricata", is_synthetic=False, created_at=now),
            # 1 Medium
            Alert(alert_id="ALT-M1", title="Medium 1", severity="Medium", status="NEW", category="suspicious_dns", source="zeek", is_synthetic=False, created_at=now),
            # 3 Low
            Alert(alert_id="ALT-L1", title="Low 1", severity="low", status="NEW", category="policy", source="zeek", is_synthetic=False, created_at=now),
            Alert(alert_id="ALT-L2", title="Low 2", severity="LOW", status="ACKNOWLEDGED", category="policy", source="zeek", is_synthetic=False, created_at=now),
            Alert(alert_id="ALT-L3", title="Low 3", severity="Low", status="NEW", category="policy", source="zeek", is_synthetic=False, created_at=now),
        ]
        session.add_all(alerts_to_add)
        await session.commit()

    resp = await async_client.get("/api/v1/health/summary", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["active_alerts"] == 11
    assert data["critical_alerts"] == 2
    assert data["severity_distribution"] == {
        "CRITICAL": 2,
        "HIGH": 5,
        "MEDIUM": 1,
        "LOW": 3
    }


@pytest.mark.asyncio
async def test_health_summary_synthetic_alerts_excluded(async_client):
    """Verify synthetic / demo alerts (is_synthetic=True) do NOT affect the real severity distribution."""
    token = await perform_test_login(async_client, username="testadmin", password="Password123!")
    headers = {"Authorization": f"Bearer {token}"}

    now = datetime.now(timezone.utc)
    async with TestSessionLocal() as session:
        await session.execute(delete(Alert))
        # Add 1 real LOW alert and 3 synthetic CRITICAL/HIGH alerts
        session.add_all([
            Alert(alert_id="ALT-REAL-1", title="Real Alert", severity="LOW", status="NEW", category="policy", source="zeek", is_synthetic=False, created_at=now),
            Alert(alert_id="ALT-SYN-1", title="Synthetic 1", severity="CRITICAL", status="NEW", category="malware", source="mock", is_synthetic=True, created_at=now),
            Alert(alert_id="ALT-SYN-2", title="Synthetic 2", severity="HIGH", status="NEW", category="malware", source="mock", is_synthetic=True, created_at=now),
        ])
        await session.commit()

    resp = await async_client.get("/api/v1/health/summary", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["active_alerts"] == 1
    assert data["severity_distribution"] == {
        "CRITICAL": 0,
        "HIGH": 0,
        "MEDIUM": 0,
        "LOW": 1
    }


@pytest.mark.asyncio
async def test_health_summary_resolved_and_false_positive_alerts_excluded(async_client):
    """Verify resolved and false_positive alerts do NOT affect active threat distribution."""
    token = await perform_test_login(async_client, username="testadmin", password="Password123!")
    headers = {"Authorization": f"Bearer {token}"}

    now = datetime.now(timezone.utc)
    async with TestSessionLocal() as session:
        await session.execute(delete(Alert))
        session.add_all([
            Alert(alert_id="ALT-ACT-1", title="Active Alert", severity="HIGH", status="NEW", category="port_scan", source="suricata", is_synthetic=False, created_at=now),
            Alert(alert_id="ALT-RES-1", title="Resolved Alert", severity="CRITICAL", status="RESOLVED", category="malware", source="suricata", is_synthetic=False, created_at=now),
            Alert(alert_id="ALT-FP-1", title="False Positive", severity="CRITICAL", status="FALSE_POSITIVE", category="malware", source="suricata", is_synthetic=False, created_at=now),
        ])
        await session.commit()

    resp = await async_client.get("/api/v1/health/summary", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["active_alerts"] == 1
    assert data["critical_alerts"] == 0
    assert data["severity_distribution"] == {
        "CRITICAL": 0,
        "HIGH": 1,
        "MEDIUM": 0,
        "LOW": 0
    }


@pytest.mark.asyncio
async def test_health_summary_unknown_or_invalid_severity_ignored(async_client):
    """Verify unknown severity strings (e.g. INFORMATIONAL, UNKNOWN) do NOT inflate valid categories."""
    token = await perform_test_login(async_client, username="testadmin", password="Password123!")
    headers = {"Authorization": f"Bearer {token}"}

    now = datetime.now(timezone.utc)
    async with TestSessionLocal() as session:
        await session.execute(delete(Alert))
        session.add_all([
            Alert(alert_id="ALT-UNK-1", title="Unknown Severity Alert", severity="INFORMATIONAL", status="NEW", category="misc", source="zeek", is_synthetic=False, created_at=now),
            Alert(alert_id="ALT-UNK-2", title="None Severity Alert", severity="", status="NEW", category="misc", source="zeek", is_synthetic=False, created_at=now),
            Alert(alert_id="ALT-OK-1", title="Valid Alert", severity="MEDIUM", status="NEW", category="dns", source="zeek", is_synthetic=False, created_at=now),
        ])
        await session.commit()

    resp = await async_client.get("/api/v1/health/summary", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    # The two unknown severities must not inflate CRITICAL, HIGH, or LOW
    assert data["severity_distribution"] == {
        "CRITICAL": 0,
        "HIGH": 0,
        "MEDIUM": 1,
        "LOW": 0
    }
