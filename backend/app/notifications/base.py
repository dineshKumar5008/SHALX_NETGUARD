from abc import ABC, abstractmethod
from typing import Optional, Dict, Any


class NotificationProvider(ABC):
    """Abstract base class for notification dispatch providers."""

    @abstractmethod
    async def send_notification(
        self,
        subject: str,
        message: str,
        severity: str = "HIGH",
        recipient: Optional[str] = None
    ) -> Dict[str, Any]:
        """Dispatch notification to destination channel."""
        pass
