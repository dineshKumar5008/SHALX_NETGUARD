from typing import Optional
from pydantic import BaseModel, ConfigDict
from datetime import datetime


class AlertBase(BaseModel):
    alert_id: str
    title: str
    description: Optional[str] = None
    category: str
    severity: str = "MEDIUM"
    status: str = "NEW"
    source: str = "Suricata IDS"
    source_ip: Optional[str] = None
    destination_ip: Optional[str] = None
    source_port: Optional[int] = None
    destination_port: Optional[int] = None
    protocol: Optional[str] = None
    signature: Optional[str] = None
    raw_event: Optional[str] = None
    is_synthetic: bool = False


class AlertCreate(AlertBase):
    pass


class AlertUpdate(BaseModel):
    status: Optional[str] = None
    resolution_notes: Optional[str] = None
    acknowledged_by: Optional[str] = None
    resolved_by: Optional[str] = None


class AlertTriageRequest(BaseModel):
    action: str
    notes: Optional[str] = None


class AlertResponse(AlertBase):
    id: int
    created_at: datetime
    updated_at: datetime
    acknowledged_by: Optional[str] = None
    resolved_by: Optional[str] = None
    resolution_notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
