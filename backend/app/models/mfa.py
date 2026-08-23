from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from backend.app.core.database import Base


class MFAChallenge(Base):
    """Temporary storage for hashed Multi-Factor Authentication (MFA) challenges."""
    __tablename__ = "mfa_challenges"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    challenge_id = Column(String(64), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    otp_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    attempt_count = Column(Integer, default=0, nullable=False)
    resend_count = Column(Integer, default=0, nullable=False)
    is_used = Column(Boolean, default=False, nullable=False)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(255), nullable=True)
