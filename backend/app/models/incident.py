from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.core.database import Base


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    incident_id = Column(String(64), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String(32), default="HIGH", nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    status = Column(String(32), default="OPEN", nullable=False)  # OPEN, INVESTIGATING, CONTAINED, RESOLVED, CLOSED
    assigned_analyst = Column(String(64), nullable=True)
    created_by = Column(String(64), nullable=False)
    affected_ips = Column(Text, nullable=True)  # JSON or comma-separated list of affected IPs
    investigation_notes = Column(Text, nullable=True)
    is_synthetic = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    alerts = relationship("IncidentAlert", back_populates="incident", cascade="all, delete-orphan")
    timeline_events = relationship("IncidentTimeline", back_populates="incident", cascade="all, delete-orphan", order_by="IncidentTimeline.timestamp")


class IncidentAlert(Base):
    __tablename__ = "incident_alerts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    incident_id = Column(Integer, ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False)
    alert_id = Column(Integer, ForeignKey("alerts.id", ondelete="CASCADE"), nullable=False)

    incident = relationship("Incident", back_populates="alerts")


class IncidentTimeline(Base):
    __tablename__ = "incident_timeline"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    incident_id = Column(Integer, ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    actor = Column(String(64), nullable=False)
    event_type = Column(String(64), nullable=False)  # CREATED, ASSIGNED, NOTE_ADDED, IP_BLOCKED, STATUS_CHANGED, RESOLVED
    message = Column(Text, nullable=False)

    incident = relationship("Incident", back_populates="timeline_events")
