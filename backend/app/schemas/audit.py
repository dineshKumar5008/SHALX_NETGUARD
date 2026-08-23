from typing import Optional
from pydantic import BaseModel, ConfigDict
from datetime import datetime


class AuditLogResponse(BaseModel):
    id: int
    timestamp: datetime
    user: str
    action: str
    resource: str
    result: str
    source_ip: Optional[str] = None
    metadata_json: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
