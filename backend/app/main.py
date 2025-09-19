from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Response, Cookie
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from passlib.context import CryptContext

from . import db, models, schemas, crud, deps

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

@asynccontextmanager
async def lifespan(app: FastAPI):
    db.create_db_and_tables()
    yield

app = FastAPI(title="Config Control API (lab)", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    yield from db.get_session()

@app.get("/api/me", response_model=schemas.UserOut)
def me(
    session: Session = Depends(get_db),
    user_id: int | None = Depends(deps.get_current_user_id),
):
    if user_id is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = crud.get_user_by_id(session, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.post("/api/register", response_model=schemas.UserOut)
def register(payload: schemas.UserCreate, session: Session = Depends(get_db)):
    existing = crud.get_user_by_username(session, payload.username)
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    password_hash = pwd_ctx.hash(payload.password)
    user = crud.create_user(
        session,
        username=payload.username,
        email=payload.email,
        password_hash=password_hash,
    )
    return user

@app.post("/api/login")
def login(payload: schemas.LoginPayload, response: Response, session: Session = Depends(get_db)):
    username = payload.username
    password = payload.password
    if not username or not password:
        raise HTTPException(status_code=400, detail="username and password required")

    user = crud.get_user_by_username(session, username)
    if not user or not pwd_ctx.verify(password, user.password_hash):
        raise HTTPException(status_code=401, detail="invalid credentials")

    sid = deps.create_session(user.id)
    response.set_cookie(
        key="session_id",
        value=sid,
        httponly=True,
        samesite="lax",
    )
    return {"msg": "ok"}

@app.post("/api/logout")
def logout(response: Response, session_id: str | None = Cookie(None)):
    if session_id:
        from .deps import _sessions
        _sessions.pop(session_id, None)
    response.delete_cookie("session_id")
    return {"msg": "logged out"}

@app.post("/api/branches")
def create_branch(payload: dict, session: Session = Depends(get_db)):
    name = payload.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="name required")
    b = crud.create_branch_if_not_exists(session, name)
    return {"id": b.id, "name": b.name}

@app.get("/api/branches")
def list_branches(session: Session = Depends(get_db)):
    branches = session.exec(select(models.Branch)).all()
    return [{"id": b.id, "name": b.name} for b in branches]

@app.get("/api/configs", response_model=list[schemas.DeviceConfigOut])
def list_configs(
    session: Session = Depends(get_db),
    limit: int = 100,
    offset: int = 0,
):
    return crud.list_configs(session, limit=limit, offset=offset)

@app.get("/api/configs/{config_id}", response_model=schemas.DeviceConfigOut)
def get_config(config_id: int, session: Session = Depends(get_db)):
    cfg = crud.get_config(session, config_id)
    if not cfg:
        raise HTTPException(status_code=404, detail="not found")
    return cfg

@app.post("/api/configs", response_model=schemas.DeviceConfigOut)
def create_config(
    payload: schemas.DeviceConfigCreate,
    session: Session = Depends(get_db),
    user_id: Optional[int] = Depends(deps.get_current_user_id),
):
    data = payload.model_dump()
    return crud.create_config(session, data, user_id)

@app.put("/api/configs/{config_id}", response_model=schemas.DeviceConfigOut)
def update_config(
    config_id: int,
    payload: schemas.DeviceConfigUpdate,
    session: Session = Depends(get_db),
    user_id: Optional[int] = Depends(deps.get_current_user_id),
):
    cfg = crud.update_config(
        session,
        config_id,
        payload.model_dump(exclude_unset=True),
        user_id,
    )
    if not cfg:
        raise HTTPException(status_code=404, detail="not found")
    return cfg

@app.delete("/api/configs/{config_id}")
def delete_config(
    config_id: int,
    session: Session = Depends(get_db),
    user_id: Optional[int] = Depends(deps.get_current_user_id),
):
    ok = crud.delete_config(session, config_id, user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="not found")
    return {"msg": "deleted"}

@app.get("/api/configs/{config_id}/audit", response_model=list[schemas.AuditOut])
def get_audit(config_id: int, session: Session = Depends(get_db)):
    return crud.get_audit_for_config(session, config_id)

@app.get("/api/users", response_model=list[schemas.UserOut])
def list_users(session: Session = Depends(get_db)):
    return session.query(models.Users).all()