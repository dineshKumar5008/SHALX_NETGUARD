# SHALX NETGUARD SOC — Demonstration Procedures & Test Scenarios

This guide details the exact step-by-step procedures to demonstrate the 6 core SOC capabilities of SHALX NETGUARD for evaluation or portfolio reviews.

---

## Preparation
1. Start the backend: `python -m uvicorn backend.app.main:app --port 8000 --reload`
2. Start the frontend: `cd frontend && npm run dev`
3. Open `http://localhost:5173` and log in as `admin` (Password: `NetGuard@2026!`).

---

## Scenario 1: Subnet Device Discovery
**Objective**: Demonstrate automated discovery of active network assets across monitored CIDRs.
1. Navigate to **Discovered Devices** (`/devices`) in the sidebar.
2. Click **Trigger Subnet Sweep**.
3. Observe the newly discovered devices populate the table (showing IP, MAC, Vendor, OS type, and status).
4. Navigate to **Network Topology** (`/topology`) and show the assets mapped into their respective VLAN segments (VLAN 10, VLAN 20, VLAN 30).
5. Click on any node to view the inspector drawer.

---

## Scenario 2: Controlled Port Scan & Threat Detection
**Objective**: Demonstrate real-time IDS alert ingestion and WebSocket dashboard push.
1. In the top navbar, click **Simulate Lab Event** (or execute from Kali: `python scripts/simulate_attacks.py --type port_scan`).
2. Watch the **Real-time Alert Toast Banner** flash at the top of the dashboard.
3. Navigate to **Security Alerts** (`/alerts`) to inspect the newly ingested alert:
   - Category: `Port Scan`
   - Severity: `HIGH`
   - Source: `192.168.10.220` &rarr; Target: `192.168.20.50`
4. Click on the Alert ID to inspect the raw normalized IDS JSON payload.

---

## Scenario 3: Incident Creation & Case Management
**Objective**: Demonstrate forensic triage workflow and timeline tracking.
1. From the alert inspection page, click **Escalate to Incident**.
2. Notice the system automatically creates a dedicated forensic case with an assigned Analyst and initial timeline event.
3. Add an investigation note: `"Confirmed malicious reconnaissance scan from Kali testbox. Escalating to perimeter firewall containment."`
4. Advance the incident status to `INVESTIGATING`.

---

## Scenario 4: Dynamic Firewall IP Containment
**Objective**: Demonstrate perimeter firewall blocking with allowlist safety validation.
1. From the incident page (or **Blocked IPs** `/blocked-ips`), click **Block Offender IP** (`192.168.10.220`).
2. Set the duration to `1 Hour` and provide the threat reason.
3. Click **Confirm Firewall Block**.
4. Observe the IP immediately populate the **Blocked IPs** registry table and live WebSocket event broadcast.
5. Demonstrate safety safeguard: Try blocking the Gateway IP `192.168.10.1` &rarr; Notice SHALX NETGUARD strictly blocks the attempt with a safety allowlist violation warning.

---

## Scenario 5: Host Health Telemetry & Resource Monitoring
**Objective**: Demonstrate host agent telemetry ingestion and CPU/RAM threshold alerts.
1. Navigate to **System Health** (`/health`).
2. Observe live CPU, RAM, Disk, and Uptime gauges for the SHALX NETGUARD SOC server and reporting host agents.
3. In a separate terminal, launch a host monitoring agent:
   ```bash
   python agents/linux/netguard_agent.py
   ```
4. Observe the host heartbeat register and stream metrics in real time.

---

## Scenario 6: Executive PDF Security Report Generation
**Objective**: Demonstrate generating a formatted, publication-ready PDF security posture report.
1. Navigate to **PDF Reports** (`/reports`).
2. Click **Generate New PDF Report**.
3. Select `Daily Threat & Network Posture Report` and click **Build & Compile PDF**.
4. Click **Download PDF** to open the generated report containing executive metrics, top threats, blocked IPs, and hardening recommendations.
