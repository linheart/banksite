from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from passlib.context import CryptContext
from sqlalchemy.exc import IntegrityError

from .. import crud, deps, models, schemas
from .shared import CurrentUserDep, SessionDep, get_user_id_or_500

router = APIRouter(prefix="/api", tags=["auth"])

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


@router.get("/me", response_model=schemas.MeOut)
def me(
    session: SessionDep,
    current_user: CurrentUserDep,
):
    user_id = get_user_id_or_500(current_user)
    branch_ids = sorted(crud.get_user_branch_ids(session, user_id))
    return schemas.MeOut(
        id=user_id,
        username=current_user.username,
        email=current_user.email,
        role=current_user.role,
        branch_ids=branch_ids,
    )


@router.post("/register", response_model=schemas.UserOut)
def register(payload: schemas.UserCreate, session: SessionDep):
    if crud.get_user_by_username(session, payload.username):
        raise HTTPException(status_code=400, detail="Username already exists")
    if crud.get_user_by_email(session, payload.email):
        raise HTTPException(status_code=400, detail="Email already exists")

    role = models.UserRole.ADMIN if crud.count_users(session) == 0 else models.UserRole.VIEWER
    password_hash = pwd_ctx.hash(payload.password)
    try:
        return crud.create_user(
            session,
            username=payload.username,
            email=payload.email,
            password_hash=password_hash,
            role=role,
        )
    except IntegrityError as exc:
        raise HTTPException(status_code=409, detail="User already exists") from exc


@router.post("/login")
def login(
    payload: schemas.LoginPayload,
    response: Response,
    session: SessionDep,
):
    user = crud.get_user_by_username(session, payload.username)
    if not user or not pwd_ctx.verify(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="invalid credentials")

    user_id = get_user_id_or_500(user)
    tokens = deps.create_auth_tokens(user_id)
    deps.set_auth_cookies(response, tokens)
    return {"msg": "ok"}


@router.post("/token/refresh")
def refresh_token(
    response: Response,
    session: SessionDep,
    user_id: Annotated[int, Depends(deps.require_refresh_user_id)],
):
    if not crud.get_user_by_id(session, user_id):
        raise HTTPException(status_code=401, detail="Not authenticated")
    tokens = deps.create_auth_tokens(user_id)
    deps.set_auth_cookies(response, tokens)
    return {"msg": "ok"}


@router.post("/logout")
def logout(response: Response):
    deps.clear_auth_cookies(response)
    return {"msg": "logged out"}
