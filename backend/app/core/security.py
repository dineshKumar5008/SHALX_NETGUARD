import enum
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, APIKeyHeader
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.core.config import settings
from backend.app.core.database import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")
agent_api_key_header = APIKeyHeader(name="X-Agent-Token", auto_error=False)


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    SENIOR_ANALYST = "SENIOR_ANALYST"
    ANALYST = "ANALYST"
    VIEWER = "VIEWER"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against its bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """Generate bcrypt password hash."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
):
    """Dependency to retrieve and authenticate the current user from JWT."""
    from backend.app.models.user import User

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    
    username: str = payload.get("sub")
    if username is None:
        raise credentials_exception
    
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalars().first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def require_role(allowed_roles: List[UserRole]):
    """Role-Based Access Control dependency factory."""
    async def role_checker(current_user = Depends(get_current_user)):
        if current_user.role not in [role.value for role in allowed_roles] and current_user.role != UserRole.ADMIN.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: requires one of roles {[r.value for r in allowed_roles]}"
            )
        return current_user
    return role_checker


async def verify_agent_token(api_key: Optional[str] = Depends(agent_api_key_header)):
    """Authenticate incoming monitoring agent telemetry."""
    if not api_key or api_key != settings.AGENT_AUTH_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Agent-Token"
        )
    return True
