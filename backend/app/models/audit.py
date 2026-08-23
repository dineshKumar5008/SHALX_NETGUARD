from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Text
from backend.app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True, nullable=False)
    user = Column(String(64), index=True, nullable=False)
    action = Column(String(64), index=True, nullable=False)  # LOGIN, LOGOUT, IP_BLOCK, IP_UNBLOCK, ALERT_ACK, INCIDENT_CREATE, etc.
    resource = Column(String(128), nullable=False)
    result = Column(String(32), default="SUCCESS", nullable=False)  # SUCCESS, FAILURE, DENIED
    source_ip = Column(String(45), nullable=True)
    metadata_json = Column(Text, nullable=True)
