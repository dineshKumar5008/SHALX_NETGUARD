import pytest
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient
from sqlalchemy.future import select

from backend.app.models.user import User
from backend.app.models.mfa import MFAChallenge
from backend.app.services.mfa_service import mfa_service
from backend.tests.conftest import TestSessionLocal, perform_test_login


@pytest.mark.asyncio
async def test_auth_login_mfa_flow_success(async_client: AsyncClient):
    """Test full 2-step dynamic MFA login workflow with real registered email."""
    # Step 1: Initial Login
    login_resp = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "testadmin", "password": "Password123!"}
    )
    assert login_resp.status_code == 200
    data = login_resp.json()
    assert data["mfa_required"] is True
    assert "challenge_id" in data
    assert "a***@shalx-soc.com" in data["masked_email"]
    assert "access_token" not in data  # Access token must NOT be issued in Step 1

    challenge_id = data["challenge_id"]

    # Verify that the plaintext OTP is NOT stored in the database
    async with TestSessionLocal() as db:
        challenge = (await db.execute(
            select(MFAChallenge).where(MFAChallenge.challenge_id == challenge_id)
        )).scalars().first()
        assert challenge is not None
        assert challenge.is_used is False
        # OTP is securely hashed
        assert len(challenge.otp_hash) > 20
        assert not challenge.otp_hash.isdigit()

    # Step 2: Retrieve OTP from user's simulated email inbox
    otp = mfa_service.get_test_inbox_otp("admin@shalx-soc.com")
    assert otp is not None
    assert len(otp) == 6
    assert otp.isdigit()

    # Step 3: Verify OTP
    verify_resp = await async_client.post(
        "/api/v1/auth/verify-mfa",
        json={"challenge_id": challenge_id, "otp": otp}
    )
    assert verify_resp.status_code == 200
    token_data = verify_resp.json()
    assert "access_token" in token_data
    assert token_data["role"] == "ADMIN"
    assert token_data["username"] == "testadmin"

    # Step 4: Verify challenge is marked consumed in database
    async with TestSessionLocal() as db:
        ch_after = (await db.execute(
            select(MFAChallenge).where(MFAChallenge.challenge_id == challenge_id)
        )).scalars().first()
        assert ch_after.is_used is True


@pytest.mark.asyncio
async def test_auth_masked_email_formats():
    """Verify dynamic email masking logic for various real email formats."""
    assert mfa_service.mask_email("dinesh@gmail.com") == "d****@gmail.com"
    assert mfa_service.mask_email("admin@company.org") == "a***@company.org"
    assert mfa_service.mask_email("js@corp.io") == "j*@corp.io"


@pytest.mark.asyncio
async def test_auth_unconfigured_or_placeholder_email_rejected(async_client: AsyncClient):
    """Test that login is rejected when user has no real email or has a placeholder email."""
    # Create user with placeholder / unconfigured email
    async with TestSessionLocal() as db:
        unconfigured_user = User(
            username="unconfigured_user",
            email="fake_admin@netguard.local",
            full_name="Unconfigured User",
            hashed_password=mfa_service.hash_otp("Password123!"),
            role="ANALYST",
            is_active=True
        )
        db.add(unconfigured_user)
        await db.commit()

    response = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "unconfigured_user", "password": "Password123!"}
    )
    assert response.status_code == 400
    assert "does not have a verified real email" in response.json()["detail"]


@pytest.mark.asyncio
async def test_auth_setup_admin_email_flow(async_client: AsyncClient):
    """Test configuring the administrator's real email and logging in."""
    # 1. Update admin registered email
    setup_resp = await async_client.post(
        "/api/v1/auth/setup-admin-email",
        json={
            "username": "testadmin",
            "password": "Password123!",
            "real_email": "dinesh.soc@gmail.com"
        }
    )
    assert setup_resp.status_code == 200
    assert setup_resp.json()["success"] is True

    # 2. Verify database record updated
    async with TestSessionLocal() as db:
        admin = (await db.execute(
            select(User).where(User.username == "testadmin")
        )).scalars().first()
        assert admin.email == "dinesh.soc@gmail.com"

    # 3. Login with admin
    login_resp = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "testadmin", "password": "Password123!"}
    )
    assert login_resp.status_code == 200
    data = login_resp.json()
    assert "d****@gmail.com" in data["masked_email"]

    # 4. OTP arrived at the newly configured real email
    otp = mfa_service.get_test_inbox_otp("dinesh.soc@gmail.com")
    assert otp is not None

    # 5. Verify OTP
    verify_resp = await async_client.post(
        "/api/v1/auth/verify-mfa",
        json={"challenge_id": data["challenge_id"], "otp": otp}
    )
    assert verify_resp.status_code == 200
    assert "access_token" in verify_resp.json()


@pytest.mark.asyncio
async def test_auth_dynamic_otp_uniqueness():
    """Verify that every generated OTP is dynamic, unique, and unpredictable."""
    otps = set()
    for _ in range(50):
        otp = mfa_service.generate_secure_otp()
        assert len(otp) == 6
        assert otp.isdigit()
        otps.add(otp)
    # 50 random 6-digit codes should produce at least 48 distinct values
    assert len(otps) >= 48


