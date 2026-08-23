from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class ReportGenerateRequest(BaseModel):
    report_type: str = "daily"  # daily, weekly, custom
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    title: Optional[str] = "NetGuard SOC Executive Security Report"
    include_incidents: bool = True
    include_traffic: bool = True
    include_health: bool = True


class ReportMetadata(BaseModel):
    report_id: str
    report_name: str
    generated_at: datetime
    file_size_bytes: int
    download_url: str
