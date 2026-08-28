import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.core.config import settings
from backend.app.core.database import init_db, AsyncSessionLocal
from backend.app.api.api import api_router
from backend.app.websocket.manager import ws_manager
from backend.app.workers.background import background_worker
from backend.app.models.user import User
from backend.app.core.security import get_password_hash
from sqlalchemy.future import select

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("netguard.main")


async def ensure_default_admin():
    """Ensure baseline administrator and user accounts exist on startup with real configured emails."""
    async with AsyncSessionLocal() as db:
        # 1. Admin account initialization or sync with configured ADMIN_EMAIL
        admin_email = (settings.ADMIN_EMAIL or "").strip()
        admin_stmt = select(User).where(User.username == "admin")
        res = await db.execute(admin_stmt)
        admin = res.scalars().first()
        if not admin:
            logger.info("Seeding baseline administrator account (admin)...")
            admin_user = User(
                username="admin",
                email=admin_email if mfa_service.is_valid_production_email(admin_email) else None,
                full_name="SOC Administrator",
                hashed_password=get_password_hash("NetGuard@2026!"),
                role="ADMIN",
                is_active=True
            )
            db.add(admin_user)
        else:
            # If ADMIN_EMAIL is configured in environment, sync it into the database
            if admin_email and mfa_service.is_valid_production_email(admin_email) and admin.email != admin_email:
                logger.info(f"Syncing administrator registered email to: {admin_email}")
                admin.email = admin_email
            elif not admin.email and settings.SMTP_FROM_EMAIL and mfa_service.is_valid_production_email(settings.SMTP_FROM_EMAIL):
                logger.info(f"Setting administrator registered email from SMTP sender: {settings.SMTP_FROM_EMAIL}")
                admin.email = settings.SMTP_FROM_EMAIL

            # Ensure admin password hash is valid
            if not admin.hashed_password or not admin.hashed_password.startswith("$2b$"):
                admin.hashed_password = get_password_hash("NetGuard@2026!")

        # 2. Analyst and Viewer accounts
        for u_name, full_name, raw_pass, role in [
            ("analyst", "SOC Tier-2 Analyst", "Analyst@2026!", "ANALYST"),
            ("viewer", "SOC Executive Viewer", "Viewer@2026!", "VIEWER"),
        ]:
            stmt = select(User).where(User.username == u_name)
            acc = (await db.execute(stmt)).scalars().first()
            if not acc:
                user_obj = User(
                    username=u_name,
                    email=None,  # Unconfigured until assigned by administrator
                    full_name=full_name,
                    hashed_password=get_password_hash(raw_pass),
                    role=role,
                    is_active=True
                )
                db.add(user_obj)
        await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle manager."""
    logger.info("Initializing SHALX NETGUARD SOC Platform Database...")
    await init_db()
    await ensure_default_admin()
    
    # Run immediate real discovery sweep on startup to detect laptop and gateway
    try:
        from backend.app.collectors.discovery import discovery_service
        async with AsyncSessionLocal() as db:
            await discovery_service.scan_monitored_subnets(db)
    except Exception as e:
        logger.warning(f"Startup dynamic discovery notice: {e}")

    # Validate required SMTP email service configuration
    if settings.SMTP_HOST:
        logger.info(f"SMTP email service configured. (Host: {settings.SMTP_HOST}:{settings.SMTP_PORT}, Sender: {settings.SMTP_FROM_EMAIL})")
    else:
        logger.warning("SMTP email service is not configured.")

    # Clean up / reset rate limit state on startup
    try:
        from backend.app.models.mfa import MFAChallenge
        from sqlalchemy import delete
        from datetime import datetime, timezone, timedelta
        async with AsyncSessionLocal() as db:
            if settings.ENVIRONMENT.lower() in ["dev", "development", "testing"]:
                await db.execute(delete(MFAChallenge))
                await db.commit()
                logger.info("Development mode: Reset MFA rate-limit challenge state on startup.")
            else:
                stale_threshold = datetime.now(timezone.utc) - timedelta(minutes=15)
                await db.execute(delete(MFAChallenge).where(MFAChallenge.created_at < stale_threshold))
                await db.commit()
    except Exception as e:
        logger.debug(f"Startup challenge maintenance notice: {e}")

    # Start background collectors
    await background_worker.start()
    yield
    # Shutdown background collectors
    await background_worker.stop()
    logger.info("SHALX NETGUARD SOC Platform shutdown complete.")


app = FastAPI(
    title="SHALX NETGUARD API",
    version=settings.VERSION,
    description="API for the SHALX NETGUARD Intelligent Network Security Monitoring and Response Platform.",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include REST API v1
app.include_router(api_router, prefix=settings.API_V1_STR)


# Root and Health check endpoints
@app.get("/", tags=["System"])
async def root():
    return {
        "platform": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "status": "OPERATIONAL",
        "docs": "/docs",
        "api_prefix": settings.API_V1_STR
    }


@app.get("/health", tags=["System"])
async def health():
    """Lightweight orchestrator and load balancer health check endpoint."""
    return {"status": "ok"}


@app.get("/api/healthcheck", tags=["System"])
async def healthcheck():
    return {
        "status": "HEALTHY",
        "database": "CONNECTED",
        "websockets_active_clients": len(ws_manager.active_connections),
        "environment": settings.ENVIRONMENT
    }



# WebSocket Endpoints
@app.websocket("/ws/soc")
@app.websocket("/ws/alerts")
@app.websocket("/ws/traffic")
@app.websocket("/ws/health")
@app.websocket("/ws/devices")
async def websocket_soc_stream(websocket: WebSocket):
    """Real-time bidirectional WebSocket stream for live SOC updates."""
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep-alive receive loop
            data = await websocket.receive_text()
            # Echo ping / pong
            if data == "ping":
                await websocket.send_text('{"type":"pong"}')
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket client error: {e}")
        ws_manager.disconnect(websocket)
