import pytest
from datetime import datetime, timezone
from sqlalchemy.future import select
from httpx import AsyncClient

from backend.app.models.device import Device
from backend.tests.conftest import TestSessionLocal, perform_test_login


@pytest.mark.asyncio
async def test_dynamic_topology_no_hardcoded_fake_infrastructure(async_client: AsyncClient):
    # Login as admin using 2-step MFA
    token = await perform_test_login(async_client, username="testadmin", password="Password123!")
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch topology
    resp = await async_client.get("/api/v1/topology", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert "nodes" in data
    assert "edges" in data
    
    # Verify no fake demo nodes exist
    node_labels = [n["data"].get("label", "").lower() for n in data["nodes"]]
    node_ids = [n["id"] for n in data["nodes"]]

    assert "node-core-switch" not in node_ids
    assert "node-vlan10-sw" not in node_ids
    assert "node-vlan20-sw" not in node_ids
    assert "node-vlan30-sw" not in node_ids
    assert not any("db-production" in l for l in node_labels)
    assert not any("suricata-ids.lab" in l for l in node_labels)


@pytest.mark.asyncio
async def test_dynamic_topology_with_real_discovered_devices(async_client: AsyncClient):
    now = datetime.now(timezone.utc)

    # Insert 2 real discovered devices into test database
    async with TestSessionLocal() as session:
        d1 = Device(
            ip_address="192.168.1.100",
            mac_address="00:1E:67:AA:BB:CC",
            hostname="laptop-user.local",
            vendor="Intel Corporation",
            os_type="Windows",
            device_type="workstation",
            status="ONLINE",
            first_seen=now,
            last_seen=now
        )
        d2 = Device(
            ip_address="192.168.1.150",
            mac_address="B8:27:EB:11:22:33",
            hostname="raspberrypi.local",
            vendor="Raspberry Pi Foundation",
            os_type="Linux",
            device_type="server",
            status="ONLINE",
            first_seen=now,
            last_seen=now
        )
        session.add_all([d1, d2])
        await session.commit()

    # Login as admin using 2-step MFA
    token = await perform_test_login(async_client, username="testadmin", password="Password123!")
    headers = {"Authorization": f"Bearer {token}"}

    resp = await async_client.get("/api/v1/topology", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    node_ips = [n["data"].get("ip") for n in data["nodes"]]
    assert "192.168.1.100" in node_ips
    assert "192.168.1.150" in node_ips

    # Ensure edge connections link real devices to the gateway
    edge_targets = [e["target"] for e in data["edges"]]
    assert any(f"node-dev-{d1.id}" in t for t in edge_targets)
    assert any(f"node-dev-{d2.id}" in t for t in edge_targets)
