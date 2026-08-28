import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Union

from fastapi import APIRouter, Depends, HTTPException, Request, status, Body
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, update, delete

from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.core.security import verify_password, get_password_hash, create_access_token, get_current_user
import secrets
from backend.app.core.audit import record_audit_log
from backend.app.models.user import User
from backend.app.models.mfa import MFAChallenge, PasswordResetChallenge
from backend.app.models.registration import RegistrationRequest
from backend.app.schemas.auth import (
    Token, UserResponse, PasswordChangeRequest, LoginRequest, LoginMfaResponse,
    MFAVerifyRequest, MFAResendRequest, SetupAdminEmailRequest, UserProfileUpdateRequest,
    ResetRateLimitRequest, ForgotPasswordRequest, ForgotPasswordResponse,
    ForgotPasswordVerifyRequest, ForgotPasswordVerifyResponse, ForgotPasswordResendRequest,
    ForgotPasswordResetRequest
)
from backend.app.schemas.registration import RegistrationSubmitRequest, RegistrationStatusResponse
from backend.app.services.mfa_service import mfa_service

logger = logging.getLogger("netguard.auth")
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=LoginMfaResponse)
async def login(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Step 1 of MFA Login Flow:
    1. Authenticate username and password against registered database record.
    2. Retrieve user's verified registered email address from database.
    3. Validate that the email address is a genuine production email (not unconfigured/placeholder).
    4. Generate a cryptographically secure, random 6-digit OTP.
    5. Store salted cryptographic hash of OTP in mfa_challenges.
    6. Deliver the OTP to user's registered email via SMTP.
    7. Return MFA challenge ID (JWT session is NOT issued until OTP verification).
    """
    content_type = request.headers.get("content-type", "")
    username = ""
    password = ""

    if "application/json" in content_type:
        try:
            body = await request.json()
            username = body.get("username", "").strip()
            password = body.get("password", "")
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload")
    else:
        try:
            form = await request.form()
            username = str(form.get("username", "")).strip()
            password = str(form.get("password", ""))
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid form payload")

    if not username or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username and password are required"
        )

    clean_username = username.strip()
    clean_lower = clean_username.lower()

    # 1. Look up user by username or registered email (case-insensitive)
    stmt = select(User).where(
        (func.lower(User.username) == clean_lower) | (func.lower(User.email) == clean_lower)
    )
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user:
        # Check if user has a pending or rejected registration request
        stmt_reg = select(RegistrationRequest).where(
            (func.lower(RegistrationRequest.username) == clean_lower) | (func.lower(RegistrationRequest.email) == clean_lower)
        ).order_by(RegistrationRequest.created_at.desc())
        pending_req = (await db.execute(stmt_reg)).scalars().first()

        if pending_req:
            if pending_req.status == "PENDING":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Your registration request is currently pending approval by an administrator. You will be able to log in once approved."
                )
            elif pending_req.status == "REJECTED":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Your registration request was rejected: {pending_req.rejection_reason or 'Access denied'}."
                )

        await record_audit_log(
            db,
            user=clean_username,
            action="LOGIN_FAILED",
            resource="/api/v1/auth/login",
            result="DENIED",
            metadata={"reason": "User not found", "ip": request.client.host if request.client else None}
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(password, user.hashed_password):
        await record_audit_log(
            db,
            user=clean_username,
            action="LOGIN_FAILED",
            resource="/api/v1/auth/login",
            result="DENIED",
            metadata={"reason": "Invalid credentials", "ip": request.client.host if request.client else None}
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )

    # 2. Strict Real Registered Email Validation
    recipient_email = (user.email or "").strip()
    if not mfa_service.is_valid_production_email(recipient_email):
        await record_audit_log(
            db,
            user=user.username,
            action="LOGIN_FAILED_UNCONFIGURED_EMAIL",
            resource="/api/v1/auth/login",
            result="DENIED",
            metadata={"reason": "User has no verified real email configured", "raw_email": recipient_email}
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your account does not have a verified real email configured for MFA delivery. Please configure your registered email (e.g. set ADMIN_EMAIL in Render environment variables or run setup) before logging in."
        )

    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=settings.MFA_RESEND_WINDOW_MINUTES)

    # 3. Rate Limiting: Max 3 OTP generation requests per 10 minutes per user
    rate_stmt = select(func.count(MFAChallenge.id)).where(
        MFAChallenge.user_id == user.id,
        MFAChallenge.created_at >= window_start
    )
    recent_otp_count = (await db.execute(rate_stmt)).scalar() or 0
    if recent_otp_count >= settings.MFA_MAX_RESENDS_PER_WINDOW:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many authentication attempts. Please wait before requesting another verification code."
        )

    # 4. Invalidate any existing active challenges for this user
    await db.execute(
        update(MFAChallenge)
        .where(MFAChallenge.user_id == user.id, MFAChallenge.is_used == False)
        .values(is_used=True)
    )

    # 5. Generate a completely NEW, cryptographically random 6-digit OTP
    otp = mfa_service.generate_secure_otp()
    otp_hash = mfa_service.hash_otp(otp)
    challenge_id = uuid.uuid4().hex
    expires_at = now + timedelta(minutes=settings.MFA_OTP_EXPIRE_MINUTES)

    challenge = MFAChallenge(
        challenge_id=challenge_id,
        user_id=user.id,
        otp_hash=otp_hash,
        created_at=now,
        expires_at=expires_at,
        attempt_count=0,
        resend_count=0,
        is_used=False,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "")[:250]
    )
    db.add(challenge)
    await db.commit()

    # 6. Send dynamic OTP strictly to the user's REGISTERED EMAIL address in the database
    masked_email = mfa_service.mask_email(recipient_email)
    
    email_sent, email_err = await mfa_service.send_otp_email(
        recipient_email=recipient_email,
        otp=otp,
        recipient_name=user.full_name or user.username
    )

    if not email_sent:
        logger.warning(f"Email dispatch failure for {masked_email}: {email_err}")
        challenge.is_used = True
        await db.commit()
        if not settings.is_email_configured:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Email delivery service is not configured on the server. Please configure RESEND_API_KEY (or SMTP credentials) in Render environment variables."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Unable to send verification code email: {email_err}"
            )

    await record_audit_log(
        db,
        user=user.username,
        action="MFA_CHALLENGE_ISSUED",
        resource="/api/v1/auth/login",
        result="SUCCESS",
        metadata={
            "challenge_id": challenge_id,
            "masked_email": masked_email,
            "email_dispatched": email_sent
        }
    )

    return LoginMfaResponse(
        mfa_required=True,
        challenge_id=challenge_id,
        masked_email=masked_email,
        expires_in=settings.MFA_OTP_EXPIRE_MINUTES * 60,
        message=f"Verification code dispatched to your registered email ({masked_email})."
    )


@router.post("/verify-mfa", response_model=Token)
async def verify_mfa(
    payload: MFAVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Step 2 of MFA Login Flow:
    1. Verify user-submitted 6-digit OTP against stored cryptographic hash.
    2. Check expiration (5 minutes) and attempt limits (max 5 attempts).
    3. Issue final authenticated JWT session upon successful verification.
    """
    now = datetime.now(timezone.utc)

    # 1. Fetch MFA challenge
    stmt = select(MFAChallenge).where(MFAChallenge.challenge_id == payload.challenge_id)
    challenge = (await db.execute(stmt)).scalars().first()

    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification challenge"
        )

    if challenge.is_used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification code has already been used. Please log in again."
        )

    # 2. Check Expiration
    challenge_exp = challenge.expires_at
    if challenge_exp.tzinfo is None:
        challenge_exp = challenge_exp.replace(tzinfo=timezone.utc)

    if now > challenge_exp:
        challenge.is_used = True
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new code."
        )

    # 3. Check Attempt Limit (Max 5 attempts)
    if challenge.attempt_count >= settings.MFA_MAX_VERIFY_ATTEMPTS:
        challenge.is_used = True
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Maximum verification attempts exceeded. Please initiate a new login."
        )

    # Increment attempt count
    challenge.attempt_count += 1

    # 4. Cryptographic Hash Verification
    is_valid = mfa_service.verify_otp_hash(payload.otp, challenge.otp_hash)

    if not is_valid:
        await db.commit()
        remaining_attempts = max(0, settings.MFA_MAX_VERIFY_ATTEMPTS - challenge.attempt_count)
        if remaining_attempts == 0:
            challenge.is_used = True
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification code. Challenge locked due to too many failed attempts."
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid verification code. {remaining_attempts} attempt(s) remaining."
        )

    # 5. Success: Consume challenge and authenticate user
    challenge.is_used = True

    user_stmt = select(User).where(User.id == challenge.user_id)
    user = (await db.execute(user_stmt)).scalars().first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated or unavailable"
        )

    user.last_login = now
    await db.commit()

    # 6. Issue JWT Access Token
    token_data = {"sub": user.username, "role": user.role}
    access_token = create_access_token(data=token_data)

    await record_audit_log(
        db,
        user=user.username,
        action="LOGIN_SUCCESS_MFA",
        resource="/api/v1/auth/verify-mfa",
        result="SUCCESS",
        metadata={
            "role": user.role,
            "ip": request.client.host if request.client else None
        }
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        role=user.role,
        username=user.username,
        full_name=user.full_name
    )


