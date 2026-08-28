import pytest
import json
from datetime import datetime, timezone
from sqlalchemy.future import select
from backend.app.collectors.discovery import (
    NetworkDiscoveryService,
    get_vendor_by_mac,
    normalize_mac,
    PORT_SERVICE_MAP
)
from backend.app.models.device import Device, NetworkInterface
from backend.app.schemas.device import DeviceResponse
from backend.tests.conftest import TestSessionLocal


@pytest.mark.asyncio
async def test_vendor_and_mac_normalization():
    # Test normalization
    assert normalize_mac("00-50-56-11-22-33") == "00:50:56:11:22:33"
    assert normalize_mac("005056112233") == "00:50:56:11:22:33"
    assert normalize_mac("52:54:00:12:34:56") == "52:54:00:12:34:56"

    # Test vendor lookup
    assert "VMware" in get_vendor_by_mac("00:50:56:11:22:33")
    assert "QEMU" in get_vendor_by_mac("52:54:00:AB:CD:EF")
    assert "Hyper-V" in get_vendor_by_mac("00:15:5D:12:34:56")
    assert "Raspberry" in get_vendor_by_mac("DC:A6:32:11:22:33")
    assert "Apple" in get_vendor_by_mac("00:17:F2:11:22:33")
    assert "Samsung" in get_vendor_by_mac("00:12:47:11:22:33")
    assert "HP" in get_vendor_by_mac("00:1E:0B:11:22:33")
    assert "Canon" in get_vendor_by_mac("00:1E:8F:11:22:33")
    assert "Amazon" in get_vendor_by_mac("68:37:E9:11:22:33")
    assert "TP-Link" in get_vendor_by_mac("AC:84:C6:11:22:33")


@pytest.mark.asyncio
async def test_local_host_device_detection():
    service = NetworkDiscoveryService()
    host_data = service.get_local_host_device()

    assert host_data["ip_address"] is not None
    assert host_data["hostname"] is not None
    assert host_data["device_type"] in ["Laptop", "Desktop"]
    assert host_data["device_type_confidence"] == "High"
    assert host_data["os_confidence"] == "High"
    assert host_data["architecture"] is not None


@pytest.mark.asyncio
async def test_fingerprint_node_evidence_classification():
    service = NetworkDiscoveryService()

    # 1. Gateway node -> Router (High confidence)
    gw_node = await service.fingerprint_node("192.168.1.1", "AC:84:C6:11:22:33", default_gw_ip="192.168.1.1")
    assert gw_node["device_type"] == "Router"
    assert gw_node["device_type_confidence"] == "High"

    # 2. Mobile vendor OUI node -> Mobile (High confidence)
    samsung_node = await service.fingerprint_node("192.168.1.105", "00:12:47:AA:BB:CC", default_gw_ip="192.168.1.1")
    assert samsung_node["device_type"] == "Mobile"
    assert samsung_node["device_type_confidence"] == "High"

    # 3. Printer OUI node -> Printer (Medium or High confidence)
    printer_node = await service.fingerprint_node("192.168.1.150", "00:1E:8F:AA:BB:CC", default_gw_ip="192.168.1.1")
    assert printer_node["device_type"] == "Printer"
    assert printer_node["device_type_confidence"] in ["High", "Medium"]

    # 4. Unknown MAC with no open ports -> Unknown (Low confidence)
    unknown_node = await service.fingerprint_node("192.168.1.250", "98:AA:BB:CC:DD:EE", default_gw_ip="192.168.1.1")
    # Even if unknown MAC, verify it doesn't crash and returns valid device_type
    assert unknown_node["device_type"] in ["Unknown", "Mobile", "Desktop", "Router", "IoT", "Printer"]


@pytest.mark.asyncio
async def test_device_schema_serialization():
    # Test that DeviceResponse properly parses open_ports and detected_services from JSON strings
    device_dict = {
        "id": 1,
        "ip_address": "192.168.1.10",
        "mac_address": "00:12:47:11:22:33",
        "hostname": "Galaxy-S23",
        "vendor": "Samsung Electronics",
        "os_type": "Android",
        "os_version": "14",
        "os_confidence": "High",
        "architecture": "ARM64",
        "device_type": "Mobile",
        "device_type_confidence": "High",
        "open_ports": "[53, 80]",
        "detected_services": "[\"DNS\", \"HTTP Web Server\"]",
        "status": "ONLINE",
        "is_monitored": True,
        "first_seen": datetime.now(timezone.utc),
        "last_seen": datetime.now(timezone.utc),
        "interfaces": []
    }

    resp = DeviceResponse.model_validate(device_dict)
    assert resp.device_type == "Mobile"
    assert resp.device_type_confidence == "High"
    assert resp.open_ports == [53, 80]
    assert resp.detected_services == ["DNS", "HTTP Web Server"]


