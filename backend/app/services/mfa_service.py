import os
import secrets
import smtplib
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Tuple, Dict, Any

from backend.app.core.config import settings
from backend.app.core.security import get_password_hash, verify_password

logger = logging.getLogger("netguard.services.mfa")


class MFAService:
    """
    Cryptographically secure Multi-Factor Authentication (MFA) service.
    Generates dynamic random 6-digit OTPs, securely hashes them, and delivers them via real SMTP email.
    Plaintext OTPs are NEVER hardcoded, NEVER logged, and NEVER returned from APIs.
    """

    _test_inbox: Dict[str, str] = {}
    _test_mode: bool = False

    @classmethod
    def set_test_mode(cls, enabled: bool = True):
        """Enable or disable simulated test delivery mode for automated test suites."""
        cls._test_mode = enabled

    @classmethod
    def get_test_inbox_otp(cls, email: str) -> Optional[str]:
        """Retrieve the last delivered OTP from simulated test inbox for unit test verification."""
        return cls._test_inbox.get(email)

    @classmethod
    def clear_test_inbox(cls):
        """Clear test mailbox."""
        cls._test_inbox.clear()

    @staticmethod
    def generate_secure_otp() -> str:
        """
        Generate a cryptographically secure, unpredictable 6-digit numeric OTP.
        Uses secrets.randbelow to prevent PRNG predictability.
        """
        code_num = secrets.randbelow(900000) + 100000  # Always in range 100000-999999
        return f"{code_num:06d}"

    @staticmethod
    def hash_otp(otp: str) -> str:
        """Hash the OTP using standard salted cryptographic algorithm."""
        return get_password_hash(otp)

    @staticmethod
    def verify_otp_hash(plain_otp: str, hashed_otp: str) -> bool:
        """Verify the user-submitted plaintext OTP against the stored cryptographic hash."""
        if not plain_otp or not hashed_otp:
            return False
        return verify_password(plain_otp.strip(), hashed_otp)

    @staticmethod
    def is_valid_production_email(email: Optional[str]) -> bool:
        """
        Validate that the email address is a real, well-formed production email.
        Rejects empty values, invalid syntax, and development/placeholder domains (.local, .test, .example).
        """
        if not email or not isinstance(email, str):
            return False
        
        email = email.strip()
        # Basic RFC 5322 matching regex
        import re
        pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
        if not re.match(pattern, email):
            return False

        domain = email.split("@")[-1].lower()
        
        # Explicitly reject local/placeholder/mock domains
        invalid_tlds = [".local", ".test", ".example", ".invalid", ".localhost", ".internal"]
        if any(domain.endswith(tld) for tld in invalid_tlds):
            return False

        if domain in ["netguard.local", "test.local", "example.com", "example.org", "example.net"]:
            return False

        return True

    @staticmethod
    def mask_email(email: str) -> str:
        """
        Mask an email address for secure user presentation.
        Example: dinesh@gmail.com -> d****@gmail.com
                 admin@domain.com -> a***@domain.com
        """
        if not email or "@" not in email:
            return "******@unknown"
        
        user_part, domain_part = email.split("@", 1)
        user_len = len(user_part)

        if user_len <= 1:
            masked_user = f"{user_part}*"
        elif user_len <= 4:
            masked_user = f"{user_part[0]}{'*' * (user_len - 1)}"
        elif user_len == 5:
            masked_user = f"{user_part[0]}***"
        else:
            masked_user = f"{user_part[0]}****"

        return f"{masked_user}@{domain_part}"

    @classmethod
    async def send_otp_email(
        cls,
        recipient_email: str,
        otp: str,
        recipient_name: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Dispatch the dynamic 6-digit OTP to the user's verified registered email address via SMTP.
        Executes delivery in a background thread to prevent blocking asynchronous event loop.
        """
        cls._test_inbox[recipient_email] = otp
        if not recipient_email or "@" not in recipient_email:
            return False, "Invalid recipient email address"

        subject = "SHALX NETGUARD — Login Verification Code"
        name_display = recipient_name or "Security Operator"

        # 1. Plain text format (Exact match for requested specification)
        text_body = f"""SHALX NETGUARD

Your login verification code is:

{otp}

This code expires in 5 minutes.

If you did not attempt to log in, please secure your account.
"""

        # 2. HTML format (Professional SOC Dark Theme)
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                    background-color: #0a0d14;
                    color: #e2e8f0;
                    margin: 0;
                    padding: 30px 15px;
                }}
                .container {{
                    max-width: 520px;
                    margin: 0 auto;
                    background-color: #0f1422;
                    border: 1px solid #1e293b;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
                }}
                .header {{
                    background: linear-gradient(135deg, #0f172a 0%, #0369a1 100%);
                    padding: 24px;
                    text-align: center;
                    border-bottom: 2px solid #0284c7;
                }}
                .logo-title {{
                    font-size: 20px;
                    font-weight: 800;
                    letter-spacing: 1.5px;
                    color: #ffffff;
                    margin: 0;
                    font-family: 'Courier New', Courier, monospace;
                }}
                .subtitle {{
                    font-size: 11px;
                    color: #bae6fd;
                    letter-spacing: 1px;
                    margin-top: 4px;
                    text-transform: uppercase;
                }}
                .content {{
                    padding: 28px 24px;
                }}
                .greeting {{
                    font-size: 15px;
                    color: #f8fafc;
                    margin-bottom: 16px;
                }}
                .otp-box {{
                    background-color: #0a0d14;
                    border: 2px dashed #0284c7;
                    border-radius: 8px;
                    padding: 18px;
                    text-align: center;
                    margin: 24px 0;
                }}
                .otp-code {{
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 32px;
                    font-weight: 800;
                    letter-spacing: 8px;
                    color: #38bdf8;
                    display: inline-block;
                }}
                .expiry-notice {{
                    font-size: 12px;
                    color: #94a3b8;
                    margin-top: 8px;
                }}
                .security-footer {{
                    margin-top: 24px;
                    padding-top: 18px;
                    border-top: 1px solid #1e293b;
                    font-size: 11px;
                    color: #64748b;
                    line-height: 1.5;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 class="logo-title">SHALX NETGUARD</h1>
                    <div class="subtitle">Intelligent Security Operations Center</div>
                </div>
                <div class="content">
                    <div class="greeting">Hello <b>{name_display}</b>,</div>
                    <p style="font-size: 13px; color: #94a3b8; margin: 0 0 16px 0;">
                        A login attempt was initiated for your SHALX NETGUARD SOC account. Use the following dynamic verification code to complete authentication:
                    </p>
                    
                    <div class="otp-box">
                        <div class="otp-code">{otp}</div>
                        <div class="expiry-notice">⏱️ This code expires in <b>5 minutes</b>.</div>
                    </div>

                    <p style="font-size: 12px; color: #f87171; margin: 16px 0 0 0;">
                        ⚠️ If you did not attempt to log in, please secure your account credentials immediately.
                    </p>

                    <div class="security-footer">
                        Automated identity verification dispatched by SHALX NETGUARD MFA Subsystem.<br>
                        Do not share this one-time code with anyone.
                    </div>
                </div>
            </div>
        </body>
        </html>
        """

        msg = MIMEMultipart("alternative")
        from_name = settings.SMTP_FROM_NAME
        from_email = settings.SMTP_FROM_EMAIL
        msg["From"] = f"{from_name} <{from_email}>"
        msg["To"] = recipient_email
        msg["Subject"] = subject

        msg.attach(MIMEText(text_body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        def _send_sync():
            # If running in test mode, complete simulated delivery without network SMTP call
            if cls._test_mode or settings.ENVIRONMENT == "testing":
                return True, None

            smtp_host = settings.SMTP_HOST
            smtp_port = settings.SMTP_PORT
            smtp_user = settings.effective_smtp_user
            smtp_pass = settings.SMTP_PASSWORD

            if not smtp_host:
                logger.warning(
                    f"SMTP email service is not configured. Unable to deliver verification email to {cls.mask_email(recipient_email)}."
                )
                return False, "Email delivery is not configured."

            try:
                if settings.SMTP_USE_SSL:
                    server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=12)
                else:
                    server = smtplib.SMTP(smtp_host, smtp_port, timeout=12)

                with server:
                    if settings.SMTP_USE_TLS and not settings.SMTP_USE_SSL:
                        server.starttls()
                    if smtp_user and smtp_pass:
                        server.login(smtp_user, smtp_pass)
                    
                    server.sendmail(from_email, [recipient_email], msg.as_string())
                    
                logger.info(f"Dynamic MFA verification code successfully dispatched via SMTP to {cls.mask_email(recipient_email)}")
                return True, None
            except smtplib.SMTPRecipientsRefused as e:
                logger.error(f"SMTP recipient rejected (invalid/non-existent mailbox) for {cls.mask_email(recipient_email)}: {e}")
                return False, "Recipient address rejected by mail server (mailbox not found)."
            except smtplib.SMTPResponseException as e:
                logger.error(f"SMTP response error ({e.smtp_code}) for {cls.mask_email(recipient_email)}: {e.smtp_error}")
                return False, f"SMTP server rejected message (code {e.smtp_code})."
            except smtplib.SMTPAuthenticationError as e:
                logger.error(f"SMTP authentication failure for server {smtp_host}: {e}")
                return False, "SMTP server authentication failed."
            except Exception as e:
                logger.error(f"SMTP delivery error to {cls.mask_email(recipient_email)}: {e}")
                return False, f"Failed to send email: {str(e)}"

        return await asyncio.to_thread(_send_sync)


mfa_service = MFAService()
