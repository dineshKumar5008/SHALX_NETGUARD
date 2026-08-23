from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict
from datetime import datetime


class TrafficMetricResponse(BaseModel):
    id: int
    timestamp: datetime
    bytes_in: int
    bytes_out: int
    packets_in: int
    packets_out: int
    active_flows: int
    tcp_count: int
    udp_count: int
    icmp_count: int
    other_count: int
    top_source_ips: Optional[str] = None
    top_dest_ips: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class HealthMetricCreate(BaseModel):
    hostname: str
    os_name: Optional[str] = None
    cpu_percent: float
    ram_percent: float
    disk_percent: float
    network_in_bytes: int = 0
    network_out_bytes: int = 0
    uptime_seconds: int = 0


class HealthMetricResponse(HealthMetricCreate):
    id: int
    host_id: str
    status: str
    recorded_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AgentHeartbeatCreate(BaseModel):
    hostname: str
    ip_address: str
    os_name: str
    agent_version: str = "1.0.0"
    mac_address: Optional[str] = None
    vendor: Optional[str] = None
    device_type: Optional[str] = None
    os_version: Optional[str] = None


class AgentHeartbeatResponse(AgentHeartbeatCreate):
    id: int
    agent_id: str
    last_heartbeat: datetime
    status: str

    model_config = ConfigDict(from_attributes=True)


class DashboardSummary(BaseModel):
    total_devices: int
    online_devices: int
    active_alerts: int
    critical_alerts: int
    open_incidents: int
    blocked_ips_count: int
    current_bandwidth_in_kbps: float
    current_bandwidth_out_kbps: float
    total_events_today: int
    suricata_status: str
    zeek_status: str
    firewall_status: str
    agent_count: int
    development_mode: bool
