import json
import os
import re
import socket
import struct
import platform
import asyncio
import subprocess
import ipaddress
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional, Set, Tuple

import psutil
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import delete

from backend.app.core.config import settings
from backend.app.models.device import Device, NetworkInterface
from backend.app.websocket.manager import ws_manager

logger = logging.getLogger("netguard.collectors.discovery")

# Comprehensive Port to Service Name Mapping
PORT_SERVICE_MAP = {
    21: "FTP",
    22: "SSH",
    23: "Telnet",
    25: "SMTP",
    53: "DNS",
    67: "DHCP Server",
    68: "DHCP Client",
    80: "HTTP Web Server",
    110: "POP3",
    123: "NTP",
    135: "MSRPC (Windows RPC)",
    137: "NetBIOS-NS",
    138: "NetBIOS-DGM",
    139: "NetBIOS-SSN",
    143: "IMAP",
    443: "HTTPS Web Server",
    445: "Microsoft-DS (SMB)",
    515: "LPD Line Printer Daemon",
    554: "RTSP Video Stream",
    631: "IPP Internet Printing Protocol",
    993: "IMAPS",
    995: "POP3S",
    1883: "MQTT IoT Broker",
    1900: "UPnP / SSDP Media Service",
    3306: "MySQL Database",
    3389: "MS-RDP Remote Desktop",
    5000: "UPnP / Media Server",
    5353: "mDNS Multicast DNS",
    5357: "WSD (Web Services for Devices)",
    5432: "PostgreSQL Database",
    7000: "AirPlay Mirroring",
    8000: "HTTP NetGuard / Dev API",
    8008: "Google Cast / Chromecast API",
    8009: "Google Cast Protocol",
    8080: "HTTP-Proxy / Router Web Admin",
    8443: "HTTPS-Alt / Router Web Admin",
    9100: "RAW JetDirect Print Server",
}

# Comprehensive IEEE OUI Vendor Database Mapping
VENDOR_MAP = {
    # Virtualization & Cloud
    "00:50:56": "VMware Virtual Machine",
    "00:0C:29": "VMware Virtual Machine",
    "00:05:69": "VMware Virtual Machine",
    "00:15:5D": "Microsoft Hyper-V",
    "52:54:00": "QEMU / KVM Virtual",
    "08:00:27": "Oracle VirtualBox",
    "00:16:3E": "Xen Virtual Machine",
    "02:42:AC": "Docker Container Bridge",
    
    # Mobile Manufacturers & Phones
    "00:17:F2": "Apple Inc.",
    "00:1C:B3": "Apple Inc.",
    "00:23:12": "Apple Inc.",
    "00:26:08": "Apple Inc.",
    "3C:07:54": "Apple Inc.",
    "A4:83:E7": "Apple Inc.",
    "F0:18:98": "Apple Inc.",
    "38:F9:D3": "Apple Inc.",
    "98:01:A7": "Apple Inc.",
    "BC:D0:74": "Apple Inc.",
    "AC:DE:48": "Apple Inc.",
    "F4:34:F0": "Apple Inc.",
    "70:EC:E4": "Apple Inc.",
    "A0:99:9B": "Apple Inc.",
    
    "00:12:47": "Samsung Electronics",
    "18:3A:2D": "Samsung Electronics",
    "30:9C:23": "Samsung Electronics",
    "50:01:D9": "Samsung Electronics",
    "84:25:DB": "Samsung Electronics",
    "A8:7C:01": "Samsung Electronics",
    "BC:72:B7": "Samsung Electronics",
    "E8:50:8B": "Samsung Electronics",
    
    "58:41:20": "Xiaomi Communications",
    "64:09:80": "Xiaomi Communications",
    "74:23:44": "Xiaomi Communications",
    "9C:99:A0": "Xiaomi Communications",
    "A4:44:D1": "Xiaomi Communications",
    "D8:15:0D": "Xiaomi Communications",
    "E4:46:DA": "Xiaomi Communications",
    "F0:B4:29": "Xiaomi Communications",

    "94:65:2D": "OnePlus Technology",
    "C0:EE:FB": "OnePlus Technology",
    "70:BF:92": "OnePlus Technology",

    "00:E0:FC": "Huawei Technologies",
    "20:F4:78": "Huawei Technologies",
    "48:46:FB": "Huawei Technologies",
    "70:72:3C": "Huawei Technologies",
    "AC:E8:7B": "Huawei Technologies",
    "D4:6E:5C": "Huawei Technologies",

    "54:6C:EB": "Vivo Mobile",
    "A0:69:86": "Vivo Mobile",
    "E4:0A:75": "Vivo Mobile",

    "14:5B:D1": "Oppo Mobile",
    "48:3F:E9": "Oppo Mobile",
    "A4:75:B4": "Oppo Mobile",
    "B0:D5:9D": "Oppo Mobile",
    "C0:CC:F8": "Oppo Mobile",

    "00:1A:11": "Google LLC",
    "3C:5A:B4": "Google LLC",
    "F4:F5:D8": "Google LLC",
    "D8:8C:79": "Google Pixel",
    "3C:28:6D": "Google Pixel",

    "00:0C:E5": "Motorola Mobility",
    "40:88:05": "Motorola Mobility",
    "F8:CF:C5": "Motorola Mobility",

    # Printers & Imaging
    "00:1E:0B": "HP LaserJet / Printer",
    "00:11:0A": "Hewlett-Packard Printer",
    "00:1E:8F": "Canon Printer",
    "00:00:85": "Canon Inc.",
    "00:26:AB": "Seiko Epson Printer",
    "00:00:48": "Seiko Epson Corp.",
    "00:80:77": "Brother Industries Printer",
    "00:00:AA": "Xerox Corporation Printer",
    "00:00:07": "Xerox Corporation",
    "00:04:00": "Lexmark International",
    "00:20:00": "Lexmark International",

    # IoT & Smart Devices
    "68:37:E9": "Amazon Technologies (Echo/FireTV)",
    "FC:65:DE": "Amazon Technologies (Echo/FireTV)",
    "B4:7C:9C": "Amazon Technologies",
    "D8:31:34": "Roku Inc.",
    "00:0D:4B": "Roku Streaming",
    "94:10:3E": "Sonos Inc.",
    "5C:AA:FD": "Sonos Inc.",
    "24:0A:C4": "Espressif IoT (ESP32/ESP8266)",
    "30:AE:A4": "Espressif IoT (ESP32/ESP8266)",
    "D8:F1:5B": "Espressif IoT",
    "68:C6:3A": "Tuya Smart IoT",
    "70:2C:1F": "Tuya Smart IoT",
    "A4:C1:38": "Tuya Smart IoT",
    "54:60:09": "Google Nest / Chromecast",
    "6C:AD:F8": "Google Home / Chromecast",
    "CC:2D:B7": "LG Electronics Smart TV",
    "00:04:1F": "Sony Corporation (Bravia TV)",
    "70:9E:29": "Sony Interactive (PlayStation)",
    "00:17:88": "Philips Lighting (Hue Bridge)",

    # PC / Server / Workstation Hardware
    "00:1A:A0": "Dell PowerEdge",
    "00:1E:4F": "Dell Computer",
    "B8:2A:72": "Dell Computer",
    "F8:DB:88": "Dell Computer",
    "00:1E:67": "Intel Corporation",
    "00:1B:21": "Intel Corporation",
    "A4:BB:6D": "Intel Corporation",
    "00:24:E8": "Dell Computer",
    "3C:D9:2B": "Hewlett Packard Enterprise",
    "00:1F:29": "Hewlett Packard Enterprise",
    "70:5A:0F": "Hewlett Packard",
    "00:0A:F7": "Super Micro Computer",
    "B8:27:EB": "Raspberry Pi Foundation",
    "DC:A6:32": "Raspberry Pi 4",
    "E4:5F:01": "Raspberry Pi 4",
    "28:CD:C1": "Raspberry Pi Trading",
    "00:E0:4C": "Realtek Semiconductor",
    "54:04:A6": "Realtek Semiconductor",
    "E8:9C:25": "Realtek Semiconductor",
    "F8:54:F6": "MediaTek Inc.",
    "00:1F:D0": "Giga-Byte Technology",
    "70:85:C2": "ASUSTek Computer",
    "AC:16:2D": "Hon Hai Precision (Foxconn)",
    
    # Network Gateways & Routers
    "F8:75:A4": "Cisco Systems",
    "00:08:E3": "Cisco Systems",
    "00:1C:10": "Cisco Systems",
    "00:04:96": "Extreme Networks",
    "00:08:54": "Netgear",
    "00:1F:33": "Netgear",
    "00:09:5B": "Netgear Inc.",
    "20:E5:2A": "Netgear Inc.",
    "70:3A:0E": "Ubiquiti Networks",
    "B4:FB:E4": "Ubiquiti Networks",
    "00:0C:42": "MikroTik RouterOS",
    "AC:84:C6": "TP-Link Technologies",
    "50:C7:BF": "TP-Link Technologies",
    "C0:06:C3": "TP-Link Technologies",
    "00:25:86": "TP-Link Technologies",
    "00:0C:E6": "TP-Link Technologies",
    "00:1E:58": "D-Link International",
    "00:13:49": "Zyxel Communications",
    "00:18:39": "Cisco-Linksys",
}


