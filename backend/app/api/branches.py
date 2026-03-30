from fastapi import APIRouter, HTTPException, Response

from .. import crud, schemas
from .shared import AdminUserDep, CurrentUserDep, SessionDep, get_branch_scope

router = APIRouter(prefix="/api", tags=["branches"])


@router.post("/branches", response_model=schemas.BranchOut, status_code=201)
def create_branch(
    payload: schemas.BranchCreate,
    session: SessionDep,
    _admin: AdminUserDep,
):
    try:
        return crud.create_branch(session, payload.name)
    except ValueError as exc:
        if str(exc) == "branch_exists":
            raise HTTPException(status_code=409, detail="branch already exists") from exc
        raise


@router.get("/branches", response_model=list[schemas.BranchOut])
def list_branches(session: SessionDep, current_user: CurrentUserDep):
    branch_scope = get_branch_scope(session, current_user)
    return crud.list_branches(session, branch_ids=branch_scope)


@router.get("/branches/{branch_id}", response_model=schemas.BranchOut)
def get_branch(
    branch_id: int,
    session: SessionDep,
    current_user: CurrentUserDep,
):
    branch_scope = get_branch_scope(session, current_user)
    if branch_scope is not None and branch_id not in branch_scope:
        raise HTTPException(status_code=404, detail="branch not found")

    branch = crud.get_branch_by_id(session, branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="branch not found")
    return branch


@router.put("/branches/{branch_id}", response_model=schemas.BranchOut)
def update_branch(
    branch_id: int,
    payload: schemas.BranchUpdate,
    session: SessionDep,
    _admin: AdminUserDep,
):
    try:
        updated = crud.update_branch(session, branch_id, payload.name)
    except ValueError as exc:
        if str(exc) == "branch_exists":
            raise HTTPException(status_code=409, detail="branch already exists") from exc
        raise

    if not updated:
        raise HTTPException(status_code=404, detail="branch not found")
    return updated


@router.delete("/branches/{branch_id}", status_code=204)
def delete_branch(
    branch_id: int,
    session: SessionDep,
    _admin: AdminUserDep,
):
    try:
        result = crud.delete_branch(session, branch_id)
    except ValueError as exc:
        if str(exc) == "branch_in_use":
            raise HTTPException(status_code=409, detail="branch in use") from exc
        raise
    if result == "not_found":
        raise HTTPException(status_code=404, detail="branch not found")
    return Response(status_code=204)
