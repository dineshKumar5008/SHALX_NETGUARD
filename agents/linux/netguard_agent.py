#!/usr/bin/env python3
"""
SHALX NETGUARD Host Monitoring Agent (Linux)
Collects host system telemetry (CPU, RAM, Disk, Network I/O, Uptime)
and securely transmits authenticated metrics to the SHALX NETGUARD SOC server.
"""

import os
import sys
import time
import socket
import json
import logging
import platform
import urllib.request
import urllib.error

try:
    import psutil
except ImportError:
    print("[ERROR] 'psutil' library is required. Run: pip install psutil")
    sys.exit(1)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [SHALX-NETGUARD-Agent]: %(message)s"
)
logger = logging.getLogger("netguard.agent.linux")

# Configuration
SOC_SERVER_URL = os.environ.get("NETGUARD_SERVER_URL", "http://192.168.30.10:8000")
AGENT_TOKEN = os.environ.get("NETGUARD_AGENT_TOKEN", "netguard-agent-secret-auth-token-2026")
POLL_INTERVAL_SECONDS = int(os.environ.get("POLL_INTERVAL", "10"))
HOSTNAME = socket.gethostname()


def get_ip_and_mac() -> tuple:
    """Determine host primary IP and MAC address."""
    ip = "127.0.0.1"
    mac = None
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 1))
        ip = s.getsockname()[0]
        s.close()
    except Exception:
        ip = "127.0.0.1"

    try:
        if_addrs = psutil.net_if_addrs()
        for iface, addrs in if_addrs.items():
            has_ip = any(addr.address == ip for addr in addrs if addr.family == socket.AF_INET)
            if has_ip:
                for addr in addrs:
                    if addr.family == psutil.AF_LINK or addr.family == getattr(socket, 'AF_PACKET', -1):
                        mac = addr.address.replace("-", ":").upper()
                        break
    except Exception:
        pass

    return ip, mac


def get_hardware_info() -> tuple:
    """Retrieve hardware vendor, product model, and distribution."""
    vendor = None
    model = None
    distro = None

    # Try DMI sysfs
    try:
        if os.path.exists("/sys/class/dmi/id/sys_vendor"):
            with open("/sys/class/dmi/id/sys_vendor", "r") as f:
                vendor = f.read().strip()
        if os.path.exists("/sys/class/dmi/id/product_name"):
            with open("/sys/class/dmi/id/product_name", "r") as f:
                model = f.read().strip()
    except Exception:
        pass

    # Try os-release
    try:
        if os.path.exists("/etc/os-release"):
            with open("/etc/os-release", "r") as f:
                for line in f:
                    if line.startswith("PRETTY_NAME="):
                        distro = line.split("=")[1].strip().strip('"')
                        break
    except Exception:
        pass

    if not distro:
        distro = f"Linux ({platform.system()} {platform.release()})"

    return vendor, model, distro


def send_payload(endpoint: str, data: dict) -> bool:
    """Send JSON payload to SHALX NETGUARD backend with X-Agent-Token."""
    url = f"{SOC_SERVER_URL.rstrip('/')}/api/v1/agent/{endpoint}"
    req_body = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=req_body,
        headers={
            'Content-Type': 'application/json',
            'X-Agent-Token': AGENT_TOKEN
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            return response.status in [200, 201]
    except urllib.error.URLError as e:
        logger.warning(f"Connection failed to {url}: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending metrics: {e}")
        return False


def collect_metrics() -> dict:
    """Sample CPU, RAM, Disk, and Network telemetry."""
    cpu_pct = psutil.cpu_percent(interval=1)
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    net_io = psutil.net_io_counters()
    uptime = int(time.time() - psutil.boot_time())

    return {
        "hostname": HOSTNAME,
        "os_name": f"Linux ({platform.system()} {platform.release()})",
        "cpu_percent": round(cpu_pct, 1),
        "ram_percent": round(ram.percent, 1),
        "disk_percent": round(disk.percent, 1),
        "network_in_bytes": net_io.bytes_recv,
        "network_out_bytes": net_io.bytes_sent,
        "uptime_seconds": uptime
    }


def send_heartbeat():
    """Register agent presence with SHALX NETGUARD SOC."""
    ip, mac = get_ip_and_mac()
    vendor, model, distro = get_hardware_info()

    payload = {
        "hostname": HOSTNAME,
        "ip_address": ip,
        "mac_address": mac,
        "vendor": vendor or "Linux Host",
        "os_name": "Linux",
        "os_version": distro,
        "device_type": "server",
        "agent_version": "1.0.0"
    }
    success = send_payload("heartbeat", payload)
    if success:
        logger.info(f"Registered heartbeat for {HOSTNAME} ({ip} / {mac}) with SOC server.")


def main():
    logger.info(f"Starting SHALX NETGUARD Host Monitoring Agent on {HOSTNAME}...")
    logger.info(f"Target SOC Server: {SOC_SERVER_URL}")
    send_heartbeat()

    last_heartbeat_time = time.time()

    while True:
        try:
            metrics = collect_metrics()
            send_payload("metrics", metrics)

            # Re-heartbeat every 60 seconds
            if time.time() - last_heartbeat_time > 60:
                send_heartbeat()
                last_heartbeat_time = time.time()

        except KeyboardInterrupt:
            logger.info("Agent stopped by user.")
            break
        except Exception as e:
            logger.error(f"Agent error loop: {e}")

        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
