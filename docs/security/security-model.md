# SHALX NETGUARD SOC — Security Model & Safeguards

This document specifies the security principles, cryptographic architectures, and defensive controls implemented within SHALX NETGUARD.

---

## 1. Authentication & Authorization Architecture
- **Password Storage**: Passwords are never stored in plaintext. They are salted and hashed using `bcrypt` (12 rounds) or `Argon2`.
- **JWT Bearer Tokens**: Stateless JWT access tokens signed with HMAC-SHA256 (`HS256`) and an isolated `SECRET_KEY`.
- **Role-Based Access Control (RBAC)**:
  - `ADMIN`: Full administrative authority (user management, global system settings, custom firewall policies).
  - `ANALYST`: Incident investigation, alert triage, manual IP containment blocks, PDF report generation.
  - `VIEWER`: Read-only access to operational dashboards and telemetry.

---

## 2. Dynamic Firewall Response & Safeguard Allowlists
To prevent self-inflicted denial of service or operator lockout, SHALX NETGUARD enforces a multi-tier safety validation protocol prior to applying any firewall block:
1. **Critical Infrastructure Allowlist**:
   - `127.0.0.1`, `::1` (Loopback)
   - `192.168.1.1`, `192.168.10.1`, `192.168.20.1`, `192.168.30.1` (VLAN Gateways)
   - `192.168.30.10` (SHALX NETGUARD SOC Server)
   - `8.8.8.8`, `1.1.1.1` (Primary DNS Resolvers)
2. **Severity Escalation Thresholds**:
   - `LOW` / `MEDIUM`: Recorded to database and dashboard. No automated firewall drop.
   - `HIGH`: Alert flagged on dashboard for analyst investigation and manual confirmation.
   - `CRITICAL`: Optional auto-block triggered only when explicitly activated by an Administrator in system settings.

---

## 3. Host Agent Telemetry Protection
- Monitoring agents authenticate with the backend using a pre-shared token transmitted in the `X-Agent-Token` header.
- Unauthenticated requests are rejected with `401 Unauthorized`.
- Agent metrics are validated using Pydantic schemas before persistence.

---

## 4. Immutable Audit Trail
- Every critical security action (authentication, IP block, unblock, triage update, incident creation, user modification) is recorded to the `audit_logs` table.
- Audit logs contain initiating user, target resource, timestamp, client IP, action type, and JSON metadata.
- Audit logs cannot be modified or deleted via the SOC web application.
