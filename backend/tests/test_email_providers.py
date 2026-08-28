import pytest
import httpx
from unittest.mock import patch, MagicMock, AsyncMock
from backend.app.core.config import Settings
from backend.app.services.mfa_service import MFAService, mfa_service


def test_email_provider_auto_detection():
    """Verify provider auto-detection from environment settings."""
    s1 = Settings(RESEND_API_KEY="re_123456789")
    assert s1.effective_email_provider == "resend"
    assert s1.is_email_configured is True

    s2 = Settings(BREVO_API_KEY="xkeysib-123456789")
    assert s2.effective_email_provider == "brevo"
    assert s2.is_email_configured is True

    s3 = Settings(SENDGRID_API_KEY="SG.123456789")
    assert s3.effective_email_provider == "sendgrid"
    assert s3.is_email_configured is True

    s4 = Settings(SMTP_HOST="smtp.gmail.com")
    assert s4.effective_email_provider == "smtp"
    assert s4.is_email_configured is True

    s5 = Settings(EMAIL_PROVIDER="brevo", RESEND_API_KEY="re_123")
    assert s5.effective_email_provider == "brevo"

    s6 = Settings(SMTP_HOST=None, RESEND_API_KEY=None, BREVO_API_KEY=None, SENDGRID_API_KEY=None)
    assert s6.effective_email_provider == "none"
    assert s6.is_email_configured is False


@pytest.mark.asyncio
async def test_resend_http_api_success():
    """Verify Resend HTTP API POST dispatch and payload structure."""
    test_svc = MFAService()
    test_svc.set_test_mode(False)

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"id": "resend_msg_12345"}

    with patch("backend.app.core.config.settings.RESEND_API_KEY", "re_test_key_123"), \
         patch("backend.app.core.config.settings.EMAIL_PROVIDER", "resend"), \
         patch("backend.app.core.config.settings.ENVIRONMENT", "prod"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response

        ok, err = await test_svc.send_otp_email(
            recipient_email="soc.analyst@example.com",
            otp="789012",
            recipient_name="Alex Turner"
        )
        assert ok is True
        assert err is None
        assert mock_post.called

        call_kwargs = mock_post.call_args
        url = call_kwargs[0][0]
        json_data = call_kwargs[1]["json"]
        headers = call_kwargs[1]["headers"]

        assert url == "https://api.resend.com/emails"
        assert json_data["to"] == ["soc.analyst@example.com"]
        assert "789012" in json_data["text"]
        assert "789012" in json_data["html"]
        assert headers["Authorization"] == "Bearer re_test_key_123"


@pytest.mark.asyncio
async def test_resend_http_api_error_handling():
    """Verify Resend HTTP error response parsing and propagation."""
    test_svc = MFAService()
    test_svc.set_test_mode(False)

    mock_response = MagicMock()
    mock_response.status_code = 403
    mock_response.json.return_value = {
        "statusCode": 403,
        "name": "validation_error",
        "message": "Domain not verified. You can only send to your account email."
    }

    with patch("backend.app.core.config.settings.RESEND_API_KEY", "re_test_key_123"), \
         patch("backend.app.core.config.settings.EMAIL_PROVIDER", "resend"), \
         patch("backend.app.core.config.settings.ENVIRONMENT", "prod"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response

        ok, err = await test_svc.send_otp_email(
            recipient_email="unverified@customdomain.com",
            otp="654321"
        )
        assert ok is False
        assert "Domain not verified" in err
        assert "403" in err


@pytest.mark.asyncio
async def test_brevo_http_api_success():
    """Verify Brevo (Sendinblue) HTTP API POST dispatch."""
    test_svc = MFAService()
    test_svc.set_test_mode(False)

    mock_response = MagicMock()
    mock_response.status_code = 201
    mock_response.json.return_value = {"messageId": "<brevo_msg_999@smtp-relay.mailin.fr>"}

    with patch("backend.app.core.config.settings.BREVO_API_KEY", "xkeysib-test-key-999"), \
         patch("backend.app.core.config.settings.EMAIL_PROVIDER", "brevo"), \
         patch("backend.app.core.config.settings.ENVIRONMENT", "prod"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response

        ok, err = await test_svc.send_password_reset_otp_email(
            recipient_email="recovery@example.com",
            otp="112233"
        )
        assert ok is True
        assert err is None
        assert mock_post.called

        call_kwargs = mock_post.call_args
        url = call_kwargs[0][0]
        json_data = call_kwargs[1]["json"]
        headers = call_kwargs[1]["headers"]

        assert url == "https://api.brevo.com/v3/smtp/email"
        assert json_data["to"] == [{"email": "recovery@example.com"}]
        assert "112233" in json_data["textContent"]
        assert headers["api-key"] == "xkeysib-test-key-999"


@pytest.mark.asyncio
async def test_sendgrid_http_api_success():
    """Verify SendGrid HTTP API POST dispatch."""
    test_svc = MFAService()
    test_svc.set_test_mode(False)

    mock_response = MagicMock()
    mock_response.status_code = 202
    mock_response.text = ""

    with patch("backend.app.core.config.settings.SENDGRID_API_KEY", "SG.test-key-777"), \
         patch("backend.app.core.config.settings.EMAIL_PROVIDER", "sendgrid"), \
         patch("backend.app.core.config.settings.ENVIRONMENT", "prod"), \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response

        ok, err = await test_svc.send_registration_approved_email(
            applicant_email="approved.user@example.com",
            username="approveduser"
        )
        assert ok is True
        assert err is None
        assert mock_post.called

        call_kwargs = mock_post.call_args
        url = call_kwargs[0][0]
        json_data = call_kwargs[1]["json"]
        headers = call_kwargs[1]["headers"]

        assert url == "https://api.sendgrid.com/v3/mail/send"
        assert json_data["personalizations"][0]["to"] == [{"email": "approved.user@example.com"}]
        assert headers["Authorization"] == "Bearer SG.test-key-777"


@pytest.mark.asyncio
async def test_unconfigured_email_provider_returns_descriptive_error():
    """Verify that when no email provider is configured, a helpful error is returned."""
    test_svc = MFAService()
    test_svc.set_test_mode(False)

    with patch("backend.app.core.config.settings.RESEND_API_KEY", None), \
         patch("backend.app.core.config.settings.BREVO_API_KEY", None), \
         patch("backend.app.core.config.settings.SENDGRID_API_KEY", None), \
         patch("backend.app.core.config.settings.SMTP_HOST", None), \
         patch("backend.app.core.config.settings.EMAIL_PROVIDER", None), \
         patch("backend.app.core.config.settings.ENVIRONMENT", "prod"):

        ok, err = await test_svc.send_otp_email(
            recipient_email="test@example.com",
            otp="999888"
        )
        assert ok is False
        assert "not configured" in err
