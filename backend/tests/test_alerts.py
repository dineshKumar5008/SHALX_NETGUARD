import pytest
from httpx import AsyncClient
from backend.tests.conftest import perform_test_login


@pytest.mark.asyncio
async def test_alerts_and_incident_lifecycle(async_client: AsyncClient):
    # 1. Login as Analyst using 2-step MFA
    token = await perform_test_login(async_client, username="testanalyst", password="Password123!")
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Seed data
    await async_client.post("/api/v1/dev/seed-data", headers=headers)

    # 3. List alerts (with include_synthetic=true for seeded demo alerts)
    alerts_resp = await async_client.get("/api/v1/alerts?include_synthetic=true", headers=headers)
    assert alerts_resp.status_code == 200
    alerts = alerts_resp.json()
    assert len(alerts) > 0
    first_alert = alerts[0]

    # 4. Triage alert -> Acknowledge
    triage_resp = await async_client.post(
        f"/api/v1/alerts/{first_alert['id']}/triage",
        json={"action": "acknowledge", "notes": "Under review by analyst"},
        headers=headers
    )
    assert triage_resp.status_code == 200
    assert triage_resp.json()["status"] == "ACKNOWLEDGED"

    # 5. Escalate to Incident
    esc_resp = await async_client.post(
        f"/api/v1/alerts/{first_alert['id']}/escalate-to-incident",
        headers=headers
    )
    assert esc_resp.status_code == 200
    incident_id = esc_resp.json()["incident_id"]

    # 6. Retrieve Incident and add investigation note
    inc_resp = await async_client.get(f"/api/v1/incidents/{incident_id}", headers=headers)
    assert inc_resp.status_code == 200
    assert inc_resp.json()["status"] == "OPEN"

    note_resp = await async_client.post(
        f"/api/v1/incidents/{incident_id}/notes",
        json={"note": "Confirmed malicious port scan source. Initiating containment."},
        headers=headers
    )
    assert note_resp.status_code == 200
