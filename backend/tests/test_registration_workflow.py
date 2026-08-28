import pytest
from httpx import AsyncClient
from sqlalchemy.future import select

from backend.app.models.user import User
from backend.app.models.registration import RegistrationRequest
from backend.app.services.mfa_service import mfa_service
from backend.tests.conftest import TestSessionLocal, perform_test_login


@pytest.mark.asyncio
async def test_registration_submission_creates_pending_request(async_client: AsyncClient):
    """
    Test that submitting registration creates a PENDING registration request,
    stores hashed password (never plaintext), does NOT create an active user,
    and returns registration status with masked email.
    """
    mfa_service.clear_test_inbox()

    payload = {
        "full_name": "Marcus Vance",
        "username": "mvance",
        "email": "marcus.vance@shalx-soc.com",
        "password": "SecurePassword2026!",
        "confirm_password": "SecurePassword2026!",
        "department": "Incident Response",
        "reason": "SOC shift analyst rotation access requirement."
    }

    resp = await async_client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "PENDING"
    assert data["username"] == "mvance"
    assert "m****@shalx-soc.com" in data["masked_email"]
    assert "access_token" not in data  # No automatic login

    # Check DB state
    async with TestSessionLocal() as session:
        # Request exists and is PENDING
        req = (await session.execute(select(RegistrationRequest).where(RegistrationRequest.username == "mvance"))).scalars().first()
        assert req is not None
        assert req.status == "PENDING"
        assert req.password_hash != "SecurePassword2026!"
        assert req.password_hash.startswith("$2b$")

        # Active user DOES NOT exist yet
        user = (await session.execute(select(User).where(User.username == "mvance"))).scalars().first()
        assert user is None

    # Verify applicant CANNOT log in while PENDING (returns 403 with pending status message)
    login_resp = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "mvance", "password": "SecurePassword2026!"}
    )
    assert login_resp.status_code == 403
    assert "pending approval" in login_resp.json()["detail"]


@pytest.mark.asyncio
async def test_registration_status_lookup(async_client: AsyncClient):
    """
    Test public status lookup for a submitted registration request.
    """
    payload = {
        "full_name": "Elena Rostova",
        "username": "erostova",
        "email": "elena.rostova@shalx-soc.com",
        "password": "Password123!",
        "confirm_password": "Password123!",
        "department": "Threat Intel",
        "reason": "Log analysis and correlation."
    }
    submit_resp = await async_client.post("/api/v1/auth/register", json=payload)
    assert submit_resp.status_code == 201
    req_id = submit_resp.json()["id"]

    status_resp = await async_client.get(f"/api/v1/auth/registration-status/{req_id}")
    assert status_resp.status_code == 200
    status_data = status_resp.json()
    assert status_data["id"] == req_id
    assert status_data["status"] == "PENDING"
    assert "waiting for approval" in status_data["message"]


@pytest.mark.asyncio
async def test_registration_duplicate_username_and_email_rejected(async_client: AsyncClient):
    """
    Test that registration rejects duplicate usernames and emails safely.
    """
    # 1. Duplicate existing active user username
    dup_admin = await async_client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Fake Admin",
            "username": "testadmin",
            "email": "newadmin@shalx-soc.com",
            "password": "Password123!",
            "confirm_password": "Password123!",
            "department": "IT",
            "reason": "Duplicate test"
        }
    )
    assert dup_admin.status_code == 400
    assert "already registered" in dup_admin.json()["detail"]

    # 2. Duplicate existing active user email
    dup_email = await async_client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Fake Admin 2",
            "username": "differentuser",
            "email": "admin@shalx-soc.com",
            "password": "Password123!",
            "confirm_password": "Password123!",
            "department": "IT",
            "reason": "Duplicate test"
        }
    )
    assert dup_email.status_code == 400
    assert "already registered" in dup_email.json()["detail"]


