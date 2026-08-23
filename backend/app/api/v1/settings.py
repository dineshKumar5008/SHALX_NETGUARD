from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.core.database import get_db
from backend.app.core.security import get_current_user, require_role, UserRole
from backend.app.core.audit import record_audit_log
from backend.app.models.user import User
from backend.app.models.settings import SystemSetting
from backend.app.schemas.settings import SystemSettingUpdate, SystemSettingResponse

router = APIRouter(prefix="/settings", tags=["System Settings & Policies"])


@router.get("", response_model=List[SystemSettingResponse])
async def list_system_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List configurable platform thresholds, IDS file paths, and auto-response policies."""
    stmt = select(SystemSetting).order_by(SystemSetting.key)
    res = await db.execute(stmt)
    settings_list = res.scalars().all()

    if not settings_list:
        # Seed defaults if empty
        defaults = [
            SystemSetting(key="AUTO_BLOCK_CRITICAL_ALERTS", value="false", description="Automatically block source IP on CRITICAL alerts"),
            SystemSetting(key="AUTO_BLOCK_DURATION_MINUTES", value="60", description="Duration in minutes for automatic block rules"),
            SystemSetting(key="CPU_WARNING_THRESHOLD", value="70.0", description="CPU warning threshold percentage"),
            SystemSetting(key="CPU_CRITICAL_THRESHOLD", value="90.0", description="CPU critical threshold percentage"),
            SystemSetting(key="RAM_WARNING_THRESHOLD", value="75.0", description="RAM warning threshold percentage"),
            SystemSetting(key="RAM_CRITICAL_THRESHOLD", value="90.0", description="RAM critical threshold percentage"),
            SystemSetting(key="MONITORED_SUBNETS", value="192.168.10.0/24, 192.168.20.0/24, 192.168.30.0/24", description="Subnets actively monitored"),
            SystemSetting(key="SURICATA_EVE_PATH", value="./logs/suricata/eve.json", description="Path to Suricata EVE JSON log file"),
        ]
        db.add_all(defaults)
        await db.commit()
        settings_list = defaults

    return settings_list


@router.put("/{key}", response_model=SystemSettingResponse)
async def update_system_setting(
    key: str,
    payload: SystemSettingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN]))
):
    """Update a specific platform configuration setting (ADMIN only)."""
    stmt = select(SystemSetting).where(SystemSetting.key == key)
    setting = (await db.execute(stmt)).scalars().first()
    if not setting:
        setting = SystemSetting(
            key=key,
            value=payload.value,
            description=payload.description or "Configured system parameter",
            updated_at=datetime.now(timezone.utc),
            updated_by=current_user.username
        )
        db.add(setting)
    else:
        setting.value = payload.value
        if payload.description:
            setting.description = payload.description
        setting.updated_at = datetime.now(timezone.utc)
        setting.updated_by = current_user.username

    await db.commit()
    await db.refresh(setting)

    await record_audit_log(
        db,
        user=current_user.username,
        action="SETTING_UPDATED",
        resource=f"/api/v1/settings/{key}",
        result="SUCCESS",
        metadata={"key": key, "new_value": payload.value}
    )
    return setting
