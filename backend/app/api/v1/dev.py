import uuid
import random
from datetime import datetime, timezone, timedelta
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from sqlalchemy import delete
from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.core.security import get_password_hash, get_current_user, require_role, UserRole
from backend.app.models.user import User
from backend.app.models.mfa import MFAChallenge
from backend.app.models.device import Device, NetworkInterface
from backend.app.models.security_event import SecurityEvent
from backend.app.models.alert import Alert
from backend.app.models.metrics import HealthMetric, TrafficMetric
from backend.app.models.firewall import BlockedIP, FirewallRule
from backend.app.collectors.suricata import suricata_collector
from backend.app.detection.engine import detection_engine
from backend.app.websocket.manager import ws_manager

router = APIRouter(prefix="/dev", tags=["Development & Lab Simulation"])


class AttackSimulationRequest(BaseModel):
    attack_type: str = "port_scan"  # port_scan, brute_force, dns_anomaly, sqli_attack, ddos_syn_flood
    attacker_ip: str = "192.168.10.220"
    target_ip: str = "192.168.20.50"


@router.post("/seed-data")
async def seed_initial_demo_data(db: AsyncSession = Depends(get_db)):
    """
    Seed initial accounts, lab devices, baseline traffic metrics, and alerts.
    Exclusively tags all demo assets with is_synthetic = True to keep REAL MODE 100% clean.
    """
    # 1. Seed Users (Real registered emails must be configured by administrator)
    admin_email = settings.ADMIN_EMAIL or ""
    users_to_seed = [
        ("admin", admin_email, "SOC Administrator", "NetGuard@2026!", "ADMIN"),
        ("analyst", "", "Senior SOC Analyst", "Analyst@2026!", "ANALYST"),
        ("viewer", "", "Auditor / Viewer", "Viewer@2026!", "VIEWER"),
    ]

    created_users = []
    for username, email, full_name, raw_pwd, role in users_to_seed:
        stmt = select(User).where(User.username == username)
        existing = (await db.execute(stmt)).scalars().first()
        if not existing:
            u = User(
                username=username,
                email=email if email else None,
                full_name=full_name,
                hashed_password=get_password_hash(raw_pwd),
                role=role,
                is_active=True,
                created_at=datetime.now(timezone.utc)
            )
            db.add(u)
            created_users.append(username)

    # 2. Seed Baseline Lab Network Devices (Marked is_synthetic = True)
    devices_to_seed = [
        ("192.168.1.1", "52:54:00:12:34:01", "pfsense-gateway.lab", "Netgate / pfSense", "FreeBSD", "14.0", "firewall", "ONLINE"),
        ("192.168.30.10", "52:54:00:AB:CD:10", "netguard-soc.lab", "Ubuntu Enterprise", "Linux", "Ubuntu 22.04", "soc", "ONLINE"),
        ("192.168.20.10", "52:54:00:AA:BB:20", "suricata-sensor.lab", "Ubuntu Server", "Linux", "Ubuntu 22.04", "server", "ONLINE"),
        ("192.168.20.50", "00:50:56:11:22:33", "db-prod-01.lab", "VMware vSphere", "Linux", "Debian 12", "server", "ONLINE"),
        ("192.168.20.80", "00:50:56:44:55:66", "web-portal.lab", "VMware vSphere", "Linux", "Ubuntu 22.04", "server", "ONLINE"),
        ("192.168.10.105", "00:15:5D:44:55:66", "win11-finance-01.lab", "Microsoft Hyper-V", "Windows", "Windows 11", "workstation", "ONLINE"),
        ("192.168.10.112", "00:15:5D:77:88:99", "win11-hr-02.lab", "Microsoft Hyper-V", "Windows", "Windows 11", "workstation", "ONLINE"),
        ("192.168.10.220", "08:00:27:DE:AD:01", "kali-testbox.lab", "Oracle VirtualBox", "Linux", "Kali 2024.1", "workstation", "ONLINE"),
    ]

    for ip, mac, hostname, vendor, os_type, os_ver, dev_type, stat in devices_to_seed:
        stmt = select(Device).where(Device.ip_address == ip)
        dev = (await db.execute(stmt)).scalars().first()
        if not dev:
            dev = Device(
                ip_address=ip,
                mac_address=mac,
                hostname=hostname,
                vendor=vendor,
                os_type=os_type,
                os_version=os_ver,
                device_type=dev_type,
                status=stat,
                is_monitored=True,
                is_synthetic=True,
                first_seen=datetime.now(timezone.utc),
                last_seen=datetime.now(timezone.utc)
            )
            db.add(dev)
            await db.flush()
            iface = NetworkInterface(
                device_id=dev.id,
                interface_name="eth0",
                ip_address=ip,
                mac_address=mac,
                is_primary=True
            )
            db.add(iface)

    # 3. Seed Sample Security Alerts (Marked is_synthetic = True)
    sample_alerts = [
        ("ALT-PORT-SCAN-01", "Nmap TCP Stealth SYN Scan Detected", "port_scan", "HIGH", "Suricata IDS", "192.168.10.220", "192.168.20.50", 49152, 22, "TCP", "ET SCAN Potential Nmap Scan"),
        ("ALT-BRUTE-SSH-02", "Excessive SSH Authentication Failures", "brute_force", "HIGH", "Behavioral Detection Engine", "192.168.10.220", "192.168.20.10", 52140, 22, "TCP", "GPL ATTACK_RESPONSE SSH Failed Login Spike"),
        ("ALT-DNS-C2-03", "High-Entropy DGA Query Detected (Domain: qx89vbn23mzz.cc)", "suspicious_dns", "HIGH", "Behavioral Detection Engine", "192.168.10.105", "8.8.8.8", 53120, 53, "UDP", "ET MALWARE Suspicious DGA Domain Lookup"),
        ("ALT-SQLI-WEB-04", "SQL Injection Attempt via HTTP GET Parameter", "unauthorized_access", "CRITICAL", "Suricata IDS", "192.168.10.220", "192.168.20.80", 54312, 80, "TCP", "ET WEB_SPECIFIC_APPS SQL Injection Union Select"),
    ]

    for code, title, cat, sev, src, src_ip, dst_ip, s_port, d_port, proto, sig in sample_alerts:
        stmt = select(Alert).where(Alert.alert_id == code)
        existing_alert = (await db.execute(stmt)).scalars().first()
        if not existing_alert:
            a = Alert(
                alert_id=code,
                title=title,
                description=f"Automated threat alert generated during detection correlation ({src_ip} -> {dst_ip}).",
                category=cat,
                severity=sev,
                status="NEW",
                source=src,
                source_ip=src_ip,
                destination_ip=dst_ip,
                source_port=s_port,
                destination_port=d_port,
                protocol=proto,
                signature=sig,
                raw_event=f'{{"event_type": "alert", "signature": "{sig}", "src_ip": "{src_ip}", "dest_ip": "{dst_ip}"}}',
                is_synthetic=True,
                created_at=datetime.now(timezone.utc) - timedelta(minutes=random.randint(5, 120)),
                updated_at=datetime.now(timezone.utc)
            )
            db.add(a)

    # 4. Seed Health Metrics
    for hostname, os_name in [("netguard-soc.lab", "Linux"), ("db-prod-01.lab", "Linux"), ("win11-finance-01.lab", "Windows")]:
        hm = HealthMetric(
            host_id=f"host-{hostname}",
            hostname=hostname,
            os_name=os_name,
            cpu_percent=round(random.uniform(22.0, 48.0), 1),
            ram_percent=round(random.uniform(45.0, 68.0), 1),
            disk_percent=round(random.uniform(35.0, 55.0), 1),
            network_in_bytes=random.randint(1000000, 5000000),
            network_out_bytes=random.randint(1000000, 5000000),
            uptime_seconds=86400 * 3,
            status="HEALTHY",
            recorded_at=datetime.now(timezone.utc)
        )
        db.add(hm)

    await db.commit()
    return {
        "message": "NetGuard demonstration lab database seeded successfully (Tagged is_synthetic=True).",
        "created_users": created_users,
        "default_credentials": {
            "admin": "NetGuard@2026!",
            "analyst": "Analyst@2026!",
            "viewer": "Viewer@2026!"
        }
    }


