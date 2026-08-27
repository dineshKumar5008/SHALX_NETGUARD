import pytest
from httpx import AsyncClient
from backend.app.services.mfa_service import mfa_service


@pytest.fixture(autouse=True)
def setup_test_mode():
    mfa_service.set_test_mode(True)
    mfa_service.clear_test_inbox()
    yield
    mfa_service.clear_test_inbox()
    mfa_service.set_test_mode(False)


@pytest.mark.asyncio
async def test_forgot_password_generic_response_nonexistent_email(async_client: AsyncClient):
    """Anti-enumeration: Requesting a reset for non-existent email returns a generic success message."""
    res = await async_client.post("/api/v1/auth/forgot-password/request", json={
        "email": "nonexistent.user99@corporate.com"
    })
    assert res.status_code == 200
    data = res.json()
    assert "verification code has been sent" in data["message"]
    assert data["challenge_id"] is None


@pytest.mark.asyncio
async def test_forgot_password_request_delivers_dynamic_otp(async_client: AsyncClient):
    """Registered user receives a dynamic 6-digit OTP via SMTP without exposing the OTP in API response."""
    res = await async_client.post("/api/v1/auth/forgot-password/request", json={
        "email": "analyst@shalx-soc.com"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["challenge_id"] is not None
    assert "a****@shalx-soc.com" in data["masked_email"]

    # Ensure OTP is NEVER returned in the API response
    assert "otp" not in data

    # Check that OTP was delivered to test inbox
    delivered_otp = mfa_service.get_test_inbox_otp("analyst@shalx-soc.com")
    assert delivered_otp is not None
    assert len(delivered_otp) == 6
    assert delivered_otp.isdigit()


@pytest.mark.asyncio
async def test_forgot_password_verify_invalid_otp_and_attempt_limit(async_client: AsyncClient):
    """Entering invalid OTP increments attempts and rejects after 5 failed tries."""
    req_res = await async_client.post("/api/v1/auth/forgot-password/request", json={
        "email": "analyst@shalx-soc.com"
    })
    challenge_id = req_res.json()["challenge_id"]

    # 4 failed attempts
    for attempt in range(1, 5):
        bad_res = await async_client.post("/api/v1/auth/forgot-password/verify", json={
            "challenge_id": challenge_id,
            "otp": "000000"
        })
        assert bad_res.status_code == 400
        assert "Invalid verification code" in bad_res.json()["detail"]

    # 5th failed attempt
    bad_res_5 = await async_client.post("/api/v1/auth/forgot-password/verify", json={
        "challenge_id": challenge_id,
        "otp": "000000"
    })
    assert bad_res_5.status_code == 400

    # 6th attempt is locked out (429)
    locked_res = await async_client.post("/api/v1/auth/forgot-password/verify", json={
        "challenge_id": challenge_id,
        "otp": "000000"
    })
    assert locked_res.status_code == 429
    assert "Maximum verification attempts exceeded" in locked_res.json()["detail"]


@pytest.mark.asyncio
async def test_forgot_password_resend_otp(async_client: AsyncClient):
    """Resending OTP generates a new OTP and updates the recovery session."""
    req_res = await async_client.post("/api/v1/auth/forgot-password/request", json={
        "email": "analyst@shalx-soc.com"
    })
    challenge_id = req_res.json()["challenge_id"]
    otp_1 = mfa_service.get_test_inbox_otp("analyst@shalx-soc.com")

    # Resend OTP
    resend_res = await async_client.post("/api/v1/auth/forgot-password/resend", json={
        "challenge_id": challenge_id
    })
    assert resend_res.status_code == 200
    otp_2 = mfa_service.get_test_inbox_otp("analyst@shalx-soc.com")
    assert otp_2 is not None

    # Verify with new OTP
    verify_res = await async_client.post("/api/v1/auth/forgot-password/verify", json={
        "challenge_id": challenge_id,
        "otp": otp_2
    })
    assert verify_res.status_code == 200
    assert "reset_token" in verify_res.json()


@pytest.mark.asyncio
async def test_forgot_password_full_recovery_and_login_flow(async_client: AsyncClient):
    """Complete workflow: Request OTP -> Verify -> Reset Password -> Sign in with new credentials."""
    # 1. Step 1: Request Password Recovery
    req_res = await async_client.post("/api/v1/auth/forgot-password/request", json={
        "email": "analyst@shalx-soc.com"
    })
    assert req_res.status_code == 200
    challenge_id = req_res.json()["challenge_id"]

    delivered_otp = mfa_service.get_test_inbox_otp("analyst@shalx-soc.com")
    assert delivered_otp is not None

    # 2. Step 2: Verify Dynamic OTP
    verify_res = await async_client.post("/api/v1/auth/forgot-password/verify", json={
        "challenge_id": challenge_id,
        "otp": delivered_otp
    })
    assert verify_res.status_code == 200
    reset_token = verify_res.json()["reset_token"]
    assert reset_token is not None
    assert len(reset_token) > 20

    # 3. Step 3: Password Mismatch Validation
    mismatch_res = await async_client.post("/api/v1/auth/forgot-password/reset", json={
        "reset_token": reset_token,
        "new_password": "NewSecurePassword@2026!",
        "confirm_password": "DifferentPassword@2026!"
    })
    assert mismatch_res.status_code == 400
    assert "do not match" in mismatch_res.json()["detail"]

    # 4. Step 3: Password Policy Validation (< 8 chars)
    short_res = await async_client.post("/api/v1/auth/forgot-password/reset", json={
        "reset_token": reset_token,
        "new_password": "short",
        "confirm_password": "short"
    })
    assert short_res.status_code in [400, 422]

    # 5. Step 3: Successful Password Reset
    reset_res = await async_client.post("/api/v1/auth/forgot-password/reset", json={
        "reset_token": reset_token,
        "new_password": "NewSecurePassword@2026!",
        "confirm_password": "NewSecurePassword@2026!"
    })
    assert reset_res.status_code == 200
    assert "updated successfully" in reset_res.json()["message"]

    # 6. Verify single-use token: Reusing the same reset_token must fail
    reuse_res = await async_client.post("/api/v1/auth/forgot-password/reset", json={
        "reset_token": reset_token,
        "new_password": "AnotherPassword@2026!",
        "confirm_password": "AnotherPassword@2026!"
    })
    assert reuse_res.status_code == 400
    assert "Invalid or expired" in reuse_res.json()["detail"]

    # 7. Old password no longer works
    old_login_res = await async_client.post("/api/v1/auth/login", json={
        "username": "testanalyst",
        "password": "Password123!"
    })
    assert old_login_res.status_code == 401

    # 8. Sign in with NEW password and complete email MFA
    new_login_res = await async_client.post("/api/v1/auth/login", json={
        "username": "testanalyst",
        "password": "NewSecurePassword@2026!"
    })
    assert new_login_res.status_code == 200
    login_data = new_login_res.json()
    assert login_data["mfa_required"] is True
    login_challenge_id = login_data["challenge_id"]

    # Get MFA login OTP
    mfa_otp = mfa_service.get_test_inbox_otp("analyst@shalx-soc.com")
    assert mfa_otp is not None

    # Verify MFA OTP to get access token
    mfa_verify_res = await async_client.post("/api/v1/auth/verify-mfa", json={
        "challenge_id": login_challenge_id,
        "otp": mfa_otp
    })
    assert mfa_verify_res.status_code == 200
    token_data = mfa_verify_res.json()
    assert "access_token" in token_data
    assert token_data["username"] == "testanalyst"
