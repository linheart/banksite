from fastapi import APIRouter, HTTPException, Query

from .. import crud, models, schemas
from .shared import CurrentUserDep, SessionDep, get_branch_scope, get_user_id_or_500, require_role

router = APIRouter(prefix="/api", tags=["configs"])


@router.get("/configs", response_model=schemas.DeviceConfigListOut)
def list_configs(
    session: SessionDep,
    current_user: CurrentUserDep,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    q: str | None = Query(default=None, min_length=1, max_length=150),
    branch_id: int | None = Query(default=None, gt=0),
    device_type: str | None = Query(default=None, min_length=1, max_length=100),
):
    branch_scope = get_branch_scope(session, current_user)
    q_value = q.strip() if q and q.strip() else None
    device_type_value = device_type.strip() if device_type and device_type.strip() else None
    items, total = crud.list_configs(
        session,
        limit=limit,
        offset=offset,
        branch_ids=branch_scope,
        q=q_value,
        branch_id=branch_id,
        device_type=device_type_value,
    )
    return schemas.DeviceConfigListOut(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/configs/{config_id}", response_model=schemas.DeviceConfigOut)
def get_config(config_id: int, session: SessionDep, current_user: CurrentUserDep):
    branch_scope = get_branch_scope(session, current_user)
    cfg = crud.get_config(session, config_id, branch_ids=branch_scope)
    if not cfg:
        raise HTTPException(status_code=404, detail="not found")
    return cfg


@router.post("/configs", response_model=schemas.DeviceConfigOut)
def create_config(
    payload: schemas.DeviceConfigCreate,
    session: SessionDep,
    current_user: CurrentUserDep,
):
    require_role(current_user, {models.UserRole.OPERATOR, models.UserRole.ADMIN})

    user_id = get_user_id_or_500(current_user)
    allowed_branch_ids = None
    if current_user.role == models.UserRole.OPERATOR:
        allowed_branch_ids = crud.get_user_branch_ids(session, user_id)

    try:
        return crud.create_config(
            session,
            payload.model_dump(),
            user_id,
            allowed_branch_ids=allowed_branch_ids,
        )
    except ValueError as exc:
        if str(exc) == "branch_not_found":
            raise HTTPException(status_code=404, detail="branch not found") from exc
        if str(exc) == "branch_forbidden":
            raise HTTPException(status_code=403, detail="branch access denied") from exc
        if str(exc) == "config_exists_in_branch":
            raise HTTPException(status_code=409, detail="config already exists in branch") from exc
        raise


@router.put("/configs/{config_id}", response_model=schemas.DeviceConfigOut)
def update_config(
    config_id: int,
    payload: schemas.DeviceConfigUpdate,
    session: SessionDep,
    current_user: CurrentUserDep,
):
    require_role(current_user, {models.UserRole.OPERATOR, models.UserRole.ADMIN})

    user_id = get_user_id_or_500(current_user)
    branch_scope = None
    if current_user.role == models.UserRole.OPERATOR:
        branch_scope = crud.get_user_branch_ids(session, user_id)

    try:
        cfg = crud.update_config(
            session,
            config_id,
            payload.model_dump(exclude_unset=True),
            user_id,
            branch_ids=branch_scope,
        )
    except ValueError as exc:
        if str(exc) == "branch_not_found":
            raise HTTPException(status_code=404, detail="branch not found") from exc
        if str(exc) == "branch_forbidden":
            raise HTTPException(status_code=403, detail="branch access denied") from exc
        if str(exc) == "config_exists_in_branch":
            raise HTTPException(status_code=409, detail="config already exists in branch") from exc
        raise

    if not cfg:
        raise HTTPException(status_code=404, detail="not found")
    return cfg


@router.delete("/configs/{config_id}")
def delete_config(
    config_id: int,
    session: SessionDep,
    current_user: CurrentUserDep,
):
    require_role(current_user, {models.UserRole.ADMIN})

    user_id = get_user_id_or_500(current_user)
    ok = crud.delete_config(session, config_id, user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="not found")
    return {"msg": "deleted"}


@router.get("/audit", response_model=list[schemas.AuditOut])
def list_audit(
    session: SessionDep,
    current_user: CurrentUserDep,
    limit: int = Query(default=20, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    branch_scope = get_branch_scope(session, current_user)
    return crud.list_audit(session, limit=limit, offset=offset, branch_ids=branch_scope)


@router.get("/configs/{config_id}/audit", response_model=list[schemas.AuditOut])
def get_audit(config_id: int, session: SessionDep, current_user: CurrentUserDep):
    branch_scope = get_branch_scope(session, current_user)
    cfg = crud.get_config(session, config_id, branch_ids=branch_scope)
    if not cfg:
        raise HTTPException(status_code=404, detail="not found")
    return crud.get_audit_for_config(session, config_id)
