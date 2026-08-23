from typing import Optional
from pydantic import BaseModel, ConfigDict
from datetime import datetime


class SystemSettingUpdate(BaseModel):
    key: str
    value: str
    description: Optional[str] = None


class SystemSettingResponse(BaseModel):
    key: str
    value: str
    description: Optional[str] = None
    updated_at: datetime
    updated_by: str

    model_config = ConfigDict(from_attributes=True)
