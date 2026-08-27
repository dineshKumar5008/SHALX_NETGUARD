from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.app.core.database import Base


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ip_address = Column(String(45), unique=True, index=True, nullable=False)
    mac_address = Column(String(32), index=True, nullable=True)
    hostname = Column(String(128), index=True, nullable=True)
    vendor = Column(String(128), nullable=True)
    os_type = Column(String(64), nullable=True)  # Windows, Android, iOS, Linux, RouterOS, etc.
    os_version = Column(String(64), nullable=True)
    os_confidence = Column(String(32), default="Low", nullable=True)  # High, Medium, Low
    architecture = Column(String(32), nullable=True)  # x86_64, AMD64, ARM64, etc.
    device_type = Column(String(64), default="Unknown", nullable=False)  # Laptop, Mobile, Desktop, Printer, Router, IoT, Unknown
    device_type_confidence = Column(String(32), default="Low", nullable=True)  # High, Medium, Low
    open_ports = Column(Text, nullable=True)  # JSON-encoded list of integers e.g. "[53, 80]"
    detected_services = Column(Text, nullable=True)  # JSON-encoded list of strings
    status = Column(String(32), default="ONLINE", nullable=False)  # ONLINE, OFFLINE, WARNING, CRITICAL
    is_monitored = Column(Boolean, default=True, nullable=False)
    is_synthetic = Column(Boolean, default=False, nullable=False)
    first_seen = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    last_seen = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    notes = Column(Text, nullable=True)

    interfaces = relationship("NetworkInterface", back_populates="device", cascade="all, delete-orphan")


class NetworkInterface(Base):
    __tablename__ = "network_interfaces"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    interface_name = Column(String(64), nullable=False)
    ip_address = Column(String(45), nullable=True)
    mac_address = Column(String(32), nullable=True)
    is_primary = Column(Boolean, default=False, nullable=False)

    device = relationship("Device", back_populates="interfaces")
