import logging
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.config import settings
from backend.app.notifications.base import NotificationProvider
from backend.app.notifications.mock import MockNotificationProvider
from backend.app.notifications.email import EmailProvider
from backend.app.notifications.telegram import TelegramProvider
from backend.app.models.notification import NotificationLog
from datetime import datetime, timezone

logger = logging.getLogger("netguard.notifications")


class NotificationService:
    """Dispatches alerts across configured notification providers and logs results."""

    def __init__(self):
        self.mock_provider = MockNotificationProvider()
        self.email_provider = EmailProvider()
        self.telegram_provider = TelegramProvider()

    async def dispatch(
        self,
        db: Optional[AsyncSession],
        subject: str,
        message: str,
        severity: str = "HIGH"
    ) -> List[Dict[str, Any]]:
        results = []

        # Severity Routing:
        # LOW -> Dashboard only (no external dispatch)
        # MEDIUM -> Dashboard + optional Email
        # HIGH -> Dashboard + Email + Telegram
        # CRITICAL -> Dashboard + Email + Telegram

        if severity == "LOW":
            return results

        channels_to_notify = []
        if severity in ["MEDIUM", "HIGH", "CRITICAL"]:
            if settings.NOTIFICATION_PROVIDER == "real":
                if settings.SMTP_HOST and settings.SMTP_USER:
                    channels_to_notify.append(("EMAIL", self.email_provider))
            else:
                channels_to_notify.append(("MOCK", self.mock_provider))

        if severity in ["HIGH", "CRITICAL"]:
            if settings.NOTIFICATION_PROVIDER == "real":
                if settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID:
                    channels_to_notify.append(("TELEGRAM", self.telegram_provider))

        for channel_name, provider in channels_to_notify:
            try:
                res = await provider.send_notification(subject=subject, message=message, severity=severity)
                results.append(res)

                if db:
                    log_entry = NotificationLog(
                        timestamp=datetime.now(timezone.utc),
                        channel=channel_name,
                        recipient=res.get("recipient", "configured-default"),
                        subject=subject,
                        body=message,
                        status=res.get("status", "SENT" if res.get("success") else "FAILED"),
                        error_message=res.get("error")
                    )
                    db.add(log_entry)
                    await db.commit()
            except Exception as e:
                logger.error(f"Error dispatching notification via {channel_name}: {e}")
                results.append({"success": False, "channel": channel_name, "error": str(e)})

        return results


notification_service = NotificationService()
