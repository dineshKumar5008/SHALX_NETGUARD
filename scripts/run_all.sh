#!/usr/bin/env bash
# SHALX NETGUARD Platform Linux Launcher

echo "=========================================================="
echo "   SHALX NETGUARD - Intelligent Network Security Platform"
echo "=========================================================="

echo "[*] Starting FastAPI Backend on :8000..."
python3 -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

sleep 3

echo "[*] Starting React Frontend on :5173..."
cd frontend && npm run dev &
FRONTEND_PID=$!

echo "[+] SHALX NETGUARD SOC Platform active."
echo "    - Dashboard: http://localhost:5173"
echo "    - API Docs:  http://localhost:8000/docs"
echo "    - Default Credentials: admin / NetGuard@2026!"

trap "kill $BACKEND_PID $FRONTEND_PID; exit 0" SIGINT SIGTERM
wait