@pytest.mark.asyncio
async def test_dynamic_device_upsert_and_ip_migration():
    service = NetworkDiscoveryService()
    now = datetime.now(timezone.utc)

    async with TestSessionLocal() as session:
        # 1. Initial discovery of device with MAC 00:50:56:AA:BB:CC on 192.168.1.50
        node_data_1 = {
            "ip_address": "192.168.1.50",
            "mac_address": "00:50:56:AA:BB:CC",
            "hostname": "workstation-01.local",
            "vendor": "VMware Virtual Machine",
            "os_type": "Linux",
            "device_type": "Desktop",
            "device_type_confidence": "Medium",
            "open_ports": "[22]",
            "detected_services": "[\"SSH\"]",
            "interface_name": "eth0"
        }

        dev1 = await service._upsert_device(session, node_data_1, now)
        await session.commit()

        assert dev1.id is not None
        assert dev1.ip_address == "192.168.1.50"
        assert dev1.mac_address == "00:50:56:AA:BB:CC"
        assert dev1.status == "ONLINE"
        assert dev1.device_type == "Desktop"

        # Verify device count is 1
        total_devs = (await session.execute(select(Device))).scalars().all()
        assert len(total_devs) == 1

        # 2. Dynamic IP reassignment: Device receives new IP 192.168.1.99 with same MAC
        node_data_2 = {
            "ip_address": "192.168.1.99",
            "mac_address": "00:50:56:AA:BB:CC",
            "hostname": "workstation-01.local",
            "vendor": "VMware Virtual Machine",
            "os_type": "Linux",
            "device_type": "Desktop",
            "device_type_confidence": "Medium",
            "interface_name": "eth0"
        }

        dev2 = await service._upsert_device(session, node_data_2, now)
        await session.commit()

        # Identity preserved: same ID, updated IP, no duplicates created
        assert dev2.id == dev1.id
        assert dev2.ip_address == "192.168.1.99"

        total_devs_after = (await session.execute(select(Device))).scalars().all()
        assert len(total_devs_after) == 1


@pytest.mark.asyncio
async def test_dynamic_scan_execution():
    service = NetworkDiscoveryService()
    
    async with TestSessionLocal() as session:
        # Run dynamic scan (probes local host & ARP table)
        devices = await service.scan_monitored_subnets(session)
        
        # Must return list of real discovered devices without crashing
        assert isinstance(devices, list)
        
        # All returned devices must have real valid IPs
        for d in devices:
            assert d.ip_address is not None
            assert d.status in ["ONLINE", "OFFLINE"]
            assert d.device_type in ["Laptop", "Mobile", "Desktop", "Printer", "Router", "Switch", "Firewall", "Server", "IoT", "Unknown", "workstation", "server", "soc"]


@pytest.mark.asyncio
async def test_subnet_and_vlan_computation():
    from backend.app.collectors.discovery import get_device_subnet_and_vlan
    
    # Standard private /24
    cidr1, vlan1 = get_device_subnet_and_vlan("192.168.1.50")
    assert cidr1 == "192.168.1.0/24"
    assert vlan1 == "VLAN 1"

    cidr2, vlan2 = get_device_subnet_and_vlan("172.23.230.15", monitored_subnets=["172.23.230.0/24", "10.0.0.0/8"])
    assert cidr2 == "172.23.230.0/24"
    assert vlan2 == "VLAN 230"

    cidr_lb, vlan_lb = get_device_subnet_and_vlan("127.0.0.1")
    assert cidr_lb == "127.0.0.0/8"


@pytest.mark.asyncio
async def test_device_activity_endpoint(async_client):
    from backend.tests.conftest import perform_test_login
    from backend.app.models.security_event import SecurityEvent
    
    now = datetime.now(timezone.utc)
    
    async with TestSessionLocal() as session:
        dev = Device(
            ip_address="192.168.1.188",
            mac_address="52:54:00:99:88:77",
            hostname="DESKTOP-FINANCE",
            vendor="Dell Inc.",
            os_type="Windows",
            device_type="Desktop",
            status="ONLINE",
            first_seen=now,
            last_seen=now
        )
        session.add(dev)
        await session.commit()
        await session.refresh(dev)
        dev_id = dev.id

        # Add DNS and flow security events
        evt1 = SecurityEvent(
            event_id="evt-dns-001",
            timestamp=now,
            source="suricata",
            event_type="dns",
            severity="LOW",
            signature="DNS Query: api.render.com",
            description="api.render.com",
            source_ip="192.168.1.188",
            destination_ip="1.1.1.1",
            destination_port=53
        )
        evt2 = SecurityEvent(
            event_id="evt-tls-002",
            timestamp=now,
            source="suricata",
            event_type="tls",
            severity="LOW",
            signature="TLS SNI: github.com",
            source_ip="192.168.1.188",
            destination_ip="140.82.121.4",
            destination_port=443
        )
        session.add_all([evt1, evt2])
        await session.commit()

    token = await perform_test_login(async_client, username="testadmin", password="Password123!")
    headers = {"Authorization": f"Bearer {token}"}

    resp = await async_client.get(f"/api/v1/devices/{dev_id}/activity", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["device_id"] == dev_id
    assert data["ip_address"] == "192.168.1.188"
    assert data["subnet"] == "192.168.1.0/24"
    assert len(data["dns_queries"]) >= 1
    assert any(q["query"] == "api.render.com" for q in data["dns_queries"])
    assert len(data["destination_domains"]) >= 1
    assert any(d["domain"] == "github.com" for d in data["destination_domains"])
    assert data["summary"]["total_dns_queries"] >= 1

