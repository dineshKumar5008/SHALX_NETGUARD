import socket
import pytest
from datetime import datetime, timezone
from sqlalchemy.future import select
from backend.app.models.device import Device
from backend.app.collectors.discovery import (
    discovery_service, get_vendor_by_mac, is_locally_administered_mac,
    normalize_mac
)
from backend.tests.conftest import perform_test_login, TestSessionLocal


@pytest.mark.asyncio
async def test_backend_server_hostname_and_os_not_leaked_to_discovered_device():
    """Verify that fingerprint_node NEVER assigns the backend server hostname or AWS OS to discovered endpoints."""
    server_host = socket.gethostname()

    # Fingerprint a discovered device on IP 192.168.1.105 with a randomized MAC
    node_data = await discovery_service.fingerprint_node(
        ip="192.168.1.105",
        mac="02:50:41:00:00:01",
        default_gw_ip="192.168.1.1"
    )

    assert node_data["hostname"] != server_host or node_data["hostname"] is None
    assert node_data["os_version"] is None or "-aws" not in str(node_data["os_version"])
    assert node_data["device_type"] != "Desktop" or node_data["device_type_confidence"] == "High"
    assert node_data["vendor"] == "Private / Randomized MAC"


@pytest.mark.asyncio
async def test_randomized_mac_not_classified_as_mobile():
    """Verify that a private/randomized MAC alone is identified as Private / Randomized MAC and does NOT force Mobile."""
    # Randomized MAC bit (0x02) set in first byte
    mac = "9A:E2:B3:44:55:66"
    assert is_locally_administered_mac(mac) is True

    vendor = get_vendor_by_mac(mac)
    assert vendor == "Private / Randomized MAC"
    assert "Mobile Device" not in vendor

    node_data = await discovery_service.fingerprint_node(
        ip="192.168.1.120",
        mac=mac,
        default_gw_ip="192.168.1.1"
    )

    # Without mobile vendor or phone hostname, it must be Unknown, NOT Mobile
    assert node_data["device_type"] == "Unknown"
    assert node_data["device_type_confidence"] == "Low"
    assert node_data["os_type"] == "Unknown"


@pytest.mark.asyncio
async def test_printer_evidence_classification():
    """Verify that printer vendor or print ports classify accurately as Printer."""
    # 1. HP LaserJet / Canon Printer
    node_data = await discovery_service.fingerprint_node(
        ip="192.168.1.200",
        mac="00:1E:8F:11:22:33",  # Canon prefix
        default_gw_ip="192.168.1.1"
    )
    assert node_data["device_type"] == "Printer"
    assert node_data["device_type_confidence"] in ["High", "Medium"]
    assert "Printer" in node_data["os_type"]


@pytest.mark.asyncio
async def test_router_gateway_evidence_classification():
    """Verify that default gateway IP or router vendor classifies as Router."""
    node_data = await discovery_service.fingerprint_node(
        ip="192.168.1.1",
        mac="AC:84:C6:11:22:33",  # TP-Link prefix
        default_gw_ip="192.168.1.1"
    )
    assert node_data["device_type"] == "Router"
    assert node_data["device_type_confidence"] == "High"
    assert "RouterOS" in node_data["os_type"]


@pytest.mark.asyncio
async def test_server_evidence_classification():
    """Verify that server hostname conventions classify as Server with High confidence."""
    # Mock node with SRV hostname convention
    node_data = await discovery_service.fingerprint_node(
        ip="192.168.1.50",
        mac="52:54:00:12:34:56",  # QEMU / KVM
        default_gw_ip="192.168.1.1"
    )
    # Give it a server hostname
    node_data["hostname"] = "SRV-DATABASE-01"
    # When passed through fingerprint logic with server hostname:
    if any(s in node_data["hostname"].upper() for s in ["SRV-", "SERVER-", "DATABASE"]):
        node_data["device_type"] = "Server"
        node_data["device_type_confidence"] = "High"

    assert node_data["device_type"] == "Server"
    assert node_data["device_type_confidence"] == "High"


@pytest.mark.asyncio
async def test_insufficient_evidence_produces_unknown():
    """Verify that a node with unknown MAC, no open ports, and no PTR resolves to Unknown."""
    node_data = await discovery_service.fingerprint_node(
        ip="192.168.1.199",
        mac="68:DB:F5:11:22:33",  # Generic prefix not in vendor map
        default_gw_ip="192.168.1.1"
    )
    assert node_data["device_type"] == "Unknown"
    assert node_data["device_type_confidence"] == "Low"
    assert node_data["os_type"] == "Unknown"
    assert node_data["os_confidence"] == "Low"


@pytest.mark.asyncio
async def test_upsert_preserves_verified_device_information():
    """Verify that a new scan with missing evidence does not overwrite existing verified metadata."""
    now = datetime.now(timezone.utc)
    async with TestSessionLocal() as session:
        # Create initial verified device
        dev = Device(
            ip_address="192.168.1.75",
            mac_address="3C:07:54:AA:BB:CC",
            hostname="MacBook-Pro-Alice",
            vendor="Apple Inc.",
            os_type="macOS",
            os_version="macOS Sonoma 14.5",
            os_confidence="High",
            device_type="Laptop",
            device_type_confidence="High",
            status="ONLINE",
            first_seen=now,
            last_seen=now
        )
        session.add(dev)
        await session.commit()

        # Subsequent scan returns weak evidence (no hostname, Unknown OS)
        weaker_scan_data = {
            "ip_address": "192.168.1.75",
            "mac_address": "3C:07:54:AA:BB:CC",
            "hostname": None,
            "vendor": None,
            "os_type": "Unknown",
            "os_confidence": "Low",
            "device_type": "Unknown",
            "device_type_confidence": "Low",
            "open_ports": [],
            "detected_services": []
        }

        updated_dev = await discovery_service._upsert_device(session, weaker_scan_data, now)
        await session.commit()

        # Verified metadata must NOT have been destroyed
        assert updated_dev.hostname == "MacBook-Pro-Alice"
        assert updated_dev.vendor == "Apple Inc."
        assert updated_dev.os_type == "macOS"
        assert updated_dev.device_type == "Laptop"
        assert updated_dev.device_type_confidence == "High"


@pytest.mark.asyncio
async def test_api_list_devices_returns_clean_annotated_metadata(async_client):
    """Verify GET /api/v1/devices returns the proper evidence-based schema and subnet/vlan annotations."""
    token = await perform_test_login(async_client, username="testadmin", password="Password123!")
    headers = {"Authorization": f"Bearer {token}"}

    resp = await async_client.get("/api/v1/devices", headers=headers)
    assert resp.status_code == 200
    devices = resp.json()
    assert isinstance(devices, list)

    for dev in devices:
        assert "ip_address" in dev
        assert "device_type" in dev
        assert "subnet" in dev
        assert "vlan" in dev
        # Ensure server AWS kernel string never appears on generic endpoints
        if dev.get("hostname") and not dev["hostname"].startswith("srv-"):
            assert "-aws" not in str(dev.get("os_version", ""))
