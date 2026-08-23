import logging
from typing import Optional, Dict, Any
from backend.app.notifications.base import NotificationProvider

logger = logging.getLogger("netguard.notifications.mock")


class MockNotificationProvider(NotificationProvider):
    """Mock notification provider for development & simulation."""

    async def send_notification(
        self,
        subject: str,
        message: str,
        severity: str = "HIGH",
        recipient: Optional[str] = None
    ) -> Dict[str, Any]:
        logger.info(
            f"[MOCK NOTIFICATION] Channel: Internal | Severity: {severity} | Recipient: {recipient or 'All SOC'} | "
            f"Subject: {subject} | Body: {message[:100]}..."
        )
        return {
            "success": True,
            "channel": "MOCK",
            "status": "SIMULATED",
            "subject": subject,
            "recipient": recipient or "configured-recipients",
            "message": "Notification successfully simulated in development mode."
        }
