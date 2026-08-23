from backend.app.core.config import settings
from backend.app.integrations.firewall.base import FirewallProvider
from backend.app.integrations.firewall.mock import MockFirewallProvider
from backend.app.integrations.firewall.pfsense import PfSenseFirewallProvider

_mock_instance = None
_pfsense_instance = None


def get_firewall_provider() -> FirewallProvider:
    """Returns the configured Firewall provider (pfSense or Mock)."""
    global _mock_instance, _pfsense_instance
    if settings.FIREWALL_PROVIDER.lower() == "pfsense":
        if _pfsense_instance is None:
            _pfsense_instance = PfSenseFirewallProvider()
        return _pfsense_instance
    else:
        if _mock_instance is None:
            _mock_instance = MockFirewallProvider()
        return _mock_instance
