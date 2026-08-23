# SHALX NETGUARD Virtualized Network Lab Setup Guide

This guide details how to build a complete 3-VLAN virtualization lab for college capstone demonstrations and security testing using VMware Workstation, Proxmox VE, or VirtualBox.

---

## 1. Network Topology & Addressing Scheme

```
                            [ INTERNET / WAN ]
                                    |
                          +---------+---------+
                          | pfSense Firewall  |
                          | (Gateway Router)  |
                          +---------+---------+
                                    |
                            [ Virtual Trunk ]
                                    |
          +-------------------------+-------------------------+
          |                         |                         |
     [ VLAN 10 ]               [ VLAN 20 ]               [ VLAN 30 ]
    Users Subnet              Servers Subnet            Security Subnet
  192.168.10.0/24            192.168.20.0/24            192.168.30.0/24
          |                         |                         |
  +-------+-------+         +-------+-------+         +-------+-------+
  | Windows 11 VM |         | Web Server VM |         | SHALX NETGUARD|
  | 192.168.10.105|         | 192.168.20.80 |         | SOC Server    |
  |               |         |               |         | 192.168.30.10 |
  | Kali Linux VM |         | Database VM   |         |               |
  | 192.168.10.220|         | 192.168.20.50 |         | Suricata EVE  |
  |               |         |               |         | Sensor VM     |
  +---------------+         +---------------+         +---------------+
```

---

## 2. Virtual Machine Roles

| VM Name | Operating System | IP Address | Role |
| :--- | :--- | :--- | :--- |
| **pfSense-GW** | FreeBSD (pfSense 2.7) | `192.168.10.1`, `20.1`, `30.1` | Inter-VLAN router & perimeter firewall |
| **SHALX-NETGUARD-SOC** | Ubuntu 22.04 LTS | `192.168.30.10` | FastAPI backend, React dashboard, PostgreSQL |
| **Suricata-Sensor**| Ubuntu 22.04 LTS | `192.168.30.20` | Network IDS sensor ingesting mirror/SPAN traffic |
| **Web-Prod** | Debian 12 / Ubuntu | `192.168.20.80` | Target Apache/Nginx web server |
| **DB-Prod** | Debian 12 / Ubuntu | `192.168.20.50` | Target PostgreSQL/MySQL database server |
| **Win11-Client** | Windows 11 Pro | `192.168.10.105` | Corporate user workstation |
| **Kali-Testbox** | Kali Linux 2024.x | `192.168.10.220` | Authorized controlled security testing box |

---

## 3. SPAN / Port Mirroring Configuration

To allow Suricata to inspect all inter-VLAN and external traffic:
1. In your hypervisor (VMware / Proxmox / VirtualBox), create a dedicated Promiscuous Mode virtual switch.
2. Direct all mirror traffic to the Suricata sensor interface (`eth1`).
3. Suricata inspects packets in real time and writes matches to `/var/log/suricata/eve.json`.
4. SHALX NETGUARD continuously ingests `eve.json` and correlates threats.
