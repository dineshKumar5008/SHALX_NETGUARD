import httpx
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from backend.app.core.config import settings
from backend.app.integrations.firewall.base import FirewallProvider

logger = logging.getLogger("netguard.firewall.pfsense")


class PfSenseFirewallProvider(FirewallProvider):
    """
    Real pfSense Firewall Provider communicating over HTTPS via pfSense REST API or FauxAPI.
    Applies safety allowlists and graceful fallback on connection failure.
    """

    def __init__(self):
        self.base_url = settings.PFSENSE_URL.rstrip("/")
        self.api_key = settings.PFSENSE_API_KEY
        self.api_secret = settings.PFSENSE_API_SECRET
        self.verify_ssl = settings.PFSENSE_VERIFY_SSL
        logger.info(f"PfSenseFirewallProvider configured for {self.base_url}")

    def _get_headers(self) -> dict:
        headers = {"Content-Type": "application/json"}
        if self.api_key and self.api_secret:
            headers["Authorization"] = f"{self.api_key} {self.api_secret}"
        return headers

    async def block_ip(
        self,
        ip: str,
        reason: str,
        duration_minutes: Optional[int] = None,
        force: bool = False
    ) -> Dict[str, Any]:
        if ip in settings.PROTECTED_IPS and not force:
            logger.warning(f"pfSense Provider: Protected IP check triggered! Refusing to block {ip}")
            return {
                "success": False,
                "error": f"Safety Safeguard: IP {ip} is on the critical protected allowlist.",
                "is_protected": True
            }

        url = f"{self.base_url}/api/v1/firewall/alias/entry"
        payload = {
            "name": "NetGuard_Blocked_IPs",
            "address": ip,
            "detail": f"NetGuard SOC Block: {reason}"
        }

        try:
            async with httpx.AsyncClient(verify=self.verify_ssl, timeout=5.0) as client:
                response = await client.post(url, json=payload, headers=self._get_headers())
                if response.status_code in [200, 201]:
                    logger.info(f"pfSense successfully blocked IP: {ip}")
                    return {
                        "success": True,
                        "ip": ip,
                        "action": "BLOCK",
                        "provider": "PfSenseFirewallProvider",
                        "message": f"IP {ip} successfully pushed to pfSense block alias table."
                    }
                else:
                    logger.error(f"pfSense API error: {response.status_code} - {response.text}")
                    return {
                        "success": False,
                        "error": f"pfSense returned HTTP {response.status_code}: {response.text}"
                    }
        except httpx.RequestError as e:
            logger.error(f"pfSense connection failed: {e}")
            return {
                "success": False,
                "error": f"pfSense connection error: {str(e)}"
            }

    async def unblock_ip(self, ip: str) -> Dict[str, Any]:
        url = f"{self.base_url}/api/v1/firewall/alias/entry"
        params = {
            "name": "NetGuard_Blocked_IPs",
            "address": ip
        }

        try:
            async with httpx.AsyncClient(verify=self.verify_ssl, timeout=5.0) as client:
                response = await client.request("DELETE", url, json=params, headers=self._get_headers())
                if response.status_code in [200, 204]:
                    logger.info(f"pfSense successfully unblocked IP: {ip}")
                    return {
                        "success": True,
                        "ip": ip,
                        "action": "UNBLOCK",
                        "provider": "PfSenseFirewallProvider",
                        "message": f"IP {ip} removed from pfSense block table."
                    }
                else:
                    return {
                        "success": False,
                        "error": f"pfSense returned HTTP {response.status_code}: {response.text}"
                    }
        except httpx.RequestError as e:
            logger.error(f"pfSense unblock connection failed: {e}")
            return {
                "success": False,
                "error": f"pfSense unblock connection error: {str(e)}"
            }

    async def is_ip_blocked(self, ip: str) -> bool:
        blocked = await self.list_blocked_ips()
        return ip in blocked

    async def list_blocked_ips(self) -> List[str]:
        url = f"{self.base_url}/api/v1/firewall/alias/entry?name=NetGuard_Blocked_IPs"
        try:
            async with httpx.AsyncClient(verify=self.verify_ssl, timeout=5.0) as client:
                response = await client.get(url, headers=self._get_headers())
                if response.status_code == 200:
                    data = response.json()
                    return [entry.get("address") for entry in data.get("data", []) if "address" in entry]
                return []
        except Exception as e:
            logger.warning(f"Could not retrieve pfSense blocked list: {e}")
            return []

    async def get_status(self) -> Dict[str, Any]:
        url = f"{self.base_url}/api/v1/status/system"
        is_connected = False
        details = {}
        try:
            async with httpx.AsyncClient(verify=self.verify_ssl, timeout=3.0) as client:
                response = await client.get(url, headers=self._get_headers())
                if response.status_code == 200:
                    is_connected = True
                    details = response.json().get("data", {})
        except Exception as e:
            logger.warning(f"pfSense status check failed: {e}")

        return {
            "provider": "PfSenseFirewallProvider",
            "url": self.base_url,
            "is_connected": is_connected,
            "mode": "PRODUCTION",
            "details": details,
            "protected_ips_count": len(settings.PROTECTED_IPS),
            "last_sync": datetime.now(timezone.utc).isoformat()
        }
