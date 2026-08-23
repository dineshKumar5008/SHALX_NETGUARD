from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from backend.app.core.database import Base


class NotificationSetting(Base):
    __tablename__ = "notification_settings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    channel_type = Column(String(32), unique=True, nullable=False)  # email, telegram, webhook
    is_enabled = Column(Boolean, default=False, nullable=False)
    min_severity = Column(String(32), default="HIGH", nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    config_json = Column(Text, nullable=True)  # JSON with channel-specific credentials/endpoints


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    channel = Column(String(32), nullable=False)  # EMAIL, TELEGRAM, WEBHOOK
    recipient = Column(String(128), nullable=False)
    subject = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    status = Column(String(32), default="SENT", nullable=False)  # SENT, FAILED, SIMULATED
    error_message = Column(Text, nullable=True)
