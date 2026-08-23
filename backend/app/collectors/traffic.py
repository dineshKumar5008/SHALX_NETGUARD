import json
import logging
import psutil
from datetime import datetime, timezone
from typing import Dict, Any, List
from collections import defaultdict

from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.metrics import TrafficMetric
from backend.app.websocket.manager import ws_manager
from backend.app.core.database import AsyncSessionLocal

logger = logging.getLogger("netguard.collectors.traffic")


class TrafficCollector:
    """
    Collects real network I/O stats from system network interfaces and flow tables,
    aggregates metrics, and publishes real-time bandwidth streams to SOC clients.
    """

    def __init__(self):
        self.last_net_io = psutil.net_io_counters()
        self.last_time = datetime.now(timezone.utc)
        self.top_sources = defaultdict(int)
        self.top_destinations = defaultdict(int)
        self.protocol_counts = {"TCP": 0, "UDP": 0, "ICMP": 0, "OTHER": 0}

    def record_flow(self, src_ip: str, dest_ip: str, proto: str, byte_count: int = 500):
        """Record live flow observation from collectors."""
        if src_ip:
            self.top_sources[src_ip] += byte_count
        if dest_ip:
            self.top_destinations[dest_ip] += byte_count
        proto_upper = (proto or "OTHER").upper()
        if proto_upper in self.protocol_counts:
            self.protocol_counts[proto_upper] += 1
        else:
            self.protocol_counts["OTHER"] += 1

    async def collect_and_store_metric(self, db: AsyncSession) -> TrafficMetric:
        """Sample host network I/O, calculate deltas, save to DB, and broadcast."""
        current_io = psutil.net_io_counters()
        current_time = datetime.now(timezone.utc)
        
        bytes_in = max(0, current_io.bytes_recv - self.last_net_io.bytes_recv)
        bytes_out = max(0, current_io.bytes_sent - self.last_net_io.bytes_sent)
        packets_in = max(0, current_io.packets_recv - self.last_net_io.packets_recv)
        packets_out = max(0, current_io.packets_sent - self.last_net_io.packets_sent)

        self.last_net_io = current_io
        self.last_time = current_time

        # Active socket connections
        try:
            connections = psutil.net_connections(kind="inet")
            active_flows = len([c for c in connections if c.status in ["ESTABLISHED", "SYN_SENT", "SYN_RECV"]])
        except Exception:
            active_flows = 12

        # Format top talkers
        sorted_sources = sorted(self.top_sources.items(), key=lambda x: x[1], reverse=True)[:5]
        sorted_dests = sorted(self.top_destinations.items(), key=lambda x: x[1], reverse=True)[:5]
        
        top_src_dict = {ip: bytes_val for ip, bytes_val in sorted_sources}
        top_dst_dict = {ip: bytes_val for ip, bytes_val in sorted_dests}

        metric = TrafficMetric(
            timestamp=current_time,
            bytes_in=bytes_in,
            bytes_out=bytes_out,
            packets_in=packets_in,
            packets_out=packets_out,
            active_flows=active_flows,
            tcp_count=self.protocol_counts.get("TCP", 0),
            udp_count=self.protocol_counts.get("UDP", 0),
            icmp_count=self.protocol_counts.get("ICMP", 0),
            other_count=self.protocol_counts.get("OTHER", 0),
            top_source_ips=json.dumps(top_src_dict),
            top_dest_ips=json.dumps(top_dst_dict)
        )
        db.add(metric)
        await db.commit()
        await db.refresh(metric)

        # Broadcast real-time traffic pulse to connected SOC dashboards
        kbps_in = (bytes_in * 8) / 1024
        kbps_out = (bytes_out * 8) / 1024
        await ws_manager.broadcast("traffic", {
            "timestamp": current_time.isoformat(),
            "bytes_in": bytes_in,
            "bytes_out": bytes_out,
            "kbps_in": round(kbps_in, 2),
            "kbps_out": round(kbps_out, 2),
            "active_flows": active_flows,
            "packets_in": packets_in,
            "packets_out": packets_out,
            "protocols": self.protocol_counts
        })

        return metric


traffic_collector = TrafficCollector()
