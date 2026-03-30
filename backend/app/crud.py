from datetime import datetime, timezone
from typing import List

from sqlalchemy import false
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlmodel import Session, func, select

from . import models
from .logger import get_logger


logger = get_logger(__name__)


def _commit(session: Session) -> None:
    try:
        session.commit()
    except SQLAlchemyError:
        session.rollback()
        logger.exception("Database commit failed")
        raise


def _format_change(key: str, old: object, new: object) -> str:
    if key == "config_text":
        old_len = len(old) if isinstance(old, str) else 0
        new_len = len(new) if isinstance(new, str) else 0
        return f"{key}: ({old_len} chars) -> ({new_len} chars)"
    return f"{key}: '{old}' -> '{new}'"


def count_users(session: Session) -> int:
    stmt = select(func.count()).select_from(models.Users)
    return int(session.exec(stmt).one())


def create_user(
    session: Session,
    username: str,
    email: str,
    password_hash: str,
    role: str = models.UserRole.VIEWER,
) -> models.Users:
    user = models.Users(
        username=username,
        email=email,
        password_hash=password_hash,
        role=role,
    )
    session.add(user)
    _commit(session)
    session.refresh(user)
    return user


def get_user_by_username(session: Session, username: str) -> models.Users | None:
    statement = select(models.Users).where(models.Users.username == username)
    return session.exec(statement).first()


def get_user_by_email(session: Session, email: str) -> models.Users | None:
    statement = select(models.Users).where(models.Users.email == email)
    return session.exec(statement).first()


def get_user_by_id(session: Session, user_id: int) -> models.Users | None:
    return session.get(models.Users, user_id)


def list_users_with_branch_access(session: Session) -> list[tuple[models.Users, list[int]]]:
    users = session.exec(select(models.Users).order_by(models.Users.id)).all()
    access_stmt = select(models.UserBranchAccess.user_id, models.UserBranchAccess.branch_id)
    branch_map: dict[int, list[int]] = {}
    for user_id, branch_id in session.exec(access_stmt).all():
        branch_map.setdefault(user_id, []).append(branch_id)

    result: list[tuple[models.Users, list[int]]] = []
    for user in users:
        if user.id is None:
            continue
        result.append((user, sorted(set(branch_map.get(user.id, [])))))
    return result


def get_user_branch_ids(session: Session, user_id: int) -> set[int]:
    stmt = select(models.UserBranchAccess.branch_id).where(models.UserBranchAccess.user_id == user_id)
    return set(session.exec(stmt).all())


def update_user_access(
    session: Session,
    user_id: int,
    role: str,
    branch_ids: list[int],
) -> tuple[models.Users, set[int]] | None:
    user = get_user_by_id(session, user_id)
    if not user:
        return None

    user.role = role
    session.add(user)

    existing_stmt = select(models.UserBranchAccess).where(models.UserBranchAccess.user_id == user_id)
    for item in session.exec(existing_stmt).all():
        session.delete(item)

    unique_branch_ids = sorted(set(branch_ids))
    for branch_id in unique_branch_ids:
        session.add(models.UserBranchAccess(user_id=user_id, branch_id=branch_id))

    _commit(session)
    session.refresh(user)
    return user, set(unique_branch_ids)


def get_branch_by_id(session: Session, branch_id: int) -> models.Branch | None:
    return session.get(models.Branch, branch_id)


def _get_branch_by_name(session: Session, name: str) -> models.Branch | None:
    stmt = select(models.Branch).where(models.Branch.name == name)
    return session.exec(stmt).first()


def list_branches(session: Session, branch_ids: set[int] | None = None) -> List[models.Branch]:
    stmt = select(models.Branch)
    if branch_ids is not None:
        if not branch_ids:
            return []
        stmt = stmt.where(models.Branch.id.in_(branch_ids))

    stmt = stmt.order_by(models.Branch.name)
    return session.exec(stmt).all()


def create_branch(session: Session, name: str) -> models.Branch:
    if _get_branch_by_name(session, name):
        raise ValueError("branch_exists")

    branch = models.Branch(name=name)
    session.add(branch)

    try:
        _commit(session)
    except IntegrityError as exc:
        raise ValueError("branch_exists") from exc

    session.refresh(branch)
    return branch


def update_branch(session: Session, branch_id: int, name: str) -> models.Branch | None:
    branch = get_branch_by_id(session, branch_id)
    if not branch:
        return None

    if branch.name == name:
        return branch

    existing = _get_branch_by_name(session, name)
    if existing and existing.id != branch_id:
        raise ValueError("branch_exists")

    branch.name = name
    session.add(branch)

    try:
        _commit(session)
    except IntegrityError as exc:
        raise ValueError("branch_exists") from exc

    session.refresh(branch)
    return branch


def delete_branch(session: Session, branch_id: int) -> str:
    branch = get_branch_by_id(session, branch_id)
    if not branch:
        return "not_found"

    session.delete(branch)
    try:
        _commit(session)
    except IntegrityError as exc:
        raise ValueError("branch_in_use") from exc

    return "deleted"


def _config_filters(
    branch_ids: set[int] | None = None,
    q: str | None = None,
    branch_id: int | None = None,
    device_type: str | None = None,
) -> list[object]:
    conditions: list[object] = [models.DeviceConfig.deleted_at.is_(None)]

    if branch_ids is not None:
        if not branch_ids:
            conditions.append(false())
        else:
            conditions.append(models.DeviceConfig.branch_id.in_(branch_ids))

    if branch_id is not None:
        conditions.append(models.DeviceConfig.branch_id == branch_id)

    if q:
        conditions.append(models.DeviceConfig.name.ilike(f"%{q}%"))

    if device_type:
        conditions.append(models.DeviceConfig.device_type.ilike(f"%{device_type}%"))

    return conditions


