from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc

from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.models.user import User
from backend.app.models.security_event import SecurityEvent
from backend.app.schemas.security_event import SecurityEventResponse

router = APIRouter(prefix="/events", tags=["Security Events"])


@router.get("", response_model=List[SecurityEventResponse])
async def list_security_events(
    source: Optional[str] = Query(None, description="Filter by event source (suricata, zeek, agent, simulator)"),
    event_type: Optional[str] = Query(None, description="Filter by event type (alert, dns, http, tls, flow)"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    search: Optional[str] = Query(None, description="Search term across IP, signature, payload"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Query normalized raw security events from Suricata, Zeek, host agents, and network collectors."""
    query = select(SecurityEvent).order_by(desc(SecurityEvent.timestamp)).offset(offset).limit(limit)

    if source:
        query = query.where(SecurityEvent.source == source.lower())
    if event_type:
        query = query.where(SecurityEvent.event_type == event_type.lower())
    if severity:
        query = query.where(SecurityEvent.severity == severity.upper())
    if search:
        s = f"%{search}%"
        query = query.where(
            (SecurityEvent.source_ip.ilike(s)) |
            (SecurityEvent.destination_ip.ilike(s)) |
            (SecurityEvent.signature.ilike(s)) |
            (SecurityEvent.description.ilike(s))
        )

    result = await db.execute(query)
    return result.scalars().all()
