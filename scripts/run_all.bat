@echo off
title SHALX NETGUARD SOC Platform Launcher
echo ==========================================================
echo    SHALX NETGUARD - Intelligent Network Security Platform
echo ==========================================================
echo.

echo Starting SHALX NETGUARD Backend on port 8000...
start cmd /k "python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 3 /nobreak >nul

echo Starting SHALX NETGUARD Frontend on port 5173...
cd frontend
start cmd /k "npm run dev"

echo.
echo ==========================================================
echo Platform successfully launched!
echo Access SOC Web Dashboard: http://localhost:5173
echo Access REST API Docs:     http://localhost:8000/docs
echo Default Admin Login:       admin / NetGuard@2026!
echo ==========================================================
pause
