# SHALX NETGUARD SOC — REST & WebSocket API Guide

Interactive OpenAPI documentation is hosted at `http://localhost:8000/docs` (Swagger UI) and `http://localhost:8000/redoc`.

---

## 1. Authentication Endpoints

| Method | Endpoint | Description | Role Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | OAuth2 username/password login & JWT token return | Public |
| `GET` | `/api/v1/auth/me` | Retrieve profile and role for current user | Authenticated |
| `POST` | `/api/v1/auth/change-password` | Update current operator password | Authenticated |

---

## 2. Security Alerts & Threat Triage

| Method | Endpoint | Description | Role Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/alerts` | Filterable list of security alerts with pagination | Authenticated |
| `GET` | `/api/v1/alerts/{id}` | Complete alert metadata and raw event JSON | Authenticated |
| `POST` | `/api/v1/alerts/{id}/triage` | Update triage state (acknowledge, investigate, resolve, false_positive) | ANALYST |
| `POST` | `/api/v1/alerts/{id}/escalate-to-incident` | Escalate alert to an active Incident investigation | ANALYST |

---

## 3. Incident Management

| Method | Endpoint | Description | Role Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/incidents` | List forensic incident cases | Authenticated |
| `POST` | `/api/v1/incidents` | Open a new incident investigation | ANALYST |
| `GET` | `/api/v1/incidents/{id}` | Full incident details with timeline and linked alerts | Authenticated |
| `PUT` | `/api/v1/incidents/{id}` | Update incident status, severity, or notes | ANALYST |
| `POST` | `/api/v1/incidents/{id}/notes` | Append a forensic note to the timeline | ANALYST |

---

## 4. Firewall & Perimeter Containment

| Method | Endpoint | Description | Role Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/firewall/status` | Connection status of pfSense provider | Authenticated |
| `GET` | `/api/v1/firewall/blocked-ips` | List active blocked IPs and expirations | Authenticated |
| `POST` | `/api/v1/firewall/block` | Block an IP address with allowlist validation | ANALYST |
| `POST` | `/api/v1/firewall/unblock/{ip}` | Unblock an IP address from perimeter firewall | ANALYST |
| `GET` | `/api/v1/firewall/actions` | Audit log of firewall response operations | Authenticated |

---

## 5. Host Agent Telemetry Ingestion

| Method | Endpoint | Description | Auth Header |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/agent/heartbeat` | Register agent presence and IP | `X-Agent-Token` |
| `POST` | `/api/v1/agent/metrics` | Ingest CPU, RAM, Disk, and Network telemetry | `X-Agent-Token` |

---

## 6. Real-time WebSocket Stream

- **Endpoint**: `ws://localhost:8000/ws/soc`
- **Topics Broadcasted**:
  - `alert`: Ingestion of new security threat alert
  - `alert_triaged`: Triage status changes
  - `traffic`: Bandwidth, flows, and packet throughput pulse
  - `health_metric`: Remote host resource utilization update
  - `firewall_block`: IP block containment enforcement
  - `firewall_unblock`: IP unblock removal
