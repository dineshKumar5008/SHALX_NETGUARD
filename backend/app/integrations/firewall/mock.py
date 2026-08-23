import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from backend.app.core.config import settings
from backend.app.integrations.firewall.base import FirewallProvider

logger = logging.getLogger("netguard.firewall.mock")


class MockFirewallProvider(FirewallProvider):
    """
    Mock firewall provider for local development, simulation, and isolated testing.
    Maintains safe blocking rules and allowlists without requiring physical pfSense hardware.
    """

    def __init__(self):
        self._blocked_ips: Dict[str, Dict[str, Any]] = {}
        logger.info("MockFirewallProvider initialized.")

    async def block_ip(
        self,
        ip: str,
        reason: str,
        duration_minutes: Optional[int] = None,
        force: bool = False
    ) -> Dict[str, Any]:
        if ip in settings.PROTECTED_IPS and not force:
            logger.warning(f"Protected IP safety check triggered! Refusing to block {ip}")
            return {
                "success": False,
                "error": f"Safety Safeguard: IP {ip} is in the protected critical infrastructure allowlist.",
                "is_protected": True
            }

        self._blocked_ips[ip] = {
            "ip": ip,
            "reason": reason,
            "blocked_at": datetime.now(timezone.utc),
            "duration_minutes": duration_minutes
        }
        logger.info(f"[MOCK FIREWALL] Blocked IP {ip} (Reason: {reason})")
        return {
            "success": True,
            "ip": ip,
            "action": "BLOCK",
            "provider": "MockFirewallProvider",
            "message": f"IP {ip} successfully added to firewall block table (mock mode)."
        }

    async def unblock_ip(self, ip: str) -> Dict[str, Any]:
        if ip in self._blocked_ips:
            del self._blocked_ips[ip]
            logger.info(f"[MOCK FIREWALL] Unblocked IP {ip}")
            return {
                "success": True,
                "ip": ip,
                "action": "UNBLOCK",
                "provider": "MockFirewallProvider",
                "message": f"IP {ip} successfully removed from firewall block table (mock mode)."
            }
        return {
            "success": False,
            "error": f"IP {ip} was not in active mock block table."
        }

    async def is_ip_blocked(self, ip: str) -> bool:
        return ip in self._blocked_ips

    async def list_blocked_ips(self) -> List[str]:
        return list(self._blocked_ips.keys())

    async def get_status(self) -> Dict[str, Any]:
        return {
            "provider": "MockFirewallProvider",
            "is_connected": True,
            "mode": "DEVELOPMENT_SIMULATION",
            "active_blocks_count": len(self._blocked_ips),
            "protected_ips_count": len(settings.PROTECTED_IPS),
            "last_sync": datetime.now(timezone.utc).isoformat()
        }