@pytest.mark.asyncio
async def test_auth_login_invalid_credentials(async_client: AsyncClient):
    """Test that incorrect credentials are rejected immediately."""
    response = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "testadmin", "password": "WrongPassword!"}
    )
    assert response.status_code == 401
    assert "Incorrect username or password" in response.json()["detail"]


@pytest.mark.asyncio
async def test_auth_verify_invalid_otp(async_client: AsyncClient):
    """Test that incorrect OTP is rejected with remaining attempts decrement."""
    # Step 1: Login
    login_resp = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "testadmin", "password": "Password123!"}
    )
    challenge_id = login_resp.json()["challenge_id"]

    # Step 2: Attempt wrong OTP
    verify_resp = await async_client.post(
        "/api/v1/auth/verify-mfa",
        json={"challenge_id": challenge_id, "otp": "000000"}
    )
    assert verify_resp.status_code == 400
    assert "Invalid verification code" in verify_resp.json()["detail"]
    assert "4 attempt(s) remaining" in verify_resp.json()["detail"]


@pytest.mark.asyncio
async def test_auth_otp_single_use(async_client: AsyncClient):
    """Test that an OTP cannot be reused once consumed."""
    login_resp = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "testadmin", "password": "Password123!"}
    )
    challenge_id = login_resp.json()["challenge_id"]
    otp = mfa_service.get_test_inbox_otp("admin@shalx-soc.com")

    # First verification -> Success
    res1 = await async_client.post(
        "/api/v1/auth/verify-mfa",
        json={"challenge_id": challenge_id, "otp": otp}
    )
    assert res1.status_code == 200

    # Second verification with same OTP -> Rejected
    res2 = await async_client.post(
        "/api/v1/auth/verify-mfa",
        json={"challenge_id": challenge_id, "otp": otp}
    )
    assert res2.status_code == 400
    assert "already been used" in res2.json()["detail"]


@pytest.mark.asyncio
async def test_auth_resend_mfa_generates_new_otp(async_client: AsyncClient):
    """Test that Resend Code invalidates previous OTP and generates a completely NEW OTP."""
    # Initial Login
    login_resp = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "testanalyst", "password": "Password123!"}
    )
    old_challenge_id = login_resp.json()["challenge_id"]
    old_otp = mfa_service.get_test_inbox_otp("analyst@shalx-soc.com")

    # Resend Code
    resend_resp = await async_client.post(
        "/api/v1/auth/resend-mfa",
        json={"challenge_id": old_challenge_id}
    )
    assert resend_resp.status_code == 200
    new_data = resend_resp.json()
    new_challenge_id = new_data["challenge_id"]
    assert new_challenge_id != old_challenge_id

    new_otp = mfa_service.get_test_inbox_otp("analyst@shalx-soc.com")
    assert new_otp is not None

    # Verify old OTP fails on old challenge
    old_verify = await async_client.post(
        "/api/v1/auth/verify-mfa",
        json={"challenge_id": old_challenge_id, "otp": old_otp}
    )
    assert old_verify.status_code == 400

    # Verify new OTP succeeds on new challenge
    new_verify = await async_client.post(
        "/api/v1/auth/verify-mfa",
        json={"challenge_id": new_challenge_id, "otp": new_otp}
    )
    assert new_verify.status_code == 200
    assert "access_token" in new_verify.json()


@pytest.mark.asyncio
async def test_auth_me_endpoint_with_mfa(async_client: AsyncClient):
    """Test accessing protected /me endpoint with token obtained from MFA verification."""
    token = await perform_test_login(async_client, username="testadmin", password="Password123!")

    me_resp = await async_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["username"] == "testadmin"
    assert me_data["role"] == "ADMIN"


@pytest.mark.asyncio
async def test_auth_smtp_missing_error_handling(async_client: AsyncClient):
    """Test that login returns clear 503 error when SMTP is unconfigured in live mode."""
    from backend.app.core.config import settings
    mfa_service.set_test_mode(False)
    original_host = settings.SMTP_HOST
    settings.SMTP_HOST = None

    try:
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"username": "testadmin", "password": "Password123!"}
        )
        assert response.status_code == 503
        assert "Email delivery is not configured" in response.json()["detail"]
    finally:
        settings.SMTP_HOST = original_host
        mfa_service.set_test_mode(True)


