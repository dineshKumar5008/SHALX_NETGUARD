import os
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.config import settings
from backend.app.models.security_event import SecurityEvent
from backend.app.detection.engine import detection_engine
from backend.app.core.database import AsyncSessionLocal

logger = logging.getLogger("netguard.collectors.zeek")


class ZeekLogCollector:
    """
    Ingests Zeek network security logs (conn.log, dns.log, http.log, ssl.log).
    Gracefully operates if Zeek is not installed or configured.
    """

    def __init__(self, log_dir: Optional[str] = None):
        self.log_dir = log_dir or settings.ZEEK_LOG_PATH
        self.offsets: Dict[str, int] = {}

    def is_available(self) -> bool:
        return os.path.exists(self.log_dir) and os.path.isdir(self.log_dir)

    def parse_conn_line(self, data: Dict[str, Any], is_synthetic: bool = False) -> Optional[SecurityEvent]:
        """Normalize Zeek conn.log row into SecurityEvent."""
        src_ip = data.get("id.orig_h") or data.get("src_ip")
        dest_ip = data.get("id.resp_h") or data.get("dest_ip")
        src_port = data.get("id.orig_p") or data.get("src_port")
        dest_port = data.get("id.resp_p") or data.get("dest_port")
        proto = data.get("proto", "TCP").upper()
        service = data.get("service", "-")

        event_id = f"EVT-ZEEK-{uuid.uuid4().hex[:12].upper()}"
        return SecurityEvent(
            event_id=event_id,
            timestamp=datetime.now(timezone.utc),
            source="zeek",
            event_type="connection",
            severity="LOW",
            source_ip=src_ip,
            destination_ip=dest_ip,
            source_port=int(src_port) if src_port else None,
            destination_port=int(dest_port) if dest_port else None,
            protocol=proto,
            signature=f"Zeek Conn: {proto} {service}",
            description=f"State: {data.get('conn_state', 'unknown')} | Orig Bytes: {data.get('orig_bytes', 0)}",
            raw_payload=json.dumps(data),
            is_synthetic=is_synthetic
        )

    def parse_dns_line(self, data: Dict[str, Any], is_synthetic: bool = False) -> Optional[SecurityEvent]:
        """Normalize Zeek dns.log row into SecurityEvent."""
        src_ip = data.get("id.orig_h") or data.get("src_ip")
        dest_ip = data.get("id.resp_h") or data.get("dest_ip")
        query = data.get("query", "unknown")
        qtype = data.get("qtype_name", "A")

        event_id = f"EVT-ZEEK-{uuid.uuid4().hex[:12].upper()}"
        return SecurityEvent(
            event_id=event_id,
            timestamp=datetime.now(timezone.utc),
            source="zeek",
            event_type="dns",
            severity="LOW",
            source_ip=src_ip,
            destination_ip=dest_ip,
            source_port=None,
            destination_port=53,
            protocol="UDP",
            signature=f"Zeek DNS Query [{qtype}]: {query}",
            description=query,
            raw_payload=json.dumps(data),
            is_synthetic=is_synthetic
        )


zeek_collector = ZeekLogCollector()
