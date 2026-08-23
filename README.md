# 🛡️ SHALX NETGUARD
### Intelligent Network Security Monitoring & Response Platform

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6.svg)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![Suricata](https://img.shields.io/badge/IDS-Suricata%20EVE-orange.svg)](https://suricata.io/)
[![pfSense](https://img.shields.io/badge/Firewall-pfSense%20API-red.svg)](https://www.pfsense.org/)
[![Tests](https://img.shields.io/badge/Tests-Pytest%20Passing-brightgreen.svg)]()

**SHALX NETGUARD** is a modular, production-grade cybersecurity and network monitoring platform built for Security Operations Centers (SOC). It provides real-time network device discovery, traffic flow analysis, Suricata IDS log ingestion, heuristic threat correlation, interactive network topology, automated pfSense firewall response, remote host health monitoring, multi-channel alerting (Email & Telegram), and automated PDF executive security reports.

---

## 📸 Key Capabilities

1. **Network Device Discovery**: Safe ARP/ICMP scanning across configured subnets with MAC OUI vendor resolution and OS profiling.
2. **Real-time Traffic Monitoring**: Ingress/egress bandwidth tracking, Layer 4 protocol distribution, active connections, and top talker matrix.
3. **Suricata EVE JSON Ingestion**: Real-time log tailing, JSON validation, event deduplication, and normalized telemetry mapping.
4. **Threat Detection Engine**: Heuristic port scan detection, brute-force authentication tracking, high-entropy DGA/DNS anomaly detection, and IDS signature classification.
5. **Interactive Network Topology**: Dynamic React Flow canvas displaying multi-VLAN segmentation (Users, Servers, Security) with node inspection.
6. **Active Perimeter Firewall Response**: Abstracted pfSense provider with dynamic block table synchronization and protected infrastructure allowlists.
7. **Forensic Incident Management**: Dedicated case files with chronological investigation timelines, analyst notes, and linked IDS alerts.
8. **Host Hardware Health Telemetry**: Authenticated Linux/Windows monitoring agents reporting CPU, RAM, Disk, and Network utilization.
9. **Executive PDF Reporting**: Publication-ready security reports compiled directly from database events using ReportLab.
10. **Multi-Channel Notifications**: Real-time WebSockets, SMTP Email alerts, and Telegram Bot incident notifications with severity-based routing.
11. **Role-Based Access Control (RBAC)**: Secure JWT authentication with strict `ADMIN`, `ANALYST`, and `VIEWER` permission enforcement.
12. **Immutable Audit Trail**: Tamper-resistant audit logging for all critical security actions, triage decisions, and administrative operations.

---

## 🏛️ System Architecture

```
                                  [ NETWORK TELEMETRY ]
                                            |
         +--------------------+-------------+-------------+--------------------+
         |                    |                           |                    |
         v                    v                           v                    v
  Suricata EVE JSON     Zeek Security Logs          Host Agents (Win/Linux) Network Flows
         |                    |                           |                    |
         +--------------------+-------------+-------------+--------------------+
                                            |
                                            v
                              [ Normalization Layer ]
                                            |
                                            v
                              [ Threat Detection Engine ]
                                            |
                                            v
                              [ Async SQLAlchemy / DB ]
                                            |
                    +-----------------------+-----------------------+
                    |                                               |
                    v                                               v
        [ Real-time WebSockets ]                        [ Perimeter Defense ]
        (Broadcasting to React UI)                     (pfSense Dynamic Block Table)
```

---

## 🌐 Virtualized Network Lab Architecture

SHALX NETGUARD is designed to monitor a standard 3-VLAN virtualized network environment:

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
  +---------------+         +---------------+         +---------------+
```

---

## 🚀 Quick Start & Installation

### Option A: Local Development (Recommended)

1. **Install Backend Dependencies**:
   ```bash
   pip install -r backend/requirements.txt
   ```

2. **Start FastAPI Backend**:
   ```bash
   python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

3. **Install & Launch Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Access the SOC Interface**:
   - Web Dashboard: `http://localhost:5173`
   - OpenAPI Docs: `http://localhost:8000/docs`
   - **Default Admin Login**: `admin` / `NetGuard@2026!`

---

### Option B: One-Click Launchers

- **Windows**: Double-click `scripts/run_all.bat`
- **Linux/macOS**: Execute `./scripts/run_all.sh`

---

### Option C: Docker Compose

```bash
docker-compose up -d
```

---

## 🧪 Automated Testing

SHALX NETGUARD includes a comprehensive test suite covering authentication, RBAC, alert lifecycles, threat correlation, Suricata parsers, and PDF report generation:

```bash
python -m pytest backend/tests/ -v
```

---

## 📚 Documentation Index

- [System Architecture Specification](docs/architecture/system-architecture.md)
- [Local Development & Setup Guide](docs/setup/local-development.md)
- [Virtualized Network Lab Setup (pfSense, VLANs, Suricata)](docs/setup/network-lab.md)
- [Security Model & Allowlist Safeguards](docs/security/security-model.md)
- [Step-by-Step Demonstration Scenarios](docs/demo/project-demo.md)
- [REST & WebSocket API Guide](docs/api/api-guide.md)

---

## 🔒 Security Disclaimer
SHALX NETGUARD is created for authorized educational cybersecurity training, college demonstrations, and laboratory research. Controlled testing scenarios should only be conducted within authorized network environments.
