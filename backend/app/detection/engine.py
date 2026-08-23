import uuid
import logging
import math
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from collections import defaultdict

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.core.config import settings
from backend.app.models.security_event import SecurityEvent
from backend.app.models.alert import Alert
from backend.app.models.device import Device
from backend.app.integrations.firewall import get_firewall_provider
from backend.app.notifications import notification_service
from backend.app.websocket.manager import ws_manager

logger = logging.getLogger("netguard.detection")


class ThreatDetectionEngine:
    """
    Core security event detection engine.
    Analyzes normalized security events, applies behavioural heuristic rules,
    detects anomalies, creates alerts, and initiates safety-checked response actions.
    """

    def __init__(self):
        # Sliding state windows for heuristic correlation
        self.port_scan_tracker = defaultdict(lambda: {"ports": set(), "last_seen": datetime.now(timezone.utc)})
        self.failed_auth_tracker = defaultdict(lambda: {"count": 0, "first_seen": datetime.now(timezone.utc)})
        self.dns_query_tracker = defaultdict(lambda: {"queries": list(), "last_seen": datetime.now(timezone.utc)})

    def _calculate_shannon_entropy(self, data: str) -> float:
        """Calculate Shannon entropy to identify algorithmic / DGA domains."""
        if not data:
            return 0.0
        entropy = 0.0
        length = len(data)
        freq = defaultdict(int)
        for char in data:
            freq[char] += 1
        for count in freq.values():
            p_x = count / length
            entropy -= p_x * math.log2(p_x)
        return entropy

    async def process_event(self, db: AsyncSession, event: SecurityEvent) -> Optional[Alert]:
        """
        Process incoming normalized SecurityEvent against detection rules.
        """
        created_alert: Optional[Alert] = None

        # 1. Direct IDS Alert Ingestion
        if event.event_type == "alert" or event.source in ["suricata", "zeek"]:
            created_alert = await self._handle_ids_alert(db, event)

        # 2. Port Scan Behavioural Detection
        elif event.event_type in ["flow", "connection"] and event.source_ip and event.destination_port:
            created_alert = await self._detect_port_scan(db, event)

        # 3. Repeated Failed Authentication Detection
        elif event.event_type in ["auth_failure", "login_failed"] and event.source_ip:
            created_alert = await self._detect_brute_force(db, event)

        # 4. Suspicious DNS & DGA Detection
        elif event.event_type == "dns" and event.description:
            created_alert = await self._detect_dns_anomaly(db, event)

        if created_alert:
            # Trigger real-time notifications & automatic response
            await self._handle_alert_response(db, created_alert)

        return created_alert

    async def _handle_ids_alert(self, db: AsyncSession, event: SecurityEvent) -> Alert:
        """Map raw IDS signature event to high-fidelity SOC Alert."""
        severity = event.severity.upper()
        if severity not in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]:
            severity = "MEDIUM"

        category = "ids_signature"
        sig_lower = (event.signature or "").lower()
        if "scan" in sig_lower or "nmap" in sig_lower:
            category = "port_scan"
        elif "brute" in sig_lower or "login" in sig_lower or "auth" in sig_lower:
            category = "brute_force"
        elif "malware" in sig_lower or "trojan" in sig_lower or "c2" in sig_lower:
            category = "malware"
            severity = "CRITICAL"
        elif "dos" in sig_lower or "flood" in sig_lower:
            category = "ddos"
            severity = "HIGH"
        elif "dns" in sig_lower or "tunnel" in sig_lower:
            category = "suspicious_dns"

        alert_id = f"ALT-{uuid.uuid4().hex[:8].upper()}"
        alert = Alert(
            alert_id=alert_id,
            title=event.signature or f"Suspicious Activity Detected ({event.event_type})",
            description=event.description or f"IDS alert triggered from {event.source_ip} to {event.destination_ip}:{event.destination_port}",
            category=category,
            severity=severity,
            status="NEW",
            source=event.source.capitalize(),
            source_ip=event.source_ip,
            destination_ip=event.destination_ip,
            source_port=event.source_port,
            destination_port=event.destination_port,
            protocol=event.protocol,
            signature=event.signature,
            raw_event=event.raw_payload,
            is_synthetic=event.is_synthetic,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        db.add(alert)
        await db.commit()
        await db.refresh(alert)
        return alert

    async def _detect_port_scan(self, db: AsyncSession, event: SecurityEvent) -> Optional[Alert]:
        """Detect rapid connection attempts across distinct ports."""
        src = event.source_ip
        now = datetime.now(timezone.utc)
        record = self.port_scan_tracker[src]

        # Reset if window expired (1 minute)
        if (now - record["last_seen"]).total_seconds() > 60:
            record["ports"] = set()

        record["ports"].add(event.destination_port)
        record["last_seen"] = now

        # Threshold: > 15 distinct ports in 60s
        if len(record["ports"]) >= 15:
            record["ports"] = set()  # Reset after trigger to avoid flood
            alert_id = f"ALT-{uuid.uuid4().hex[:8].upper()}"
            alert = Alert(
                alert_id=alert_id,
                title="Port Scanning Activity Detected",
                description=f"Host {src} scanned multiple destination ports in a short timeframe.",
                category="port_scan",
                severity="HIGH",
                status="NEW",
                source="Behavioral Detection Engine",
                source_ip=src,
                destination_ip=event.destination_ip,
                source_port=event.source_port,
                destination_port=event.destination_port,
                protocol=event.protocol or "TCP",
                signature="ENGINE-DETECT-PORT-SCAN",
                raw_event=event.raw_payload,
                is_synthetic=event.is_synthetic,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            db.add(alert)
            await db.commit()
            await db.refresh(alert)
            return alert
        return None

    async def _detect_brute_force(self, db: AsyncSession, event: SecurityEvent) -> Optional[Alert]:
        """Detect multiple failed authentications in short succession."""
        src = event.source_ip
        now = datetime.now(timezone.utc)
        record = self.failed_auth_tracker[src]

        if (now - record["first_seen"]).total_seconds() > 120:
            record["count"] = 0
            record["first_seen"] = now

        record["count"] += 1

        # Threshold: 5 failed attempts in 2 minutes
        if record["count"] >= 5:
            record["count"] = 0
            alert_id = f"ALT-{uuid.uuid4().hex[:8].upper()}"
            alert = Alert(
                alert_id=alert_id,
                title="Repeated Failed Authentication (Brute Force)",
                description=f"Host {src} generated excessive failed authentication attempts against {event.destination_ip}:{event.destination_port}.",
                category="brute_force",
                severity="HIGH",
                status="NEW",
                source="Behavioral Detection Engine",
                source_ip=src,
                destination_ip=event.destination_ip,
                source_port=event.source_port,
                destination_port=event.destination_port,
                protocol=event.protocol or "TCP",
                signature="ENGINE-DETECT-BRUTE-FORCE",
                raw_event=event.raw_payload,
                is_synthetic=event.is_synthetic,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            db.add(alert)
            await db.commit()
            await db.refresh(alert)
            return alert
        return None

    async def _detect_dns_anomaly(self, db: AsyncSession, event: SecurityEvent) -> Optional[Alert]:
        """Detect high entropy domains (DGA/tunneling indicators)."""
        domain = event.description or ""
        entropy = self._calculate_shannon_entropy(domain)

        # Threshold: Domain length > 18 and Shannon Entropy > 3.8 indicates high randomness
        if len(domain) > 18 and entropy > 3.8:
            alert_id = f"ALT-{uuid.uuid4().hex[:8].upper()}"
            alert = Alert(
                alert_id=alert_id,
                title="Suspicious High-Entropy DNS Query (Possible DGA / C2)",
                description=f"Query for suspicious domain '{domain}' (Entropy: {entropy:.2f}) from {event.source_ip}.",
                category="suspicious_dns",
                severity="HIGH",
                status="NEW",
                source="Behavioral Detection Engine",
                source_ip=event.source_ip,
                destination_ip=event.destination_ip,
                source_port=event.source_port,
                destination_port=53,
                protocol="UDP",
                signature="ENGINE-DETECT-HIGH-ENTROPY-DNS",
                raw_event=event.raw_payload,
                is_synthetic=event.is_synthetic,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            db.add(alert)
            await db.commit()
            await db.refresh(alert)
            return alert
        return None

    async def _handle_alert_response(self, db: AsyncSession, alert: Alert):
        """Broadcast alert via WebSockets, dispatch notifications, and handle safe auto-response."""
        # 1. Real-time WebSocket Broadcast
        alert_data = {
            "id": alert.id,
            "alert_id": alert.alert_id,
            "title": alert.title,
            "severity": alert.severity,
            "category": alert.category,
            "source_ip": alert.source_ip,
            "destination_ip": alert.destination_ip,
            "status": alert.status,
            "created_at": alert.created_at.isoformat(),
            "is_synthetic": alert.is_synthetic
        }
        await ws_manager.broadcast("alert", alert_data)

        # 2. Dispatch Notifications
        subject = f"{alert.title} ({alert.severity})"
        body = (
            f"Alert ID: {alert.alert_id}\n"
            f"Severity: {alert.severity}\n"
            f"Category: {alert.category}\n"
            f"Source IP: {alert.source_ip}\n"
            f"Destination IP: {alert.destination_ip}\n"
            f"Description: {alert.description}\n"
            f"Time: {alert.created_at.isoformat()}"
        )
        await notification_service.dispatch(db=db, subject=subject, message=body, severity=alert.severity)

        # 3. Optional Safe Auto-Block for CRITICAL Alerts if enabled by Administrator
        if alert.severity == "CRITICAL" and settings.AUTO_BLOCK_CRITICAL_ALERTS and alert.source_ip:
            fw_provider = get_firewall_provider()
            # Double-check protected allowlist before taking action
            if alert.source_ip not in settings.PROTECTED_IPS:
                logger.info(f"Auto-blocking malicious source IP {alert.source_ip} due to CRITICAL alert {alert.alert_id}")
                block_res = await fw_provider.block_ip(
                    ip=alert.source_ip,
                    reason=f"Auto-response for Critical Alert {alert.alert_id} ({alert.title})",
                    duration_minutes=settings.AUTO_BLOCK_DURATION_MINUTES
                )
                if block_res.get("success"):
                    from backend.app.models.firewall import BlockedIP, FirewallAction
                    blocked_entry = BlockedIP(
                        ip_address=alert.source_ip,
                        reason=f"Automated SOC Defense: {alert.title}",
                        blocked_by="NetGuard Auto-Response",
                        blocked_at=datetime.now(timezone.utc),
                        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.AUTO_BLOCK_DURATION_MINUTES),
                        is_active=True,
                        source_alert_id=alert.alert_id
                    )
                    action_log = FirewallAction(
                        action_type="BLOCK",
                        ip_address=alert.source_ip,
                        triggered_by="NetGuard Auto-Response Engine",
                        timestamp=datetime.now(timezone.utc),
                        status="SUCCESS",
                        details=f"Blocked due to {alert.alert_id}"
                    )
                    db.add(blocked_entry)
                    db.add(action_log)
                    await db.commit()
                    await ws_manager.broadcast("firewall_block", {"ip": alert.source_ip, "reason": alert.title})


detection_engine = ThreatDetectionEngine()
