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
    first_seen: datetime
    last_seen: datetime
    interfaces: List[NetworkInterfaceSchema] = []

    model_config = ConfigDict(from_attributes=True)


class TopologyNode(BaseModel):
    id: str
    type: str  # internet, router, firewall, switch, server, workstation, soc
    data: dict
    position: dict


class TopologyEdge(BaseModel):
    id: str
    source: str
    target: str
    label: Optional[str] = None
    animated: Optional[bool] = False


class TopologyResponse(BaseModel):
    nodes: List[TopologyNode]
    edges: List[TopologyEdge]
