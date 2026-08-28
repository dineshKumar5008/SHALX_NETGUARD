import os
from pathlib import Path
from typing import List, Optional
from dotenv import load_dotenv
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator

# Automatically discover and load .env file
_root_dir = Path(__file__).resolve().parent.parent.parent.parent
_env_candidates = [
    Path.cwd() / ".env",
    _root_dir / ".env",
    Path(__file__).resolve().parent.parent.parent / ".env",
]
for _env_path in _env_candidates:
    if _env_path.exists():
        load_dotenv(dotenv_path=str(_env_path), override=False)


class Settings(BaseSettings):
    PROJECT_NAME: str = "SHALX NETGUARD"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = Field(default="prod", description="prod, dev, testing")
    API_V1_STR: str = "/api/v1"
    
    # Security / Auth
    SECRET_KEY: str = Field(
        default="netguard-super-secret-production-grade-key-2026-soc-defense",
        description="JWT Secret Key"
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    AGENT_AUTH_TOKEN: str = "netguard-agent-secret-auth-token-2026"

    # Multi-Factor Authentication (MFA / OTP) Policies
    MFA_OTP_EXPIRE_MINUTES: int = 5
    MFA_MAX_VERIFY_ATTEMPTS: int = 5
    MFA_MAX_RESENDS_PER_WINDOW: int = 3
    MFA_RESEND_WINDOW_MINUTES: int = 10
    ADMIN_EMAIL: Optional[str] = Field(
        default=None,
        description="Real registered destination email address for administrator account MFA delivery"
    )

    # Server & Hosting
    HOST: str = Field(default="0.0.0.0", description="Production bind host")
    PORT: int = Field(default=8000, description="Production bind port")
    FRONTEND_URL: Optional[str] = Field(
        default=None,
        description="Public frontend URL (e.g. https://netguard.example.com)"
    )
    CORS_ORIGINS: Optional[str] = Field(
        default=None,
        description="Comma-separated additional allowed CORS origins"
    )
    CORS_ORIGIN_REGEX: Optional[str] = Field(
        default=r"^https:\/\/.*\.onrender\.com$",
        description="Regex pattern for dynamic allowed CORS origins (e.g. Render deployments)"
    )

    # Storage
    REPORTS_STORAGE_PATH: str = Field(
        default="./reports_storage",
        description="Directory for persistent PDF report storage"
    )

    # Database
    DATABASE_URL: str = Field(
        default="sqlite+aiosqlite:///./netguard.db",
        description="Async database connection string (SQLite or PostgreSQL)"
    )

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: Optional[str]) -> str:
        if not v:
            return "sqlite+aiosqlite:///./netguard.db"
        val = str(v).strip()
        if val.startswith("postgres://"):
            return val.replace("postgres://", "postgresql+asyncpg://", 1)
        if val.startswith("postgresql://") and not val.startswith("postgresql+asyncpg://"):
            return val.replace("postgresql://", "postgresql+asyncpg://", 1)
        return val

    # Baseline Development & Local CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    @property
    def cors_origins_list(self) -> List[str]:
        """Dynamically compute allowed CORS origins from defaults and environment variables."""
        origins = list(self.BACKEND_CORS_ORIGINS)
        
        # Include deployed frontend & backend known hostnames
        known_defaults = [
            "https://netguard-frontend-lgxp.onrender.com",
            "https://netguard-backend-9ozq.onrender.com",
        ]
        for kd in known_defaults:
            if kd not in origins:
                origins.append(kd)

        if self.FRONTEND_URL:
            clean_fe = self.FRONTEND_URL.strip().rstrip("/")
            if clean_fe:
                if clean_fe not in origins:
                    origins.append(clean_fe)
                if not clean_fe.startswith("http://") and not clean_fe.startswith("https://"):
                    origins.append(f"https://{clean_fe}")
                    origins.append(f"http://{clean_fe}")
        if self.CORS_ORIGINS:
            for item in self.CORS_ORIGINS.split(","):
                clean_item = item.strip().rstrip("/")
                if clean_item:
                    if clean_item not in origins:
                        origins.append(clean_item)
                    if not clean_item.startswith("http://") and not clean_item.startswith("https://"):
                        origins.append(f"https://{clean_item}")
                        origins.append(f"http://{clean_item}")
        return origins



    # Monitored Networks (CIDRs) - Defaults to empty so discovery dynamically inspects active host interface subnets
    MONITORED_NETWORKS: List[str] = []

    # IDS Ingestion Paths
    SURICATA_EVE_PATH: str = Field(
        default="./logs/suricata/eve.json",
        description="Path to Suricata EVE JSON log file"
    )
    ZEEK_LOG_PATH: str = Field(
        default="./logs/zeek",
        description="Directory containing Zeek logs (conn.log, dns.log, etc.)"
    )

    # Firewall Integration (pfSense)
    FIREWALL_PROVIDER: str = Field(default="mock", description="'pfsense' or 'mock'")
    PFSENSE_URL: str = "https://192.168.1.1"
    PFSENSE_API_KEY: Optional[str] = None
    PFSENSE_API_SECRET: Optional[str] = None
    PFSENSE_VERIFY_SSL: bool = False
    
    # Critical Infrastructure Allowlist (Never block these IPs automatically or manually without explicit force)
    PROTECTED_IPS: List[str] = [
        "127.0.0.1",
        "::1",
        "8.8.8.8",         # Primary DNS
        "1.1.1.1",         # Cloudflare DNS
    ]

    # Notifications & Real SMTP Delivery
    NOTIFICATION_PROVIDER: str = Field(default="mock", description="'real' or 'mock'")
    TELEGRAM_BOT_TOKEN: Optional[str] = None
    TELEGRAM_CHAT_ID: Optional[str] = None
    
    # SMTP / Real Email Configuration
    SMTP_HOST: Optional[str] = Field(default=None, description="SMTP server host (e.g. smtp.gmail.com)")
    SMTP_PORT: int = Field(default=587, description="SMTP port (587 for TLS, 465 for SSL)")
    SMTP_USERNAME: Optional[str] = Field(default=None, description="SMTP username / email")
    SMTP_USER: Optional[str] = Field(default=None, description="Legacy alias for SMTP username")
    SMTP_PASSWORD: Optional[str] = Field(default=None, description="SMTP password / app password")
    SMTP_FROM_EMAIL: str = Field(default="security@shalx-netguard.com", description="Sender email address")
    SMTP_FROM_NAME: str = Field(default="SHALX NETGUARD Security", description="Sender display name")
    SMTP_USE_TLS: bool = Field(default=True, description="Enable STARTTLS")
    SMTP_USE_SSL: bool = Field(default=False, description="Enable SSL direct connection")

    @property
    def effective_smtp_user(self) -> Optional[str]:
        return self.SMTP_USERNAME or self.SMTP_USER

    # Health Thresholds
    CPU_WARNING_THRESHOLD: float = 70.0
    CPU_CRITICAL_THRESHOLD: float = 90.0
    RAM_WARNING_THRESHOLD: float = 75.0
    RAM_CRITICAL_THRESHOLD: float = 90.0
    DISK_WARNING_THRESHOLD: float = 80.0
    DISK_CRITICAL_THRESHOLD: float = 95.0

    # Auto Response Policy (Disabled by default for safety)
    AUTO_BLOCK_CRITICAL_ALERTS: bool = False
    AUTO_BLOCK_DURATION_MINUTES: int = 60

    model_config = {
        "env_file": [str(p) for p in _env_candidates if p.exists()] or ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore"
    }


settings = Settings()
