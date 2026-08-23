import os
import psutil
from typing import List, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.models.user import User
from backend.app.models.device import Device
from backend.app.models.alert import Alert
from backend.app.models.incident import Incident
from backend.app.models.firewall import BlockedIP
from backend.app.models.security_event import SecurityEvent
from backend.app.models.metrics import HealthMetric, AgentHeartbeat
from backend.app.schemas.metrics import HealthMetricResponse, DashboardSummary
from backend.app.integrations.firewall import get_firewall_provider

router = APIRouter(prefix="/health", tags=["System & Host Health Monitoring"])


@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve top-level SOC operational and security health summary."""
    # Devices (Real discovered devices only)
    dev_res = await db.execute(select(Device).where(Device.is_synthetic == False))
    devices = dev_res.scalars().all()
    total_dev = len(devices)
    online_dev = len([d for d in devices if d.status.upper() == "ONLINE"])

    # Active alerts (Real security alerts only)
    alert_res = await db.execute(
        select(Alert).where(
            Alert.is_synthetic == False,
            Alert.status.in_(["NEW", "ACKNOWLEDGED", "INVESTIGATING"])
        )
    )
    active_alerts = alert_res.scalars().all()
    crit_alerts = len([a for a in active_alerts if a.severity.upper() == "CRITICAL"])

    # Incidents (Real incidents only)
    inc_res = await db.execute(
        select(Incident).where(
            Incident.is_synthetic == False,
            Incident.status.in_(["OPEN", "INVESTIGATING"])
        )
    )
    open_incidents = len(inc_res.scalars().all())

    # Blocked IPs
    block_res = await db.execute(select(BlockedIP).where(BlockedIP.is_active == True))
    blocked_count = len(block_res.scalars().all())

    # Security events today (Real events only)
    evt_count_res = await db.execute(
        select(func.count(SecurityEvent.id)).where(SecurityEvent.is_synthetic == False)
    )
    total_events = evt_count_res.scalar() or 0

    # Agent heartbeats
    hb_res = await db.execute(select(AgentHeartbeat))
    agents = hb_res.scalars().all()

    # Bandwidth
    net_io = psutil.net_io_counters()
    kbps_in = round((net_io.bytes_recv % (1024 * 1024)) / 1024, 1)
    kbps_out = round((net_io.bytes_sent % (1024 * 1024)) / 1024, 1)

    # Subsystem statuses
    suricata_ok = os.path.exists(settings.SURICATA_EVE_PATH) or settings.ENVIRONMENT == "dev"
    zeek_ok = os.path.exists(settings.ZEEK_LOG_PATH)
    fw = get_firewall_provider()
    fw_status = await fw.get_status()

    return {
        "total_devices": total_dev,
        "online_devices": online_dev,
        "active_alerts": len(active_alerts),
        "critical_alerts": crit_alerts,
        "open_incidents": open_incidents,
        "blocked_ips_count": blocked_count,
        "current_bandwidth_in_kbps": kbps_in,
        "current_bandwidth_out_kbps": kbps_out,
        "total_events_today": total_events,
        "suricata_status": "ONLINE" if suricata_ok else "NOT_FOUND",
        "zeek_status": "ONLINE" if zeek_ok else "STANDBY",
        "firewall_status": "CONNECTED" if fw_status.get("is_connected") else "DISCONNECTED",
        "agent_count": len(agents),
        "development_mode": settings.ENVIRONMENT.lower() == "dev"
    }


@router.get("/hosts", response_model=List[HealthMetricResponse])
async def list_host_health_metrics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve latest CPU/RAM/Disk health status of all reporting hosts."""
    stmt = select(HealthMetric).order_by(HealthMetric.recorded_at.desc()).limit(20)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/server-self")
async def get_server_self_health(
    current_user: User = Depends(get_current_user)
):
    """Retrieve host telemetry of the NetGuard SOC server itself."""
    cpu_pct = psutil.cpu_percent(interval=None)
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    boot_time = psutil.boot_time()
    uptime_secs = int(datetime.now().timestamp() - boot_time)

    # Threshold evaluation
    status_str = "HEALTHY"
    if cpu_pct >= settings.CPU_CRITICAL_THRESHOLD or ram.percent >= settings.RAM_CRITICAL_THRESHOLD or disk.percent >= settings.DISK_CRITICAL_THRESHOLD:
        status_str = "CRITICAL"
    elif cpu_pct >= settings.CPU_WARNING_THRESHOLD or ram.percent >= settings.RAM_WARNING_THRESHOLD or disk.percent >= settings.DISK_WARNING_THRESHOLD:
        status_str = "WARNING"

    return {
        "hostname": os.environ.get("COMPUTERNAME", os.environ.get("HOSTNAME", "netguard-soc")),
        "os_name": os.name,
        "cpu_percent": cpu_pct,
        "ram_percent": ram.percent,
        "disk_percent": disk.percent,
        "ram_used_gb": round((ram.total - ram.available) / (1024**3), 2),
        "ram_total_gb": round(ram.total / (1024**3), 2),
        "disk_free_gb": round(disk.free / (1024**3), 2),
        "disk_total_gb": round(disk.total / (1024**3), 2),
        "uptime_seconds": uptime_secs,
        "status": status_str,
        "thresholds": {
            "cpu_warn": settings.CPU_WARNING_THRESHOLD,
            "cpu_crit": settings.CPU_CRITICAL_THRESHOLD,
            "ram_warn": settings.RAM_WARNING_THRESHOLD,
            "ram_crit": settings.RAM_CRITICAL_THRESHOLD,
            "disk_warn": settings.DISK_WARNING_THRESHOLD,
            "disk_crit": settings.DISK_CRITICAL_THRESHOLD,
        }
    }
