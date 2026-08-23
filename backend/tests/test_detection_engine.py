import pytest
from datetime import datetime, timezone
from backend.app.collectors.suricata import SuricataLogCollector
from backend.app.integrations.firewall.mock import MockFirewallProvider


@pytest.mark.asyncio
async def test_suricata_eve_normalization():
    collector = SuricataLogCollector()
    raw_eve = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event_type": "alert",
        "src_ip": "192.168.10.220",
        "src_port": 49152,
        "dest_ip": "192.168.20.50",
        "dest_port": 22,
        "proto": "TCP",
        "alert": {
            "action": "allowed",
            "gid": 1,
            "signature_id": 2001219,
            "rev": 19,
            "signature": "ET SCAN Potential Nmap Scan",
            "category": "Attempted Information Leak",
            "severity": 2
        }
    }

    event = collector.normalize_event(raw_eve, is_synthetic=False)
    assert event is not None
    assert event.source == "suricata"
    assert event.event_type == "alert"
    assert event.severity == "MEDIUM"
    assert event.source_ip == "192.168.10.220"
    assert event.destination_ip == "192.168.20.50"


@pytest.mark.asyncio
async def test_firewall_provider_allowlist_safety():
    mock_fw = MockFirewallProvider()

    # 1. Attempt to block protected Loopback IP (127.0.0.1) without force
    block_res = await mock_fw.block_ip(
        ip="127.0.0.1",
        reason="Test accidental loopback block",
        force=False
    )
    assert block_res["success"] is False
    assert block_res.get("is_protected") is True

    # 2. Block valid malicious IP
    valid_res = await mock_fw.block_ip(
        ip="203.0.113.45",
        reason="Port scan brute force attack",
        duration_minutes=30
    )
    assert valid_res["success"] is True
    assert await mock_fw.is_ip_blocked("203.0.113.45") is True
