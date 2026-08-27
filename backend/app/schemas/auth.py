from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str
    full_name: str


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None
    exp: Optional[int] = None


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginMfaResponse(BaseModel):
    mfa_required: bool = True
    challenge_id: str
    masked_email: str
    expires_in: int = 300
    message: str = "Verification code dispatched to your registered email address."


class MFAVerifyRequest(BaseModel):
    challenge_id: str
    otp: str = Field(min_length=6, max_length=6, description="6-digit dynamic OTP verification code")


class MFAResendRequest(BaseModel):
    challenge_id: str


class SetupAdminEmailRequest(BaseModel):
    username: str = "admin"
    password: str
    real_email: str = Field(min_length=5, max_length=128, description="Real registered email address for administrator MFA OTP delivery")


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class UserProfileUpdateRequest(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None


class UserBase(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    email: str = Field(min_length=0, max_length=128)
    full_name: str
    role: str = "ANALYST"
    is_active: bool = True
    email_verified: bool = True


class UserCreate(UserBase):
    password: str = Field(min_length=8)


class UserUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    email_verified: Optional[bool] = None


class UserResponse(UserBase):
    id: int
    created_at: datetime
    last_login: Optional[datetime] = None
    email_verified_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ResetRateLimitRequest(BaseModel):
    username: str = "admin"
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str = Field(min_length=3, max_length=128, description="Registered email address")


class ForgotPasswordResponse(BaseModel):
    message: str = "If the email address is registered, a verification code has been sent."
    challenge_id: Optional[str] = None
    masked_email: Optional[str] = None
    expires_in: int = 600


class ForgotPasswordVerifyRequest(BaseModel):
    challenge_id: str
    otp: str = Field(min_length=6, max_length=6, description="6-digit verification code")


class ForgotPasswordVerifyResponse(BaseModel):
    message: str = "Email verification successful."
    reset_token: str


class ForgotPasswordResendRequest(BaseModel):
    challenge_id: str


class ForgotPasswordResetRequest(BaseModel):
    reset_token: str
    new_password: str = Field(min_length=8, max_length=128, description="New account password")
    confirm_password: str = Field(min_length=8, max_length=128, description="Confirm new password")

