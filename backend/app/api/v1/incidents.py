import uuid
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import desc

from backend.app.core.database import get_db
from backend.app.core.security import get_current_user, require_role, UserRole
from backend.app.core.audit import record_audit_log
from backend.app.models.user import User
from backend.app.models.incident import Incident, IncidentAlert, IncidentTimeline
from backend.app.models.alert import Alert
from backend.app.schemas.incident import (
    IncidentCreate, IncidentUpdate, IncidentResponse, IncidentTimelineResponse, IncidentNoteCreate
)

router = APIRouter(prefix="/incidents", tags=["Incident Management"])


@router.get("", response_model=List[IncidentResponse])
async def list_incidents(
    status: Optional[str] = Query(None, description="Filter by status (OPEN, INVESTIGATING, CONTAINED, RESOLVED, CLOSED)"),
    severity: Optional[str] = Query(None, description="Filter by severity (LOW, MEDIUM, HIGH, CRITICAL)"),
    include_synthetic: bool = Query(False, description="Include simulated demo incidents"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List security incidents with timeline summaries."""
    query = select(Incident).options(
        selectinload(Incident.timeline_events),
        selectinload(Incident.alerts)
    ).order_by(desc(Incident.created_at))

    if not include_synthetic:
        query = query.where(Incident.is_synthetic == False)

    if status:
        query = query.where(Incident.status == status.upper())
    if severity:
        query = query.where(Incident.severity == severity.upper())

    result = await db.execute(query)
    incidents = result.scalars().all()

    # Enrich response
    response_list = []
    for inc in incidents:
        inc_dict = {
            "id": inc.id,
            "incident_id": inc.incident_id,
            "title": inc.title,
            "description": inc.description,
            "severity": inc.severity,
            "status": inc.status,
            "assigned_analyst": inc.assigned_analyst,
            "created_by": inc.created_by,
            "affected_ips": inc.affected_ips,
            "investigation_notes": inc.investigation_notes,
            "created_at": inc.created_at,
            "updated_at": inc.updated_at,
            "resolved_at": inc.resolved_at,
            "timeline_events": inc.timeline_events,
            "alert_count": len(inc.alerts)
        }
        response_list.append(inc_dict)

    return response_list


@router.post("", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
async def create_incident(
    inc_in: IncidentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ANALYST]))
):
    """Create a new manual incident investigation."""
    inc_id = f"INC-{uuid.uuid4().hex[:8].upper()}"
    incident = Incident(
        incident_id=inc_id,
        title=inc_in.title,
        description=inc_in.description,
        severity=inc_in.severity.upper(),
        status="OPEN",
        assigned_analyst=inc_in.assigned_analyst or current_user.username,
        created_by=current_user.username,
        affected_ips=inc_in.affected_ips,
        investigation_notes=inc_in.investigation_notes,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    db.add(incident)
    await db.flush()

    # Link any specified alerts
    if inc_in.alert_ids:
        for aid in inc_in.alert_ids:
            link = IncidentAlert(incident_id=incident.id, alert_id=aid)
            db.add(link)

    # Initial timeline record
    timeline = IncidentTimeline(
        incident_id=incident.id,
        timestamp=datetime.now(timezone.utc),
        actor=current_user.username,
        event_type="CREATED",
        message=f"Incident {inc_id} opened by {current_user.username}."
    )
    db.add(timeline)
    await db.commit()

    # Fetch loaded object
    stmt = select(Incident).options(
        selectinload(Incident.timeline_events),
        selectinload(Incident.alerts)
    ).where(Incident.id == incident.id)
    loaded = (await db.execute(stmt)).scalars().first()

    await record_audit_log(
        db,
        user=current_user.username,
        action="INCIDENT_CREATED",
        resource=f"/api/v1/incidents/{incident.id}",
        result="SUCCESS",
        metadata={"incident_id": inc_id, "title": incident.title}
    )

    return {
        "id": loaded.id,
        "incident_id": loaded.incident_id,
        "title": loaded.title,
        "description": loaded.description,
        "severity": loaded.severity,
        "status": loaded.status,
        "assigned_analyst": loaded.assigned_analyst,
        "created_by": loaded.created_by,
        "affected_ips": loaded.affected_ips,
        "investigation_notes": loaded.investigation_notes,
        "created_at": loaded.created_at,
        "updated_at": loaded.updated_at,
        "resolved_at": loaded.resolved_at,
        "timeline_events": loaded.timeline_events,
        "alert_count": len(loaded.alerts)
    }


@router.get("/{incident_id}", response_model=IncidentResponse)
async def get_incident_by_id(
    incident_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve full incident details, timeline events, and linked alerts."""
    stmt = select(Incident).options(
        selectinload(Incident.timeline_events),
        selectinload(Incident.alerts)
    ).where(Incident.id == incident_id)
    inc = (await db.execute(stmt)).scalars().first()
    if not inc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    return {
        "id": inc.id,
        "incident_id": inc.incident_id,
        "title": inc.title,
        "description": inc.description,
        "severity": inc.severity,
        "status": inc.status,
        "assigned_analyst": inc.assigned_analyst,
        "created_by": inc.created_by,
        "affected_ips": inc.affected_ips,
        "investigation_notes": inc.investigation_notes,
        "created_at": inc.created_at,
        "updated_at": inc.updated_at,
        "resolved_at": inc.resolved_at,
        "timeline_events": inc.timeline_events,
        "alert_count": len(inc.alerts)
    }


@router.put("/{incident_id}", response_model=IncidentResponse)
async def update_incident(
    incident_id: int,
    payload: IncidentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ANALYST]))
):
    """Update incident status, severity, assignment, or investigation notes."""
    stmt = select(Incident).options(
        selectinload(Incident.timeline_events),
        selectinload(Incident.alerts)
    ).where(Incident.id == incident_id)
    inc = (await db.execute(stmt)).scalars().first()
    if not inc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    changes = []
    if payload.status and payload.status.upper() != inc.status:
        old_status = inc.status
        inc.status = payload.status.upper()
        changes.append(f"Status changed from {old_status} to {inc.status}")
        if inc.status in ["RESOLVED", "CLOSED"]:
            inc.resolved_at = datetime.now(timezone.utc)
    if payload.severity and payload.severity.upper() != inc.severity:
        inc.severity = payload.severity.upper()
        changes.append(f"Severity updated to {inc.severity}")
    if payload.assigned_analyst and payload.assigned_analyst != inc.assigned_analyst:
        inc.assigned_analyst = payload.assigned_analyst
        changes.append(f"Assigned analyst set to {inc.assigned_analyst}")
    if payload.investigation_notes:
        inc.investigation_notes = payload.investigation_notes
    if payload.title:
        inc.title = payload.title
    if payload.affected_ips:
        inc.affected_ips = payload.affected_ips

    inc.updated_at = datetime.now(timezone.utc)

    # Append timeline event if status/assignment changed
    if changes:
        timeline = IncidentTimeline(
            incident_id=inc.id,
            timestamp=datetime.now(timezone.utc),
            actor=current_user.username,
            event_type="STATUS_CHANGED",
            message="; ".join(changes)
        )
        db.add(timeline)

    await db.commit()

    await record_audit_log(
        db,
        user=current_user.username,
        action="INCIDENT_UPDATED",
        resource=f"/api/v1/incidents/{inc.id}",
        result="SUCCESS",
        metadata={"incident_id": inc.incident_id, "changes": changes}
    )

    return await get_incident_by_id(incident_id, db, current_user)


@router.post("/{incident_id}/notes")
async def add_incident_note(
    incident_id: int,
    payload: IncidentNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ANALYST]))
):
    """Add a timestamped investigation note to the incident timeline."""
    stmt = select(Incident).where(Incident.id == incident_id)
    inc = (await db.execute(stmt)).scalars().first()
    if not inc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    timeline = IncidentTimeline(
        incident_id=inc.id,
        timestamp=datetime.now(timezone.utc),
        actor=current_user.username,
        event_type="NOTE_ADDED",
        message=f"[Note from {current_user.username}]: {payload.note}"
    )
    db.add(timeline)
    
    # Append to notes field as well
    existing = inc.investigation_notes or ""
    time_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    inc.investigation_notes = f"{existing}\n[{time_str}] {current_user.username}: {payload.note}".strip()
    inc.updated_at = datetime.now(timezone.utc)

    await db.commit()
    return {"message": "Investigation note added successfully"}
