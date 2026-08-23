import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, Any
from backend.app.core.config import settings
from backend.app.notifications.base import NotificationProvider

logger = logging.getLogger("netguard.notifications.email")


class EmailProvider(NotificationProvider):
    """SMTP Email notification provider."""

    async def send_notification(
        self,
        subject: str,
        message: str,
        severity: str = "HIGH",
        recipient: Optional[str] = None
    ) -> Dict[str, Any]:
        dest_email = recipient or settings.SMTP_USER
        if not settings.SMTP_HOST or not dest_email:
            logger.warning("SMTP host or recipient not configured.")
            return {
                "success": False,
                "error": "SMTP server or recipient is not configured."
            }

        msg = MIMEMultipart()
        msg["From"] = settings.SMTP_FROM_EMAIL
        msg["To"] = dest_email
        msg["Subject"] = f"[{severity}] [SHALX NETGUARD] {subject}"

        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 20px;">
            <div style="max-width: 600px; margin: auto; background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 20px;">
                <h2 style="color: {'#ef4444' if severity in ['HIGH', 'CRITICAL'] else '#f59e0b'};">🛡️ SHALX NETGUARD SECURITY ALERT ({severity})</h2>
                <h3 style="color: #38bdf8;">{subject}</h3>
                <div style="background-color: #0f172a; padding: 15px; border-radius: 6px; font-family: monospace; white-space: pre-wrap; color: #e2e8f0;">
                    {message}
                </div>
                <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">
                    This is an automated security advisory from SHALX NETGUARD SOC Monitoring Platform.
                </p>
            </div>
        </body>
        </html>
        """
        msg.attach(MIMEText(html_body, "html"))

        try:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                if settings.SMTP_USE_TLS:
                    server.starttls()
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM_EMAIL, [dest_email], msg.as_string())
            logger.info(f"Email notification successfully sent to {dest_email}")
            return {
                "success": True,
                "channel": "EMAIL",
                "recipient": dest_email,
                "status": "SENT"
            }
        except Exception as e:
            logger.error(f"Failed to send email notification: {e}")
            return {
                "success": False,
                "channel": "EMAIL",
                "error": str(e)
            }