@router.post("/resend-mfa", response_model=LoginMfaResponse)
async def resend_mfa(
    payload: MFAResendRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Resend a NEW dynamic OTP verification code:
    1. Invalidate the previous challenge.
    2. Check user-level rate limiting.
    3. Generate a completely NEW 6-digit random OTP and hash it.
    4. Deliver new code to the SAME registered user email.
    5. Reset the 5-minute expiration timer.
    """
    now = datetime.now(timezone.utc)

    # 1. Locate previous challenge
    stmt = select(MFAChallenge).where(MFAChallenge.challenge_id == payload.challenge_id)
    prev_challenge = (await db.execute(stmt)).scalars().first()

    if not prev_challenge:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification challenge session"
        )

    user_id = prev_challenge.user_id
    user_stmt = select(User).where(User.id == user_id)
    user = (await db.execute(user_stmt)).scalars().first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated or unavailable"
        )

    # Validate registered email
    recipient_email = (user.email or "").strip()
    if not mfa_service.is_valid_production_email(recipient_email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have a verified real email address configured."
        )

    # 2. Check rate limit: Max 3 sends per 10 minutes
    window_start = now - timedelta(minutes=settings.MFA_RESEND_WINDOW_MINUTES)
    rate_stmt = select(func.count(MFAChallenge.id)).where(
        MFAChallenge.user_id == user.id,
        MFAChallenge.created_at >= window_start
    )
    recent_count = (await db.execute(rate_stmt)).scalar() or 0
    if recent_count >= settings.MFA_MAX_RESENDS_PER_WINDOW:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many verification code requests. Please wait a few minutes before trying again."
        )

    # 3. Invalidate previous challenge
    prev_challenge.is_used = True

    # 4. Generate completely NEW random OTP
    new_otp = mfa_service.generate_secure_otp()
    new_otp_hash = mfa_service.hash_otp(new_otp)
    new_challenge_id = uuid.uuid4().hex
    new_expires_at = now + timedelta(minutes=settings.MFA_OTP_EXPIRE_MINUTES)

    new_challenge = MFAChallenge(
        challenge_id=new_challenge_id,
        user_id=user.id,
        otp_hash=new_otp_hash,
        created_at=now,
        expires_at=new_expires_at,
        attempt_count=0,
        resend_count=prev_challenge.resend_count + 1,
        is_used=False,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "")[:250]
    )
    db.add(new_challenge)
    await db.commit()

    # 5. Deliver new code to the same registered email
    masked_email = mfa_service.mask_email(recipient_email)
    
    email_sent, email_err = await mfa_service.send_otp_email(
        recipient_email=recipient_email,
        otp=new_otp,
        recipient_name=user.full_name or user.username
    )

    if not email_sent:
        logger.warning(f"Resend email dispatch failure for {masked_email}: {email_err}")
        new_challenge.is_used = True
        await db.commit()
        if not settings.is_email_configured:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Email delivery service is not configured on the server. Please configure RESEND_API_KEY (or SMTP credentials) in Render environment variables."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Unable to send verification code email: {email_err}"
            )

    await record_audit_log(
        db,
        user=user.username,
        action="MFA_RESEND_ISSUED",
        resource="/api/v1/auth/resend-mfa",
        result="SUCCESS",
        metadata={
            "new_challenge_id": new_challenge_id,
            "masked_email": masked_email,
            "resend_count": new_challenge.resend_count
        }
    )

    return LoginMfaResponse(
        mfa_required=True,
        challenge_id=new_challenge_id,
        masked_email=masked_email,
        expires_in=settings.MFA_OTP_EXPIRE_MINUTES * 60,
        message=f"A fresh verification code has been dispatched to your registered email ({masked_email})."
    )


@router.post("/setup-admin-email")
async def setup_admin_email(
    payload: SetupAdminEmailRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Initial Setup Endpoint: Configure the administrator's real registered email address.
    Requires administrator password verification.
    """
    stmt = select(User).where(User.username == payload.username)
    result = await db.execute(stmt)
    admin_user = result.scalars().first()

    if not admin_user or admin_user.role != "ADMIN" or not verify_password(payload.password, admin_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid administrator credentials"
        )

    clean_email = payload.real_email.strip()
    if not mfa_service.is_valid_production_email(clean_email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid, non-placeholder production email address (e.g. your-name@gmail.com)."
        )

    admin_user.email = clean_email
    await db.commit()

    await record_audit_log(
        db,
        user=admin_user.username,
        action="ADMIN_EMAIL_CONFIGURED",
        resource="/api/v1/auth/setup-admin-email",
        result="SUCCESS",
        metadata={"configured_email": mfa_service.mask_email(clean_email)}
    )

    return {
        "success": True,
        "message": f"Administrator registered email successfully updated to {clean_email}. Real MFA verification codes will now be dispatched to this address."
    }


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    """Retrieve profile, registered email, and role information for currently authenticated user."""
    return current_user


@router.put("/profile", response_model=UserResponse)
async def update_current_user_profile(
    payload: UserProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update profile and registered MFA email address for the logged-in user."""
    if payload.email is not None:
        clean_email = payload.email.strip()
        if not mfa_service.is_valid_production_email(clean_email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid email format. Please provide a real production email address."
            )
        # Check if email is already used by another account
        stmt = select(User).where(User.email == clean_email, User.id != current_user.id)
        if (await db.execute(stmt)).scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This email address is already registered to another account."
            )
        if current_user.email != clean_email:
            current_user.email = clean_email
            current_user.email_verified = True
            await db.execute(delete(MFAChallenge).where(MFAChallenge.user_id == current_user.id))

    if payload.full_name is not None:
        current_user.full_name = payload.full_name.strip()

    await db.commit()
    await db.refresh(current_user)

    await record_audit_log(
        db,
        user=current_user.username,
        action="PROFILE_UPDATED",
        resource="/api/v1/auth/profile",
        result="SUCCESS"
    )
    return current_user


@router.post("/change-password")
async def change_password(
    payload: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Change the current user's password securely."""
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password"
        )

    current_user.hashed_password = get_password_hash(payload.new_password)
    await db.commit()

    await record_audit_log(
        db,
        user=current_user.username,
        action="PASSWORD_CHANGE",
        resource="/api/v1/auth/change-password",
        result="SUCCESS"
    )
    return {"message": "Password updated successfully"}


@router.post("/reset-rate-limit")
async def reset_rate_limit(
    payload: ResetRateLimitRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Safely reset the login / MFA rate-limit state for an account upon valid credential verification.
    This provides developers and administrators with a secure, authenticated mechanism to reset
    cooldown windows without weakening production security, bypassing OTP, or exposing credentials.
    """
    stmt = select(User).where(User.username == payload.username)
    user = (await db.execute(stmt)).scalars().first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )

    # Invalidate and delete existing challenges for this user
    await db.execute(delete(MFAChallenge).where(MFAChallenge.user_id == user.id))
    await db.commit()

    logger.info(f"MFA rate-limit state manually reset for user '{user.username}'.")
    return {
        "success": True,
        "message": f"Rate-limit state cleared for user '{user.username}'. You may now log in."
    }


@router.post("/register", response_model=RegistrationStatusResponse, status_code=status.HTTP_201_CREATED)
async def submit_registration_request(
    payload: RegistrationSubmitRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Public user self-registration submission:
    1. Validates all required applicant fields and email format.
    2. Verifies unique username and email across users and pending requests.
    3. Hashes password securely using bcrypt.
    4. Creates RegistrationRequest record with status 'PENDING'.
    5. Dispatches notification email to system administrators and senior analysts.
    6. Records security audit event.
    7. Returns pending status response (no automatic login or access token issued).
    """
    clean_username = payload.username.strip()
    clean_email = payload.email.strip().lower()
    clean_full_name = payload.full_name.strip()
    clean_department = payload.department.strip()
    clean_reason = payload.reason.strip()

    if not mfa_service.is_valid_production_email(clean_email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide a valid real production email address."
        )

    # Check for duplicate user account
    stmt_user = select(User).where(
        (func.lower(User.username) == clean_username.lower()) | (func.lower(User.email) == clean_email)
    )
    existing_user = (await db.execute(stmt_user)).scalars().first()
    if existing_user:
        if existing_user.username.lower() == clean_username.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username is already registered. Please choose a different username or log in."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email address is already registered. Please log in or use Forgot Password."
            )

    # Check for duplicate pending registration request
    stmt_pending = select(RegistrationRequest).where(
        RegistrationRequest.status == "PENDING",
        (func.lower(RegistrationRequest.username) == clean_username.lower()) | (func.lower(RegistrationRequest.email) == clean_email)
    )
    existing_pending = (await db.execute(stmt_pending)).scalars().first()
    if existing_pending:
        if existing_pending.username.lower() == clean_username.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A pending registration request already exists for this username. Please wait for administrator approval."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A pending registration request already exists for this email address. Please wait for administrator approval."
            )

    hashed_pw = get_password_hash(payload.password)
    now = datetime.now(timezone.utc)

    reg_req = RegistrationRequest(
        full_name=clean_full_name,
        username=clean_username,
        email=clean_email,
        password_hash=hashed_pw,
        department=clean_department,
        reason=clean_reason,
        requested_role="VIEWER",
        status="PENDING",
        created_at=now
    )
    db.add(reg_req)
    await db.commit()
    await db.refresh(reg_req)

    masked_email = mfa_service.mask_email(clean_email)

    # Dispatch notification to Administrators and Senior Analysts
    stmt_reviewers = select(User.email).where(
        User.role.in_(["ADMIN", "SENIOR_ANALYST"]),
        User.is_active == True,
        User.email.isnot(None),
        User.email != ""
    )
    reviewer_emails = (await db.execute(stmt_reviewers)).scalars().all()
    admin_emails = list(reviewer_emails)
    if settings.ADMIN_EMAIL and settings.ADMIN_EMAIL not in admin_emails:
        admin_emails.append(settings.ADMIN_EMAIL)

    try:
        await mfa_service.send_registration_submitted_admin_notification(
            admin_emails=admin_emails,
            req_data={
                "id": reg_req.id,
                "full_name": clean_full_name,
                "username": clean_username,
                "email": clean_email,
                "department": clean_department,
                "reason": clean_reason,
            }
        )
    except Exception as e:
        logger.error(f"Failed to dispatch reviewer registration notification: {e}")

    await record_audit_log(
        db,
        user=clean_username,
        action="REGISTRATION_SUBMITTED",
        resource=f"/api/v1/auth/register/{reg_req.id}",
        result="SUCCESS",
        metadata={
            "registration_id": reg_req.id,
            "department": clean_department,
            "masked_email": masked_email
        }
    )

    return RegistrationStatusResponse(
        id=reg_req.id,
        username=reg_req.username,
        masked_email=masked_email,
        status="PENDING",
        created_at=reg_req.created_at,
        reviewed_at=reg_req.reviewed_at,
        rejection_reason=reg_req.rejection_reason,
        message="Registration request submitted successfully. Your account is pending approval by an administrator or senior analyst."
    )


