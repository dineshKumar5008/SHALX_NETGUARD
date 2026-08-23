from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from backend.app.core.database import Base


class BlockedIP(Base):
    __tablename__ = "blocked_ips"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ip_address = Column(String(45), unique=True, index=True, nullable=False)
    reason = Column(String(255), nullable=False)
    blocked_by = Column(String(64), default="SOC Analyst", nullable=False)
    blocked_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    source_alert_id = Column(String(64), nullable=True)


class FirewallAction(Base):
    __tablename__ = "firewall_actions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    action_type = Column(String(32), nullable=False)  # BLOCK, UNBLOCK, RULE_CHANGE, SYNC
    ip_address = Column(String(45), nullable=True)
    triggered_by = Column(String(64), nullable=False)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    status = Column(String(32), default="SUCCESS", nullable=False)  # SUCCESS, FAILED, PENDING
    details = Column(Text, nullable=True)


class FirewallRule(Base):
    __tablename__ = "firewall_rules"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    rule_name = Column(String(128), nullable=False)
    action = Column(String(16), default="BLOCK", nullable=False)  # BLOCK, PASS, REJECT
    source_cidr = Column(String(64), default="any", nullable=False)
    dest_cidr = Column(String(64), default="any", nullable=False)
    port_range = Column(String(32), default="any", nullable=False)
    protocol = Column(String(16), default="any", nullable=False)
    is_enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