@router.post("/simulate-attack")
async def simulate_attack_event(
    payload: AttackSimulationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ANALYST]))
):
    """
    Execute a controlled attack simulation event in development/lab mode.
    Generates authentic IDS records with 'is_synthetic = True' and processes them through the SOC pipeline.
    """
    now = datetime.now(timezone.utc)

    if payload.attack_type == "port_scan":
        events = []
        for port in [21, 22, 23, 25, 80, 110, 139, 443, 445, 1433, 3306, 3389, 5432, 8080, 8443, 9000]:
            raw_suri = {
                "timestamp": now.isoformat(),
                "event_type": "flow",
                "src_ip": payload.attacker_ip,
                "dest_ip": payload.target_ip,
                "src_port": random.randint(40000, 60000),
                "dest_port": port,
                "proto": "TCP"
            }
            evt, alert = await suricata_collector.ingest_single_event(db, raw_suri, is_synthetic=True)
            events.append(evt)
        return {
            "message": f"Port scan simulated from {payload.attacker_ip} against {payload.target_ip}",
            "events_generated": len(events)
        }

    elif payload.attack_type == "brute_force":
        for _ in range(6):
            raw_evt = {
                "timestamp": now.isoformat(),
                "event_type": "auth_failure",
                "src_ip": payload.attacker_ip,
                "dest_ip": payload.target_ip,
                "src_port": 51234,
                "dest_port": 22,
                "proto": "TCP",
                "alert": {
                    "signature": "SSH Password Guessing Brute Force Spike",
                    "severity": 1,
                    "category": "Attempted Administrator Privilege Gain"
                }
            }
            await suricata_collector.ingest_single_event(db, raw_evt, is_synthetic=True)
        return {"message": f"SSH Brute force simulated from {payload.attacker_ip}"}

    elif payload.attack_type == "dns_anomaly":
        dga_domain = f"malware-c2-xyz{random.randint(10000, 99999)}abc998877.biz"
        raw_dns = {
            "timestamp": now.isoformat(),
            "event_type": "dns",
            "src_ip": payload.attacker_ip,
            "dest_ip": "8.8.8.8",
            "dns": {"rrname": dga_domain}
        }
        await suricata_collector.ingest_single_event(db, raw_dns, is_synthetic=True)
        return {"message": f"High-entropy DNS query simulated for domain: {dga_domain}"}

    elif payload.attack_type == "sqli_attack":
        raw_sqli = {
            "timestamp": now.isoformat(),
            "event_type": "alert",
            "src_ip": payload.attacker_ip,
            "dest_ip": payload.target_ip,
            "src_port": 58920,
            "dest_port": 80,
            "proto": "TCP",
            "alert": {
                "signature": "ET WEB_SPECIFIC_APPS SQL Injection Union Select Attempt",
                "severity": 1,
                "category": "Web Application Attack",
                "action": "allowed"
            },
            "http": {
                "hostname": "portal.internal.lab",
                "url": "/login.php?user=admin' UNION SELECT null, password FROM users--",
                "http_method": "GET"
            }
        }
        await suricata_collector.ingest_single_event(db, raw_sqli, is_synthetic=True)
        return {"message": "Web application SQL injection attack simulated."}

    else:
        raw_ddos = {
            "timestamp": now.isoformat(),
            "event_type": "alert",
            "src_ip": payload.attacker_ip,
            "dest_ip": payload.target_ip,
            "src_port": 45120,
            "dest_port": 443,
            "proto": "TCP",
            "alert": {
                "signature": "ET DOS TCP SYN Flood Volumetric Anomaly",
                "severity": 1,
                "category": "Denial of Service"
            }
        }
        await suricata_collector.ingest_single_event(db, raw_ddos, is_synthetic=True)
        return {"message": "SYN Flood DDoS attack alert simulated."}


@router.post("/reset-rate-limit")
async def dev_reset_rate_limit(
    username: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    [DEVELOPMENT / TEST ONLY]
    Clears rate-limiting challenge history so operators can re-test authentication during development.
    Disabled in production mode.
    """
    if settings.ENVIRONMENT.lower() in ["prod", "production"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Rate limit reset is disabled in production environment."
        )

    if username:
        user_stmt = select(User).where(User.username == username)
        user = (await db.execute(user_stmt)).scalars().first()
        if user:
            await db.execute(delete(MFAChallenge).where(MFAChallenge.user_id == user.id))
    else:
        await db.execute(delete(MFAChallenge))

    await db.commit()
    return {
        "success": True,
        "message": f"MFA rate-limit state cleared successfully for {'user ' + username if username else 'all users'}."
    }

