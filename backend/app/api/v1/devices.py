from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from backend.app.core.database import get_db
from backend.app.core.security import get_current_user, require_role, UserRole
from backend.app.core.audit import record_audit_log
from backend.app.models.user import User
from backend.app.models.device import Device, NetworkInterface
from backend.app.models.alert import Alert
from backend.app.models.metrics import HealthMetric
from backend.app.schemas.device import DeviceCreate, DeviceUpdate, DeviceResponse
from backend.app.collectors.discovery import discovery_service

router = APIRouter(prefix="/devices", tags=["Device Management"])


@router.get("", response_model=List[DeviceResponse])
async def list_devices(
    status: Optional[str] = Query(None, description="Filter by status (ONLINE, OFFLINE, WARNING)"),
    device_type: Optional[str] = Query(None, description="Filter by type (server, workstation, firewall, etc.)"),
    search: Optional[str] = Query(None, description="Search in hostname, IP, or MAC"),
    include_synthetic: bool = Query(False, description="Include simulated demo lab devices"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all discovered real network devices with optional filtering."""
    query = select(Device).options(selectinload(Device.interfaces)).order_by(Device.last_seen.desc())
    if not include_synthetic:
        query = query.where(Device.is_synthetic == False)
    if status:
        query = query.where(Device.status == status.upper())
    if device_type:
        query = query.where(Device.device_type == device_type.lower())
    if search:
        s = f"%{search}%"
        query = query.where((Device.hostname.ilike(s)) | (Device.ip_address.ilike(s)) | (Device.mac_address.ilike(s)))

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{device_id}", response_model=DeviceResponse)
async def get_device_by_id(
    device_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve detailed device metadata and network interfaces."""
    stmt = select(Device).options(selectinload(Device.interfaces)).where(Device.id == device_id)
    device = (await db.execute(stmt)).scalars().first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    return device


@router.get("/{device_id}/alerts")
async def get_device_alerts(
    device_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve recent security alerts involving this device."""
    stmt = select(Device).where(Device.id == device_id)
    device = (await db.execute(stmt)).scalars().first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    alerts_stmt = select(Alert).where(
        (Alert.source_ip == device.ip_address) | (Alert.destination_ip == device.ip_address)
    ).order_by(Alert.created_at.desc()).limit(50)
    
    alerts = (await db.execute(alerts_stmt)).scalars().all()
    return alerts


@router.get("/{device_id}/health")
async def get_device_health_metrics(
    device_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve recent CPU/RAM/Disk health telemetry for this device."""
    stmt = select(Device).where(Device.id == device_id)
    device = (await db.execute(stmt)).scalars().first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    metrics_stmt = select(HealthMetric).where(
        (HealthMetric.hostname == device.hostname) | (HealthMetric.host_id == str(device.id))
    ).order_by(HealthMetric.recorded_at.desc()).limit(20)
    
    metrics = (await db.execute(metrics_stmt)).scalars().all()
    return metrics


@router.put("/{device_id}", response_model=DeviceResponse)
async def update_device(
    device_id: int,
    device_in: DeviceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ANALYST]))
):
    """Update device metadata, type, or monitoring configuration."""
    stmt = select(Device).options(selectinload(Device.interfaces)).where(Device.id == device_id)
    device = (await db.execute(stmt)).scalars().first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    if device_in.hostname is not None:
        device.hostname = device_in.hostname
    if device_in.vendor is not None:
        device.vendor = device_in.vendor
    if device_in.os_type is not None:
        device.os_type = device_in.os_type
    if device_in.os_version is not None:
        device.os_version = device_in.os_version
    if device_in.device_type is not None:
        device.device_type = device_in.device_type
    if device_in.status is not None:
        device.status = device_in.status
    if device_in.is_monitored is not None:
        device.is_monitored = device_in.is_monitored
    if device_in.notes is not None:
        device.notes = device_in.notes

    await db.commit()
    await db.refresh(device)
    return device


@router.post("/scan")
async def trigger_subnet_discovery_scan(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ANALYST]))
):
    """Trigger an on-demand real network discovery sweep across active network interfaces."""
    discovered = await discovery_service.scan_monitored_subnets(db)
    await record_audit_log(
        db,
        user=current_user.username,
        action="NETWORK_DISCOVERY_SCAN",
        resource="/api/v1/devices/scan",
        result="SUCCESS",
        metadata={"devices_discovered": len(discovered)}
    )
    return {
        "message": f"Discovery scan complete. Synced {len(discovered)} live devices.",
        "device_count": len(discovered)
    }
