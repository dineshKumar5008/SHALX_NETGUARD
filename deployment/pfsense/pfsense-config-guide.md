# pfSense Firewall Integration Guide for SHALX NETGUARD

This document outlines the step-by-step procedure to configure a pfSense virtual or physical appliance to work with the SHALX NETGUARD SOC Platform for automated dynamic IP containment.

---

## 1. Prerequisites
- pfSense 2.7.x or pfSense Plus 23.x+
- Virtual interfaces configured on 3 VLANs:
  - **VLAN 10 (Users)**: `192.168.10.1/24`
  - **VLAN 20 (Servers)**: `192.168.20.1/24`
  - **VLAN 30 (Security/SOC)**: `192.168.30.1/24`
- Package installed: `pfSense-pkg-REST-API` or `pfSense-pkg-FauxAPI`

---

## 2. Firewall Block Alias Setup

1. In pfSense WebGUI, navigate to **Firewall &rarr; Aliases &rarr; IP**.
2. Click **Add**:
   - **Name**: `NetGuard_Blocked_IPs`
   - **Type**: `Host(s)`
   - **Description**: `Dynamic Block Table Managed by SHALX NETGUARD SOC Platform`
3. Click **Save** and **Apply Changes**.

---

## 3. Firewall Rule Creation

1. Navigate to **Firewall &rarr; Rules &rarr; Floating** (or on each VLAN interface):
2. Click **Add (Top of List)**:
   - **Action**: `Block` (or `Reject`)
   - **Quick**: Check `Apply immediately on match`
   - **Interface**: Select `WAN`, `VLAN 10`, `VLAN 20`
   - **Direction**: `in`
   - **Address Family**: `IPv4+IPv6`
   - **Protocol**: `Any`
   - **Source**: `Single host or alias` &rarr; `NetGuard_Blocked_IPs`
   - **Destination**: `Any`
   - **Description**: `SHALX NETGUARD Automated SOC Threat Containment Rule`
3. Click **Save** and **Apply Changes**.

---

## 4. SHALX NETGUARD Configuration

In your `.env` file on the SOC server:
```ini
FIREWALL_PROVIDER=pfsense
PFSENSE_URL=https://192.168.1.1
PFSENSE_API_KEY=your_pfsense_api_key_here
PFSENSE_API_SECRET=your_pfsense_api_secret_here
PFSENSE_VERIFY_SSL=false
```

SHALX NETGUARD will automatically communicate with the pfSense REST API or FauxAPI to inject malicious threat actor IPs into `NetGuard_Blocked_IPs` table in real time with zero latency.
