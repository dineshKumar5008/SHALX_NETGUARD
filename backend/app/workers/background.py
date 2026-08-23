import asyncio
import logging
from datetime import datetime, timezone
from sqlalchemy.future import select

from backend.app.core.database import AsyncSessionLocal
from backend.app.collectors.suricata import suricata_collector
from backend.app.collectors.discovery import discovery_service
from backend.app.collectors.traffic import traffic_collector
from backend.app.models.firewall import BlockedIP
from backend.app.integrations.firewall import get_firewall_provider

logger = logging.getLogger("netguard.workers")


class BackgroundWorker:
    """Orchestrates asynchronous background telemetry collection and maintenance tasks."""

    def __init__(self):
        self.is_running = False
        self._tasks = []

    async def start(self):
        self.is_running = True
        logger.info("Starting NetGuard Background Telemetry & Maintenance Workers...")
        self._tasks.append(asyncio.create_task(self._suricata_tail_loop()))
        self._tasks.append(asyncio.create_task(self._traffic_metrics_loop()))
        self._tasks.append(asyncio.create_task(self._discovery_loop()))
        self._tasks.append(asyncio.create_task(self._block_expiration_loop()))

    async def stop(self):
        self.is_running = False
        for task in self._tasks:
            task.cancel()
        logger.info("NetGuard Background Workers stopped.")

    async def _suricata_tail_loop(self):
        """Continuously tail Suricata EVE JSON file."""
        while self.is_running:
            try:
                await suricata_collector.read_new_lines()
            except Exception as e:
                logger.debug(f"Suricata poll loop: {e}")
            await asyncio.sleep(2)

    async def _traffic_metrics_loop(self):
        """Record traffic counters every 5 seconds."""
        while self.is_running:
            try:
                async with AsyncSessionLocal() as db:
                    await traffic_collector.collect_and_store_metric(db)
            except Exception as e:
                logger.debug(f"Traffic worker error: {e}")
            await asyncio.sleep(5)

    async def _discovery_loop(self):
        """Periodically scan monitored CIDRs for new / updated devices."""
        while self.is_running:
            try:
                async with AsyncSessionLocal() as db:
                    await discovery_service.scan_monitored_subnets(db)
            except Exception as e:
                logger.debug(f"Discovery worker error: {e}")
            await asyncio.sleep(60)

    async def _block_expiration_loop(self):
        """Unblock expired temporary firewall blocks."""
        while self.is_running:
            try:
                async with AsyncSessionLocal() as db:
                    now = datetime.now(timezone.utc)
                    stmt = select(BlockedIP).where(
                        BlockedIP.is_active == True,
                        BlockedIP.expires_at != None,
                        BlockedIP.expires_at <= now
                    )
                    res = await db.execute(stmt)
                    expired_ips = res.scalars().all()
                    
                    fw = get_firewall_provider()
                    for item in expired_ips:
                        logger.info(f"Expiring block on IP {item.ip_address}")
                        await fw.unblock_ip(item.ip_address)
                        item.is_active = False
                    if expired_ips:
                        await db.commit()
            except Exception as e:
                logger.debug(f"Block expiration worker error: {e}")
            await asyncio.sleep(30)


background_worker = BackgroundWorker()
