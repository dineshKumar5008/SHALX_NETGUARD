#!/usr/bin/env python3
"""
SHALX NETGUARD SOC Seeder Script
Initializes baseline accounts, monitored assets, and sample alerts.
"""

import urllib.request
import json
import sys

SEED_URL = "http://localhost:8000/api/v1/dev/seed-data"

def seed():
    print("[*] Contacting SHALX NETGUARD backend to seed baseline SOC data...")
    req = urllib.request.Request(SEED_URL, data=b"{}", headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            print(f"[+] {data.get('message')}")
            print("[+] Seeded credentials:")
            for user, pwd in data.get("default_credentials", {}).items():
                print(f"    - {user}: {pwd}")
    except Exception as e:
        print(f"[-] Failed to seed database: {e}")
        print("    Ensure the backend is running on http://localhost:8000")

if __name__ == "__main__":
    seed()
