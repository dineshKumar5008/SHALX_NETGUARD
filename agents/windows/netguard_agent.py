"""
SHALX NETGUARD Host Monitoring Agent (Windows)
Collects CPU, Memory, Disk, and Network telemetry on Windows hosts
and transmits authenticated telemetry to SHALX NETGUARD SOC backend.
"""

import os
import sys
import time
import socket
import json
import logging
import platform
import subprocess
import urllib.request
import urllib.error

try:
    import psutil
except ImportError:
    print("[ERROR] 'psutil' is required. Run: pip install psutil")
    sys.exit(1)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [SHALX-NETGUARD-Agent-Windows]: %(message)s"
)
logger = logging.getLogger("netguard.agent.windows")

# Configuration
SOC_SERVER_URL = os.environ.get("NETGUARD_SERVER_URL", "http://192.168.30.10:8000")
AGENT_TOKEN = os.environ.get("NETGUARD_AGENT_TOKEN", "netguard-agent-secret-auth-token-2026")
POLL_INTERVAL_SECONDS = int(os.environ.get("POLL_INTERVAL", "10"))
HOSTNAME = socket.gethostname()


def get_ip_and_mac() -> tuple:
    """Determine host primary IPv4 and MAC address."""
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
    """Retrieve Windows system manufacturer, model, and OS version."""
    vendor = None
    model = None
    os_ver = f"Windows {platform.release()} (Build {platform.version()})"

    try:
        res = subprocess.run(
            ["powershell", "-NoProfile", "-Command", "Get-CimInstance -ClassName Win32_ComputerSystem | Select-Object -Property Manufacturer,Model | ConvertTo-Json"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if res.returncode == 0 and res.stdout.strip():
            data = json.loads(res.stdout.strip())
            vendor = data.get("Manufacturer")
            model = data.get("Model")
    except Exception:
        pass

    return vendor, model, os_ver


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
        logger.warning(f"Connection error to {url}: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return False


def collect_metrics() -> dict:
    """Collect Windows resource utilization telemetry."""
    cpu_pct = psutil.cpu_percent(interval=1)
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage('C:\\')
    net_io = psutil.net_io_counters()
    uptime = int(time.time() - psutil.boot_time())

    return {
        "hostname": HOSTNAME,
        "os_name": f"Windows {platform.release()}",
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
    vendor, model, os_ver = get_hardware_info()

    payload = {
        "hostname": HOSTNAME,
        "ip_address": ip,
        "mac_address": mac,
        "vendor": vendor or "PC Workstation",
        "os_name": "Windows",
        "os_version": os_ver,
        "device_type": "workstation",
        "agent_version": "1.0.0"
    }
    success = send_payload("heartbeat", payload)
    if success:
        logger.info(f"Registered Windows heartbeat for {HOSTNAME} ({ip} / {mac}) with SOC.")


def main():
    logger.info(f"Starting SHALX NETGUARD Windows Monitoring Agent on {HOSTNAME}...")
    logger.info(f"Target SOC Server: {SOC_SERVER_URL}")
    send_heartbeat()

    last_heartbeat_time = time.time()

    while True:
        try:
            metrics = collect_metrics()
            send_payload("metrics", metrics)

            if time.time() - last_heartbeat_time > 60:
                send_heartbeat()
                last_heartbeat_time = time.time()

        except KeyboardInterrupt:
            logger.info("Agent stopped by user.")
            break
        except Exception as e:
            logger.error(f"Agent loop error: {e}")

        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
