from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, field_validator


class RegistrationSubmitRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=128, description="Applicant's full name")
    username: str = Field(min_length=3, max_length=64, description="Desired system username")
    email: str = Field(min_length=5, max_length=128, description="Real email address for notification & MFA")
    password: str = Field(min_length=8, description="Account password")
    confirm_password: str = Field(min_length=8, description="Password confirmation")
    department: str = Field(min_length=2, max_length=128, description="Department / Team name")
    reason: str = Field(min_length=5, max_length=500, description="Business justification for SOC access")

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v, info):
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Password confirmation does not match password.")
        return v


class RegistrationResponse(BaseModel):
    id: int
    full_name: str
    username: str
    email: str
    department: str
    reason: str
    requested_role: str
    status: str
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None
    rejection_reason: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class RegistrationStatusResponse(BaseModel):
    id: int
    username: str
    masked_email: str
    status: str
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    message: str


class RegistrationApproveRequest(BaseModel):
    role: Optional[str] = Field(default="VIEWER", description="Assigned RBAC role (ADMIN, SENIOR_ANALYST, ANALYST, VIEWER)")


class RegistrationRejectRequest(BaseModel):
    rejection_reason: str = Field(min_length=3, max_length=500, description="Mandatory reason for rejecting access request")