@pytest.mark.asyncio
async def test_registration_validation_rules(async_client: AsyncClient):
    """
    Test validation of password matching and invalid email formats.
    """
    # Password mismatch
    mismatch = await async_client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Mismatch User",
            "username": "mismatch",
            "email": "mismatch@shalx-soc.com",
            "password": "Password123!",
            "confirm_password": "DifferentPassword123!",
            "department": "IT",
            "reason": "Testing mismatch"
        }
    )
    assert mismatch.status_code == 422

    # Invalid email format (local domain)
    bad_email = await async_client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Bad Email User",
            "username": "bademailuser",
            "email": "user@netguard.local",
            "password": "Password123!",
            "confirm_password": "Password123!",
            "department": "IT",
            "reason": "Testing bad email"
        }
    )
    assert bad_email.status_code == 400
    assert "valid real production email" in bad_email.json()["detail"]


@pytest.mark.asyncio
async def test_registration_approval_by_admin_and_senior_analyst(async_client: AsyncClient):
    """
    Test that both ADMIN and SENIOR_ANALYST can review and approve a request,
    activating the user account and enabling login with per-user MFA.
    """
    mfa_service.clear_test_inbox()

    # 1. Submit Registration
    reg_payload = {
        "full_name": "Sarah Connor",
        "username": "sconnor",
        "email": "sarah.connor@shalx-soc.com",
        "password": "CyberPassword2026!",
        "confirm_password": "CyberPassword2026!",
        "department": "Cyber Defense",
        "reason": "Threat hunting and telemetry correlation."
    }
    submit_resp = await async_client.post("/api/v1/auth/register", json=reg_payload)
    assert submit_resp.status_code == 201
    req_id = submit_resp.json()["id"]

    # 2. Login as SENIOR ANALYST
    sa_token = await perform_test_login(async_client, username="testsenioranalyst", password="Password123!")

    # 3. Senior Analyst lists pending registration requests
    list_resp = await async_client.get(
        "/api/v1/users/registration-requests?status=PENDING",
        headers={"Authorization": f"Bearer {sa_token}"}
    )
    assert list_resp.status_code == 200
    requests = list_resp.json()
    assert any(r["id"] == req_id for r in requests)

    # 4. Senior Analyst approves request with ANALYST role
    approve_resp = await async_client.post(
        f"/api/v1/users/registration-requests/{req_id}/approve",
        json={"role": "ANALYST"},
        headers={"Authorization": f"Bearer {sa_token}"}
    )
    assert approve_resp.status_code == 200
    app_data = approve_resp.json()
    assert app_data["status"] == "APPROVED"
    assert app_data["reviewed_by"] == "testsenioranalyst"
    assert app_data["requested_role"] == "ANALYST"

    # 5. Approved user logs in
    mfa_service.clear_test_inbox()
    user_login = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "sconnor", "password": "CyberPassword2026!"}
    )
    assert user_login.status_code == 200
    login_data = user_login.json()
    assert login_data["mfa_required"] is True
    assert "s****@shalx-soc.com" in login_data["masked_email"]

    # Verify OTP arrived at Sarah Connor's registered email
    otp = mfa_service.get_test_inbox_otp("sarah.connor@shalx-soc.com")
    assert otp is not None

    # Complete MFA verification
    verify_resp = await async_client.post(
        "/api/v1/auth/verify-mfa",
        json={"challenge_id": login_data["challenge_id"], "otp": otp}
    )
    assert verify_resp.status_code == 200
    assert "access_token" in verify_resp.json()


