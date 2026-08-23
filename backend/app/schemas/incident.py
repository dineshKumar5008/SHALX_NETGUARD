from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from datetime import datetime


class IncidentTimelineResponse(BaseModel):
    id: int
    timestamp: datetime
    actor: str
    event_type: str
    message: str

    model_config = ConfigDict(from_attributes=True)


class IncidentBase(BaseModel):
    title: str
    description: Optional[str] = None
    severity: str = "HIGH"
    assigned_analyst: Optional[str] = None
    affected_ips: Optional[str] = None
    investigation_notes: Optional[str] = None


class IncidentCreate(IncidentBase):
    alert_ids: Optional[List[int]] = []


class IncidentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    assigned_analyst: Optional[str] = None
    affected_ips: Optional[str] = None
    investigation_notes: Optional[str] = None


class IncidentNoteCreate(BaseModel):
    note: str


class IncidentResponse(IncidentBase):
    id: int
    incident_id: str
    status: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    timeline_events: List[IncidentTimelineResponse] = []
    alert_count: int = 0

    model_config = ConfigDict(from_attributes=True)
