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

# Comprehensive IEEE OUI Vendor & Mobile Device Database Mapping
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
    "00:04:96": "Extreme Networks",
    "00:08:54": "Netgear",
    "00:1F:33": "Netgear",
    "70:3A:0E": "Ubiquiti Networks",
    "B4:FB:E4": "Ubiquiti Networks",
    "00:0C:42": "MikroTik RouterOS",
    "AC:84:C6": "TP-Link Technologies",
    "50:C7:BF": "TP-Link Technologies",
    "C0:06:C3": "TP-Link Technologies",
    "00:25:86": "TP-Link Technologies",
    "00:1E:58": "D-Link International",
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
        Returns ONE unified Device record representing the host laptop.
        """
        context = get_primary_host_network_context()
        host_name = socket.gethostname()
        os_sys = platform.system()
        os_ver = f"{platform.system()} {platform.release()}"
        vendor = get_vendor_by_mac(context.get("mac_address")) or "Host Laptop / PC"

        return {
            "ip_address": context["ip_address"],
            "mac_address": context.get("mac_address"),
            "hostname": host_name,
            "vendor": vendor,
            "os_type": os_sys,
            "os_version": os_ver,
            "device_type": "soc",
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
        """Probe a single IP across common ports (53, 80, 443, 135, 8080, 22) to stimulate ARP resolution."""
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
        Never assigns the laptop's own hostname to another node.
        """
        hostname = resolve_hostname(ip)
        vendor = get_vendor_by_mac(mac)
        os_type = None
        os_version = None
        device_type = "workstation"

        # Check if this node is the default gateway (e.g. Mobile A Hotspot)
        is_gw = (ip == default_gw_ip)

        open_ports = []
        for port in [53, 80, 443, 135, 445, 22, 3389, 8080]:
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(0.08)
                res = s.connect_ex((ip, port))
                s.close()
                if res == 0:
                    open_ports.append(port)
            except Exception:
                pass

        if is_gw:
            device_type = "router"
            if not vendor:
                vendor = "Mobile Hotspot Gateway"
            if 53 in open_ports and 80 not in open_ports and 443 not in open_ports:
                os_type = "Mobile OS (Hotspot)"
            else:
                os_type = "RouterOS / Firmware"
        elif 135 in open_ports or 445 in open_ports or 3389 in open_ports:
            os_type = "Windows"
            device_type = "workstation"
        elif 22 in open_ports:
            os_type = "Linux"
            device_type = "server"
        elif vendor and any(m in vendor.lower() for m in ["apple", "samsung", "xiaomi", "oneplus", "huawei", "vivo", "oppo", "pixel", "motorola", "mobile"]):
            device_type = "mobile"
            os_type = "Android / iOS"
        elif mac and is_locally_administered_mac(mac):
            device_type = "mobile"
            os_type = "Android / iOS (Private MAC)"

        return {
            "ip_address": ip,
            "mac_address": mac,
            "hostname": hostname,
            "vendor": vendor,
            "os_type": os_type,
            "os_version": os_version,
            "device_type": device_type,
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

            if data.get("os_type") and not dev.os_type:
                dev.os_type = data["os_type"]

            if data.get("device_type") and dev.device_type == "workstation" and data["device_type"] != "workstation":
                dev.device_type = data["device_type"]

            dev.status = "ONLINE"
            dev.is_synthetic = False
            dev.last_seen = now
        else:
            dev = Device(
                ip_address=ip,
                mac_address=mac,
                hostname=data.get("hostname"),
                vendor=data.get("vendor"),
                os_type=data.get("os_type"),
                os_version=data.get("os_version"),
                device_type=data.get("device_type", "workstation"),
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
