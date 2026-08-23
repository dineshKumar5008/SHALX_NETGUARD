import os
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.core.security import get_current_user, require_role, UserRole
from backend.app.core.audit import record_audit_log
from backend.app.models.user import User
from backend.app.schemas.report import ReportGenerateRequest, ReportMetadata
from backend.app.reports.generator import pdf_report_generator

router = APIRouter(prefix="/reports", tags=["Security Report Generation"])


@router.post("/generate", response_model=ReportMetadata)
async def generate_security_report(
    payload: ReportGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.ANALYST]))
):
    """Generate an executive PDF security incident and network posture report from live database data."""
    try:
        report_meta = await pdf_report_generator.generate_security_report(
            db=db,
            title=payload.title or "SHALX NETGUARD SOC Executive Security Report",
            report_type=payload.report_type,
            start_date=payload.start_date,
            end_date=payload.end_date
        )

        await record_audit_log(
            db,
            user=current_user.username,
            action="REPORT_GENERATED",
            resource=f"/api/v1/reports/download/{report_meta['filename']}",
            result="SUCCESS",
            metadata={"report_id": report_meta["report_id"], "type": payload.report_type}
        )

        return {
            "report_id": report_meta["report_id"],
            "report_name": report_meta["filename"],
            "generated_at": datetime.now(timezone.utc),
            "file_size_bytes": report_meta["file_size"],
            "download_url": f"/api/v1/reports/download/{report_meta['filename']}"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate PDF report: {str(e)}"
        )


@router.get("/download/{filename}")
async def download_report_file(
    filename: str,
    current_user: User = Depends(get_current_user)
):
    """Download a generated PDF report file with authentication and path safety checks."""
    # Sanitize filename and prevent path traversal
    safe_filename = os.path.basename(filename)
    if not safe_filename.endswith(".pdf") or ".." in filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid report filename")

    filepath = os.path.join(pdf_report_generator.output_dir, safe_filename)

    if not os.path.exists(filepath):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report file not found")

    return FileResponse(
        path=filepath,
        filename=safe_filename,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_filename}"'
        }
    )


@router.get("/list", response_model=List[ReportMetadata])
async def list_generated_reports(
    current_user: User = Depends(get_current_user)
):
    """List all previously generated PDF reports available for download."""
    reports = []
    if os.path.exists(pdf_report_generator.output_dir):
        for f in os.listdir(pdf_report_generator.output_dir):
            if f.endswith(".pdf"):
                full_path = os.path.join(pdf_report_generator.output_dir, f)
                stat = os.stat(full_path)
                report_id = f.replace("SHALX_NETGUARD_Report_", "").replace("NetGuard_SOC_Report_", "").replace(".pdf", "")
                reports.append({
                    "report_id": report_id,
                    "report_name": f,
                    "generated_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc),
                    "file_size_bytes": stat.st_size,
                    "download_url": f"/api/v1/reports/download/{f}"
                })
    return sorted(reports, key=lambda x: x["generated_at"], reverse=True)
