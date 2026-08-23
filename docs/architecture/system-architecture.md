# SHALX NETGUARD SOC Platform — System Architecture

## 1. High-Level Architectural Overview

SHALX NETGUARD is an event-driven, modular cybersecurity and network monitoring platform that combines network intrusion detection (Suricata / Zeek), host telemetry agents, automated firewall response (pfSense), forensic case management, and real-time dashboard visualizations into a unified Security Operations Center interface.

```
+-----------------------------------------------------------------------------------+
|                              DATA INGESTION SOURCES                               |
+---------------------+-----------------------+---------------------+---------------+
| Suricata EVE JSON   | Zeek Security Logs    | Host Health Agents  | Network Flows |
| (eve.json tailer)   | (conn/dns/http/ssl)   | (Win / Linux)       | (ARP / ICMP)  |
+----------+----------+-----------+-----------+----------+----------+-------+-------+
           |                      |                      |                  |
           +----------------------+----------------------+------------------+
                                  |
                                  v
                    +---------------------------+
                    | Event Normalization Layer |
                    +-------------+-------------+
                                  |
                                  v
                    +---------------------------+
                    | Threat Detection Engine   |
                    | (Heuristics + Signatures) |
                    +-------------+-------------+
                                  |
                                  v
                    +---------------------------+
                    | Database & State Engine   |
                    | (PostgreSQL / SQLite)     |
                    +-------------+-------------+
                                  |
            +---------------------+---------------------+
            |                                           |
            v                                           v
+-----------------------+                   +-----------------------+
| Real-time WebSocket   |                   | Active Defense Engine |
| Broadcast (/ws/soc)   |                   | (pfSense / Response)  |
+-----------+-----------+                   +-----------+-----------+
            |                                           |
            v                                           v
+-----------------------+                   +-----------------------+
| React SOC Dashboard   |                   | Perimeter Containment |
| (Dark Cyber UI)       |                   | (Block Table Sync)    |
+-----------------------+                   +-----------------------+
```

---

## 2. Core Subsystems

### 2.1 Event Pipeline & Ingestion
- **Suricata Log Tailer**: Efficiently tracks the EOF pointer of `eve.json`, deserializes JSON entries safely, validates mandatory network fields, and handles log rotation.
- **Normalizer**: Transforms diverse telemetry feeds into a standardized `SecurityEvent` schema with unified timestamp formats, IPv4/IPv6 sanitization, and classification tags.

### 2.2 Threat Detection Engine
- **Heuristic Correlation**: Evaluates sliding time-window metrics for anomalous behavior:
  - *Port Scan*: Rapid connections across &ge; 15 distinct ports within 60s.
  - *Brute Force*: Multiple failed authentications (&ge; 5) targeting a single service within 120s.
  - *DNS Anomaly*: High Shannon entropy (&gt; 3.8) and long domain length identifying DGA algorithms and DNS tunnels.
  - *IDS Signature Mapping*: Direct classification of Suricata threat levels (1 = Critical/High, 2 = Medium, 3 = Low).

### 2.3 Firewall Abstraction Layer
- Isolated behind the `FirewallProvider` interface.
- Includes `PfSenseFirewallProvider` for live REST API / FauxAPI synchronization and `MockFirewallProvider` for offline development.
- **Protected Allowlist**: Hardcoded infrastructure safeguards prevent accidental blocking of Default Gateways, DNS Resolvers, and the SHALX NETGUARD SOC server.

### 2.4 Real-time Communication
- Asynchronous WebSocket connection manager broadcasting alerts, traffic pulses, health metrics, and device updates over `/ws/soc` with zero manual page refreshes.
