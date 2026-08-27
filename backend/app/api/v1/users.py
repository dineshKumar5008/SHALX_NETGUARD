import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, delete

from backend.app.core.database import get_db
from backend.app.core.security import get_current_user, require_role, UserRole, get_password_hash
from backend.app.core.audit import record_audit_log
from backend.app.models.user import User
from backend.app.models.registration import RegistrationRequest
from backend.app.models.mfa import MFAChallenge
from backend.app.schemas.auth import UserCreate, UserUpdate, UserResponse
from backend.app.schemas.registration import (
    RegistrationResponse, RegistrationApproveRequest, RegistrationRejectRequest
)
from backend.app.services.mfa_service import mfa_service

logger = logging.getLogger("netguard.users")
router = APIRouter(prefix="/users", tags=["User Management"])


@router.get("", response_model=List[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SENIOR_ANALYST, UserRole.ANALYST]))
):
    """List all registered system users (ADMIN, SENIOR_ANALYST, ANALYST)."""
    result = await db.execute(select(User).order_by(User.id))
    return result.scalars().all()


@router.get("/registration-requests/count")
async def get_pending_registration_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SENIOR_ANALYST]))
):
    """Get total count of pending registration requests for notification badges."""
    stmt = select(func.count(RegistrationRequest.id)).where(RegistrationRequest.status == "PENDING")
    count = (await db.execute(stmt)).scalar() or 0
    return {"pending_count": count}


@router.get("/registration-requests", response_model=List[RegistrationResponse])
async def list_registration_requests(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status: PENDING, APPROVED, REJECTED"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SENIOR_ANALYST]))
):
    """List registration requests for review (ADMIN and SENIOR_ANALYST)."""
    stmt = select(RegistrationRequest).order_by(RegistrationRequest.created_at.desc())
    if status_filter and status_filter.upper() in ["PENDING", "APPROVED", "REJECTED"]:
        stmt = stmt.where(RegistrationRequest.status == status_filter.upper())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/registration-requests/{request_id}", response_model=RegistrationResponse)
async def get_registration_request_details(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SENIOR_ANALYST]))
):
    """Retrieve full details of a specific registration request."""
    stmt = select(RegistrationRequest).where(RegistrationRequest.id == request_id)
    req = (await db.execute(stmt)).scalars().first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registration request not found")
    return req


@router.post("/registration-requests/{request_id}/approve", response_model=RegistrationResponse)
async def approve_registration_request(
    request_id: int,
    payload: RegistrationApproveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SENIOR_ANALYST]))
):
    """
    Approve an applicant's registration request:
    1. Validates reviewer authorization (ADMIN or SENIOR_ANALYST).
    2. Verifies request is still in PENDING state (prevents double approval / race conditions).
    3. Validates assigned RBAC role (defaults to VIEWER).
    4. Creates active User record with preserved password hash and email.
    5. Marks registration request as APPROVED with reviewer identity & timestamp.
    6. Dispatches approval notification email to applicant.
    7. Records security audit logs.
    """
    stmt = select(RegistrationRequest).where(RegistrationRequest.id == request_id)
    req = (await db.execute(stmt)).scalars().first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registration request not found")

    if req.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This registration request has already been processed (Current status: {req.status})."
        )

    assigned_role = (payload.role or "VIEWER").upper()
    valid_roles = [r.value for r in UserRole]
    if assigned_role not in valid_roles:
        assigned_role = "VIEWER"

    # Safeguard against duplicate user in database
    stmt_user = select(User).where((User.username == req.username) | (User.email == req.email))
    existing_user = (await db.execute(stmt_user)).scalars().first()
    if existing_user:
        req.status = "APPROVED"
        req.reviewed_by = current_user.username
        req.reviewed_at = datetime.now(timezone.utc)
        req.requested_role = assigned_role
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An active user account already exists with username '{req.username}' or email '{req.email}'."
        )

    now = datetime.now(timezone.utc)
    new_user = User(
        username=req.username,
        email=req.email,
        full_name=req.full_name,
        hashed_password=req.password_hash,
        role=assigned_role,
        is_active=True,
        email_verified=True,
        email_verified_at=now,
        created_at=now
    )
    db.add(new_user)

    req.status = "APPROVED"
    req.requested_role = assigned_role
    req.reviewed_by = current_user.username
    req.reviewed_at = now

    await db.commit()
    await db.refresh(new_user)
    await db.refresh(req)

    # Dispatch approval email to applicant's registered address
    try:
        await mfa_service.send_registration_approved_email(
            applicant_email=req.email,
            username=req.username,
            applicant_name=req.full_name
        )
    except Exception as e:
        logger.error(f"Failed to dispatch approval email to {req.email}: {e}")

    await record_audit_log(
        db,
        user=current_user.username,
        action="REGISTRATION_APPROVED",
        resource=f"/api/v1/users/registration-requests/{req.id}",
        result="SUCCESS",
        metadata={
            "approved_username": req.username,
            "assigned_role": assigned_role,
            "applicant_email": req.email,
            "reviewed_by": current_user.username
        }
    )
    await record_audit_log(
        db,
        user=current_user.username,
        action="USER_ACTIVATED",
        resource=f"/api/v1/users/{new_user.id}",
        result="SUCCESS",
        metadata={"username": new_user.username, "role": new_user.role}
    )

    return req


