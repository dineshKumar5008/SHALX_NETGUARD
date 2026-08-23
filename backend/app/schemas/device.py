from typing import Optional, List
from pydantic import BaseModel, ConfigDict
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
    device_type: str = "workstation"
    status: str = "ONLINE"
    is_monitored: bool = True
    notes: Optional[str] = None


class DeviceCreate(DeviceBase):
    interfaces: Optional[List[NetworkInterfaceSchema]] = []


class DeviceUpdate(BaseModel):
    hostname: Optional[str] = None
    vendor: Optional[str] = None
    os_type: Optional[str] = None
    os_version: Optional[str] = None
    device_type: Optional[str] = None
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
