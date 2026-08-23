#!/usr/bin/env python3
"""
SHALX NETGUARD Controlled Attack Simulation Tool
Generates realistic IDS test events (Port Scans, Brute Force, DNS Anomaly, SQLi)
for safe local laboratory demonstrations.
"""

import sys
import time
import argparse
import urllib.request
import json

SOC_URL = "http://localhost:8000/api/v1/dev/simulate-attack"


def trigger_attack(attack_type: str, attacker_ip: str, target_ip: str):
    print(f"[*] Dispatching simulated attack: {attack_type} ({attacker_ip} -> {target_ip})...")
    payload = {
        "attack_type": attack_type,
        "attacker_ip": attacker_ip,
        "target_ip": target_ip
    }
    req = urllib.request.Request(
        SOC_URL,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            res = json.loads(response.read().decode())
            print(f"[+] SUCCESS: {res.get('message')}")
    except Exception as e:
        print(f"[-] ERROR dispatching attack: {e}")


def main():
    parser = argparse.ArgumentParser(description="SHALX NETGUARD SOC Attack Simulation Script")
    parser.add_argument(
        "--type",
        choices=["port_scan", "brute_force", "dns_anomaly", "sqli_attack", "ddos_syn_flood", "all"],
        default="port_scan",
        help="Type of attack scenario to simulate"
    )
    parser.add_argument("--src", default="192.168.10.220", help="Simulated attacker IP (e.g. Kali)")
    parser.add_argument("--dst", default="192.168.20.50", help="Target server IP")

    args = parser.parse_args()

    if args.type == "all":
        scenarios = ["port_scan", "brute_force", "dns_anomaly", "sqli_attack", "ddos_syn_flood"]
        for s in scenarios:
            trigger_attack(s, args.src, args.dst)
            time.sleep(2)
    else:
        trigger_attack(args.type, args.src, args.dst)


if __name__ == "__main__":
    main()
