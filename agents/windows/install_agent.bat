@echo off
title SHALX NETGUARD Host Agent Setup
echo ====================================================
echo   SHALX NETGUARD - Windows Host Monitoring Agent Setup
echo ====================================================
echo.

pip install psutil
echo.
echo Starting SHALX NETGUARD Windows Monitoring Agent...
python netguard_agent.py
pause
