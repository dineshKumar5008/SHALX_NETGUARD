import uuid
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc

from backend.app.core.database import get_db
from backend.app.core.security import get_current_user, require_role, UserRole
from backend.app.core.audit import record_audit_log
from backend.app.models.user import User
from backend.app.models.alert import Alert
from backend.app.models.incident import Incident, IncidentAlert, IncidentTimeline
from backend.app.schemas.alert import AlertResponse, AlertTriageRequest
from backend.app.websocket.manager import ws_manager

router = APIRouter(prefix="/alerts", tags=["Alert Management"])


@router.get("", response_model=List[AlertResponse])
async def list_alerts(
    severity: Optional[str] = Query(None, description="Filter by severity (LOW, MEDIUM, HIGH, CRITICAL)"),
    status: Optional[str] = Query(None, description="Filter by status (NEW, ACKNOWLEDGED, INVESTIGATING, RESOLVED, FALSE_POSITIVE)"),
    category: Optional[str] = Query(None, description="Filter by threat category"),
    search: Optional[str] = Query(None, description="Search in title, IP, signature"),
    include_synthetic: bool = Query(False, description="Include simulated demo alerts"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve security alerts with full filtering, search, and pagination."""
    query = select(Alert).order_by(desc(Alert.created_at)).offset(offset).limit(limit)
    if not include_synthetic:
        query = query.where(Alert.is_synthetic == False)

    if severity:
        query = query.where(Alert.severity == severity.upper())
    if status:
        query = query.where(Alert.status == status.upper())
    if category:
        query = query.where(Alert.category == category.lower())
    if search:
        s = f"%{search}%"
        query = query.where((Alert.title.ilike(s)) | (Alert.source_ip.ilike(s)) | (Alert.destination_ip.ilike(s)) | (Alert.signature.ilike(s)))

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert_by_id(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve complete metadata, raw packet/event payload, and resolution state for an alert."""
    stmt = select(Alert).where(Alert.id == alert_id)
    alert = (await db.execute(stmt)).scalars().first()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    return alert


@router.post("/{alert_id}/triage", response_model=AlertResponse)
async def triage_alert(
    alert_id: int,
    payload: AlertTriageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ANALYST]))
):
    """Triage and update the lifecycle status of an alert (acknowledge, investigate, resolve, false positive)."""
    stmt = select(Alert).where(Alert.id == alert_id)
    alert = (await db.execute(stmt)).scalars().first()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")

    action_map = {
        "acknowledge": "ACKNOWLEDGED",
        "investigate": "INVESTIGATING",
        "resolve": "RESOLVED",
        "false_positive": "FALSE_POSITIVE"
    }

    new_status = action_map.get(payload.action.lower())
    if not new_status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid triage action. Allowed: {list(action_map.keys())}"
        )

    alert.status = new_status
    alert.updated_at = datetime.now(timezone.utc)
    if new_status == "ACKNOWLEDGED":
        alert.acknowledged_by = current_user.username
    elif new_status in ["RESOLVED", "FALSE_POSITIVE"]:
        alert.resolved_by = current_user.username
        if payload.notes:
            alert.resolution_notes = payload.notes

    await db.commit()
    await db.refresh(alert)

    # Broadcast updated alert status
    await ws_manager.broadcast("alert_triaged", {
        "id": alert.id,
        "alert_id": alert.alert_id,
        "status": alert.status,
        "updated_by": current_user.username
    })

    await record_audit_log(
        db,
        user=current_user.username,
        action=f"ALERT_TRIAGE_{new_status}",
        resource=f"/api/v1/alerts/{alert.id}",
        result="SUCCESS",
        metadata={"alert_id": alert.alert_id, "action": payload.action, "notes": payload.notes}
    )
    return alert


@router.post("/{alert_id}/escalate-to-incident")
async def escalate_alert_to_incident(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ANALYST]))
):
    """Escalate a security alert into an official Incident for forensic investigation."""
    stmt = select(Alert).where(Alert.id == alert_id)
    alert = (await db.execute(stmt)).scalars().first()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")

    inc_id = f"INC-{uuid.uuid4().hex[:8].upper()}"
    incident = Incident(
        incident_id=inc_id,
        title=f"Incident: {alert.title}",
        description=f"Escalated from Alert {alert.alert_id} ({alert.source_ip} -> {alert.destination_ip}).\n\n{alert.description}",
        severity=alert.severity,
        status="OPEN",
        assigned_analyst=current_user.username,
        created_by=current_user.username,
        affected_ips=f"{alert.source_ip}, {alert.destination_ip}" if alert.source_ip else alert.destination_ip,
        investigation_notes=f"Escalated by analyst {current_user.username} for active investigation.",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    db.add(incident)
    await db.flush()

    # Link alert to incident
    link = IncidentAlert(incident_id=incident.id, alert_id=alert.id)
    db.add(link)

    # Add initial timeline event
    timeline_event = IncidentTimeline(
        incident_id=incident.id,
        timestamp=datetime.now(timezone.utc),
        actor=current_user.username,
        event_type="CREATED",
        message=f"Incident generated via escalation from Alert {alert.alert_id} by {current_user.username}."
    )
    db.add(timeline_event)

    alert.status = "INVESTIGATING"
    await db.commit()

    await record_audit_log(
        db,
        user=current_user.username,
        action="INCIDENT_CREATED_FROM_ALERT",
        resource=f"/api/v1/incidents/{incident.id}",
        result="SUCCESS",
        metadata={"incident_id": inc_id, "alert_id": alert.alert_id}
    )

    return {
        "message": f"Alert {alert.alert_id} escalated to Incident {inc_id}",
        "incident_id": incident.id,
        "incident_code": inc_id
    }