@pytest.mark.asyncio
async def test_auth_rate_limit_reset_flow(async_client: AsyncClient):
    """Test triggering rate limit, clearing it via reset endpoint, and re-authenticating successfully."""
    # 1. Exhaust rate limit (3 requests)
    for _ in range(3):
        r = await async_client.post(
            "/api/v1/auth/login",
            json={"username": "testadmin", "password": "Password123!"}
        )
        assert r.status_code == 200

    # 4th request must be rate limited (429)
    blocked_resp = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "testadmin", "password": "Password123!"}
    )
    assert blocked_resp.status_code == 429

    # 2. Reset rate limit state with admin credentials
    reset_resp = await async_client.post(
        "/api/v1/auth/reset-rate-limit",
        json={"username": "testadmin", "password": "Password123!"}
    )
    assert reset_resp.status_code == 200
    assert reset_resp.json()["success"] is True

    # 3. Login attempt immediately succeeds with a NEW random OTP
    login_resp = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "testadmin", "password": "Password123!"}
    )
    assert login_resp.status_code == 200
    data = login_resp.json()
    assert data["mfa_required"] is True

    # 4. Verify OTP and complete login
    otp = mfa_service.get_test_inbox_otp("admin@shalx-soc.com")
    assert otp is not None
    verify_resp = await async_client.post(
        "/api/v1/auth/verify-mfa",
        json={"challenge_id": data["challenge_id"], "otp": otp}
    )
    assert verify_resp.status_code == 200
    assert "access_token" in verify_resp.json()


@pytest.mark.asyncio
async def test_auth_multiple_users_independent_mfa_routing(async_client: AsyncClient):
    """
    Verify that multiple distinct user accounts receive their OTPs exclusively at their own registered emails.
    Admin OTP -> admin email, Analyst OTP -> analyst email, Viewer OTP -> viewer email.
    """
    mfa_service.clear_test_inbox()

    # 1. Login as ADMIN
    admin_login = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "testadmin", "password": "Password123!"}
    )
    assert admin_login.status_code == 200
    admin_data = admin_login.json()
    assert "a***@shalx-soc.com" in admin_data["masked_email"]

    admin_otp = mfa_service.get_test_inbox_otp("admin@shalx-soc.com")
    assert admin_otp is not None
    assert mfa_service.get_test_inbox_otp("analyst@shalx-soc.com") is None
    assert mfa_service.get_test_inbox_otp("viewer@shalx-soc.com") is None

    # 2. Login as ANALYST
    analyst_login = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "testanalyst", "password": "Password123!"}
    )
    assert analyst_login.status_code == 200
    analyst_data = analyst_login.json()
    assert "a****@shalx-soc.com" in analyst_data["masked_email"]

    analyst_otp = mfa_service.get_test_inbox_otp("analyst@shalx-soc.com")
    assert analyst_otp is not None
    assert analyst_otp != admin_otp  # Must be uniquely generated

    # 3. Login as VIEWER
    viewer_login = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "testviewer", "password": "Password123!"}
    )
    assert viewer_login.status_code == 200
    viewer_data = viewer_login.json()
    assert "v****@shalx-soc.com" in viewer_data["masked_email"]

    viewer_otp = mfa_service.get_test_inbox_otp("viewer@shalx-soc.com")
    assert viewer_otp is not None
    assert viewer_otp != admin_otp
    assert viewer_otp != analyst_otp


@pytest.mark.asyncio
async def test_auth_user_creation_and_email_update_mfa_flow(async_client: AsyncClient):
    """
    Verify creating a new user with real email, updating the email, and verifying OTP delivery routes to updated email.
    """
    # 1. Login as ADMIN
    admin_token = await perform_test_login(async_client, username="testadmin", password="Password123!")

    # 2. Attempt creation with invalid email format (Must be rejected with 400)
    invalid_resp = await async_client.post(
        "/api/v1/users",
        json={
            "username": "baduser",
            "email": "invalid-email-format",
            "full_name": "Bad User",
            "password": "Password123!",
            "role": "ANALYST"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert invalid_resp.status_code == 400
    assert "Please enter a valid email address" in invalid_resp.json()["detail"]

    # 3. Create user with valid email
    create_resp = await async_client.post(
        "/api/v1/users",
        json={
            "username": "soc_lead",
            "email": "soc.lead.initial@shalx-soc.com",
            "full_name": "SOC Lead Engineer",
            "password": "Password123!",
            "role": "ANALYST"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert create_resp.status_code == 201
    created_user_id = create_resp.json()["id"]

    # 4. Update the newly created user's email
    update_resp = await async_client.put(
        f"/api/v1/users/{created_user_id}",
        json={"email": "soc.lead.updated@shalx-soc.com"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["email"] == "soc.lead.updated@shalx-soc.com"

    # 5. Login as the updated user
    mfa_service.clear_test_inbox()
    user_login = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "soc_lead", "password": "Password123!"}
    )
    assert user_login.status_code == 200
    login_data = user_login.json()
    assert "s****@shalx-soc.com" in login_data["masked_email"]

    # Verify OTP arrived at the UPDATED email address
    otp = mfa_service.get_test_inbox_otp("soc.lead.updated@shalx-soc.com")
    assert otp is not None
    assert mfa_service.get_test_inbox_otp("soc.lead.initial@shalx-soc.com") is None

    # Complete MFA login
    verify_resp = await async_client.post(
        "/api/v1/auth/verify-mfa",
        json={"challenge_id": login_data["challenge_id"], "otp": otp}
    )
    assert verify_resp.status_code == 200
    assert "access_token" in verify_resp.json()


