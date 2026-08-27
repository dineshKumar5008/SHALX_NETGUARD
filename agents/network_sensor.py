"""
SHALX NETGUARD Remote Network Sensor
Authorized Local LAN Discovery & Physical Device Telemetry Collector.

This sensor runs locally inside an authorized customer / operator network.
It performs real evidence-based discovery (ARP discovery, interface inspection,
port probes, and OS classification) and securely streams the telemetry over HTTPS
to the hosted SHALX NETGUARD SOC cloud backend.
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
from typing import List, Dict, Any, Optional

try:
    import psutil
except ImportError:
    print("[ERROR] 'psutil' is required. Run: pip install psutil")
    sys.exit(1)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [SHALX-NETGUARD-Sensor]: %(message)s"
)
logger = logging.getLogger("netguard.sensor")

# Environment & Configuration
SOC_SERVER_URL = os.environ.get("NETGUARD_SERVER_URL", "http://127.0.0.1:8000").rstrip("/")
AGENT_TOKEN = os.environ.get("NETGUARD_AGENT_TOKEN", "netguard-agent-secret-auth-token-2026")
POLL_INTERVAL_SECONDS = int(os.environ.get("POLL_INTERVAL", "60"))
SENSOR_ID = os.environ.get("NETGUARD_SENSOR_ID", f"SENSOR-{socket.gethostname().upper()}")

PORT_SERVICE_MAP = {
    21: ("FTP", "Router"),
    22: ("SSH", "Linux"),
    23: ("Telnet", "Router"),
    53: ("DNS", "Router"),
    80: ("HTTP", "Web/Router"),
    443: ("HTTPS", "Web/Router"),
    445: ("SMB", "Desktop/Laptop"),
    515: ("LPD", "Printer"),
    631: ("IPP", "Printer"),
    1900: ("SSDP", "IoT"),
    3389: ("RDP", "Desktop/Laptop"),
    8008: ("Cast", "IoT"),
    8080: ("HTTP-Alt", "Web/Router"),
    9100: ("RAW-Print", "Printer"),
}


def get_default_gateway_and_ip() -> tuple:
    """Retrieve local active IP and default gateway."""
    local_ip = "127.0.0.1"
    gateway_ip = None

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 1))
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        local_ip = "127.0.0.1"

    # Gateway inspection
    try:
        if platform.system().lower() == "windows":
            res = subprocess.run(["route", "print", "0.0.0.0"], capture_output=True, text=True, timeout=4)
            for line in res.stdout.splitlines():
                parts = line.strip().split()
                if len(parts) >= 5 and parts[0] == "0.0.0.0" and parts[1] == "0.0.0.0":
                    gateway_ip = parts[2]
                    break
        else:
            res = subprocess.run(["ip", "route", "show", "default"], capture_output=True, text=True, timeout=4)
            for line in res.stdout.splitlines():
                if "default via" in line:
                    gateway_ip = line.split()[2]
                    break
    except Exception as e:
        logger.debug(f"Gateway resolution notice: {e}")

    return local_ip, gateway_ip


def get_local_mac_for_ip(ip: str) -> Optional[str]:
    """Inspect local network interfaces to match MAC for IP."""
    try:
        if_addrs = psutil.net_if_addrs()
        for iface, addrs in if_addrs.items():
            has_ip = any(addr.address == ip for addr in addrs if addr.family == socket.AF_INET)
            if has_ip:
                for addr in addrs:
                    if addr.family == psutil.AF_LINK or addr.family == getattr(socket, 'AF_PACKET', -1):
                        return addr.address.replace("-", ":").upper()
    except Exception:
        pass
    return None


def inspect_arp_table() -> List[Dict[str, str]]:
    """Query OS ARP table for active neighbor nodes."""
    nodes = []
    try:
        if platform.system().lower() == "windows":
            res = subprocess.run(["arp", "-a"], capture_output=True, text=True, timeout=5)
            for line in res.stdout.splitlines():
                parts = line.strip().split()
                if len(parts) >= 3 and "." in parts[0] and "-" in parts[1]:
                    ip = parts[0]
                    mac = parts[1].replace("-", ":").upper()
                    entry_type = parts[2].lower()
                    if entry_type == "dynamic" and not ip.startswith("169.254.") and not ip.startswith("224.") and ip != "255.255.255.255":
                        nodes.append({"ip": ip, "mac": mac})
        else:
            res = subprocess.run(["ip", "neigh"], capture_output=True, text=True, timeout=5)
            for line in res.stdout.splitlines():
                parts = line.strip().split()
                if len(parts) >= 5 and "lladdr" in parts:
                    ip = parts[0]
                    mac_idx = parts.index("lladdr") + 1
                    if mac_idx < len(parts):
                        mac = parts[mac_idx].upper()
                        if "REACHABLE" in line or "DELAY" in line or "STALE" in line:
                            nodes.append({"ip": ip, "mac": mac})
    except Exception as e:
        logger.warning(f"ARP table scan warning: {e}")
    return nodes


def probe_ports(ip: str, ports: List[int]) -> List[int]:
    """Non-intrusive TCP connect scan on standard indicator ports."""
    open_ports = []
    for port in ports:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(0.2)
            res = sock.connect_ex((ip, port))
            if res == 0:
                open_ports.append(port)
            sock.close()
        except Exception:
            pass
    return open_ports


def resolve_hostname(ip: str) -> Optional[str]:
    """Safe reverse DNS lookup."""
    try:
        host, _, _ = socket.gethostbyaddr(ip)
        return host
    except Exception:
        return None


def scan_local_network() -> List[Dict[str, Any]]:
    """Execute complete evidence-based LAN discovery sweep."""
    local_ip, gateway_ip = get_default_gateway_and_ip()
    local_mac = get_local_mac_for_ip(local_ip)
    discovered_nodes = []

    # 1. Add Local Host Device
    local_hostname = socket.gethostname()
    local_os = f"{platform.system()} {platform.release()}"
    has_battery = False
    try:
        batt = psutil.sensors_battery()
        has_battery = batt is not None
    except Exception:
        pass

    local_dev_type = "Laptop" if has_battery else "Desktop"
    discovered_nodes.append({
        "ip_address": local_ip,
        "mac_address": local_mac,
        "hostname": local_hostname,
        "vendor": "Local Host System",
        "os_type": platform.system(),
        "os_version": local_os,
        "os_confidence": "High",
        "device_type": local_dev_type,
        "device_type_confidence": "High",
        "architecture": platform.machine(),
        "open_ports": [],
        "detected_services": ["Local Sensor Agent"],
        "is_gateway": False,
        "is_local_host": True,
        "interface_name": "eth0"
    })

    # 2. Add Default Gateway if known
    if gateway_ip and gateway_ip != local_ip:
        gw_ports = probe_ports(gateway_ip, [80, 443, 53, 22, 23, 8080])
        gw_services = [PORT_SERVICE_MAP[p][0] for p in gw_ports if p in PORT_SERVICE_MAP]
        discovered_nodes.append({
            "ip_address": gateway_ip,
            "mac_address": None,
            "hostname": resolve_hostname(gateway_ip) or "Default Gateway",
            "vendor": "Network Gateway",
            "os_type": "RouterOS / Embedded Linux",
            "os_version": None,
            "os_confidence": "Medium",
            "device_type": "Router",
            "device_type_confidence": "High",
            "architecture": None,
            "open_ports": gw_ports,
            "detected_services": gw_services,
            "is_gateway": True,
            "is_local_host": False,
            "interface_name": "eth0"
        })

    # 3. Add ARP Discovered Neighbors
    arp_entries = inspect_arp_table()
    for entry in arp_entries:
        ip = entry["ip"]
        mac = entry["mac"]

        # Skip if already added
        if any(d["ip_address"] == ip for d in discovered_nodes):
            continue

        ports = probe_ports(ip, list(PORT_SERVICE_MAP.keys()))
        services = [PORT_SERVICE_MAP[p][0] for p in ports if p in PORT_SERVICE_MAP]

        # Determine evidence-based device type
        dev_type = "Unknown"
        conf = "Low"
        if 9100 in ports or 515 in ports or 631 in ports:
            dev_type = "Printer"
            conf = "High"
        elif 53 in ports or 8080 in ports:
            dev_type = "Router"
            conf = "Medium"
        elif 1900 in ports or 8008 in ports:
            dev_type = "IoT"
            conf = "Medium"
        elif 3389 in ports or 445 in ports:
            dev_type = "Desktop"
            conf = "Medium"
        elif 22 in ports:
            dev_type = "Linux Host"
            conf = "Medium"

        hostname = resolve_hostname(ip)
        discovered_nodes.append({
            "ip_address": ip,
            "mac_address": mac,
            "hostname": hostname,
            "vendor": None,
            "os_type": "Unknown",
            "os_version": None,
            "os_confidence": "Low",
            "device_type": dev_type,
            "device_type_confidence": conf,
            "architecture": None,
            "open_ports": ports,
            "detected_services": services,
            "is_gateway": False,
            "is_local_host": False,
            "interface_name": "eth0"
        })

    return discovered_nodes


def transmit_discovery_payload(devices: List[Dict[str, Any]]) -> bool:
    """Send authenticated discovery sync batch to cloud backend."""
    url = f"{SOC_SERVER_URL}/api/v1/agent/discovery-sync"
    local_ip, gateway_ip = get_default_gateway_and_ip()

    payload = {
        "sensor_id": SENSOR_ID,
        "sensor_hostname": socket.gethostname(),
        "monitored_subnet": f"{local_ip.rsplit('.', 1)[0]}.0/24" if "." in local_ip else None,
        "gateway_ip": gateway_ip,
        "devices": devices
    }

    req_data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=req_data,
        headers={
            "Content-Type": "application/json",
            "X-Agent-Token": AGENT_TOKEN
        }
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status == 200:
                res_json = json.loads(response.read().decode('utf-8'))
                logger.info(f"Successfully synced {res_json.get('synced_devices_count', len(devices))} live network devices with SOC cloud backend.")
                return True
    except urllib.error.HTTPError as e:
        logger.error(f"SOC backend rejected sync (HTTP {e.code}): {e.read().decode('utf-8', 'ignore')}")
    except Exception as e:
        logger.error(f"Failed to transmit discovery payload to {url}: {e}")

    return False


def run_sensor():
    """Main daemon loop for continuous local network posture monitoring."""
    logger.info(f"Starting SHALX NETGUARD Sensor [ID: {SENSOR_ID}] -> Target SOC: {SOC_SERVER_URL}")
    while True:
        try:
            logger.info("Executing authorized local network discovery sweep...")
            nodes = scan_local_network()
            logger.info(f"Discovered {len(nodes)} physical node(s) on local subnet.")
            transmit_discovery_payload(nodes)
        except Exception as e:
            logger.error(f"Sensor sweep error: {e}")

        logger.info(f"Sleeping {POLL_INTERVAL_SECONDS}s until next discovery cycle...")
        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--once":
        logger.info("Running single discovery scan and exiting (--once)...")
        nodes = scan_local_network()
        transmit_discovery_payload(nodes)
    else:
        run_sensor()
