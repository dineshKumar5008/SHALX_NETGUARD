import os
import platform
import psutil
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta
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
from backend.app.schemas.metrics import (
    HealthMetricResponse, DashboardSummary, DiscoveredDeviceTelemetryStatus
)
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

    # Agent heartbeats (Active if reported within last 90 seconds)
    now = datetime.now(timezone.utc)
    stale_threshold = now - timedelta(seconds=90)
    hb_res = await db.execute(
        select(AgentHeartbeat).where(AgentHeartbeat.last_heartbeat >= stale_threshold)
    )
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
    """
    Retrieve latest CPU/RAM/Disk health status of all unique reporting hosts.
    Deduplicates metrics per host and automatically detects stale/offline agents.
    """
    now = datetime.now(timezone.utc)

    # 1. Fetch heartbeats and devices for IP & metadata enrichment
    hb_stmt = select(AgentHeartbeat)
    heartbeats = {hb.hostname: hb for hb in (await db.execute(hb_stmt)).scalars().all()}

    dev_stmt = select(Device).where(Device.is_synthetic == False)
    devices = {d.hostname: d for d in (await db.execute(dev_stmt)).scalars().all() if d.hostname}

    # 2. Query distinct hostnames with telemetry records
    host_stmt = select(HealthMetric.hostname).distinct()
    distinct_hosts = (await db.execute(host_stmt)).scalars().all()

    unique_host_metrics: List[HealthMetricResponse] = []

    for h_name in distinct_hosts:
        # Fetch the single most recent metric row for this host
        latest_stmt = select(HealthMetric).where(
            HealthMetric.hostname == h_name
        ).order_by(HealthMetric.recorded_at.desc()).limit(1)

        metric = (await db.execute(latest_stmt)).scalars().first()
        if not metric:
            continue

        hb = heartbeats.get(h_name)
        dev = devices.get(h_name)

        ip_addr = hb.ip_address if hb else (dev.ip_address if dev else None)

        # Calculate time delta for stale detection (offline if > 90s)
        rec_time = metric.recorded_at
        if rec_time.tzinfo is None:
            rec_time = rec_time.replace(tzinfo=timezone.utc)

        delta_secs = (now - rec_time).total_seconds()
        is_stale = delta_secs > 90

        # Evaluate real-time threshold status
        status_str = metric.status
        if is_stale:
            status_str = "OFFLINE"
        elif metric.cpu_percent >= settings.CPU_CRITICAL_THRESHOLD or metric.ram_percent >= settings.RAM_CRITICAL_THRESHOLD or metric.disk_percent >= settings.DISK_CRITICAL_THRESHOLD:
            status_str = "CRITICAL"
        elif metric.cpu_percent >= settings.CPU_WARNING_THRESHOLD or metric.ram_percent >= settings.RAM_WARNING_THRESHOLD or metric.disk_percent >= settings.DISK_WARNING_THRESHOLD:
            status_str = "WARNING"
        else:
            status_str = "HEALTHY"

        resp_item = HealthMetricResponse(
            id=metric.id,
            host_id=metric.host_id,
            hostname=metric.hostname,
            ip_address=ip_addr,
            os_name=metric.os_name or (hb.os_name if hb else "Generic OS"),
            cpu_percent=metric.cpu_percent,
            ram_percent=metric.ram_percent,
            disk_percent=metric.disk_percent,
            network_in_bytes=metric.network_in_bytes,
            network_out_bytes=metric.network_out_bytes,
            uptime_seconds=metric.uptime_seconds,
            status=status_str,
            recorded_at=metric.recorded_at,
            last_seen=rec_time,
            is_stale=is_stale
        )
        unique_host_metrics.append(resp_item)

    # Sort by active first, then recorded_at desc
    unique_host_metrics.sort(key=lambda m: (m.status != "OFFLINE", m.recorded_at), reverse=True)
    return unique_host_metrics


@router.get("/discovered-devices", response_model=List[DiscoveredDeviceTelemetryStatus])
async def get_discovered_devices_telemetry_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List real discovered network devices and explicitly declare whether host hardware
    telemetry is actively streaming via NetGuard agent, stopped/offline, or unavailable.
    """
    now = datetime.now(timezone.utc)

    # 1. Fetch all heartbeats to check active vs stopped agents
    hb_stmt = select(AgentHeartbeat)
    all_heartbeats = {hb.hostname: hb for hb in (await db.execute(hb_stmt)).scalars().all() if hb.hostname}

    # 2. Fetch all real discovered devices
    dev_stmt = select(Device).where(Device.is_synthetic == False).order_by(Device.last_seen.desc())
    devices = (await db.execute(dev_stmt)).scalars().all()

    device_statuses: List[DiscoveredDeviceTelemetryStatus] = []
    for d in devices:
        hb = all_heartbeats.get(d.hostname) if d.hostname else None
        has_active_agent = False

        if hb:
            hb_time = hb.last_heartbeat
            if hb_time.tzinfo is None:
                hb_time = hb_time.replace(tzinfo=timezone.utc)
            delta_s = (now - hb_time).total_seconds()
            if delta_s <= 90:
                has_active_agent = True
                telemetry_status = "Active Host Agent Telemetry"
            else:
                mins_ago = max(1, int(delta_s // 60))
                telemetry_status = f"Host agent offline — last report: {mins_ago}m ago"
        else:
            telemetry_status = "Network device discovered — host telemetry unavailable"

        device_statuses.append(DiscoveredDeviceTelemetryStatus(
            device_id=d.id,
            hostname=d.hostname,
            ip_address=d.ip_address,
            mac_address=d.mac_address,
            vendor=d.vendor,
            device_type=d.device_type,
            has_agent=has_active_agent,
            telemetry_status=telemetry_status,
            last_seen=d.last_seen
        ))

    return device_statuses


@router.get("/server-self")
async def get_server_self_health(
    current_user: User = Depends(get_current_user)
):
    """Retrieve host telemetry of the NetGuard SOC server itself."""
    cpu_pct = round(psutil.cpu_percent(interval=None), 1)
    ram = psutil.virtual_memory()

    # Determine safe root filesystem path across Linux and Windows
    disk_path = "/"
    if os.name == "nt":
        drive = os.path.splitdrive(os.getcwd())[0]
        disk_path = drive + "\\" if drive else "C:\\"

    try:
        disk = psutil.disk_usage(disk_path)
    except Exception:
        disk = psutil.disk_usage(os.sep)

    boot_time = psutil.boot_time()
    uptime_secs = int(datetime.now().timestamp() - boot_time)

    # Threshold evaluation
    status_str = "HEALTHY"
    if cpu_pct >= settings.CPU_CRITICAL_THRESHOLD or ram.percent >= settings.RAM_CRITICAL_THRESHOLD or disk.percent >= settings.DISK_CRITICAL_THRESHOLD:
        status_str = "CRITICAL"
    elif cpu_pct >= settings.CPU_WARNING_THRESHOLD or ram.percent >= settings.RAM_WARNING_THRESHOLD or disk.percent >= settings.DISK_WARNING_THRESHOLD:
        status_str = "WARNING"

    os_desc = f"{platform.system()} {platform.release()}"

    return {
        "hostname": os.environ.get("COMPUTERNAME", os.environ.get("HOSTNAME", "netguard-soc")),
        "os_name": os_desc,
        "cpu_percent": cpu_pct,
        "ram_percent": round(ram.percent, 1),
        "disk_percent": round(disk.percent, 1),
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