@router.post("/registration-requests/{request_id}/reject", response_model=RegistrationResponse)
async def reject_registration_request(
    request_id: int,
    payload: RegistrationRejectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SENIOR_ANALYST]))
):
    """
    Reject an applicant's registration request:
    1. Validates reviewer authorization (ADMIN or SENIOR_ANALYST).
    2. Verifies request is in PENDING state.
    3. Requires explicit rejection reason.
    4. Marks request as REJECTED with reviewer identity, timestamp, and reason.
    5. Dispatches rejection notification email to applicant.
    6. Records security audit log.
    """
    stmt = select(RegistrationRequest).where(RegistrationRequest.id == request_id)
    req = (await db.execute(stmt)).scalars().first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registration request not found")

    if req.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This registration request has already been processed (Current status: {req.status})."
        )

    clean_reason = payload.rejection_reason.strip()
    if not clean_reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A non-empty rejection reason is required."
        )

    now = datetime.now(timezone.utc)
    req.status = "REJECTED"
    req.rejection_reason = clean_reason
    req.reviewed_by = current_user.username
    req.reviewed_at = now

    await db.commit()
    await db.refresh(req)

    # Dispatch rejection email to applicant
    try:
        await mfa_service.send_registration_rejected_email(
            applicant_email=req.email,
            applicant_name=req.full_name,
            rejection_reason=clean_reason
        )
    except Exception as e:
        logger.error(f"Failed to dispatch rejection email to {req.email}: {e}")

    await record_audit_log(
        db,
        user=current_user.username,
        action="REGISTRATION_REJECTED",
        resource=f"/api/v1/users/registration-requests/{req.id}",
        result="SUCCESS",
        metadata={
            "rejected_username": req.username,
            "rejection_reason": clean_reason,
            "reviewed_by": current_user.username
        }
    )

    return req


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN]))
):
    """Create a new user account with validated registered email (ADMIN only)."""
    clean_email = user_in.email.strip() if user_in.email else ""
    if not clean_email or not mfa_service.is_valid_production_email(clean_email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a valid email address."
        )

    clean_username = user_in.username.strip()
    stmt = select(User).where((User.username == clean_username) | (User.email == clean_email))
    existing = (await db.execute(stmt)).scalars().first()
    if existing:
        if existing.username.lower() == clean_username.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Username '{clean_username}' is already registered."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email address '{clean_email}' is already registered to another account."
            )

    new_user = User(
        username=clean_username,
        email=clean_email,
        full_name=user_in.full_name.strip(),
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role.upper(),
        is_active=user_in.is_active,
        email_verified=True
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    await record_audit_log(
        db,
        user=current_user.username,
        action="USER_CREATED",
        resource=f"/api/v1/users/{new_user.id}",
        result="SUCCESS",
        metadata={"created_user": new_user.username, "role": new_user.role, "email": new_user.email}
    )
    return new_user


@router.get("/{user_id}", response_model=UserResponse)
async def get_user_by_id(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SENIOR_ANALYST, UserRole.ANALYST]))
):
    """Retrieve details for a specific user."""
    stmt = select(User).where(User.id == user_id)
    user = (await db.execute(stmt)).scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN]))
):
    """Update user attributes or registered email (ADMIN only)."""
    stmt = select(User).where(User.id == user_id)
    user = (await db.execute(stmt)).scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user_in.email is not None:
        clean_email = user_in.email.strip()
        if not clean_email or not mfa_service.is_valid_production_email(clean_email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please enter a valid email address."
            )
        # Check if email is already used by another account
        stmt_email = select(User).where(User.email == clean_email, User.id != user.id)
        if (await db.execute(stmt_email)).scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email address '{clean_email}' is already registered to another account."
            )

        if user.email != clean_email:
            user.email = clean_email
            user.email_verified = True
            # Invalidate any existing active MFA challenges for this user
            await db.execute(delete(MFAChallenge).where(MFAChallenge.user_id == user.id))

    if user_in.full_name is not None:
        user.full_name = user_in.full_name.strip()
    if user_in.role is not None:
        user.role = user_in.role.upper()
    if user_in.is_active is not None:
        user.is_active = user_in.is_active
    if user_in.password:
        user.hashed_password = get_password_hash(user_in.password)

    await db.commit()
    await db.refresh(user)

    await record_audit_log(
        db,
        user=current_user.username,
        action="USER_UPDATED",
        resource=f"/api/v1/users/{user.id}",
        result="SUCCESS",
        metadata={"updated_user": user.username, "role": user.role, "email": user.email}
    )
    return user


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN]))
):
    """Delete a user account (ADMIN only)."""
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete own administrator account"
        )
    stmt = select(User).where(User.id == user_id)
    user = (await db.execute(stmt)).scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    username = user.username
    await db.delete(user)
    await db.commit()

    await record_audit_log(
        db,
        user=current_user.username,
        action="USER_DELETED",
        resource=f"/api/v1/users/{user_id}",
        result="SUCCESS",
        metadata={"deleted_username": username}
    )
    return {"message": f"User {username} deleted successfully"}

