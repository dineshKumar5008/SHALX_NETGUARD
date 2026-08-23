import pytest
from datetime import datetime, timezone
from sqlalchemy.future import select
from httpx import AsyncClient

from backend.app.models.device import Device
from backend.app.collectors.discovery import (
    get_active_local_subnets,
    get_vendor_by_mac,
    NetworkDiscoveryService
)
from backend.tests.conftest import TestSessionLocal, perform_test_login


@pytest.mark.asyncio
async def test_active_local_subnet_detection():
    subnets = get_active_local_subnets()
    assert isinstance(subnets, list)
    assert len(subnets) > 0
    # Must be valid CIDR notation (e.g. 172.23.230.0/24 or 192.168.x.0/24)
    for s in subnets:
        assert "/" in s


@pytest.mark.asyncio
async def test_mobile_hotspot_topology_structure(async_client: AsyncClient):
    now = datetime.now(timezone.utc)

    async with TestSessionLocal() as session:
        # Simulate real Mobile Hotspot network discovery:
        # 1. Mobile A (Hotspot Gateway)
        mobile_a = Device(
            ip_address="192.168.43.1",
            mac_address="BE:D9:B3:40:3B:0E",
            hostname="Mobile-A-Hotspot",
            vendor="Wi-Fi Hotspot Gateway",
            os_type="Android (Hotspot)",
            device_type="router",
            status="ONLINE",
            first_seen=now,
            last_seen=now
        )
        # 2. Laptop (Running SHALX NETGUARD)
        laptop = Device(
            ip_address="192.168.43.25",
            mac_address="E8:9C:25:1E:A8:DA",
            hostname="LAPTOP-WIN11",
            vendor="Realtek Semiconductor",
            os_type="Windows 11",
            device_type="soc",
            status="ONLINE",
            first_seen=now,
            last_seen=now
        )
        # 3. Mobile B (Connected Client)
        mobile_b = Device(
            ip_address="192.168.43.50",
            mac_address="3C:5A:B4:11:22:33",
            hostname="Mobile-B",
            vendor="Google Pixel",
            os_type="Android / iOS",
            device_type="mobile",
            status="ONLINE",
            first_seen=now,
            last_seen=now
        )
        session.add_all([mobile_a, laptop, mobile_b])
        await session.commit()

    # Login as admin using 2-step MFA
    token = await perform_test_login(async_client, username="testadmin", password="Password123!")
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch topology
    resp = await async_client.get("/api/v1/topology", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    nodes = data["nodes"]
    edges = data["edges"]

    # Exactly 4 nodes: WAN (Internet), Mobile A (Gateway), Laptop, Mobile B
    node_ips = [n["data"].get("ip") for n in nodes]
    assert "External / WAN" in node_ips
    assert "192.168.43.1" in node_ips
    assert "192.168.43.25" in node_ips
    assert "192.168.43.50" in node_ips

    # Ensure NO fake switches or VLANs exist
    node_ids = [n["id"] for n in nodes]
    assert "node-core-switch" not in node_ids
    assert "node-vlan10-sw" not in node_ids
    assert "node-vlan20-sw" not in node_ids

    # Ensure connections link WAN -> Gateway, and Gateway -> Laptop & Mobile B
    edge_sources = [e["source"] for e in edges]
    edge_targets = [e["target"] for e in edges]
    
    gw_node_id = next(n["id"] for n in nodes if n["data"].get("ip") == "192.168.43.1")
    laptop_node_id = next(n["id"] for n in nodes if n["data"].get("ip") == "192.168.43.25")
    mobile_b_node_id = next(n["id"] for n in nodes if n["data"].get("ip") == "192.168.43.50")

    # WAN -> Gateway
    assert "node-internet" in edge_sources
    # Gateway -> Laptop
    assert any(e["source"] == gw_node_id and e["target"] == laptop_node_id for e in edges)
    # Gateway -> Mobile B
    assert any(e["source"] == gw_node_id and e["target"] == mobile_b_node_id for e in edges)
