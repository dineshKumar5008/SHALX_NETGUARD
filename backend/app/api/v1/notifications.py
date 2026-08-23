from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc

from backend.app.core.database import get_db
from backend.app.core.security import get_current_user, require_role, UserRole
from backend.app.core.audit import record_audit_log
from backend.app.models.user import User
from backend.app.models.notification import NotificationSetting, NotificationLog
from backend.app.schemas.notification import (
    NotificationSettingUpdate, NotificationSettingResponse, NotificationLogResponse, TestNotificationRequest
)
from backend.app.notifications import notification_service

router = APIRouter(prefix="/notifications", tags=["Security Notifications"])


@router.get("/settings", response_model=List[NotificationSettingResponse])
async def list_notification_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List notification channels and severity routing configurations."""
    stmt = select(NotificationSetting).order_by(NotificationSetting.id)
    settings_list = (await db.execute(stmt)).scalars().all()
    if not settings_list:
        # Seed defaults
        defaults = [
            NotificationSetting(channel_type="email", is_enabled=True, min_severity="HIGH"),
            NotificationSetting(channel_type="telegram", is_enabled=True, min_severity="CRITICAL"),
            NotificationSetting(channel_type="webhook", is_enabled=False, min_severity="CRITICAL")
        ]
        db.add_all(defaults)
        await db.commit()
        settings_list = defaults
    return settings_list


@router.put("/settings/{channel_type}", response_model=NotificationSettingResponse)
async def update_notification_setting(
    channel_type: str,
    payload: NotificationSettingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN]))
):
    """Update notification channel severity threshold or toggle enabled state (ADMIN only)."""
    stmt = select(NotificationSetting).where(NotificationSetting.channel_type == channel_type.lower())
    setting = (await db.execute(stmt)).scalars().first()
    if not setting:
        setting = NotificationSetting(
            channel_type=channel_type.lower(),
            is_enabled=payload.is_enabled,
            min_severity=payload.min_severity.upper(),
            config_json=payload.config_json
        )
        db.add(setting)
    else:
        setting.is_enabled = payload.is_enabled
        setting.min_severity = payload.min_severity.upper()
        if payload.config_json is not None:
            setting.config_json = payload.config_json

    await db.commit()
    await db.refresh(setting)

    await record_audit_log(
        db,
        user=current_user.username,
        action="NOTIFICATION_SETTING_UPDATED",
        resource=f"/api/v1/notifications/settings/{channel_type}",
        result="SUCCESS",
        metadata={"channel": channel_type, "enabled": payload.is_enabled, "min_severity": payload.min_severity}
    )
    return setting


@router.get("/logs", response_model=List[NotificationLogResponse])
async def list_notification_logs(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve history of dispatched security notifications."""
    stmt = select(NotificationLog).order_by(desc(NotificationLog.timestamp)).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/test")
async def send_test_notification(
    payload: TestNotificationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ANALYST]))
):
    """Trigger a live test notification to verify channel configuration."""
    ch = payload.channel.lower()
    subject = "NetGuard SOC Channel Connectivity Test"
    message = f"This is an automated connectivity test initiated by {current_user.username} from NetGuard SOC."

    if ch == "email":
        res = await notification_service.email_provider.send_notification(subject, message, "HIGH", payload.recipient)
    elif ch == "telegram":
        res = await notification_service.telegram_provider.send_notification(subject, message, "HIGH", payload.recipient)
    else:
        res = await notification_service.mock_provider.send_notification(subject, message, "HIGH", payload.recipient)

    log_entry = NotificationLog(
        timestamp=datetime.now(timezone.utc),
        channel=payload.channel.upper(),
        recipient=payload.recipient or "test-recipient",
        subject=subject,
        body=message,
        status="SENT" if res.get("success") else "FAILED",
        error_message=res.get("error")
    )
    db.add(log_entry)
    await db.commit()

    return {"message": "Test notification dispatched", "result": res}
