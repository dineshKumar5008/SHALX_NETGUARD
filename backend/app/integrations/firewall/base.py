from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any


class FirewallProvider(ABC):
    """Abstract base class for all Firewall / Response providers."""

    @abstractmethod
    async def block_ip(
        self,
        ip: str,
        reason: str,
        duration_minutes: Optional[int] = None,
        force: bool = False
    ) -> Dict[str, Any]:
        """Block an IP address on the firewall."""
        pass

    @abstractmethod
    async def unblock_ip(self, ip: str) -> Dict[str, Any]:
        """Unblock an IP address on the firewall."""
        pass

    @abstractmethod
    async def is_ip_blocked(self, ip: str) -> bool:
        """Check if an IP is currently blocked on the firewall."""
        pass

    @abstractmethod
    async def list_blocked_ips(self) -> List[str]:
        """Return list of active blocked IPs on the firewall."""
        pass

    @abstractmethod
    async def get_status(self) -> Dict[str, Any]:
        """Return firewall connection and operational status."""
        pass
