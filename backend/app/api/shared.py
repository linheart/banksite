from typing import Annotated

from fastapi import Depends, HTTPException
from sqlmodel import Session

from .. import crud, db, deps, models

SessionDep = Annotated[Session, Depends(db.get_session)]
CurrentUserDep = Annotated[models.Users, Depends(deps.require_current_user)]
AdminUserDep = Annotated[models.Users, Depends(deps.require_admin)]


def get_user_id_or_500(current_user: models.Users) -> int:
    if current_user.id is None:
        raise HTTPException(status_code=500, detail="User id is missing")
    return current_user.id


def is_global_reader(current_user: models.Users) -> bool:
    return current_user.role in {models.UserRole.ADMIN, models.UserRole.AUDITOR}


def require_role(current_user: models.Users, allowed_roles: set[str]) -> None:
    if current_user.role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Forbidden")


def get_branch_scope(session: Session, current_user: models.Users) -> set[int] | None:
    if is_global_reader(current_user):
        return None
    user_id = get_user_id_or_500(current_user)
    return crud.get_user_branch_ids(session, user_id)
