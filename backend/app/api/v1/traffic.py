import json
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc, func

from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.models.user import User
from backend.app.models.metrics import TrafficMetric
from backend.app.schemas.metrics import TrafficMetricResponse
from backend.app.collectors.traffic import traffic_collector

router = APIRouter(prefix="/traffic", tags=["Network Traffic Monitoring"])


@router.get("/metrics", response_model=List[TrafficMetricResponse])
async def get_traffic_metrics_history(
    limit: int = Query(60, ge=10, le=300, description="Number of historical time buckets to fetch"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve historical time-series traffic metrics for charts."""
    stmt = select(TrafficMetric).order_by(desc(TrafficMetric.timestamp)).limit(limit)
    result = await db.execute(stmt)
    records = result.scalars().all()
    return list(reversed(records))


@router.get("/summary")
async def get_traffic_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve summary of live bandwidth, protocols distribution, and top talkers."""
    stmt = select(TrafficMetric).order_by(desc(TrafficMetric.timestamp)).limit(1)
    latest = (await db.execute(stmt)).scalars().first()

    top_sources = {}
    top_dests = {}
    if latest:
        if latest.top_source_ips:
            try:
                top_sources = json.loads(latest.top_source_ips)
            except Exception:
                pass
        if latest.top_dest_ips:
            try:
                top_dests = json.loads(latest.top_dest_ips)
            except Exception:
                pass

    return {
        "active_flows": latest.active_flows if latest else 0,
        "bytes_in": latest.bytes_in if latest else 0,
        "bytes_out": latest.bytes_out if latest else 0,
        "packets_in": latest.packets_in if latest else 0,
        "packets_out": latest.packets_out if latest else 0,
        "protocols": {
            "TCP": latest.tcp_count if latest else 0,
            "UDP": latest.udp_count if latest else 0,
            "ICMP": latest.icmp_count if latest else 0,
            "OTHER": latest.other_count if latest else 0
        },
        "top_sources": top_sources,
        "top_destinations": top_dests
    }
