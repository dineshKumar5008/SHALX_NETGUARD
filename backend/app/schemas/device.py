import json
from typing import Optional, List, Union
from pydantic import BaseModel, ConfigDict, field_validator
from datetime import datetime


class NetworkInterfaceSchema(BaseModel):
    id: Optional[int] = None
    interface_name: str
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    is_primary: bool = False

    model_config = ConfigDict(from_attributes=True)


class DeviceBase(BaseModel):
    ip_address: str
    mac_address: Optional[str] = None
    hostname: Optional[str] = None
    vendor: Optional[str] = None
    os_type: Optional[str] = None
    os_version: Optional[str] = None
    os_confidence: str = "Low"
    architecture: Optional[str] = None
    device_type: str = "Unknown"
    device_type_confidence: str = "Low"
    open_ports: Optional[List[int]] = []
    detected_services: Optional[List[str]] = []
    status: str = "ONLINE"
    is_monitored: bool = True
    notes: Optional[str] = None

    @field_validator("open_ports", mode="before")
    @classmethod
    def parse_open_ports(cls, v):
        if v is None or v == "":
            return []
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return [int(x) for x in parsed]
            except Exception:
                pass
            return [int(x.strip()) for x in v.split(",") if x.strip().isdigit()]
        return []

    @field_validator("detected_services", mode="before")
    @classmethod
    def parse_detected_services(cls, v):
        if v is None or v == "":
            return []
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return [str(x) for x in parsed]
            except Exception:
                pass
            return [x.strip() for x in v.split(",") if x.strip()]
        return []


class DeviceCreate(DeviceBase):
    interfaces: Optional[List[NetworkInterfaceSchema]] = []


class DeviceUpdate(BaseModel):
    hostname: Optional[str] = None
    vendor: Optional[str] = None
    os_type: Optional[str] = None
    os_version: Optional[str] = None
    os_confidence: Optional[str] = None
    architecture: Optional[str] = None
    device_type: Optional[str] = None
    device_type_confidence: Optional[str] = None
    open_ports: Optional[List[int]] = None
    detected_services: Optional[List[str]] = None
    status: Optional[str] = None
    is_monitored: Optional[bool] = None
    notes: Optional[str] = None


class DeviceResponse(DeviceBase):
    id: int
    subnet: Optional[str] = None
    vlan: Optional[str] = None
    first_seen: datetime
    last_seen: datetime
    interfaces: List[NetworkInterfaceSchema] = []

    model_config = ConfigDict(from_attributes=True)


class TopologyNode(BaseModel):
    id: str
    type: str  # internet, router, firewall, switch, server, workstation, laptop, desktop, mobile, printer, iot, unknown
    data: dict
    position: dict


class TopologyEdge(BaseModel):
    id: str
    source: str
    target: str
    label: Optional[str] = None
    animated: Optional[bool] = False


class TopologySummary(BaseModel):
    total_devices: int = 0
    online_devices: int = 0
    offline_devices: int = 0


class TopologyResponse(BaseModel):
    nodes: List[TopologyNode]
    edges: List[TopologyEdge]
    summary: Optional[TopologySummary] = None


class DNSQueryItem(BaseModel):
    query: str
    timestamp: datetime
    record_type: Optional[str] = "A"
    resolved_ip: Optional[str] = None


class DestinationDomainItem(BaseModel):
    domain: str
    count: int
    last_accessed: datetime
    category: Optional[str] = "General Web"


class ConnectionFlowItem(BaseModel):
    protocol: str
    local_port: Optional[int] = None
    destination_ip: str
    destination_port: Optional[int] = None
    destination_domain: Optional[str] = None
    status: Optional[str] = "ESTABLISHED"
    bytes_sent: int = 0
    bytes_recv: int = 0
    timestamp: datetime


class DeviceSecurityEventItem(BaseModel):
    event_id: str
    timestamp: datetime
    event_type: str
    severity: str
    signature: Optional[str] = None
    protocol: Optional[str] = None
    source_ip: Optional[str] = None
    destination_ip: Optional[str] = None
    destination_port: Optional[int] = None


class DeviceActivitySummary(BaseModel):
    total_dns_queries: int = 0
    total_connections: int = 0
    total_security_events: int = 0
    bytes_uploaded: int = 0
    bytes_downloaded: int = 0


class DeviceActivityResponse(BaseModel):
    device_id: int
    ip_address: str
    hostname: Optional[str] = None
    device_type: str
    subnet: str
    vlan: str
    dns_queries: List[DNSQueryItem] = []
    destination_domains: List[DestinationDomainItem] = []
    recent_connections: List[ConnectionFlowItem] = []
    security_events: List[DeviceSecurityEventItem] = []
    summary: DeviceActivitySummary
