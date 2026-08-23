import pytest
from datetime import datetime, timezone
from sqlalchemy.future import select
from backend.app.collectors.discovery import (
    NetworkDiscoveryService,
    get_vendor_by_mac,
    normalize_mac
)
from backend.app.models.device import Device, NetworkInterface
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
            "device_type": "server",
            "interface_name": "eth0"
        }

        dev1 = await service._upsert_device(session, node_data_1, now)
        await session.commit()

        assert dev1.id is not None
        assert dev1.ip_address == "192.168.1.50"
        assert dev1.mac_address == "00:50:56:AA:BB:CC"
        assert dev1.status == "ONLINE"

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
            "device_type": "server",
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
