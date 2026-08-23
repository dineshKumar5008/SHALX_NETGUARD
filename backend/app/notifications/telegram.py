import httpx
import logging
from typing import Optional, Dict, Any
from backend.app.core.config import settings
from backend.app.notifications.base import NotificationProvider

logger = logging.getLogger("netguard.notifications.telegram")


class TelegramProvider(NotificationProvider):
    """Telegram Bot notification provider."""

    async def send_notification(
        self,
        subject: str,
        message: str,
        severity: str = "HIGH",
        recipient: Optional[str] = None
    ) -> Dict[str, Any]:
        token = settings.TELEGRAM_BOT_TOKEN
        chat_id = recipient or settings.TELEGRAM_CHAT_ID

        if not token or not chat_id:
            logger.warning("Telegram Bot Token or Chat ID not configured.")
            return {
                "success": False,
                "error": "Telegram Bot Token or Chat ID is not configured."
            }

        url = f"https://api.telegram.org/bot{token}/sendMessage"
        icon = "🔴" if severity == "CRITICAL" else ("🟠" if severity == "HIGH" else "🟡")
        
        text = (
            f"🚨 *SHALX NETGUARD SECURITY ALERT [{severity}]*\n"
            f"*Subject:* {subject}\n\n"
            f"```\n{message}\n```\n"
            f"_Automated Alert from SHALX NETGUARD SOC Engine_"
        )

        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "Markdown"
        }

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    logger.info(f"Telegram alert sent to chat {chat_id}")
                    return {
                        "success": True,
                        "channel": "TELEGRAM",
                        "recipient": chat_id,
                        "status": "SENT"
                    }
                else:
                    logger.error(f"Telegram API error: {resp.status_code} - {resp.text}")
                    return {
                        "success": False,
                        "channel": "TELEGRAM",
                        "error": f"Telegram API returned {resp.status_code}: {resp.text}"
                    }
        except Exception as e:
            logger.error(f"Telegram connection error: {e}")
            return {
                "success": False,
                "channel": "TELEGRAM",
                "error": str(e)
            }
