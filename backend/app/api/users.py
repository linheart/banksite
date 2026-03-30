from fastapi import APIRouter, HTTPException

from .. import crud, models, schemas
from .shared import AdminUserDep, SessionDep, get_user_id_or_500

router = APIRouter(prefix="/api", tags=["users"])


@router.get("/users", response_model=list[schemas.UserAccessOut])
def list_users(session: SessionDep, _: AdminUserDep):
    items: list[schemas.UserAccessOut] = []
    for user, branch_ids in crud.list_users_with_branch_access(session):
        user_id = user.id
        if user_id is None:
            continue
        items.append(
            schemas.UserAccessOut(
                user_id=user_id,
                username=user.username,
                role=user.role,
                branch_ids=branch_ids,
            )
        )
    return items


@router.put("/users/{user_id}", response_model=schemas.UserAccessOut)
def update_user(
    user_id: int,
    payload: schemas.UserAccessUpdate,
    session: SessionDep,
    current_user: AdminUserDep,
):
    current_user_id = get_user_id_or_500(current_user)
    if user_id == current_user_id:
        raise HTTPException(status_code=400, detail="Cannot change own role")

    target = crud.get_user_by_id(session, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.role not in models.UserRole.ALL:
        raise HTTPException(status_code=400, detail="Invalid role")

    branch_ids = sorted(set(payload.branch_ids))
    for branch_id in branch_ids:
        if not crud.get_branch_by_id(session, branch_id):
            raise HTTPException(status_code=404, detail=f"Branch {branch_id} not found")

    if payload.role in {models.UserRole.ADMIN, models.UserRole.AUDITOR}:
        branch_ids = []

    updated = crud.update_user_access(session, user_id, payload.role, branch_ids)
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    updated_user, updated_branch_ids = updated

    return schemas.UserAccessOut(
        user_id=user_id,
        username=updated_user.username,
        role=updated_user.role,
        branch_ids=sorted(updated_branch_ids),
    )
