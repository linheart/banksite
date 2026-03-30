import os
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from fastapi import Cookie, Depends, HTTPException, Response
from jwt import InvalidTokenError
from sqlmodel import Session

from . import crud, db, models

ACCESS_TOKEN_COOKIE = "access_token"
REFRESH_TOKEN_COOKIE = "refresh_token"


def _parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


JWT_SECRET = os.getenv("JWT_SECRET") or os.getenv("SESSION_SECRET", "secret")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_MINUTES = int(os.getenv("JWT_ACCESS_MINUTES", "5"))
REFRESH_TOKEN_DAYS = int(os.getenv("JWT_REFRESH_DAYS", "7"))
COOKIE_SECURE = _parse_bool(os.getenv("COOKIE_SECURE"), default=False)
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "strict").lower()
if COOKIE_SAMESITE not in {"lax", "strict", "none"}:
    COOKIE_SAMESITE = "lax"


def _now_utc() -> datetime:
    return datetime.now(UTC)

def _decode_token(raw_token: str, expected_type: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(raw_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Not authenticated") from exc

    if payload.get("type") != expected_type:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return payload


def _extract_user_id(payload: dict[str, Any]) -> int:
    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        return int(sub)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Not authenticated") from exc

def _create_token(
    user_id: int,
    token_type: str,
    expires_delta: timedelta,
) -> str:
    now = _now_utc()
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_auth_tokens(user_id: int) -> dict[str, str]:
    access_token = _create_token(
        user_id=user_id,
        token_type="access",
        expires_delta=timedelta(minutes=ACCESS_TOKEN_MINUTES),
    )
    refresh_token = _create_token(
        user_id=user_id,
        token_type="refresh",
        expires_delta=timedelta(days=REFRESH_TOKEN_DAYS),
    )
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
    }


def set_auth_cookies(response: Response, tokens: dict[str, str]) -> None:
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE,
        value=tokens["access_token"],
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=ACCESS_TOKEN_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE,
        value=tokens["refresh_token"],
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=REFRESH_TOKEN_DAYS * 24 * 60 * 60,
        path="/",
    )

def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_TOKEN_COOKIE, path="/")
    response.delete_cookie(REFRESH_TOKEN_COOKIE, path="/")

def require_current_user(
    session: Session = Depends(db.get_session),
    access_token: str | None = Cookie(default=None, alias=ACCESS_TOKEN_COOKIE),
) -> models.Users:
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = _decode_token(access_token, expected_type="access")
    user_id = _extract_user_id(payload)
    user = crud.get_user_by_id(session, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

def require_refresh_user_id(
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_TOKEN_COOKIE),
) -> int:
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = _decode_token(refresh_token, expected_type="refresh")
    return _extract_user_id(payload)

def require_admin(
    current_user: models.Users = Depends(require_current_user),
) -> models.Users:
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
