from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, BigInteger, DateTime, Text
from backend.app.core.database import Base


class TrafficMetric(Base):
    __tablename__ = "traffic_metrics"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True, nullable=False)
    bytes_in = Column(BigInteger, default=0, nullable=False)
    bytes_out = Column(BigInteger, default=0, nullable=False)
    packets_in = Column(BigInteger, default=0, nullable=False)
    packets_out = Column(BigInteger, default=0, nullable=False)
    active_flows = Column(Integer, default=0, nullable=False)
    tcp_count = Column(Integer, default=0, nullable=False)
    udp_count = Column(Integer, default=0, nullable=False)
    icmp_count = Column(Integer, default=0, nullable=False)
    other_count = Column(Integer, default=0, nullable=False)
    top_source_ips = Column(Text, nullable=True)  # JSON string of top talker source IPs
    top_dest_ips = Column(Text, nullable=True)    # JSON string of top destination IPs


class HealthMetric(Base):
    __tablename__ = "health_metrics"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    host_id = Column(String(64), index=True, nullable=False)
    hostname = Column(String(128), nullable=False)
    os_name = Column(String(64), nullable=True)
    cpu_percent = Column(Float, default=0.0, nullable=False)
    ram_percent = Column(Float, default=0.0, nullable=False)
    disk_percent = Column(Float, default=0.0, nullable=False)
    network_in_bytes = Column(BigInteger, default=0, nullable=False)
    network_out_bytes = Column(BigInteger, default=0, nullable=False)
    uptime_seconds = Column(BigInteger, default=0, nullable=False)
    status = Column(String(32), default="HEALTHY", nullable=False)  # HEALTHY, WARNING, CRITICAL, OFFLINE
    recorded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True, nullable=False)


class AgentHeartbeat(Base):
    __tablename__ = "agent_heartbeats"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    agent_id = Column(String(64), unique=True, index=True, nullable=False)
    hostname = Column(String(128), nullable=False)
    ip_address = Column(String(45), nullable=False)
    os_name = Column(String(64), nullable=False)
    agent_version = Column(String(32), default="1.0.0", nullable=False)
    last_heartbeat = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    status = Column(String(32), default="ONLINE", nullable=False)
