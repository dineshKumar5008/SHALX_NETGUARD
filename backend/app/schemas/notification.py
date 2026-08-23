from typing import Optional
from pydantic import BaseModel, ConfigDict
from datetime import datetime


class NotificationSettingUpdate(BaseModel):
    is_enabled: bool
    min_severity: str = "HIGH"
    config_json: Optional[str] = None


class NotificationSettingResponse(BaseModel):
    id: int
    channel_type: str
    is_enabled: bool
    min_severity: str
    config_json: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class NotificationLogResponse(BaseModel):
    id: int
    timestamp: datetime
    channel: str
    recipient: str
    subject: str
    body: str
    status: str
    error_message: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TestNotificationRequest(BaseModel):
    channel: str  # email or telegram
    recipient: Optional[str] = None
