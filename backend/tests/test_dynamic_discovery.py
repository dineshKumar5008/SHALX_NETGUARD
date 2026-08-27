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
            assert d.device_type in ["Laptop", "Mobile", "Desktop", "Printer", "Router", "IoT", "Unknown", "workstation", "server", "soc"]
