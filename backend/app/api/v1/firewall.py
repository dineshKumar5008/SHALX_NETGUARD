from typing import List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc

from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user, require_role, UserRole
from backend.app.core.audit import record_audit_log
from backend.app.models.user import User
from backend.app.models.firewall import BlockedIP, FirewallAction, FirewallRule
from backend.app.schemas.firewall import (
    BlockRequest, BlockedIPResponse, FirewallActionResponse, FirewallRuleCreate, FirewallRuleResponse, FirewallStatusResponse
)
from backend.app.integrations.firewall import get_firewall_provider
from backend.app.websocket.manager import ws_manager

router = APIRouter(prefix="/firewall", tags=["Firewall & IP Blocking Integration"])


@router.get("/status", response_model=FirewallStatusResponse)
async def get_firewall_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve live status, connectivity, and statistics of firewall provider."""
    fw = get_firewall_provider()
    status_info = await fw.get_status()

    blocks_res = await db.execute(select(BlockedIP).where(BlockedIP.is_active == True))
    active_blocks = len(blocks_res.scalars().all())

    actions_res = await db.execute(select(FirewallAction))
    total_actions = len(actions_res.scalars().all())

    return {
        "provider": status_info.get("provider", "MockFirewallProvider"),
        "is_connected": status_info.get("is_connected", True),
        "active_blocks_count": active_blocks,
        "total_actions_count": total_actions,
        "protected_ips_count": len(settings.PROTECTED_IPS),
        "last_sync": datetime.now(timezone.utc)
    }


@router.get("/blocked-ips", response_model=List[BlockedIPResponse])
async def list_blocked_ips(
    active_only: bool = Query(True, description="Filter only currently active blocks"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all blocked IP records and active expiration policies."""
    query = select(BlockedIP).order_by(desc(BlockedIP.blocked_at))
    if active_only:
        query = query.where(BlockedIP.is_active == True)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/block", response_model=BlockedIPResponse, status_code=status.HTTP_201_CREATED)
async def block_ip_address(
    payload: BlockRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ANALYST]))
):
    """Block an IP address across perimeter firewalls (pfSense / response layer)."""
    ip = payload.ip_address.strip()
    
    # 1. Safety Safeguard: Critical Protected Allowlist Check
    if ip in settings.PROTECTED_IPS and not payload.force:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Safety Safeguard: IP {ip} is part of the protected infrastructure allowlist (Gateway / DNS / SOC)."
        )

    # 2. Check if already actively blocked in DB
    stmt = select(BlockedIP).where(BlockedIP.ip_address == ip, BlockedIP.is_active == True)
    existing = (await db.execute(stmt)).scalars().first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"IP {ip} is already actively blocked."
        )

    # 3. Call Firewall Provider
    fw = get_firewall_provider()
    result = await fw.block_ip(
        ip=ip,
        reason=payload.reason,
        duration_minutes=payload.duration_minutes,
        force=payload.force
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=result.get("error", "Firewall provider failed to apply block rule.")
        )

    # 4. Save to Database
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=payload.duration_minutes) if payload.duration_minutes else None

    blocked_entry = BlockedIP(
        ip_address=ip,
        reason=payload.reason,
        blocked_by=current_user.username,
        blocked_at=now,
        expires_at=expires,
        is_active=True,
        source_alert_id=payload.source_alert_id
    )
    db.add(blocked_entry)

    action_entry = FirewallAction(
        action_type="BLOCK",
        ip_address=ip,
        triggered_by=current_user.username,
        timestamp=now,
        status="SUCCESS",
        details=f"Reason: {payload.reason} | Expiration: {expires}"
    )
    db.add(action_entry)
    await db.commit()
    await db.refresh(blocked_entry)

    # 5. Broadcast to WebSockets
    await ws_manager.broadcast("firewall_block", {
        "ip": ip,
        "reason": payload.reason,
        "blocked_by": current_user.username
    })

    # 6. Audit Log
    await record_audit_log(
        db,
        user=current_user.username,
        action="FIREWALL_IP_BLOCK",
        resource=f"/api/v1/firewall/block/{ip}",
        result="SUCCESS",
        metadata={"ip": ip, "reason": payload.reason, "duration": payload.duration_minutes}
    )

    return blocked_entry


@router.post("/unblock/{ip_address}")
async def unblock_ip_address(
    ip_address: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ANALYST]))
):
    """Unblock an IP address from the perimeter firewall."""
    ip = ip_address.strip()
    fw = get_firewall_provider()
    res = await fw.unblock_ip(ip)

    # Update DB entries
    stmt = select(BlockedIP).where(BlockedIP.ip_address == ip, BlockedIP.is_active == True)
    existing = (await db.execute(stmt)).scalars().all()
    for entry in existing:
        entry.is_active = False

    action_entry = FirewallAction(
        action_type="UNBLOCK",
        ip_address=ip,
        triggered_by=current_user.username,
        timestamp=datetime.now(timezone.utc),
        status="SUCCESS" if res.get("success") else "WARNING",
        details=res.get("message") or res.get("error")
    )
    db.add(action_entry)
    await db.commit()

    await ws_manager.broadcast("firewall_unblock", {
        "ip": ip,
        "unblocked_by": current_user.username
    })

    await record_audit_log(
        db,
        user=current_user.username,
        action="FIREWALL_IP_UNBLOCK",
        resource=f"/api/v1/firewall/unblock/{ip}",
        result="SUCCESS",
        metadata={"ip": ip}
    )

    return {"message": f"IP {ip} unblocked successfully", "result": res}


@router.get("/actions", response_model=List[FirewallActionResponse])
async def list_firewall_actions(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve history of firewall operations and block actions."""
    stmt = select(FirewallAction).order_by(desc(FirewallAction.timestamp)).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/rules", response_model=List[FirewallRuleResponse])
async def list_firewall_rules(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List configured firewall filter rules."""
    stmt = select(FirewallRule).order_by(FirewallRule.id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/rules", response_model=FirewallRuleResponse)
async def create_firewall_rule(
    payload: FirewallRuleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN]))
):
    """Create a new firewall filter rule (ADMIN only)."""
    rule = FirewallRule(
        rule_name=payload.rule_name,
        action=payload.action.upper(),
        source_cidr=payload.source_cidr,
        dest_cidr=payload.dest_cidr,
        port_range=payload.port_range,
        protocol=payload.protocol.upper(),
        is_enabled=payload.is_enabled,
        created_at=datetime.now(timezone.utc)
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)

    await record_audit_log(
        db,
        user=current_user.username,
        action="FIREWALL_RULE_CREATED",
        resource=f"/api/v1/firewall/rules/{rule.id}",
        result="SUCCESS",
        metadata={"rule_name": rule.rule_name}
    )
    return rule
