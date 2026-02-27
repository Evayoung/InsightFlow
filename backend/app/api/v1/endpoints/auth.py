from datetime import timedelta
from urllib.parse import urlencode
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    get_password_hash,
    verify_password,
)
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    AuthSession,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    LogoutRequest,
    ResetPasswordRequest,
    RefreshRequest,
    RegisterRequest,
    TokenPair,
    UserProfile,
    VerifyResetTokenRequest,
)
from app.services.email import send_password_reset_email

router = APIRouter()


@router.post("/register", response_model=AuthSession, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> AuthSession:
    existing = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")

    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name,
        password_hash=get_password_hash(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    tokens = TokenPair(
        access_token=create_access_token(str(user.id), timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)),
        refresh_token=create_refresh_token(str(user.id), timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)),
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    return AuthSession(user=UserProfile.model_validate(user), tokens=tokens)


@router.post("/login", response_model=AuthSession)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthSession:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    tokens = TokenPair(
        access_token=create_access_token(str(user.id), timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)),
        refresh_token=create_refresh_token(str(user.id), timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)),
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    return AuthSession(user=UserProfile.model_validate(user), tokens=tokens)


@router.post("/refresh", response_model=TokenPair)
def refresh(_: RefreshRequest) -> TokenPair:
    token_payload = decode_token(_.refresh_token, expected_type="refresh")
    user_id = token_payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    return TokenPair(
        access_token=create_access_token(user_id, timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)),
        refresh_token=create_refresh_token(user_id, timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)),
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(_: LogoutRequest) -> None:
    return None


@router.post("/password/forgot", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)) -> ForgotPasswordResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user:
        token = create_password_reset_token(
            str(user.id),
            timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES),
        )
        query = urlencode({"token": token})
        reset_link = f"{settings.PASSWORD_RESET_URL_BASE}?{query}"
        send_password_reset_email(user.email, reset_link)

    return ForgotPasswordResponse(message="If the account exists, a reset email has been sent.")


@router.post("/password/reset/verify")
def verify_reset_token(payload: VerifyResetTokenRequest, db: Session = Depends(get_db)) -> dict[str, bool]:
    token_payload = decode_token(payload.token, expected_type="password_reset")
    user_id = token_payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    try:
        user_uuid = UUID(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    user = db.get(User, user_uuid)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    return {"valid": True}


@router.post("/password/reset", response_model=ForgotPasswordResponse)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> ForgotPasswordResponse:
    token_payload = decode_token(payload.token, expected_type="password_reset")
    user_id = token_payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    try:
        user_uuid = UUID(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    user = db.get(User, user_uuid)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user.password_hash = get_password_hash(payload.new_password)
    db.add(user)
    db.commit()

    return ForgotPasswordResponse(message="Password reset successful.")


@router.get("/me", response_model=UserProfile)
def me(user: User = Depends(get_current_user)) -> UserProfile:
    return UserProfile.model_validate(user)