@router.get("/registration-status/{request_id}", response_model=RegistrationStatusResponse)
async def get_registration_status(
    request_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Public lookup for applicant to check their registration request status.
    """
    stmt = select(RegistrationRequest).where(RegistrationRequest.id == request_id)
    req = (await db.execute(stmt)).scalars().first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registration request not found")

    masked_email = mfa_service.mask_email(req.email)
    if req.status == "APPROVED":
        msg = "Your registration request has been approved! You can now log in using your registered credentials."
    elif req.status == "REJECTED":
        msg = "Your registration request was not approved."
    else:
        msg = "Your registration request is waiting for approval by an administrator or senior analyst."

    return RegistrationStatusResponse(
        id=req.id,
        username=req.username,
        masked_email=masked_email,
        status=req.status,
        created_at=req.created_at,
        reviewed_at=req.reviewed_at,
        rejection_reason=req.rejection_reason,
        message=msg
    )


# ============================================================================
# FORGOT PASSWORD & PASSWORD RECOVERY ENDPOINTS
# ============================================================================

@router.post("/forgot-password/request", response_model=ForgotPasswordResponse)
async def forgot_password_request(
    req_in: ForgotPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Step 1 of Password Recovery:
    1. Look up user by registered email.
    2. Enforces generic anti-enumeration response if email does not exist or account is inactive.
    3. Generates a dynamic 6-digit OTP, stores salted cryptographic hash in password_reset_challenges.
    4. Delivers verification code to user's registered email via SMTP.
    """
    clean_email = req_in.email.strip().lower()

    if not mfa_service.is_valid_production_email(clean_email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a valid real email address."
        )

    if not settings.is_email_configured and not mfa_service._test_mode and settings.ENVIRONMENT != "testing":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email delivery service is not configured on the server. Please configure RESEND_API_KEY (or SMTP credentials) in Render environment variables."
        )

    stmt = select(User).where(func.lower(User.email) == clean_email)
    user = (await db.execute(stmt)).scalars().first()

    now = datetime.now(timezone.utc)

    if user and user.is_active:
        # Rate limiting: max 5 requests per 10 minutes per user
        ten_mins_ago = now - timedelta(minutes=10)
        recent_stmt = select(func.count(PasswordResetChallenge.id)).where(
            PasswordResetChallenge.user_id == user.id,
            PasswordResetChallenge.created_at >= ten_mins_ago
        )
        recent_count = (await db.execute(recent_stmt)).scalar() or 0
        if recent_count >= 5:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many password reset attempts. Please wait 10 minutes before requesting again."
            )

        # Invalidate existing unused challenges for this user
        await db.execute(
            update(PasswordResetChallenge)
            .where(PasswordResetChallenge.user_id == user.id, PasswordResetChallenge.is_used == False)
            .values(is_used=True)
        )

        otp = mfa_service.generate_secure_otp()
        otp_hash = mfa_service.hash_otp(otp)
        challenge_id = uuid.uuid4().hex
        expires_at = now + timedelta(minutes=10)

        challenge = PasswordResetChallenge(
            challenge_id=challenge_id,
            user_id=user.id,
            otp_hash=otp_hash,
            created_at=now,
            expires_at=expires_at,
            attempt_count=0,
            resend_count=0,
            is_verified=False,
            is_used=False,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        db.add(challenge)
        await db.commit()

        sent_ok, send_err = await mfa_service.send_password_reset_otp_email(
            recipient_email=user.email,
            otp=otp,
            recipient_name=user.full_name
        )

        if not sent_ok:
            logger.error(f"Password reset OTP SMTP delivery failed for {mfa_service.mask_email(user.email)}: {send_err}")
            challenge.is_used = True
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Unable to send verification code email: {send_err}"
            )

        await record_audit_log(
            db,
            user=user.username,
            action="PASSWORD_RESET_REQUESTED",
            resource="/api/v1/auth/forgot-password/request",
            result="SUCCESS",
            metadata={"masked_email": mfa_service.mask_email(user.email)}
        )

        return ForgotPasswordResponse(
            message="If the email address is registered, a verification code has been sent.",
            challenge_id=challenge_id,
            masked_email=mfa_service.mask_email(user.email),
            expires_in=600
        )
    else:
        # Check if there is a pending registration request for this email
        stmt_pending = select(RegistrationRequest).where(
            func.lower(RegistrationRequest.email) == clean_email
        ).order_by(RegistrationRequest.created_at.desc())
        pending_req = (await db.execute(stmt_pending)).scalars().first()

        if pending_req and pending_req.status == "PENDING":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A registration request for this email is currently pending administrator approval. Please wait for your account to be approved before resetting your password."
            )

        # Anti-enumeration response: Generic message even if user does not exist
        return ForgotPasswordResponse(
            message="If the email address is registered, a verification code has been sent.",
            challenge_id=None,
            masked_email=mfa_service.mask_email(clean_email),
            expires_in=600
        )


