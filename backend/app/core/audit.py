from datetime import datetime, timezone
from typing import Optional, Any, Dict
from sqlalchemy.ext.asyncio import AsyncSession
import json


async def record_audit_log(
    db: AsyncSession,
    user: str,
    action: str,
    resource: str,
    result: str = "SUCCESS",
    source_ip: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
):
    """
    Persist an immutable audit log entry in the database.
    """
    from backend.app.models.audit import AuditLog
    
    meta_str = json.dumps(metadata) if metadata else None
    log_entry = AuditLog(
        user=user,
        action=action,
        resource=resource,
        result=result,
        source_ip=source_ip or "127.0.0.1",
        metadata_json=meta_str,
        timestamp=datetime.now(timezone.utc)
    )
    db.add(log_entry)
    await db.commit()
