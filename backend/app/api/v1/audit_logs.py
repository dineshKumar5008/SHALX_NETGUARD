from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc

from backend.app.core.database import get_db
from backend.app.core.security import get_current_user, require_role, UserRole
from backend.app.models.user import User
from backend.app.models.audit import AuditLog
from backend.app.schemas.audit import AuditLogResponse

router = APIRouter(prefix="/audit-logs", tags=["Immutable Audit Trail"])


@router.get("", response_model=List[AuditLogResponse])
async def list_audit_logs(
    user: Optional[str] = Query(None, description="Filter by initiating username"),
    action: Optional[str] = Query(None, description="Filter by action type (LOGIN, IP_BLOCK, etc.)"),
    search: Optional[str] = Query(None, description="Search term in resource or action"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ANALYST]))
):
    """Retrieve immutable system audit logs."""
    query = select(AuditLog).order_by(desc(AuditLog.timestamp)).offset(offset).limit(limit)

    if user:
        query = query.where(AuditLog.user == user)
    if action:
        query = query.where(AuditLog.action.ilike(f"%{action}%"))
    if search:
        s = f"%{search}%"
        query = query.where((AuditLog.resource.ilike(s)) | (AuditLog.action.ilike(s)) | (AuditLog.user.ilike(s)))

    result = await db.execute(query)
    return result.scalars().all()