@router.post("/forgot-password/verify", response_model=ForgotPasswordVerifyResponse)
async def forgot_password_verify(
    verify_in: ForgotPasswordVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Step 2 of Password Recovery:
    Validates the 6-digit OTP against stored salted hash.
    On success, generates a cryptographically secure single-use reset_token valid for 15 minutes.
    """
    stmt = select(PasswordResetChallenge).where(
        PasswordResetChallenge.challenge_id == verify_in.challenge_id,
        PasswordResetChallenge.is_used == False
    )
    challenge = (await db.execute(stmt)).scalars().first()

    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired recovery session. Please request a new verification code."
        )

    now = datetime.now(timezone.utc)
    challenge_exp = challenge.expires_at
    if challenge_exp.tzinfo is None:
        challenge_exp = challenge_exp.replace(tzinfo=timezone.utc)

    if challenge_exp < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new code."
        )

    if challenge.attempt_count >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Maximum verification attempts exceeded. Please request a new verification code."
        )

    if not mfa_service.verify_otp_hash(verify_in.otp.strip(), challenge.otp_hash):
        challenge.attempt_count += 1
        await db.commit()
        remaining = max(0, 5 - challenge.attempt_count)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid verification code. {remaining} attempt(s) remaining."
        )

    # Valid OTP: issue single-use reset_token
    reset_token = secrets.token_urlsafe(32)
    challenge.is_verified = True
    challenge.reset_token = reset_token
    challenge.reset_token_expires_at = now + timedelta(minutes=15)
    await db.commit()

    await record_audit_log(
        db,
        user=f"user_id:{challenge.user_id}",
        action="PASSWORD_RESET_OTP_VERIFIED",
        resource="/api/v1/auth/forgot-password/verify",
        result="SUCCESS",
        metadata={"challenge_id": challenge.challenge_id}
    )

    return ForgotPasswordVerifyResponse(
        message="Email verification successful. You may now set a new password.",
        reset_token=reset_token
    )


@router.post("/forgot-password/resend")
async def forgot_password_resend(
    resend_in: ForgotPasswordResendRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Resend dynamic 6-digit OTP code for active recovery session (max 3 resends).
    """
    stmt = select(PasswordResetChallenge).where(
        PasswordResetChallenge.challenge_id == resend_in.challenge_id,
        PasswordResetChallenge.is_used == False
    )
    challenge = (await db.execute(stmt)).scalars().first()

    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid recovery session. Please request a new code."
        )

    if challenge.resend_count >= 3:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Maximum resend limit reached for this session. Please start a new password recovery request."
        )

    user_stmt = select(User).where(User.id == challenge.user_id)
    user = (await db.execute(user_stmt)).scalars().first()
    if not user or not user.email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to resend code.")

    new_otp = mfa_service.generate_secure_otp()
    challenge.otp_hash = mfa_service.hash_otp(new_otp)
    challenge.resend_count += 1
    challenge.expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    await db.commit()

    sent_ok, send_err = await mfa_service.send_password_reset_otp_email(
        recipient_email=user.email,
        otp=new_otp,
        recipient_name=user.full_name
    )

    if not sent_ok:
        if not settings.is_email_configured:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Email delivery service is not configured on the server. Please configure RESEND_API_KEY (or SMTP credentials) in Render environment variables."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Unable to resend verification code email: {send_err}"
            )

    return {
        "message": "A new verification code has been dispatched to your registered email.",
        "challenge_id": challenge.challenge_id,
        "expires_in": 600
    }


