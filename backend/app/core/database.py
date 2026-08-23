import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
from backend.app.core.config import settings

logger = logging.getLogger("netguard.database")

# Determine engine parameters based on database dialect
connect_args = {}
if "sqlite" in settings.DATABASE_URL:
    connect_args["check_same_thread"] = False

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    connect_args=connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for yielding database sessions."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create all database tables on application startup and ensure schema consistency."""
    async with engine.begin() as conn:
        # 1. Ensure all tables are created
        await conn.run_sync(Base.metadata.create_all)

        # 2. Add is_synthetic columns if migrating existing SQLite tables
        if "sqlite" in settings.DATABASE_URL:
            try:
                await conn.execute(text("ALTER TABLE devices ADD COLUMN is_synthetic BOOLEAN DEFAULT 0"))
            except Exception:
                pass  # Column already exists
            try:
                await conn.execute(text("ALTER TABLE incidents ADD COLUMN is_synthetic BOOLEAN DEFAULT 0"))
            except Exception:
                pass  # Column already exists
            try:
                await conn.execute(text("ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 1"))
            except Exception:
                pass  # Column already exists
            try:
                await conn.execute(text("ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP"))
            except Exception:
                pass  # Column already exists

            # 4. Clean link-local and virtual adapter duplicate devices
            try:
                await conn.execute(text("""
                    DELETE FROM devices 
                    WHERE ip_address LIKE '169.254.%' 
                       OR ip_address IN ('192.168.56.1', '172.30.205.46')
                """))
            except Exception as e:
                logger.debug(f"Link-local cleanup notice: {e}")

            # 5. Clean legacy placeholder emails from existing user database
            try:
                if settings.ADMIN_EMAIL:
                    await conn.execute(
                        text("UPDATE users SET email = :admin_email WHERE username = 'admin'"),
                        {"admin_email": settings.ADMIN_EMAIL.strip()}
                    )
                await conn.execute(text("UPDATE users SET email = '' WHERE email LIKE '%@netguard.local'"))
            except Exception as e:
                logger.debug(f"Email placeholder cleanup notice: {e}")
