import os
import pytest
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.app.core.database import Base, get_db
from backend.app.core.security import get_password_hash

# Import all models to ensure complete metadata registration
from backend.app.models.user import User
from backend.app.models.mfa import MFAChallenge
from backend.app.models.device import Device, NetworkInterface
from backend.app.models.alert import Alert
from backend.app.models.incident import Incident, IncidentTimeline
from backend.app.models.metrics import HealthMetric, TrafficMetric, AgentHeartbeat
from backend.app.models.firewall import BlockedIP, FirewallRule
from backend.app.models.security_event import SecurityEvent
from backend.app.models.audit import AuditLog

from backend.app.main import app

TEST_DB_FILE = "./test_netguard.db"
TEST_DB_URL = f"sqlite+aiosqlite:///{TEST_DB_FILE}"

test_engine = create_async_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
)

TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest.fixture(autouse=True)
async def setup_db():
    from backend.app.services.mfa_service import mfa_service
    mfa_service.set_test_mode(True)
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    async with TestSessionLocal() as session:
        admin = User(
            username="testadmin",
            email="admin@shalx-soc.com",
            full_name="Test Admin",
            hashed_password=get_password_hash("Password123!"),
            role="ADMIN",
            is_active=True
        )
        analyst = User(
            username="testanalyst",
            email="analyst@shalx-soc.com",
            full_name="Test Analyst",
            hashed_password=get_password_hash("Password123!"),
            role="ANALYST",
            is_active=True
        )
        viewer = User(
            username="testviewer",
            email="viewer@shalx-soc.com",
            full_name="Test Viewer",
            hashed_password=get_password_hash("Password123!"),
            role="VIEWER",
            is_active=True
        )
        session.add_all([admin, analyst, viewer])
        await session.commit()

    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


from backend.app.services.mfa_service import mfa_service
from sqlalchemy.future import select

async def perform_test_login(async_client: AsyncClient, username: str, password: str = "Password123!") -> str:
    """Helper for tests to perform full 2-step MFA login."""
    login_resp = await async_client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password}
    )
    assert login_resp.status_code == 200
    data = login_resp.json()
    assert data.get("mfa_required") is True
    challenge_id = data["challenge_id"]
    
    async with TestSessionLocal() as db:
        user = (await db.execute(select(User).where(User.username == username))).scalars().first()
        user_email = user.email
        
    otp = mfa_service.get_test_inbox_otp(user_email)
    assert otp is not None
    
    verify_resp = await async_client.post(
        "/api/v1/auth/verify-mfa",
        json={"challenge_id": challenge_id, "otp": otp}
    )
    assert verify_resp.status_code == 200
    return verify_resp.json()["access_token"]
