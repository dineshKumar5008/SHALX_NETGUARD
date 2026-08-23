from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from backend.app.core.database import Base


class SecurityEvent(Base):
    __tablename__ = "security_events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    event_id = Column(String(64), unique=True, index=True, nullable=False)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True, nullable=False)
    source = Column(String(64), nullable=False)  # suricata, zeek, agent, network_collector, simulator
    event_type = Column(String(64), index=True, nullable=False)  # alert, dns, http, tls, flow, auth_failure, port_scan
    severity = Column(String(32), default="LOW", nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    source_ip = Column(String(45), index=True, nullable=True)
    destination_ip = Column(String(45), index=True, nullable=True)
    source_port = Column(Integer, nullable=True)
    destination_port = Column(Integer, nullable=True)
    protocol = Column(String(32), nullable=True)
    signature = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    raw_payload = Column(Text, nullable=True)
    is_synthetic = Column(Boolean, default=False, nullable=False)