def normalize_mac(raw_mac: Optional[str]) -> Optional[str]:
    """Normalize MAC string to uppercase standard format XX:XX:XX:XX:XX:XX."""
    if not raw_mac:
        return None
    cleaned = re.sub(r"[^0-9A-Fa-f]", "", raw_mac).upper()
    if len(cleaned) == 12:
        return ":".join(cleaned[i:i+2] for i in range(0, 12, 2))
    return raw_mac.replace("-", ":").upper()


def is_locally_administered_mac(mac: str) -> bool:
    """
    Check if MAC has locally administered / randomized bit set (common in mobile hotspot clients).
    Bit 1 of the first byte is 1 (e.g. x2, x6, xA, xE).
    """
    try:
        first_byte = int(mac.split(":")[0], 16)
        return bool(first_byte & 0x02)
    except Exception:
        return False


def get_vendor_by_mac(mac: Optional[str]) -> Optional[str]:
    """Lookup hardware vendor by MAC OUI prefix or detect randomized mobile address."""
    if not mac:
        return None
    clean_mac = normalize_mac(mac)
    if not clean_mac:
        return None
    prefix = ":".join(clean_mac.split(":")[:3]) if len(clean_mac.split(":")) >= 3 else ""
    
    vendor = VENDOR_MAP.get(prefix)
    if vendor:
        return vendor
    
    # Detect Android / iOS randomized MAC
    if is_locally_administered_mac(clean_mac):
        return "Mobile Device (Private Wi-Fi MAC)"

    return None


def is_virtual_or_secondary_interface_name(if_name: str) -> bool:
    """Detect if an interface name belongs to a virtual machine, VPN, or bridge adapter."""
    name_lower = if_name.lower()
    virtual_keywords = [
        "virtualbox", "vbox", "vmnet", "vmware", "vethernet", 
        "hyper-v", "wsl", "tap", "tun", "vpn", "mcafee", "nordvpn",
        "tailscale", "wireguard", "zerotier", "docker", "veth",
        "loopback", "bluetooth", "local area connection*", "teredo", "vgate"
    ]
    return any(kw in name_lower for kw in virtual_keywords)


