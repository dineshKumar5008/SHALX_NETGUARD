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
    ip_address: Optional[str] = None
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
    last_seen: Optional[datetime] = None
    is_stale: Optional[bool] = False

    model_config = ConfigDict(from_attributes=True)


class DiscoveredDeviceTelemetryStatus(BaseModel):
    device_id: int
    hostname: Optional[str] = None
    ip_address: str
    mac_address: Optional[str] = None
    vendor: Optional[str] = None
    device_type: str = "Unknown"
    has_agent: bool = False
    telemetry_status: str
    last_seen: Optional[datetime] = None


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


class DiscoveredNodePayload(BaseModel):
    ip_address: str
    mac_address: Optional[str] = None
    hostname: Optional[str] = None
    vendor: Optional[str] = None
    os_type: Optional[str] = None
    os_version: Optional[str] = None
    os_confidence: Optional[str] = "Low"
    device_type: Optional[str] = "Unknown"
    device_type_confidence: Optional[str] = "Low"
    architecture: Optional[str] = None
    open_ports: Optional[List[int]] = None
    detected_services: Optional[List[str]] = None
    is_gateway: Optional[bool] = False
    is_local_host: Optional[bool] = False
    interface_name: Optional[str] = "eth0"


class DiscoverySyncPayload(BaseModel):
    sensor_id: str
    sensor_hostname: str
    monitored_subnet: Optional[str] = None
    gateway_ip: Optional[str] = None
    devices: List[DiscoveredNodePayload]

