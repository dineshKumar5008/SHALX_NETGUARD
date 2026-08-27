import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, not_

from backend.app.core.config import settings
from backend.app.models.alert import Alert
from backend.app.models.incident import Incident
from backend.app.models.device import Device
from backend.app.models.firewall import BlockedIP
from backend.app.models.security_event import SecurityEvent
from backend.app.models.metrics import HealthMetric

logger = logging.getLogger("netguard.reports")


class PDFReportGenerator:
    """
    Generates professional executive SOC security reports in PDF format.
    Dynamically queries real database telemetry and synthesizes contextual threat intelligence.
    Guarantees strict separation between REAL network telemetry and simulated lab datasets.
    """

    def __init__(self, output_dir: Optional[str] = None):
        self.output_dir = output_dir or settings.REPORTS_STORAGE_PATH
        os.makedirs(self.output_dir, exist_ok=True)

    async def generate_security_report(
        self,
        db: AsyncSession,
        title: str = "SHALX NETGUARD SECURITY REPORT",
        report_type: str = "daily",
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        include_synthetic: bool = False
    ) -> Dict[str, Any]:
        report_id = f"REP-{uuid.uuid4().hex[:8].upper()}"
        filename = f"SHALX_NETGUARD_Report_{report_id}.pdf"
        filepath = os.path.join(self.output_dir, filename)

        doc = SimpleDocTemplate(
            filepath,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )

        styles = getSampleStyleSheet()
        
        # Cyber SOC themed typography styles
        title_style = ParagraphStyle(
            'ReportTitle',
            parent=styles['Heading1'],
            fontSize=20,
            leading=24,
            textColor=colors.HexColor('#0f172a'),
            spaceAfter=4
        )
        subtitle_style = ParagraphStyle(
            'ReportSubtitle',
            parent=styles['Normal'],
            fontSize=9.5,
            leading=13,
            textColor=colors.HexColor('#475569'),
            spaceAfter=10
        )
        section_heading = ParagraphStyle(
            'SectionHeading',
            parent=styles['Heading2'],
            fontSize=12,
            leading=16,
            textColor=colors.HexColor('#0284c7'),
            spaceBefore=14,
            spaceAfter=6
        )
        body_style = ParagraphStyle(
            'ReportBody',
            parent=styles['Normal'],
            fontSize=8.5,
            leading=12,
            textColor=colors.HexColor('#1e293b')
        )
        cell_style = ParagraphStyle(
            'ReportCell',
            parent=styles['Normal'],
            fontSize=7.5,
            leading=10,
            textColor=colors.HexColor('#1e293b')
        )
        cell_bold = ParagraphStyle(
            'ReportCellBold',
            parent=styles['Normal'],
            fontSize=7.5,
            leading=10,
            textColor=colors.HexColor('#0f172a'),
            fontName='Helvetica-Bold'
        )

        elements = []

        now = datetime.now(timezone.utc)

        # Compute evaluation time window
        period_label = "Past 24 Hours"
        time_filter_start = now - timedelta(days=1)
        
        if report_type == "weekly":
            period_label = "Past 7 Days"
            time_filter_start = now - timedelta(days=7)
        elif report_type == "custom" and start_date:
            time_filter_start = start_date
            period_label = f"{start_date.strftime('%Y-%m-%d')} to {(end_date or now).strftime('%Y-%m-%d')}"
        elif report_type == "custom":
            period_label = "All Recorded Telemetry"
            time_filter_start = None

        # --- 1. Gather Real Database Data (Strictly Filter Synthetic / Simulated Lab Devices in Real Mode) ---
        # Discovered Devices (Excluding synthetic lab nodes and link-local addresses)
        dev_query = select(Device)
        if not include_synthetic:
            dev_query = dev_query.where(
                Device.is_synthetic == False,
                not_(Device.ip_address.like("169.254.%")),
                not_(Device.ip_address.like("127.%")),
                not_(Device.ip_address == "192.168.56.1"),
                not_(Device.ip_address == "172.30.205.46")
            )
        dev_query = dev_query.order_by(Device.last_seen.desc())
        devices_res = await db.execute(dev_query)
        devices = devices_res.scalars().all()
        online_devices_count = sum(1 for d in devices if d.status == "ONLINE")

        # Security Alerts
        alert_query = select(Alert)
        if not include_synthetic:
            alert_query = alert_query.where(Alert.is_synthetic == False)
        if time_filter_start:
            alert_query = alert_query.where(Alert.created_at >= time_filter_start)
        alert_query = alert_query.order_by(Alert.created_at.desc())
        alerts_res = await db.execute(alert_query.limit(100))
        alerts = alerts_res.scalars().all()

        # Severity & Triage Breakdown
        sev_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
        active_alerts_count = 0
        resolved_alerts_count = 0
        for a in alerts:
            sev = (a.severity or "LOW").upper()
            if sev in sev_counts:
                sev_counts[sev] += 1
            if (a.status or "").upper() in ["NEW", "ACKNOWLEDGED", "INVESTIGATING"]:
                active_alerts_count += 1
            elif (a.status or "").upper() in ["RESOLVED", "CLOSED", "FALSE_POSITIVE"]:
                resolved_alerts_count += 1

        # Incidents
        inc_query = select(Incident)
        if not include_synthetic:
            inc_query = inc_query.where(Incident.is_synthetic == False)
        if time_filter_start:
            inc_query = inc_query.where(Incident.created_at >= time_filter_start)
        inc_query = inc_query.order_by(Incident.created_at.desc())
        incidents_res = await db.execute(inc_query.limit(25))
        incidents = incidents_res.scalars().all()
        active_incidents_count = sum(1 for i in incidents if (i.status or "").upper() in ["OPEN", "INVESTIGATING"])

        # Blocked IPs
        blocked_res = await db.execute(select(BlockedIP).where(BlockedIP.is_active == True))
        blocked_ips = blocked_res.scalars().all()

        # Real Mode vs Lab Simulation Mode String
        mode_str = "DEVELOPMENT LAB SIMULATION" if include_synthetic else "LIVE MONITORED NETWORK"

        # --- Document Header ---
        elements.append(Paragraph(f"🛡️ {title}", title_style))
        elements.append(Paragraph(
            f"<b>Report ID:</b> {report_id} &nbsp;|&nbsp; "
            f"<b>Period:</b> {period_label} &nbsp;|&nbsp; "
            f"<b>Generated:</b> {now.strftime('%Y-%m-%d %H:%M:%S UTC')} &nbsp;|&nbsp; "
            f"<b>Environment:</b> {mode_str}",
            subtitle_style
        ))
        elements.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#0284c7'), spaceAfter=12))

        # --- Section 1: Executive Threat Posture Summary ---
        elements.append(Paragraph("1. Executive Threat Posture Summary", section_heading))
        if len(devices) > 0 or len(alerts) > 0:
            summary_text = (
                f"During the evaluation period (<b>{period_label}</b>), SHALX NETGUARD monitored real-time telemetry across "
                f"<b>{len(devices)} discovered network assets</b> (<b>{online_devices_count} active online</b>). A total of "
                f"<b>{len(alerts)} security alerts</b> were evaluated (<b>{sev_counts['CRITICAL']} Critical, {sev_counts['HIGH']} High</b>), "
                f"resulting in <b>{len(incidents)} incident investigations</b>. Active perimeter containment maintained "
                f"<b>{len(blocked_ips)} active IP block rules</b>."
            )
        else:
            summary_text = "No network telemetry or security alerts have been recorded during the selected reporting period."

        elements.append(Paragraph(summary_text, body_style))
        elements.append(Spacer(1, 8))

        # Executive Metrics Table
        metric_data = [
            ["Security & Network Metric", "Count / Value", "Operational Status"],
            ["Total Discovered Devices", f"{len(devices)} ({online_devices_count} Online)", "NOMINAL" if online_devices_count > 0 else "NO ASSETS"],
            ["Total Security Alerts", str(len(alerts)), "EVALUATED" if len(alerts) > 0 else "CLEAR"],
            ["Critical / High Threat Alerts", f"{sev_counts['CRITICAL']} Crit / {sev_counts['HIGH']} High", "ATTENTION" if (sev_counts['CRITICAL'] + sev_counts['HIGH']) > 0 else "CLEAR"],
            ["Active Forensic Incidents", f"{active_incidents_count} Active / {len(incidents)} Total", "INVESTIGATING" if active_incidents_count > 0 else "NOMINAL"],
            ["Active Firewall Blocked IPs", str(len(blocked_ips)), "ACTIVE ENFORCEMENT" if len(blocked_ips) > 0 else "NOMINAL"],
        ]
        t_metrics = Table(metric_data, colWidths=[220, 160, 160])
        t_metrics.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
            ('TOPPADDING', (0, 0), (-1, -1), 3.5),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#f8fafc'), colors.HexColor('#f1f5f9')])
        ]))
        elements.append(t_metrics)
        elements.append(Spacer(1, 10))

        # --- Section 2: Discovered Network Devices ---
        elements.append(Paragraph(f"2. Discovered Network Assets ({len(devices)} Total)", section_heading))
        if len(devices) > 0:
            dev_rows = [["Asset / Hostname", "IP Address", "MAC Address", "Vendor / Manufacturer", "Device Type", "Status"]]
            for d in devices[:12]:
                h_name = d.hostname or "Hostname unavailable"
                v_name = d.vendor or "Not available"
                d_type = (d.device_type or "workstation").upper()
                stat = (d.status or "ONLINE").upper()
                dev_rows.append([
                    Paragraph(h_name[:24], cell_bold),
                    Paragraph(d.ip_address or "N/A", cell_style),
                    Paragraph(d.mac_address or "Not available", cell_style),
                    Paragraph(v_name[:22], cell_style),
                    Paragraph(d_type, cell_style),
                    Paragraph(stat, cell_style)
                ])

            t_devs = Table(dev_rows, colWidths=[110, 85, 105, 100, 75, 65])
            t_devs.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 7.5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#ffffff'), colors.HexColor('#f8fafc')])
            ]))
            elements.append(t_devs)
        else:
            elements.append(Paragraph("<i>No network assets have been discovered during the selected reporting period.</i>", body_style))

        elements.append(Spacer(1, 10))

        # --- Section 3: Security Threat Alerts ---
        elements.append(Paragraph(f"3. Security Alerts & Triage ({len(alerts)} Recorded)", section_heading))
        if len(alerts) > 0:
            alert_rows = [["Alert ID", "Severity", "Category", "Source IP", "Target IP", "Signature / Description"]]
            for a in alerts[:10]:
                alert_rows.append([
                    Paragraph(a.alert_id or "N/A", cell_bold),
                    Paragraph((a.severity or "LOW").upper(), cell_style),
                    Paragraph((a.category or "Threat").upper(), cell_style),
                    Paragraph(a.source_ip or "N/A", cell_style),
                    Paragraph(f"{a.destination_ip or 'N/A'}:{a.destination_port or ''}", cell_style),
                    Paragraph((a.title or a.signature or "Security Event")[:40], cell_style)
                ])

            t_alerts = Table(alert_rows, colWidths=[65, 55, 65, 80, 80, 195])
            t_alerts.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 7.5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#ffffff'), colors.HexColor('#f8fafc')])
            ]))
            elements.append(t_alerts)
        else:
            elements.append(Paragraph("<i>No security alerts were recorded during this evaluation period.</i>", body_style))

        elements.append(Spacer(1, 10))

        # --- Section 4: Forensic Incidents ---
        if len(incidents) > 0:
            elements.append(Paragraph(f"4. Active Forensic Incidents ({len(incidents)} Cases)", section_heading))
            inc_rows = [["Incident ID", "Title / Summary", "Severity", "Status", "Assigned", "Created At"]]
            for inc in incidents[:6]:
                inc_rows.append([
                    Paragraph(inc.incident_id or "N/A", cell_bold),
                    Paragraph((inc.title or "Incident Investigation")[:38], cell_style),
                    Paragraph((inc.severity or "HIGH").upper(), cell_style),
                    Paragraph((inc.status or "OPEN").upper(), cell_style),
                    Paragraph(getattr(inc, 'assigned_analyst', None) or getattr(inc, 'assigned_to', None) or "Unassigned", cell_style),
                    Paragraph(inc.created_at.strftime("%Y-%m-%d %H:%M") if inc.created_at else "N/A", cell_style)
                ])

            t_inc = Table(inc_rows, colWidths=[70, 190, 60, 75, 75, 70])
            t_inc.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#334155')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 7.5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#ffffff'), colors.HexColor('#f8fafc')])
            ]))
            elements.append(t_inc)
            elements.append(Spacer(1, 10))

        # --- Section 5: Perimeter Firewall Enforcement Actions ---
        elements.append(Paragraph(f"5. Active Firewall Threat Containment ({len(blocked_ips)} Block Rules)", section_heading))
        if len(blocked_ips) > 0:
            fw_rows = [["Blocked IP", "Reason / Threat Context", "Blocked By", "Blocked Timestamp", "Status"]]
            for b in blocked_ips[:6]:
                fw_rows.append([
                    Paragraph(b.ip_address or "N/A", cell_bold),
                    Paragraph((b.reason or "Automated containment")[:40], cell_style),
                    Paragraph(b.blocked_by or "SOC Admin", cell_style),
                    Paragraph(b.blocked_at.strftime("%Y-%m-%d %H:%M") if b.blocked_at else "N/A", cell_style),
                    Paragraph("ACTIVE", cell_style)
                ])

            t_fw = Table(fw_rows, colWidths=[90, 200, 80, 105, 65])
            t_fw.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#334155')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 7.5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#ffffff'), colors.HexColor('#f8fafc')])
            ]))
            elements.append(t_fw)
        else:
            elements.append(Paragraph("<i>No active perimeter firewall blocks enforced at this time.</i>", body_style))

        elements.append(Spacer(1, 10))

        # --- Section 6: Contextual Strategic Recommendations ---
        # Generate recommendations dynamically from REAL observed telemetry
        elements.append(Paragraph("6. Contextual Defense & Hardening Recommendations", section_heading))
        recs = []

        if sev_counts['CRITICAL'] > 0 or sev_counts['HIGH'] > 0:
            recs.append(f"• Prioritize forensic triage and containment for the {sev_counts['CRITICAL'] + sev_counts['HIGH']} active Critical/High security alerts recorded.")
        
        if len(blocked_ips) > 0:
            recs.append(f"• Review and audit {len(blocked_ips)} active perimeter firewall containment rules for expiration and threat intelligence correlation.")
        
        if len(devices) > 0:
            has_windows = any("windows" in (d.os_type or "").lower() for d in devices)
            has_linux = any("linux" in (d.os_type or "").lower() for d in devices)
            has_mobile = any(d.device_type == "mobile" or "mobile" in (d.os_type or "").lower() for d in devices)

            if has_windows:
                recs.append("• Audit Windows endpoint security configurations and ensure critical OS patches are applied.")
            if has_linux:
                recs.append("• Verify SSH authentication hardening and inspect service daemon logs on discovered Linux servers.")
            if has_mobile:
                recs.append("• Ensure Wi-Fi network encryption (WPA2/WPA3) is enforced for connected mobile and portable client devices.")
            
            recs.append(f"• Continue automated host health telemetry ingestion across all {len(devices)} active network assets.")
        else:
            recs.append("• Trigger network subnet discovery scan to map connected endpoints and establish security baselines.")

        if len(alerts) == 0:
            recs.append("• No active security anomalies detected during this evaluation period. Maintain current monitoring posture.")

        for r in recs:
            elements.append(Paragraph(r, body_style))
            elements.append(Spacer(1, 2.5))

        # Build document
        doc.build(elements)

        file_size = os.path.getsize(filepath)
        return {
            "report_id": report_id,
            "filename": filename,
            "filepath": filepath,
            "file_size": file_size,
            "generated_at": now.isoformat()
        }


pdf_report_generator = PDFReportGenerator()
