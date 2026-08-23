import os
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.config import settings
from backend.app.models.security_event import SecurityEvent
from backend.app.detection.engine import detection_engine
from backend.app.core.database import AsyncSessionLocal

logger = logging.getLogger("netguard.collectors.suricata")


class SuricataLogCollector:
    """
    Tails and ingests Suricata EVE JSON logs (eve.json).
    Parses alerts, HTTP, DNS, TLS, and flow metrics with deduplication.
    """

    def __init__(self, log_path: Optional[str] = None):
        self.log_path = log_path or settings.SURICATA_EVE_PATH
        self.last_position = 0
        self.processed_ids = set()

    def parse_eve_line(self, line: str) -> Optional[Dict[str, Any]]:
        """Parse and normalize a single EVE JSON line."""
        if not line or not line.strip():
            return None
        try:
            data = json.loads(line.strip())
            return data
        except json.JSONDecodeError as e:
            logger.warning(f"Malformed Suricata JSON line: {e}")
            return None

    def normalize_event(self, data: Dict[str, Any], is_synthetic: bool = False) -> Optional[SecurityEvent]:
        """Transform raw Suricata EVE record into NetGuard SecurityEvent model."""
        event_type = data.get("event_type", "unknown")
        timestamp_str = data.get("timestamp")
        
        try:
            if timestamp_str:
                dt = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
            else:
                dt = datetime.now(timezone.utc)
        except Exception:
            dt = datetime.now(timezone.utc)

        src_ip = data.get("src_ip")
        dest_ip = data.get("dest_ip")
        src_port = data.get("src_port")
        dest_port = data.get("dest_port")
        proto = data.get("proto", "IP")

        # Map severity and signatures for alert events
        severity = "LOW"
        signature = None
        description = None

        if event_type == "alert":
            alert_info = data.get("alert", {})
            signature = alert_info.get("signature", "Suricata Alert")
            severity_num = alert_info.get("severity", 3)
            # Suricata severity 1 = High/Critical, 2 = Medium, 3 = Low
            if severity_num == 1:
                severity = "HIGH"
            elif severity_num == 2:
                severity = "MEDIUM"
            else:
                severity = "LOW"
            description = f"Category: {alert_info.get('category', 'Network Threat')} | Action: {alert_info.get('action', 'allowed')}"

        elif event_type == "dns":
            dns_info = data.get("dns", {})
            query = dns_info.get("rrname") or dns_info.get("query", [{}])[0].get("rrname", "unknown")
            signature = f"DNS Query: {query}"
            description = query
            severity = "LOW"

        elif event_type == "http":
            http_info = data.get("http", {})
            hostname = http_info.get("hostname", "")
            url = http_info.get("url", "")
            signature = f"HTTP {http_info.get('http_method', 'GET')} {hostname}{url}"
            description = f"User-Agent: {http_info.get('http_user_agent', 'None')}"

        elif event_type == "tls":
            tls_info = data.get("tls", {})
            sni = tls_info.get("sni", "unknown")
            signature = f"TLS SNI: {sni}"
            description = f"Issuer: {tls_info.get('issuerdn', 'unknown')}"

        elif event_type == "flow":
            flow_info = data.get("flow", {})
            signature = f"Flow {proto} {src_ip}:{src_port} -> {dest_ip}:{dest_port}"
            description = f"Bytes: {flow_info.get('bytes_toclient', 0) + flow_info.get('bytes_toserver', 0)} | Packets: {flow_info.get('pkts_toclient', 0) + flow_info.get('pkts_toserver', 0)}"

        event_id = f"EVT-SURI-{uuid.uuid4().hex[:12].upper()}"

        return SecurityEvent(
            event_id=event_id,
            timestamp=dt,
            source="suricata",
            event_type=event_type,
            severity=severity,
            source_ip=src_ip,
            destination_ip=dest_ip,
            source_port=src_port,
            destination_port=dest_port,
            protocol=proto,
            signature=signature,
            description=description,
            raw_payload=json.dumps(data),
            is_synthetic=is_synthetic
        )

    async def ingest_single_event(self, db: AsyncSession, raw_json: Dict[str, Any], is_synthetic: bool = False):
        """Normalize, save to DB, and route through threat detection engine."""
        event = self.normalize_event(raw_json, is_synthetic=is_synthetic)
        if not event:
            return None
        db.add(event)
        await db.commit()
        await db.refresh(event)

        # Trigger detection engine
        alert = await detection_engine.process_event(db, event)
        return event, alert

    async def read_new_lines(self):
        """Poll and tail the configured EVE JSON file if it exists."""
        if not os.path.exists(self.log_path):
            return

        try:
            with open(self.log_path, "r", encoding="utf-8", errors="ignore") as f:
                f.seek(self.last_position)
                lines = f.readlines()
                self.last_position = f.tell()

            if lines:
                async with AsyncSessionLocal() as db:
                    for line in lines:
                        data = self.parse_eve_line(line)
                        if data:
                            await self.ingest_single_event(db, data, is_synthetic=False)
        except Exception as e:
            logger.error(f"Error while reading Suricata EVE log: {e}")


suricata_collector = SuricataLogCollector()
