from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.core.security import verify_agent_token
from backend.app.models.metrics import HealthMetric, AgentHeartbeat
from backend.app.models.device import Device
from backend.app.schemas.metrics import (
    HealthMetricCreate, HealthMetricResponse, AgentHeartbeatCreate,
    AgentHeartbeatResponse, DiscoverySyncPayload
)
from backend.app.websocket.manager import ws_manager

router = APIRouter(prefix="/agent", tags=["Monitoring Agent Telemetry Ingestion"])


@router.post("/heartbeat", response_model=AgentHeartbeatResponse)
async def agent_heartbeat(
    payload: AgentHeartbeatCreate,
    db: AsyncSession = Depends(get_db),
    authorized: bool = Depends(verify_agent_token)
):
    """Authenticate and update heartbeat for Linux/Windows host monitoring agent."""
    stmt = select(AgentHeartbeat).where(AgentHeartbeat.hostname == payload.hostname)
    hb = (await db.execute(stmt)).scalars().first()

    now = datetime.now(timezone.utc)
    if not hb:
        agent_id = f"AGT-{payload.hostname.lower()}"
        hb = AgentHeartbeat(
            agent_id=agent_id,
            hostname=payload.hostname,
            ip_address=payload.ip_address,
            os_name=payload.os_name,
            agent_version=payload.agent_version,
            last_heartbeat=now,
            status="ONLINE"
        )
        db.add(hb)
    else:
        hb.ip_address = payload.ip_address
        hb.os_name = payload.os_name
        hb.agent_version = payload.agent_version
        hb.last_heartbeat = now
        hb.status = "ONLINE"

    # Automatically register / update real host in Device inventory
    from backend.app.collectors.discovery import discovery_service, get_vendor_by_mac
    vendor_resolved = payload.vendor or get_vendor_by_mac(payload.mac_address)
    dev_type = payload.device_type or ("server" if "server" in payload.hostname.lower() or "linux" in payload.os_name.lower() else "workstation")
    
    await discovery_service._upsert_device(
        db=db,
        data={
            "ip_address": payload.ip_address,
            "mac_address": payload.mac_address,
            "hostname": payload.hostname,
            "vendor": vendor_resolved,
            "os_type": payload.os_name,
            "os_version": payload.os_version,
            "device_type": dev_type,
            "interface_name": "eth0"
        },
        now=now
    )

    await db.commit()
    await db.refresh(hb)
    return hb


@router.post("/metrics", response_model=HealthMetricResponse)
async def ingest_host_metrics(
    payload: HealthMetricCreate,
    db: AsyncSession = Depends(get_db),
    authorized: bool = Depends(verify_agent_token)
):
    """Ingest CPU/RAM/Disk and Network I/O metrics from an authorized host agent."""
    # Threshold classification
    status_str = "HEALTHY"
    if (payload.cpu_percent >= settings.CPU_CRITICAL_THRESHOLD or
        payload.ram_percent >= settings.RAM_CRITICAL_THRESHOLD or
        payload.disk_percent >= settings.DISK_CRITICAL_THRESHOLD):
        status_str = "CRITICAL"
    elif (payload.cpu_percent >= settings.CPU_WARNING_THRESHOLD or
          payload.ram_percent >= settings.RAM_WARNING_THRESHOLD or
          payload.disk_percent >= settings.DISK_WARNING_THRESHOLD):
        status_str = "WARNING"

    now = datetime.now(timezone.utc)
    host_id = f"host-{payload.hostname.lower()}"
    metric = HealthMetric(
        host_id=host_id,
        hostname=payload.hostname,
        os_name=payload.os_name or "Generic OS",
        cpu_percent=payload.cpu_percent,
        ram_percent=payload.ram_percent,
        disk_percent=payload.disk_percent,
        network_in_bytes=payload.network_in_bytes,
        network_out_bytes=payload.network_out_bytes,
        uptime_seconds=payload.uptime_seconds,
        status=status_str,
        recorded_at=now
    )
    db.add(metric)

    # Sync Device status if device matching hostname exists
    dev_stmt = select(Device).where(Device.hostname == payload.hostname)
    dev = (await db.execute(dev_stmt)).scalars().first()
    if dev:
        dev.last_seen = now
        dev.status = "ONLINE" if status_str == "HEALTHY" else status_str

    await db.commit()
    await db.refresh(metric)

    # Broadcast real-time host metric update
    await ws_manager.broadcast("health_metric", {
        "hostname": payload.hostname,
        "cpu_percent": payload.cpu_percent,
        "ram_percent": payload.ram_percent,
        "disk_percent": payload.disk_percent,
        "status": status_str,
        "recorded_at": now.isoformat()
    })

    return metric


@router.post("/discovery-sync")
async def sync_remote_network_discovery(
    payload: DiscoverySyncPayload,
    db: AsyncSession = Depends(get_db),
    authorized: bool = Depends(verify_agent_token)
):
    """
    Ingest verified physical LAN discovery evidence from an authorized remote network sensor.
    Updates the central device inventory using real evidence (ARP, ports, OS detection) without synthetic data.
    """
    from backend.app.collectors.discovery import discovery_service
    now = datetime.now(timezone.utc)
    synced_count = 0

    for node in payload.devices:
        clean_ip = node.ip_address.strip()
        if not clean_ip or clean_ip.startswith("169.254."):
            continue

        dev_data = {
            "ip_address": clean_ip,
            "mac_address": node.mac_address,
            "hostname": node.hostname,
            "vendor": node.vendor,
            "os_type": node.os_type or "Unknown",
            "os_version": node.os_version,
            "os_confidence": node.os_confidence or "Low",
            "device_type": node.device_type or "Unknown",
            "device_type_confidence": node.device_type_confidence or "Low",
            "architecture": node.architecture,
            "open_ports": node.open_ports or [],
            "detected_services": node.detected_services or [],
            "interface_name": node.interface_name or "sensor0",
            "is_gateway": node.is_gateway,
            "is_local_host": node.is_local_host,
        }
        await discovery_service._upsert_device(db, dev_data, now)
        synced_count += 1

    await db.commit()

    # Broadcast real-time topology and device update
    await ws_manager.broadcast("devices_updated", {
        "sensor_id": payload.sensor_id,
        "synced_count": synced_count,
        "timestamp": now.isoformat()
    })

    return {
        "status": "SUCCESS",
        "synced_devices_count": synced_count,
        "sensor_id": payload.sensor_id,
        "timestamp": now.isoformat()
    }