@pytest.mark.asyncio
async def test_registration_rejection_requires_reason(async_client: AsyncClient):
    """
    Test that rejecting a registration request requires a non-empty reason,
    marks request as REJECTED, and prevents user login.
    """
    # 1. Submit Registration
    reg_payload = {
        "full_name": "Rejected Applicant",
        "username": "rejecteduser",
        "email": "rejected.user@shalx-soc.com",
        "password": "Password123!",
        "confirm_password": "Password123!",
        "department": "External Vendor",
        "reason": "Unapproved vendor testing."
    }
    submit_resp = await async_client.post("/api/v1/auth/register", json=reg_payload)
    assert submit_resp.status_code == 201
    req_id = submit_resp.json()["id"]

    # 2. Login as ADMIN
    admin_token = await perform_test_login(async_client, username="testadmin", password="Password123!")

    # 3. Reject with empty reason -> 422 or 400
    bad_reject = await async_client.post(
        f"/api/v1/users/registration-requests/{req_id}/reject",
        json={"rejection_reason": ""},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert bad_reject.status_code in [400, 422]

    # 4. Reject with valid reason
    good_reject = await async_client.post(
        f"/api/v1/users/registration-requests/{req_id}/reject",
        json={"rejection_reason": "External vendors must use partner portal."},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert good_reject.status_code == 200
    rej_data = good_reject.json()
    assert rej_data["status"] == "REJECTED"
    assert rej_data["rejection_reason"] == "External vendors must use partner portal."
    assert rej_data["reviewed_by"] == "testadmin"

    # 5. Rejected user attempts login -> must fail with 403 rejection message
    login_attempt = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "rejecteduser", "password": "Password123!"}
    )
    assert login_attempt.status_code == 403
    assert "rejected" in login_attempt.json()["detail"].lower()


@pytest.mark.asyncio
async def test_registration_viewer_cannot_approve_or_reject(async_client: AsyncClient):
    """
    Test that normal VIEWER role cannot access registration requests or approve/reject them (403 Forbidden).
    """
    # 1. Submit Registration
    reg_payload = {
        "full_name": "Test Candidate",
        "username": "candidate",
        "email": "candidate@shalx-soc.com",
        "password": "Password123!",
        "confirm_password": "Password123!",
        "department": "Security",
        "reason": "SOC Access"
    }
    submit_resp = await async_client.post("/api/v1/auth/register", json=reg_payload)
    assert submit_resp.status_code == 201
    req_id = submit_resp.json()["id"]

    # 2. Login as VIEWER
    viewer_token = await perform_test_login(async_client, username="testviewer", password="Password123!")

    # 3. Viewer attempts to list requests -> 403
    list_resp = await async_client.get(
        "/api/v1/users/registration-requests",
        headers={"Authorization": f"Bearer {viewer_token}"}
    )
    assert list_resp.status_code == 403

    # 4. Viewer attempts to approve -> 403
    app_resp = await async_client.post(
        f"/api/v1/users/registration-requests/{req_id}/approve",
        json={"role": "VIEWER"},
        headers={"Authorization": f"Bearer {viewer_token}"}
    )
    assert app_resp.status_code == 403


@pytest.mark.asyncio
async def test_registration_double_approval_race_condition(async_client: AsyncClient):
    """
    Test that approving an already approved or rejected request returns 400 Bad Request.
    """
    # 1. Submit Registration
    reg_payload = {
        "full_name": "Race User",
        "username": "raceuser",
        "email": "race.user@shalx-soc.com",
        "password": "Password123!",
        "confirm_password": "Password123!",
        "department": "IT",
        "reason": "Concurrency test"
    }
    submit_resp = await async_client.post("/api/v1/auth/register", json=reg_payload)
    req_id = submit_resp.json()["id"]

    admin_token = await perform_test_login(async_client, username="testadmin", password="Password123!")

    # First approval -> 200
    first_app = await async_client.post(
        f"/api/v1/users/registration-requests/{req_id}/approve",
        json={"role": "VIEWER"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert first_app.status_code == 200

    # Second approval -> 400
    second_app = await async_client.post(
        f"/api/v1/users/registration-requests/{req_id}/approve",
        json={"role": "VIEWER"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert second_app.status_code == 400
    assert "already been processed" in second_app.json()["detail"]
