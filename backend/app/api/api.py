from fastapi import APIRouter
from backend.app.api.v1 import (
    auth, users, devices, alerts, incidents, events,
    traffic, health, topology, firewall, reports,
    notifications, audit_logs, settings as settings_api, agent, dev
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(devices.router)
api_router.include_router(alerts.router)
api_router.include_router(incidents.router)
api_router.include_router(events.router)
api_router.include_router(traffic.router)
api_router.include_router(health.router)
api_router.include_router(topology.router)
api_router.include_router(firewall.router)
api_router.include_router(reports.router)
api_router.include_router(notifications.router)
api_router.include_router(audit_logs.router)
api_router.include_router(settings_api.router)
api_router.include_router(agent.router)
api_router.include_router(dev.router)
