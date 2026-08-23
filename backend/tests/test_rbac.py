import pytest
from httpx import AsyncClient
from backend.tests.conftest import perform_test_login


@pytest.mark.asyncio
async def test_rbac_user_management_access(async_client: AsyncClient):
    # Login as VIEWER using 2-step MFA
    viewer_token = await perform_test_login(async_client, username="testviewer", password="Password123!")

    # Attempt to create user as VIEWER (Should be 403 Forbidden)
    create_resp = await async_client.post(
        "/api/v1/users",
        json={
            "username": "hacker1",
            "email": "hacker@test.local",
            "full_name": "Hacker",
            "password": "Password123!",
            "role": "ADMIN"
        },
        headers={"Authorization": f"Bearer {viewer_token}"}
    )
    assert create_resp.status_code == 403

    # Login as ADMIN using 2-step MFA
    admin_token = await perform_test_login(async_client, username="testadmin", password="Password123!")

    # Create user as ADMIN (Should succeed with 201)
    admin_create_resp = await async_client.post(
        "/api/v1/users",
        json={
            "username": "validanalyst",
            "email": "valid@shalx-soc.com",
            "full_name": "Valid Analyst",
            "password": "Password123!",
            "role": "ANALYST"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert admin_create_resp.status_code == 201
    assert admin_create_resp.json()["username"] == "validanalyst"