def is_link_local_or_bogon_ip(ip: Optional[str]) -> bool:
    """Check if an IP is link-local (169.254.x.x), loopback (127.x.x.x), multicast, or broadcast."""
    if not ip:
        return True
    if ip.startswith("169.254.") or ip.startswith("127.") or ip.startswith("224.") or ip.startswith("239.") or ip == "255.255.255.255":
        return True
    try:
        ip_obj = ipaddress.IPv4Address(ip)
        return ip_obj.is_link_local or ip_obj.is_loopback or ip_obj.is_multicast or ip_obj.is_reserved
    except Exception:
        return True


def get_system_default_gateway() -> Optional[str]:
    """Determine the real system default gateway IPv4 address dynamically."""
    os_sys = platform.system().lower()
    try:
        if os_sys == "windows":
            res = subprocess.run(["route", "print", "0.0.0.0"], capture_output=True, text=True, timeout=3)
            for line in res.stdout.splitlines():
                parts = line.strip().split()
                if len(parts) >= 4 and parts[0] == "0.0.0.0" and parts[1] == "0.0.0.0":
                    gw = parts[2]
                    if re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", gw) and not is_link_local_or_bogon_ip(gw):
                        return gw
        elif os_sys == "linux":
            if os.path.exists("/proc/net/route"):
                with open("/proc/net/route", "r") as f:
                    for line in f.readlines()[1:]:
                        fields = line.strip().split()
                        if len(fields) >= 3 and fields[1] == "00000000":
                            gw_hex = fields[2]
                            gw_bytes = bytes.fromhex(gw_hex)
                            return socket.inet_ntoa(gw_bytes[::-1])
            res = subprocess.run(["ip", "route", "show", "default"], capture_output=True, text=True, timeout=3)
            parts = res.stdout.strip().split()
            if len(parts) >= 3 and parts[0] == "default" and parts[1] == "via":
                return parts[2]
    except Exception as e:
        logger.debug(f"Default gateway detection error: {e}")
    return None


def get_primary_host_network_context() -> Dict[str, Any]:
    """
    Determine the single active physical default-routed network interface of the host laptop.
    Returns:
      - interface_name: str (e.g. 'Wi-Fi')
      - ip_address: str (e.g. '172.23.230.57')
      - mac_address: Optional[str]
      - subnet_cidr: str (e.g. '172.23.230.0/24')
      - gateway_ip: Optional[str]
      - secondary_interfaces: List[Dict[str, Any]] (other host interfaces attached to this device)
    """
    default_gw = get_system_default_gateway()
    if_addrs = psutil.net_if_addrs()
    if_stats = psutil.net_if_stats()

    default_if_ip = None
    default_if_name = None
    default_if_mac = None
    default_if_netmask = "255.255.255.0"

    # 1. On Windows, read interface IP tied to 0.0.0.0 route
    if platform.system().lower() == "windows":
        try:
            res = subprocess.run(["route", "print", "0.0.0.0"], capture_output=True, text=True, timeout=3)
            for line in res.stdout.splitlines():
                parts = line.strip().split()
                if len(parts) >= 4 and parts[0] == "0.0.0.0" and parts[1] == "0.0.0.0":
                    candidate_ip = parts[3]
                    if not is_link_local_or_bogon_ip(candidate_ip):
                        default_if_ip = candidate_ip
                        break
        except Exception:
            pass

    # 2. Locate matching active interface in psutil
    secondary_interfaces = []
    for if_name, addrs in if_addrs.items():
        stat = if_stats.get(if_name)
        is_up = stat.isup if stat else False
        
        cur_ip = None
        cur_mac = None
        cur_netmask = "255.255.255.0"
        
        for a in addrs:
            if a.family == socket.AF_INET and not a.address.startswith("127."):
                cur_ip = a.address
                if a.netmask:
                    cur_netmask = a.netmask
            elif a.family == psutil.AF_LINK or a.family == getattr(socket, 'AF_PACKET', -1):
                cur_mac = normalize_mac(a.address)

        if cur_ip:
            if cur_ip == default_if_ip or (not default_if_ip and is_up and not is_virtual_or_secondary_interface_name(if_name) and not is_link_local_or_bogon_ip(cur_ip)):
                default_if_ip = cur_ip
                default_if_name = if_name
                default_if_mac = cur_mac
                default_if_netmask = cur_netmask
            else:
                secondary_interfaces.append({
                    "interface_name": if_name,
                    "ip_address": cur_ip,
                    "mac_address": cur_mac,
                    "is_primary": False
                })

    # Fallback default interface if none matched
    if not default_if_ip:
        default_if_ip = "127.0.0.1"
        default_if_name = "eth0"
        default_subnet = "127.0.0.1/32"
    else:
        try:
            net_obj = ipaddress.IPv4Network(f"{default_if_ip}/{default_if_netmask}", strict=False)
            default_subnet = str(net_obj)
        except Exception:
            default_subnet = f"{default_if_ip}/24"

    return {
        "interface_name": default_if_name or "Wi-Fi",
        "ip_address": default_if_ip,
        "mac_address": default_if_mac,
        "netmask": default_if_netmask,
        "subnet_cidr": default_subnet,
        "gateway_ip": default_gw,
        "secondary_interfaces": secondary_interfaces
    }


def get_active_local_subnets() -> List[str]:
    """
    Detect ONLY the active physical Wi-Fi/Ethernet subnets connected to the monitored network.
    Excludes link-local (169.254.x.x), loopback, and virtual adapter subnets (VirtualBox, Hyper-V, WSL).
    """
    subnets: Set[str] = set()
    context = get_primary_host_network_context()
    primary_subnet = context.get("subnet_cidr")
    
    if primary_subnet and not primary_subnet.startswith("127.") and not primary_subnet.startswith("169.254."):
        subnets.add(primary_subnet)

    # Include any explicitly authorized CIDRs from configuration
    for net in settings.MONITORED_NETWORKS:
        if net and not net.startswith("169.254.") and not net.startswith("127."):
            subnets.add(net)

    return list(subnets)


