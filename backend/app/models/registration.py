from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime
from backend.app.core.database import Base


class RegistrationRequest(Base):
    __tablename__ = "registration_requests"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    full_name = Column(String(128), nullable=False)
    username = Column(String(64), index=True, nullable=False)
    email = Column(String(128), index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    department = Column(String(128), nullable=False)
    reason = Column(String(500), nullable=False)
    requested_role = Column(String(32), default="VIEWER", nullable=False)
    status = Column(String(32), default="PENDING", nullable=False)  # PENDING, APPROVED, REJECTED
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by = Column(String(64), nullable=True)
    rejection_reason = Column(String(500), nullable=True)
