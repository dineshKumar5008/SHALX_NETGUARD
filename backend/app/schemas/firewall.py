from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime


class BlockRequest(BaseModel):
    ip_address: str = Field(description="IPv4 or IPv6 address to block")
    reason: str = Field(min_length=3, description="Operational or threat reason for block")
    duration_minutes: Optional[int] = Field(default=None, description="Optional block duration in minutes; None for indefinite")
    source_alert_id: Optional[str] = None
    force: bool = Field(default=False, description="Force block even if address is on critical allowlist warning")


class BlockedIPResponse(BaseModel):
    id: int
    ip_address: str
    reason: str
    blocked_by: str
    blocked_at: datetime
    expires_at: Optional[datetime] = None
    is_active: bool
    source_alert_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class FirewallActionResponse(BaseModel):
    id: int
    action_type: str
    ip_address: Optional[str] = None
    triggered_by: str
    timestamp: datetime
    status: str
    details: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class FirewallRuleCreate(BaseModel):
    rule_name: str
    action: str = "BLOCK"
    source_cidr: str = "any"
    dest_cidr: str = "any"
    port_range: str = "any"
    protocol: str = "any"
    is_enabled: bool = True


class FirewallRuleResponse(FirewallRuleCreate):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FirewallStatusResponse(BaseModel):
    provider: str
    is_connected: bool
    active_blocks_count: int
    total_actions_count: int
    protected_ips_count: int
    last_sync: Optional[datetime] = None