def _active_configs_stmt(branch_ids: set[int] | None = None):
    return select(models.DeviceConfig).where(*_config_filters(branch_ids=branch_ids))


def list_configs(
    session: Session,
    limit: int = 100,
    offset: int = 0,
    branch_ids: set[int] | None = None,
    q: str | None = None,
    branch_id: int | None = None,
    device_type: str | None = None,
) -> tuple[List[models.DeviceConfig], int]:
    conditions = _config_filters(
        branch_ids=branch_ids,
        q=q,
        branch_id=branch_id,
        device_type=device_type,
    )

    items_stmt = (
        select(models.DeviceConfig)
        .where(*conditions)
        .order_by(models.DeviceConfig.id)
        .limit(limit)
        .offset(offset)
    )
    total_stmt = select(func.count()).select_from(models.DeviceConfig).where(*conditions)

    items = session.exec(items_stmt).all()
    total = int(session.exec(total_stmt).one())
    return items, total


def get_config(
    session: Session,
    config_id: int,
    branch_ids: set[int] | None = None,
) -> models.DeviceConfig | None:
    stmt = _active_configs_stmt(branch_ids).where(models.DeviceConfig.id == config_id)
    return session.exec(stmt).first()


def create_config(
    session: Session,
    data: dict,
    user_id: int | None,
    allowed_branch_ids: set[int] | None = None,
) -> models.DeviceConfig:
    branch_id = data.get("branch_id")
    if branch_id is None or not get_branch_by_id(session, branch_id):
        raise ValueError("branch_not_found")
    if allowed_branch_ids is not None and branch_id not in allowed_branch_ids:
        raise ValueError("branch_forbidden")

    cfg = models.DeviceConfig(**data)
    session.add(cfg)
    try:
        session.flush()
    except IntegrityError as exc:
        session.rollback()
        raise ValueError("config_exists_in_branch") from exc

    desc = f"Создана конфигурация: {cfg.name or ('id=' + str(cfg.id))}"
    audit = models.AuditLog(
        config_id=cfg.id,
        action="CREATE",
        user_id=user_id,
        description=desc,
    )
    session.add(audit)

    try:
        _commit(session)
    except IntegrityError as exc:
        raise ValueError("config_exists_in_branch") from exc
    session.refresh(cfg)
    return cfg


def update_config(
    session: Session,
    config_id: int,
    data: dict,
    user_id: int | None,
    branch_ids: set[int] | None = None,
) -> models.DeviceConfig | None:
    cfg = get_config(session, config_id, branch_ids=branch_ids)
    if not cfg:
        return None

    new_branch_id = data.get("branch_id")
    if new_branch_id is not None:
        if not get_branch_by_id(session, new_branch_id):
            raise ValueError("branch_not_found")
        if branch_ids is not None and new_branch_id not in branch_ids:
            raise ValueError("branch_forbidden")

    changes = []
    for key, value in data.items():
        old = getattr(cfg, key, None)
        if value != old:
            changes.append(_format_change(key, old, value))
            setattr(cfg, key, value)

    if not changes:
        return cfg

    cfg.last_modified = datetime.now(timezone.utc)
    session.add(cfg)

    desc = "Изменено: " + "; ".join(changes)
    audit = models.AuditLog(
        config_id=cfg.id,
        action="UPDATE",
        user_id=user_id,
        description=desc,
    )
    session.add(audit)

    try:
        _commit(session)
    except IntegrityError as exc:
        raise ValueError("config_exists_in_branch") from exc
    session.refresh(cfg)
    return cfg


def delete_config(
    session: Session,
    config_id: int,
    user_id: int | None,
    branch_ids: set[int] | None = None,
) -> bool:
    cfg = get_config(session, config_id, branch_ids=branch_ids)
    if not cfg:
        return False

    desc = f"Удалена конфигурация: {cfg.name or ('id=' + str(cfg.id))}"
    audit = models.AuditLog(
        config_id=cfg.id,
        action="DELETE",
        user_id=user_id,
        description=desc,
    )

    now = datetime.now(timezone.utc)
    cfg.deleted_at = now
    cfg.last_modified = now

    session.add(cfg)
    session.add(audit)
    _commit(session)
    return True


def list_audit(
    session: Session,
    limit: int = 20,
    offset: int = 0,
    branch_ids: set[int] | None = None,
) -> List[models.AuditLog]:
    stmt = select(models.AuditLog)
    if branch_ids is not None:
        if not branch_ids:
            return []
        stmt = stmt.join(models.DeviceConfig, models.DeviceConfig.id == models.AuditLog.config_id)
        stmt = stmt.where(models.DeviceConfig.branch_id.in_(branch_ids))

    stmt = stmt.order_by(models.AuditLog.event_at.desc()).limit(limit).offset(offset)
    return session.exec(stmt).all()


def get_audit_for_config(session: Session, config_id: int) -> List[models.AuditLog]:
    stmt = (
        select(models.AuditLog)
        .where(models.AuditLog.config_id == config_id)
        .order_by(models.AuditLog.event_at.desc())
    )
    return session.exec(stmt).all()
