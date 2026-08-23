from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.core.database import get_db
from backend.app.core.security import get_current_user, require_role, UserRole, get_password_hash
from backend.app.core.audit import record_audit_log
from backend.app.models.user import User
from backend.app.schemas.auth import UserCreate, UserUpdate, UserResponse
from backend.app.services.mfa_service import mfa_service

router = APIRouter(prefix="/users", tags=["User Management"])


@router.get("", response_model=List[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ANALYST]))
):
    """List all registered system users (ADMIN, ANALYST)."""
    result = await db.execute(select(User).order_by(User.id))
    return result.scalars().all()


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
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ANALYST]))
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
            from backend.app.models.mfa import MFAChallenge
            from sqlalchemy import delete
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