@router.post("/forgot-password/reset")
async def forgot_password_reset(
    reset_in: ForgotPasswordResetRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Step 3 of Password Recovery:
    Validates reset_token and password criteria, updates password in database, burns token.
    """
    if reset_in.new_password != reset_in.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password and confirmation password do not match."
        )

    if len(reset_in.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long."
        )

    stmt = select(PasswordResetChallenge).where(
        PasswordResetChallenge.reset_token == reset_in.reset_token,
        PasswordResetChallenge.is_verified == True,
        PasswordResetChallenge.is_used == False
    )
    challenge = (await db.execute(stmt)).scalars().first()

    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset session. Please request a new verification code."
        )

    now = datetime.now(timezone.utc)
    token_exp = challenge.reset_token_expires_at
    if token_exp and token_exp.tzinfo is None:
        token_exp = token_exp.replace(tzinfo=timezone.utc)

    if token_exp and token_exp < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset session has expired. Please request a new verification code."
        )

    # Retrieve user and update password
    user_stmt = select(User).where(User.id == challenge.user_id)
    user = (await db.execute(user_stmt)).scalars().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found."
        )

    user.hashed_password = get_password_hash(reset_in.new_password)
    challenge.is_used = True
    await db.commit()

    # Dispatch security confirmation email
    if user.email:
        try:
            await mfa_service.send_password_reset_success_email(
                recipient_email=user.email,
                recipient_name=user.full_name
            )
        except Exception as e:
            logger.error(f"Failed to dispatch password reset confirmation email: {e}")

    await record_audit_log(
        db,
        user=user.username,
        action="PASSWORD_RESET_SUCCESS",
        resource="/api/v1/auth/forgot-password/reset",
        result="SUCCESS",
        metadata={"email": mfa_service.mask_email(user.email)}
    )

    return {
        "message": "Password has been updated successfully. You may now sign in."
    }