def get_device_subnet_and_vlan(ip: str, monitored_subnets: Optional[List[str]] = None) -> Tuple[str, str]:
    """
    Calculate the subnet CIDR and VLAN description for a given IP address.
    """
    if not ip or is_link_local_or_bogon_ip(ip):
        return "127.0.0.0/8", "Loopback / Isolated"

    try:
        ip_obj = ipaddress.IPv4Address(ip)
        if monitored_subnets:
            for s in monitored_subnets:
                try:
                    net_obj = ipaddress.IPv4Network(s, strict=False)
                    if ip_obj in net_obj:
                        cidr = str(net_obj)
                        parts = cidr.split(".")
                        vlan_id = parts[2] if len(parts) > 2 else "1"
                        return cidr, f"VLAN {vlan_id}"
                except Exception:
                    pass

        # Default /24 network calculation
        net_obj = ipaddress.IPv4Network(f"{ip}/24", strict=False)
        cidr = str(net_obj)
        parts = cidr.split(".")
        vlan_id = parts[2] if len(parts) > 2 else "1"
        return cidr, f"VLAN {vlan_id}"
    except Exception:
        return "192.168.1.0/24", "VLAN 1"


def query_netbios_name(ip: str, timeout: float = 0.25) -> Optional[str]:
    """Attempt to resolve Windows / Samba hostname using NetBIOS Name Service (port 137 UDP)."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(timeout)
        netbios_request = (
            b"\x80\x00\x00\x00\x00\x01\x00\x00\x00\x00\x00\x00"
            b"\x20CKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\x00\x00\x21\x00\x01"
        )
        sock.sendto(netbios_request, (ip, 137))
        data, _ = sock.recvfrom(1024)
        sock.close()

        if len(data) > 56:
            num_names = data[56]
            if num_names > 0:
                name_bytes = data[57:57 + 15]
                decoded = name_bytes.decode('ascii', errors='ignore').strip()
                if decoded:
                    return decoded
    except Exception:
        pass
    return None


def resolve_hostname(ip: str) -> Optional[str]:
    """
    Resolve real hostname using NetBIOS or Reverse DNS.
    Returns None if unresolved. Never generates fake placeholder names.
    """
    nb_name = query_netbios_name(ip)
    if nb_name:
        return nb_name

    try:
        resolved, _, _ = socket.gethostbyaddr(ip)
        if resolved and not resolved.endswith(".in-addr.arpa") and resolved != ip:
            return resolved
    except Exception:
        pass

    return None


class NetworkDiscoveryService:
    """
    Real Dynamic Network Discovery Engine for Hotspots, Home LANs, and Enterprise Networks.
    Accurately maps the host laptop as a single asset and discovers true connected network clients.
    """

    def get_local_host_device(self) -> Dict[str, Any]:
        """
        Inspect the local host machine running NetGuard.
        Returns ONE unified Device record representing the host laptop/workstation with high confidence.
        """
        context = get_primary_host_network_context()
        host_name = socket.gethostname()
        os_sys = platform.system()
        os_ver = f"{platform.system()} {platform.release()}"
        arch = platform.machine()
        vendor = get_vendor_by_mac(context.get("mac_address")) or "Host Laptop / PC"

        # Hardware chassis & battery detection
        has_battery = False
        try:
            battery = psutil.sensors_battery()
            has_battery = (battery is not None)
        except Exception:
            pass

        host_upper = host_name.upper()
        if has_battery or host_upper.startswith("LAPTOP-") or "NOTEBOOK" in host_upper or "SURFACE" in host_upper or "THINKPAD" in host_upper:
            detected_dev_type = "Laptop"
        elif host_upper.startswith("DESKTOP-") or host_upper.startswith("PC-") or "WORKSTATION" in host_upper:
            detected_dev_type = "Desktop"
        else:
            if_name_lower = (context.get("interface_name") or "").lower()
            detected_dev_type = "Laptop" if ("wi" in if_name_lower or "wlan" in if_name_lower) else "Desktop"

        # Scan local listening ports
        local_open_ports = []
        try:
            for conn in psutil.net_connections(kind='inet'):
                if conn.status == psutil.CONN_LISTEN and conn.laddr.port not in local_open_ports:
                    local_open_ports.append(conn.laddr.port)
        except Exception:
            pass

        detected_services = []
        for p in local_open_ports:
            srv = PORT_SERVICE_MAP.get(p)
            if srv and srv not in detected_services:
                detected_services.append(srv)

        return {
            "ip_address": context["ip_address"],
            "mac_address": context.get("mac_address"),
            "hostname": host_name,
            "vendor": vendor,
            "os_type": "Windows" if os_sys.lower() == "windows" else "macOS" if os_sys.lower() == "darwin" else os_sys,
            "os_version": os_ver,
            "os_confidence": "High",
            "architecture": arch,
            "device_type": detected_dev_type,
            "device_type_confidence": "High",
            "open_ports": json.dumps(sorted(local_open_ports[:25])),
            "detected_services": json.dumps(detected_services[:25]),
            "interface_name": context.get("interface_name", "Wi-Fi"),
            "secondary_interfaces": context.get("secondary_interfaces", [])
        }

    def read_system_arp_table(self, monitored_subnets: List[str], host_ip: str) -> Dict[str, str]:
        """
        Parse local operating system ARP table / neighbor cache.
        Strictly filters to only include active monitored subnet nodes.
        Excludes link-local (169.254.x.x), multicast, and host laptop's own IP.
        """
        arp_entries: Dict[str, str] = {}
        os_name = platform.system().lower()

        # Build set of valid IP networks to match against
        ip_networks = []
        for s in monitored_subnets:
            try:
                ip_networks.append(ipaddress.ip_network(s, strict=False))
            except Exception:
                pass

        try:
            if os_name == "windows":
                res = subprocess.run(["arp", "-a"], capture_output=True, text=True, timeout=4)
                for line in res.stdout.splitlines():
                    parts = line.strip().split()
                    if len(parts) >= 3:
                        ip_candidate = parts[0]
                        mac_candidate = parts[1]
                        if re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", ip_candidate):
                            if ip_candidate != host_ip and not is_link_local_or_bogon_ip(ip_candidate):
                                if "-" in mac_candidate or ":" in mac_candidate:
                                    norm_mac = normalize_mac(mac_candidate)
                                    if norm_mac and norm_mac != "FF:FF:FF:FF:FF:FF":
                                        # Verify IP belongs to a monitored subnet
                                        try:
                                             ip_obj = ipaddress.IPv4Address(ip_candidate)
                                             if not ip_networks or any(ip_obj in net for net in ip_networks):
                                                 arp_entries[ip_candidate] = norm_mac
                                        except Exception:
                                             pass
            elif os_name == "linux":
                if os.path.exists("/proc/net/arp"):
                    with open("/proc/net/arp", "r") as f:
                        lines = f.readlines()
                    for line in lines[1:]:
                        parts = line.split()
                        if len(parts) >= 4:
                            ip = parts[0]
                            mac = parts[3]
                            if mac != "00:00:00:00:00:00" and ip != host_ip and not is_link_local_or_bogon_ip(ip):
                                norm_mac = normalize_mac(mac)
                                try:
                                    ip_obj = ipaddress.IPv4Address(ip)
                                    if not ip_networks or any(ip_obj in net for net in ip_networks):
                                        arp_entries[ip] = norm_mac
                                except Exception:
                                    pass
                else:
                    res = subprocess.run(["ip", "neigh"], capture_output=True, text=True, timeout=4)
                    for line in res.stdout.splitlines():
                        parts = line.strip().split()
                        if len(parts) >= 5 and parts[2] == "lladdr":
                            ip = parts[0]
                            mac = parts[4]
                            if ip != host_ip and not is_link_local_or_bogon_ip(ip):
                                norm_mac = normalize_mac(mac)
                                try:
                                    ip_obj = ipaddress.IPv4Address(ip)
                                    if not ip_networks or any(ip_obj in net for net in ip_networks):
                                        arp_entries[ip] = norm_mac
                                except Exception:
                                    pass
        except Exception as e:
            logger.debug(f"ARP table parse error: {e}")

        return arp_entries

    async def _probe_single_ip(self, ip: str, semaphore: asyncio.Semaphore) -> Tuple[str, bool, Optional[int]]:
        """Probe a single IP across common ports to stimulate ARP resolution."""
        async with semaphore:
            test_ports = [53, 80, 443, 135, 8080, 22]
            for port in test_ports:
                try:
                    _, writer = await asyncio.wait_for(
                        asyncio.open_connection(ip, port),
                        timeout=0.08
                    )
                    writer.close()
                    await writer.wait_closed()
                    return (ip, True, port)
                except (asyncio.TimeoutError, ConnectionRefusedError, OSError):
                    pass
            return (ip, False, None)

    async def active_sweep_subnets(self, cidrs: List[str]):
        """Safely probe monitored subnets with bounded concurrency to refresh the ARP cache."""
        semaphore = asyncio.Semaphore(50)
        tasks = []

        for cidr in cidrs:
            try:
                net = ipaddress.ip_network(cidr, strict=False)
                hosts = list(net.hosts())[:254]
                for h in hosts:
                    tasks.append(self._probe_single_ip(str(h), semaphore))
            except Exception as e:
                logger.warning(f"Invalid CIDR {cidr} for discovery: {e}")

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def fingerprint_node(self, ip: str, mac: Optional[str], default_gw_ip: Optional[str]) -> Dict[str, Any]:
        """
        Enrich discovered node with real verified hostname, vendor, operating system, and device type.
        Calculates device_type, device_type_confidence, os_type, os_confidence, open_ports, detected_services.
        """
        hostname = resolve_hostname(ip)
        vendor = get_vendor_by_mac(mac)
        is_gw = (ip == default_gw_ip)

        # Probe ports for evidence
        probe_ports = [53, 67, 80, 443, 9100, 515, 631, 135, 139, 445, 3389, 5357, 22, 8008, 8009, 1900, 1883, 5000, 8080, 8443]
        open_ports = []
        for port in probe_ports:
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(0.08)
                res = s.connect_ex((ip, port))
                s.close()
                if res == 0:
                    open_ports.append(port)
            except Exception:
                pass

        # Identify detected services
        detected_services = []
        for p in open_ports:
            srv = PORT_SERVICE_MAP.get(p)
            if srv and srv not in detected_services:
                detected_services.append(srv)

        # Evidence-based classification
        device_type = "Unknown"
        device_type_confidence = "Low"
        os_type = None
        os_version = None
        os_confidence = "Low"
        architecture = None

        hostname_upper = (hostname or "").upper()
        vendor_lower = (vendor or "").lower()

        # 1. FIREWALL CLASSIFICATION
        if any(f in vendor_lower for f in ["pfsense", "opnsense", "fortinet", "fortigate", "palo alto", "sophos", "sonicwall", "check point", "firewalla", "smoothwall"]) or \
           any(f in hostname_upper for f in ["PFSENSE", "OPNSENSE", "FORTIGATE", "PALOALTO", "SOPHOS", "SONICWALL", "FIREWALL", "FW-", "NETGUARD-FW"]):
            device_type = "Firewall"
            device_type_confidence = "High"
            os_type = "Firewall OS / Firmware"
            os_confidence = "High"

        # 2. ROUTER / GATEWAY CLASSIFICATION
        elif is_gw:
            device_type = "Router"
            device_type_confidence = "High"
            if not vendor:
                vendor = "Network Gateway / Router"
            if 53 in open_ports and 80 not in open_ports and 443 not in open_ports:
                os_type = "Mobile OS (Hotspot)"
                os_confidence = "Medium"
            else:
                os_type = "RouterOS / Firmware"
                os_confidence = "Medium"
        elif any(r in vendor_lower for r in ["cisco", "tp-link", "netgear", "ubiquiti", "mikrotik", "d-link", "linksys", "zyxel", "openwrt", "dd-wrt", "asus", "tenda", "arista"]) or \
             any(r in hostname_upper for r in ["ROUTER", "GATEWAY", "MIKROTIK", "ROUTEROS", "OPENWRT", "DDWRT", "AP-", "ACCESS-POINT", "HOTSPOT", "WIFI-ROUTER"]):
            device_type = "Router"
            device_type_confidence = "High" if (53 in open_ports or 67 in open_ports or 80 in open_ports) else "Medium"
            os_type = "RouterOS / Firmware"
            os_confidence = "Medium"
        elif (53 in open_ports or 67 in open_ports) and (80 in open_ports or 443 in open_ports or 8080 in open_ports or 8443 in open_ports) and not any(s in hostname_upper for s in ["SERVER", "SRV", "UBUNTU", "DEBIAN", "WIN-"]):
            device_type = "Router"
            device_type_confidence = "Medium"
            os_type = "RouterOS / Firmware"
            os_confidence = "Low"

        # 3. SWITCH CLASSIFICATION
        elif any(s in vendor_lower for s in ["catalyst", "edgeswitch", "prosafe", "procurve", "aruba", "juniper"]) or \
             any(s in hostname_upper for s in ["SWITCH", "SW-", "CATALYST", "EDGESWITCH", "PROSAFE", "PROCURVE", "ARUBA-SW"]):
            device_type = "Switch"
            device_type_confidence = "High"
            os_type = "Switch Firmware"
            os_confidence = "High"

        # 4. PRINTER CLASSIFICATION
        elif 9100 in open_ports or 515 in open_ports or 631 in open_ports:
            device_type = "Printer"
            device_type_confidence = "High"
            os_type = "Printer Firmware"
            os_confidence = "High"
        elif vendor and any(p in vendor_lower for p in ["printer", "canon", "epson", "brother", "xerox", "lexmark", "kyocera", "ricoh", "konica", "fuji", "hewlett-packard printer", "hp laserjet"]):
            device_type = "Printer"
            device_type_confidence = "High" if (80 in open_ports or 443 in open_ports) else "Medium"
            os_type = "Printer Firmware"
            os_confidence = "Medium"
        elif any(p in hostname_upper for p in ["PRINTER", "HP-LASER", "EPSON", "CANON", "BROTHER", "DIRECT-", "MFP", "COPIER"]):
            device_type = "Printer"
            device_type_confidence = "High"
            os_type = "Printer Firmware"
            os_confidence = "Medium"

        # 5. IOT / SMART HOME / MEDIA CLASSIFICATION
        elif any(p in open_ports for p in [554, 1883, 8008, 8009, 1900, 5000, 7000]) or \
             (vendor and any(i in vendor_lower for i in ["espressif", "tuya", "sonos", "roku", "amazon", "nest", "ring", "hue", "philips lighting", "hikvision", "dahua", "wyze", "reolink", "smart tv", "bravia", "chromecast", "playstation", "xbox", "nintendo"])):
            device_type = "IoT"
            device_type_confidence = "High"
            os_type = "Embedded Linux / IoT"
            os_confidence = "Medium"
        elif any(i in hostname_upper for i in ["TV", "CHROMECAST", "ROKU", "ECHO", "SMART", "IOT", "CAM", "SONOS", "ALEXA", "APPLE-TV", "HOME-ASSISTANT", "TPLINK-PLUG", "WEMO", "ESP32", "ESP8266"]):
            device_type = "IoT"
            device_type_confidence = "High"
            os_type = "Embedded Linux / IoT"
            os_confidence = "Medium"

        # 6. MOBILE PHONE / TABLET CLASSIFICATION
        elif (vendor and any(m in vendor_lower for m in ["samsung", "xiaomi", "oneplus", "huawei", "vivo", "oppo", "pixel", "motorola", "realme", "honor", "tecno", "infinix"])) or \
             (vendor and "apple" in vendor_lower and not any(a in hostname_upper for a in ["MACBOOK", "IMAC", "MAC-MINI", "MACPRO"])):
            device_type = "Mobile"
            device_type_confidence = "High"
            os_type = "iOS" if "apple" in vendor_lower else "Android"
            os_confidence = "Medium"
        elif any(m in hostname_upper for m in ["IPHONE", "IPAD", "ANDROID", "GALAXY", "PIXEL", "REDMI", "ONEPLUS", "VIVO", "OPPO", "REALME", "SM-", "M20", "M21", "CPH", "RMX", "PHONE", "TABLET"]):
            device_type = "Mobile"
            device_type_confidence = "High"
            os_type = "iOS" if ("IPHONE" in hostname_upper or "IPAD" in hostname_upper) else "Android"
            os_confidence = "High"
        elif mac and is_locally_administered_mac(mac) and not (135 in open_ports or 445 in open_ports or 22 in open_ports or 3389 in open_ports):
            device_type = "Mobile"
            device_type_confidence = "Medium"
            os_type = "Android / iOS (Private Wi-Fi MAC)"
            os_confidence = "Medium"

        # 7. SERVER CLASSIFICATION
        elif any(s in hostname_upper for s in ["SRV", "SERVER", "PROXMOX", "ESXI", "VSPHERE", "UBUNTU-SERVER", "DEBIAN", "RHEL", "CENTOS", "ROCKY", "ALMALINUX", "FEDORA-SERVER", "PIHOLE", "NAS", "SYNOLOGY", "QNAP", "TRUENAS", "FREEBOOT", "DOCKER", "K8S", "KUBERNETES", "NODE-", "DB-", "DATABASE", "PROD-", "STAGE-", "DEV-SERVER"]):
            device_type = "Server"
            device_type_confidence = "High"
            os_type = "Linux" if any(l in hostname_upper for l in ["UBUNTU", "DEBIAN", "RHEL", "CENTOS", "LINUX"]) else "Server OS"
            os_confidence = "High"
        elif any(p in open_ports for p in [3306, 5432, 27017, 6379, 1521, 1433]):
            device_type = "Server"
            device_type_confidence = "High"
            os_type = "Windows Server" if (135 in open_ports or 445 in open_ports) else "Linux / Database Server"
            os_confidence = "High"

        # 8. LAPTOP CLASSIFICATION
        elif any(h in hostname_upper for h in ["LAPTOP-", "NOTEBOOK", "THINKPAD", "MACBOOK", "SURFACE", "ENVY", "PAVILION", "IDEAPAD", "ZENBOOK", "XPS", "LATITUDE", "PRECISION", "INSPIRON", "ELITEBOOK", "PROBOOK", "YOGA", "SWIFT", "GRAM"]):
            device_type = "Laptop"
            device_type_confidence = "High"
            os_type = "macOS" if "MACBOOK" in hostname_upper else "Windows"
            os_confidence = "High"

        # 9. DESKTOP CLASSIFICATION
        elif any(h in hostname_upper for h in ["DESKTOP-", "PC-", "WORKSTATION", "RIG-", "TOWER", "OPTIPLEX", "VOSTRO", "VERITON", "THINKCENTRE", "PRODESK", "ELITEDESK", "ALL-IN-ONE", "AIO", "MINIPC"]):
            device_type = "Desktop"
            device_type_confidence = "High"
            os_type = "Windows"
            os_confidence = "High"

        # 10. UNKNOWN (Insufficient Evidence - NEVER default arbitrarily to Desktop)
        else:
            device_type = "Unknown"
            device_type_confidence = "Low"
            # Set detectable OS if open ports indicate it, but do NOT assume Desktop hardware
            if 135 in open_ports or 445 in open_ports or 3389 in open_ports or 5357 in open_ports:
                os_type = "Windows"
                os_confidence = "High"
            elif 22 in open_ports:
                os_type = "Linux"
                os_confidence = "Medium"
            else:
                os_type = None
                os_confidence = "Low"

        return {
            "ip_address": ip,
            "mac_address": mac,
            "hostname": hostname,
            "vendor": vendor,
            "os_type": os_type,
            "os_version": os_version,
            "os_confidence": os_confidence,
            "architecture": architecture,
            "device_type": device_type,
            "device_type_confidence": device_type_confidence,
            "open_ports": json.dumps(open_ports),
            "detected_services": json.dumps(detected_services),
            "status": "ONLINE"
        }

    async def scan_monitored_subnets(self, db: AsyncSession) -> List[Device]:
        """
        Execute full dynamic network discovery:
        1. Automatically detect active physical Wi-Fi/Ethernet subnet (e.g. 172.23.230.0/24).
        2. Clean up any stale link-local (169.254.x.x) or virtual adapter entries.
        3. Register host laptop as a SINGLE device with secondary interfaces attached.
        4. Probe active subnets to stimulate ARP resolution for all connected clients.
        5. Parse OS ARP cache for active IP / MAC pairs on the monitored subnet.
        6. Synchronize into database using MAC address identity.
        7. Transition non-responsive stale devices to OFFLINE.
        """
        active_subnets = get_active_local_subnets()
        default_gw_ip = get_system_default_gateway()
        logger.info(f"Dynamic discovery active subnets: {active_subnets}, Gateway: {default_gw_ip}")

        now = datetime.now(timezone.utc)
        active_ips: Set[str] = set()
        synced_devices: List[Device] = []

        # 1. Clean up legacy link-local or virtual adapter devices
        host_device_data = self.get_local_host_device()
        primary_host_ip = host_device_data["ip_address"]
        host_hostname = host_device_data["hostname"]

        # Delete any 169.254.x.x devices or fake duplicate entries carrying the laptop hostname
        cleanup_query = select(Device).where(
            (Device.ip_address.like("169.254.%")) |
            (Device.ip_address == "192.168.56.1") |
            (Device.ip_address == "172.30.205.46") |
            ((Device.hostname == host_hostname) & (Device.ip_address != primary_host_ip))
        )
        stale_virtual_res = await db.execute(cleanup_query)
        stale_virtual_devs = stale_virtual_res.scalars().all()
        for sv in stale_virtual_devs:
            await db.delete(sv)
        await db.flush()

        # 2. Upsert the single local host laptop device
        active_ips.add(primary_host_ip)
        host_dev = await self._upsert_device(db, host_device_data, now)
        synced_devices.append(host_dev)

        # 3. Trigger active probe on the monitored physical subnets
        if active_subnets:
            await self.active_sweep_subnets(active_subnets)

        # 4. Read OS ARP Table for the monitored subnet
        arp_map = self.read_system_arp_table(active_subnets, primary_host_ip)
        logger.info(f"Discovered {len(arp_map)} live ARP entries on monitored subnet(s).")

        # 5. Fingerprint and Upsert each discovered ARP node (Gateway, Mobile B, etc.)
        for ip, mac in arp_map.items():
            active_ips.add(ip)
            node_data = await self.fingerprint_node(ip, mac, default_gw_ip)
            dev = await self._upsert_device(db, node_data, now)
            synced_devices.append(dev)

        # 6. Mark stale devices as OFFLINE
        await self._update_offline_status(db, active_ips, now)

        await db.commit()

        # Broadcast live device update over WebSockets
        total_stmt = select(Device).where(Device.is_synthetic == False)
        all_devs = (await db.execute(total_stmt)).scalars().all()
        online_count = sum(1 for d in all_devs if d.status == "ONLINE")

        await ws_manager.broadcast("devices_updated", {
            "total_devices": len(all_devs),
            "online_devices": online_count
        })

        return synced_devices

    async def _upsert_device(self, db: AsyncSession, data: Dict[str, Any], now: datetime) -> Device:
        """
        Upsert device by MAC address identity (or fallback to IP).
        Handles dynamic IP reassignment without creating duplicate records.
        """
        mac = data.get("mac_address")
        ip = data["ip_address"]
        dev: Optional[Device] = None

        # 1. Primary lookup by MAC Address
        if mac:
            stmt = select(Device).options(selectinload(Device.interfaces)).where(Device.mac_address == mac)
            dev = (await db.execute(stmt)).scalars().first()

        # 2. Fallback lookup by IP Address if MAC not yet recorded
        if not dev:
            stmt = select(Device).options(selectinload(Device.interfaces)).where(Device.ip_address == ip)
            dev = (await db.execute(stmt)).scalars().first()

        if dev:
            if dev.ip_address != ip:
                logger.info(f"Device MAC {dev.mac_address} changed IP from {dev.ip_address} to {ip}")
                dev.ip_address = ip
                if dev.interfaces:
                    for iface in dev.interfaces:
                        if iface.is_primary:
                            iface.ip_address = ip

            if mac and not dev.mac_address:
                dev.mac_address = mac

            if data.get("hostname") and (not dev.hostname or dev.hostname == dev.ip_address):
                dev.hostname = data["hostname"]

            if data.get("vendor") and not dev.vendor:
                dev.vendor = data["vendor"]

            if data.get("os_type"):
                dev.os_type = data["os_type"]
            if data.get("os_version"):
                dev.os_version = data["os_version"]
            if data.get("os_confidence"):
                dev.os_confidence = data["os_confidence"]
            if data.get("architecture"):
                dev.architecture = data["architecture"]

            if data.get("device_type"):
                # Overwrite if current is Unknown/workstation or new confidence is High
                if dev.device_type in ["Unknown", "workstation"] or data.get("device_type_confidence") == "High":
                    dev.device_type = data["device_type"]
                    dev.device_type_confidence = data.get("device_type_confidence", "Low")
                elif not dev.device_type:
                    dev.device_type = data["device_type"]
                    dev.device_type_confidence = data.get("device_type_confidence", "Low")

            ports_raw = data.get("open_ports")
            if ports_raw is not None:
                dev.open_ports = json.dumps(ports_raw) if isinstance(ports_raw, list) else ports_raw

            services_raw = data.get("detected_services")
            if services_raw is not None:
                dev.detected_services = json.dumps(services_raw) if isinstance(services_raw, list) else services_raw

            dev.status = "ONLINE"
            dev.is_synthetic = False
            dev.last_seen = now
        else:
            ports_raw = data.get("open_ports")
            ports_str = json.dumps(ports_raw) if isinstance(ports_raw, list) else (ports_raw or "[]")

            services_raw = data.get("detected_services")
            services_str = json.dumps(services_raw) if isinstance(services_raw, list) else (services_raw or "[]")

            dev = Device(
                ip_address=ip,
                mac_address=mac,
                hostname=data.get("hostname"),
                vendor=data.get("vendor"),
                os_type=data.get("os_type"),
                os_version=data.get("os_version"),
                os_confidence=data.get("os_confidence", "Low"),
                architecture=data.get("architecture"),
                device_type=data.get("device_type", "Unknown"),
                device_type_confidence=data.get("device_type_confidence", "Low"),
                open_ports=ports_str,
                detected_services=services_str,
                status="ONLINE",
                is_monitored=True,
                is_synthetic=False,
                first_seen=now,
                last_seen=now
            )
            db.add(dev)
            await db.flush()

            iface = NetworkInterface(
                device_id=dev.id,
                interface_name=data.get("interface_name", "Wi-Fi"),
                ip_address=ip,
                mac_address=mac,
                is_primary=True
            )
            db.add(iface)

            # Add secondary host interfaces if present
            for sec in data.get("secondary_interfaces", []):
                sec_iface = NetworkInterface(
                    device_id=dev.id,
                    interface_name=sec.get("interface_name", "eth1"),
                    ip_address=sec.get("ip_address"),
                    mac_address=sec.get("mac_address"),
                    is_primary=False
                )
                db.add(sec_iface)

        return dev

    async def _update_offline_status(self, db: AsyncSession, active_ips: Set[str], now: datetime):
        """Transition devices not seen in the current sweep or last 10 minutes to OFFLINE status."""
        cutoff = now - timedelta(minutes=10)
        stmt = select(Device).where(Device.status == "ONLINE", Device.is_synthetic == False)
        res = await db.execute(stmt)
        online_devices = res.scalars().all()

        for dev in online_devices:
            dev_last_seen = dev.last_seen
            if dev_last_seen is not None and dev_last_seen.tzinfo is None:
                dev_last_seen = dev_last_seen.replace(tzinfo=timezone.utc)
            if dev.ip_address not in active_ips and (dev_last_seen is None or dev_last_seen < cutoff):
                logger.info(f"Device {dev.hostname or dev.ip_address} ({dev.ip_address}) timed out. Marking OFFLINE.")
                dev.status = "OFFLINE"


discovery_service = NetworkDiscoveryService()
