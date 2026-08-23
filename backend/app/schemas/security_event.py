from typing import Optional
from pydantic import BaseModel, ConfigDict
from datetime import datetime


class SecurityEventBase(BaseModel):
    event_id: str
    timestamp: datetime
    source: str
    event_type: str
    severity: str = "LOW"
    source_ip: Optional[str] = None
    destination_ip: Optional[str] = None
    source_port: Optional[int] = None
    destination_port: Optional[int] = None
    protocol: Optional[str] = None
    signature: Optional[str] = None
    description: Optional[str] = None
    raw_payload: Optional[str] = None
    is_synthetic: bool = False


class SecurityEventCreate(SecurityEventBase):
    pass


class SecurityEventResponse(SecurityEventBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
