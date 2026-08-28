import os
import secrets
import smtplib
import asyncio
import logging
import httpx
from datetime import datetime, timezone, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Tuple, Dict, Any, List

from backend.app.core.config import settings
from backend.app.core.security import get_password_hash, verify_password

logger = logging.getLogger("netguard.services.mfa")


class MFAService:
    """
    Cryptographically secure Multi-Factor Authentication (MFA) & Transactional Email Service.
    Supports modern HTTPS REST API delivery (Resend, Brevo, SendGrid) and legacy SMTP TCP delivery.
    Generates dynamic random 6-digit OTPs, securely hashes them, and delivers them via real email.
    Plaintext OTPs, API keys, and credentials are NEVER hardcoded, NEVER logged, and NEVER returned from APIs.
    """

    _test_inbox: Dict[str, str] = {}
    _test_notifications: List[Dict[str, Any]] = []
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
    def get_test_notifications(cls) -> List[Dict[str, Any]]:
        """Retrieve simulated test notification records."""
        return list(cls._test_notifications)

    @classmethod
    def clear_test_inbox(cls):
        """Clear test mailbox and notifications."""
        cls._test_inbox.clear()
        cls._test_notifications.clear()

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
    async def _send_resend(
        cls,
        recipient_email: str,
        subject: str,
        text_body: str,
        html_body: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """Deliver transactional email via Resend HTTPS REST API."""
        api_key = (settings.RESEND_API_KEY or "").strip()
        if not api_key:
            return False, "RESEND_API_KEY is not configured."

        from_email = settings.effective_from_email
        from_name = settings.effective_from_name
        from_header = f"{from_name} <{from_email}>" if "@" in from_email and "<" not in from_email else from_email

        payload: Dict[str, Any] = {
            "from": from_header,
            "to": [recipient_email],
            "subject": subject,
            "text": text_body,
        }
        if html_body:
            payload["html"] = html_body

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "SHALX-NetGuard-SOC/1.0"
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post("https://api.resend.com/emails", json=payload, headers=headers)
                if res.status_code in [200, 201]:
                    logger.info(f"Email '{subject}' successfully dispatched via Resend HTTP API to {cls.mask_email(recipient_email)}")
                    return True, None

                err_detail = "Unknown error"
                try:
                    err_json = res.json()
                    err_detail = err_json.get("message") or err_json.get("name") or str(err_json)
                except Exception:
                    err_detail = res.text[:200]

                logger.error(f"Resend HTTP API delivery failure ({res.status_code}) to {cls.mask_email(recipient_email)}: {err_detail}")
                return False, f"Resend API error ({res.status_code}): {err_detail}"
        except httpx.RequestError as e:
            logger.error(f"Resend HTTP connection error to {cls.mask_email(recipient_email)}: {e}")
            return False, f"Resend API connection error: {str(e)}"

    @classmethod
    async def _send_brevo(
        cls,
        recipient_email: str,
        subject: str,
        text_body: str,
        html_body: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """Deliver transactional email via Brevo (Sendinblue) HTTPS REST API."""
        api_key = (settings.BREVO_API_KEY or "").strip()
        if not api_key:
            return False, "BREVO_API_KEY is not configured."

        from_email = settings.effective_from_email
        from_name = settings.effective_from_name

        payload: Dict[str, Any] = {
            "sender": {"email": from_email, "name": from_name},
            "to": [{"email": recipient_email}],
            "subject": subject,
            "textContent": text_body,
        }
        if html_body:
            payload["htmlContent"] = html_body

        headers = {
            "api-key": api_key,
            "Content-Type": "application/json",
            "User-Agent": "SHALX-NetGuard-SOC/1.0"
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post("https://api.brevo.com/v3/smtp/email", json=payload, headers=headers)
                if res.status_code in [200, 201, 202]:
                    logger.info(f"Email '{subject}' successfully dispatched via Brevo HTTP API to {cls.mask_email(recipient_email)}")
                    return True, None

                err_detail = "Unknown error"
                try:
                    err_json = res.json()
                    err_detail = err_json.get("message") or str(err_json)
                except Exception:
                    err_detail = res.text[:200]

                logger.error(f"Brevo HTTP API delivery failure ({res.status_code}) to {cls.mask_email(recipient_email)}: {err_detail}")
                return False, f"Brevo API error ({res.status_code}): {err_detail}"
        except httpx.RequestError as e:
            logger.error(f"Brevo HTTP connection error to {cls.mask_email(recipient_email)}: {e}")
            return False, f"Brevo API connection error: {str(e)}"

    @classmethod
    async def _send_sendgrid(
        cls,
        recipient_email: str,
        subject: str,
        text_body: str,
        html_body: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """Deliver transactional email via SendGrid HTTPS REST API."""
        api_key = (settings.SENDGRID_API_KEY or "").strip()
        if not api_key:
            return False, "SENDGRID_API_KEY is not configured."

        from_email = settings.effective_from_email
        from_name = settings.effective_from_name

        content = [{"type": "text/plain", "value": text_body}]
        if html_body:
            content.append({"type": "text/html", "value": html_body})

        payload = {
            "personalizations": [{"to": [{"email": recipient_email}]}],
            "from": {"email": from_email, "name": from_name},
            "subject": subject,
            "content": content
        }

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "SHALX-NetGuard-SOC/1.0"
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post("https://api.sendgrid.com/v3/mail/send", json=payload, headers=headers)
                if res.status_code in [200, 201, 202]:
                    logger.info(f"Email '{subject}' successfully dispatched via SendGrid HTTP API to {cls.mask_email(recipient_email)}")
                    return True, None

                err_detail = "Unknown error"
                try:
                    err_json = res.json()
                    errors = err_json.get("errors", [])
                    err_detail = errors[0].get("message") if errors else str(err_json)
                except Exception:
                    err_detail = res.text[:200]

                logger.error(f"SendGrid HTTP API delivery failure ({res.status_code}) to {cls.mask_email(recipient_email)}: {err_detail}")
                return False, f"SendGrid API error ({res.status_code}): {err_detail}"
        except httpx.RequestError as e:
            logger.error(f"SendGrid HTTP connection error to {cls.mask_email(recipient_email)}: {e}")
            return False, f"SendGrid API connection error: {str(e)}"

    @classmethod
    async def _send_smtp(
        cls,
        recipient_email: str,
        subject: str,
        text_body: str,
        html_body: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """Deliver transactional email via raw SMTP TCP connection."""
        from_name = settings.effective_from_name
        from_email = settings.effective_from_email

        msg = MIMEMultipart("alternative")
        msg["From"] = f"{from_name} <{from_email}>"
        msg["To"] = recipient_email
        msg["Subject"] = subject

        msg.attach(MIMEText(text_body, "plain", "utf-8"))
        if html_body:
            msg.attach(MIMEText(html_body, "html", "utf-8"))

        def _send_sync():
            smtp_host = settings.SMTP_HOST
            smtp_port = settings.SMTP_PORT
            smtp_user = settings.effective_smtp_user
            smtp_pass = settings.SMTP_PASSWORD

            if not smtp_host:
                logger.warning(f"SMTP is not configured. Unable to deliver email '{subject}' to {cls.mask_email(recipient_email)}.")
                return False, "SMTP is not configured."

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

                logger.info(f"Email '{subject}' successfully dispatched via SMTP to {cls.mask_email(recipient_email)}")
                return True, None
            except smtplib.SMTPRecipientsRefused as e:
                logger.error(f"SMTP recipient rejected for {cls.mask_email(recipient_email)}: {e}")
                return False, "Recipient address rejected by mail server (mailbox not found)."
            except smtplib.SMTPAuthenticationError as e:
                logger.error(f"SMTP authentication failure for server {smtp_host}: {e}")
                return False, "SMTP server authentication failed."
            except Exception as e:
                logger.error(f"SMTP delivery error for '{subject}' to {cls.mask_email(recipient_email)}: {e}")
                return False, f"Failed to send email via SMTP: {str(e)}"

        return await asyncio.to_thread(_send_sync)

    @classmethod
    async def _dispatch_email(
        cls,
        recipient_email: str,
        subject: str,
        text_body: str,
        html_body: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Unified transactional email dispatcher.
        Delivers email via configured HTTP/HTTPS API provider (Resend, Brevo, SendGrid) or legacy SMTP.
        """
        cls._test_notifications.append({
            "to": recipient_email,
            "subject": subject,
            "text": text_body
        })

        if not recipient_email or "@" not in recipient_email:
            return False, "Invalid recipient email address"

        # If running in simulated test mode or testing environment, complete delivery successfully
        if cls._test_mode or settings.ENVIRONMENT == "testing":
            return True, None

        provider = settings.effective_email_provider
        masked = cls.mask_email(recipient_email)

        if provider == "resend":
            return await cls._send_resend(recipient_email, subject, text_body, html_body)
        elif provider == "brevo":
            return await cls._send_brevo(recipient_email, subject, text_body, html_body)
        elif provider == "sendgrid":
            return await cls._send_sendgrid(recipient_email, subject, text_body, html_body)
        elif provider == "smtp":
            return await cls._send_smtp(recipient_email, subject, text_body, html_body)
        else:
            logger.warning(f"No email provider configured. Unable to send '{subject}' to {masked}.")
            return False, "Transactional email service is not configured on the server. Please set RESEND_API_KEY (or SMTP credentials) in Render environment variables."

    @classmethod
    async def send_otp_email(
        cls,
        recipient_email: str,
        otp: str,
        recipient_name: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Dispatch the dynamic 6-digit OTP to the user's verified registered email address.
        """
        cls._test_inbox[recipient_email] = otp
        if not recipient_email or "@" not in recipient_email:
            return False, "Invalid recipient email address"

        subject = "SHALX NETGUARD — Login Verification Code"
        name_display = recipient_name or "Security Operator"

        # 1. Plain text format
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

        return await cls._dispatch_email(recipient_email, subject, text_body, html_body)

    @classmethod
    async def send_generic_email(
        cls,
        recipient_email: str,
        subject: str,
        text_body: str,
        html_body: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Generic helper to send an email notification through the active provider.
        """
        return await cls._dispatch_email(recipient_email, subject, text_body, html_body)

    @classmethod
    async def send_registration_submitted_admin_notification(
        cls,
        admin_emails: List[str],
        req_data: Dict[str, Any]
    ) -> List[Tuple[str, bool, Optional[str]]]:
        """
        Send notification email to administrators and senior analysts for a newly submitted registration request.
        """
        subject = "SHALX NETGUARD — New User Registration Request"
        text_body = f"""SHALX NETGUARD

New User Registration Request

Name:
{req_data.get('full_name', '')}

Username:
{req_data.get('username', '')}

Email:
{req_data.get('email', '')}

Department:
{req_data.get('department', '')}

Reason for Access:
{req_data.get('reason', '')}

Status:
PENDING

Please authenticate to SHALX NETGUARD SOC to review and approve or reject this request.
"""
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: Arial, sans-serif; background-color: #0a0d14; color: #e2e8f0; padding: 20px;">
            <div style="max-width: 540px; margin: 0 auto; background: #0f1422; border: 1px solid #1e293b; border-radius: 12px; padding: 24px;">
                <h2 style="color: #38bdf8; margin-top: 0; font-family: monospace;">SHALX NETGUARD</h2>
                <h3 style="color: #94a3b8; font-size: 16px; margin-bottom: 16px;">New User Registration Request</h3>
                <div style="background: #1e293b/60; border-left: 3px solid #38bdf8; padding: 14px; margin-bottom: 20px; font-size: 13px; line-height: 1.6;">
                    <p><b>Name:</b> {req_data.get('full_name', '')}</p>
                    <p><b>Username:</b> <span style="color: #38bdf8; font-family: monospace;">{req_data.get('username', '')}</span></p>
                    <p><b>Email:</b> {req_data.get('email', '')}</p>
                    <p><b>Department:</b> {req_data.get('department', '')}</p>
                    <p><b>Reason for Access:</b> {req_data.get('reason', '')}</p>
                    <p><b>Status:</b> <span style="background: #eab308; color: #000; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px;">PENDING</span></p>
                </div>
                <p style="font-size: 12px; color: #94a3b8;">
                    Log into the SHALX NETGUARD SOC console to review this registration request.
                </p>
            </div>
        </body>
        </html>
        """
        results = []
        for email in set(admin_emails):
            if email and "@" in email:
                success, err = await cls.send_generic_email(email, subject, text_body, html_body)
                results.append((email, success, err))
        return results

    @classmethod
    async def send_registration_approved_email(
        cls,
        applicant_email: str,
        username: str,
        applicant_name: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Notify applicant that their registration request has been approved and account is active.
        """
        subject = "SHALX NETGUARD — Registration Approved"
        text_body = f"""Your SHALX NETGUARD registration request has been approved.

Username:
{username}

You can now log in using your registered credentials.

You will be required to complete email MFA during login.
"""
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: Arial, sans-serif; background-color: #0a0d14; color: #e2e8f0; padding: 20px;">
            <div style="max-width: 500px; margin: 0 auto; background: #0f1422; border: 1px solid #1e293b; border-radius: 12px; padding: 24px;">
                <h2 style="color: #38bdf8; margin-top: 0; font-family: monospace;">SHALX NETGUARD</h2>
                <h3 style="color: #4ade80; font-size: 16px; margin-bottom: 12px;">✅ Registration Approved</h3>
                <p style="font-size: 13px; color: #cbd5e1; line-height: 1.6;">
                    Hello <b>{applicant_name or username}</b>,<br><br>
                    Your SHALX NETGUARD registration request has been approved.
                </p>
                <div style="background: #0a0d14; border: 1px solid #1e293b; border-radius: 8px; padding: 14px; margin: 16px 0;">
                    <p style="margin: 0; font-size: 13px; font-family: monospace;"><b>Username:</b> <span style="color: #38bdf8;">{username}</span></p>
                </div>
                <p style="font-size: 13px; color: #cbd5e1; line-height: 1.6;">
                    You can now log in using your registered credentials. You will be required to complete email MFA verification during login.
                </p>
                <p style="font-size: 11px; color: #64748b; margin-top: 24px;">
                    SHALX NETGUARD Security Operations Center
                </p>
            </div>
        </body>
        </html>
        """
        return await cls.send_generic_email(applicant_email, subject, text_body, html_body)

    @classmethod
    async def send_registration_rejected_email(
        cls,
        applicant_email: str,
        applicant_name: Optional[str] = None,
        rejection_reason: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Notify applicant that their registration request was not approved.
        """
        reason_text = rejection_reason or "Requirements not met or unauthorized access."
        subject = "SHALX NETGUARD — Registration Request Update"
        text_body = f"""Your SHALX NETGUARD registration request was not approved.

Reason:

{reason_text}
"""
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: Arial, sans-serif; background-color: #0a0d14; color: #e2e8f0; padding: 20px;">
            <div style="max-width: 500px; margin: 0 auto; background: #0f1422; border: 1px solid #1e293b; border-radius: 12px; padding: 24px;">
                <h2 style="color: #38bdf8; margin-top: 0; font-family: monospace;">SHALX NETGUARD</h2>
                <h3 style="color: #f87171; font-size: 16px; margin-bottom: 12px;">Registration Request Update</h3>
                <p style="font-size: 13px; color: #cbd5e1; line-height: 1.6;">
                    Hello <b>{applicant_name or 'Applicant'}</b>,<br><br>
                    Your SHALX NETGUARD registration request was not approved.
                </p>
                <div style="background: #450a0a/40; border: 1px solid #991b1b; border-radius: 8px; padding: 14px; margin: 16px 0;">
                    <p style="margin: 0; font-size: 13px; color: #fca5a5;"><b>Reason:</b> {reason_text}</p>
                </div>
                <p style="font-size: 11px; color: #64748b; margin-top: 24px;">
                    SHALX NETGUARD Security Operations Center
                </p>
            </div>
        </body>
        </html>
        """
        return await cls.send_generic_email(applicant_email, subject, text_body, html_body)

    @classmethod
    async def send_password_reset_otp_email(
        cls,
        recipient_email: str,
        otp: str,
        recipient_name: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Dispatch dynamic 6-digit Password Reset OTP to user's registered email via SMTP.
        """
        cls._test_inbox[recipient_email] = otp
        if not recipient_email or "@" not in recipient_email:
            return False, "Invalid recipient email address"

        subject = "SHALX NETGUARD — Password Reset Verification"
        name_display = recipient_name or "Security Operator"

        text_body = f"""SHALX NETGUARD

Password Reset Verification

Your verification code is: {otp}

This code will expire in 10 minutes.

If you did not request a password reset, please ignore this email.
"""

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
                    <div class="subtitle">Password Reset Verification</div>
                </div>
                <div class="content">
                    <div class="greeting">Hello <b>{name_display}</b>,</div>
                    <p style="font-size: 13px; color: #94a3b8; margin: 0 0 16px 0;">
                        A password recovery request was initiated for your SHALX NETGUARD account. Use the following dynamic verification code to confirm identity and reset your password:
                    </p>
                    
                    <div class="otp-box">
                        <div class="otp-code">{otp}</div>
                        <div class="expiry-notice">⏱️ This code expires in <b>10 minutes</b>.</div>
                    </div>

                    <p style="font-size: 12px; color: #f87171; margin: 16px 0 0 0;">
                        ⚠️ If you did not request a password reset, please ignore this email. Your current password remains secure.
                    </p>

                    <div class="security-footer">
                        Automated security verification dispatched by SHALX NETGUARD Authentication Subsystem.<br>
                        Do not share this one-time code with anyone.
                    </div>
                </div>
            </div>
        </body>
        </html>
        """

        return await cls.send_generic_email(recipient_email, subject, text_body, html_body)

    @classmethod
    async def send_password_reset_success_email(
        cls,
        recipient_email: str,
        recipient_name: Optional[str] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Dispatch confirmation email notification after successful password reset.
        """
        subject = "SHALX NETGUARD — Password Successfully Reset"
        name_display = recipient_name or "Security Operator"

        text_body = f"""SHALX NETGUARD

Password Reset Successful

Hello {name_display},

Your account password for SHALX NETGUARD has been successfully updated.

If you did not make this change, please contact your SOC Administrator immediately.
"""

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
                    background: linear-gradient(135deg, #0f172a 0%, #10b981 100%);
                    padding: 24px;
                    text-align: center;
                    border-bottom: 2px solid #059669;
                }}
                .logo-title {{
                    font-size: 20px;
                    font-weight: 800;
                    letter-spacing: 1.5px;
                    color: #ffffff;
                    margin: 0;
                    font-family: 'Courier New', Courier, monospace;
                }}
                .content {{
                    padding: 28px 24px;
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
                    <div style="font-size: 11px; color: #a7f3d0; margin-top: 4px; letter-spacing: 1px;">SECURITY NOTIFICATION</div>
                </div>
                <div class="content">
                    <div style="font-size: 15px; color: #f8fafc; margin-bottom: 16px;">Hello <b>{name_display}</b>,</div>
                    <p style="font-size: 13px; color: #94a3b8; margin: 0 0 16px 0;">
                        Your account password for SHALX NETGUARD has been <b>successfully updated</b>. You can now sign in using your new credentials.
                    </p>
                    <p style="font-size: 12px; color: #f87171; margin: 16px 0 0 0;">
                        ⚠️ If you did not perform this password change, please contact your SOC Administrator immediately.
                    </p>
                    <div class="security-footer">
                        Automated security notification dispatched by SHALX NETGUARD.<br>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """

        return await cls.send_generic_email(recipient_email, subject, text_body, html_body)


mfa_service = MFAService()
