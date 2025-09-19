from sqlmodel import Session, select
from . import models
from typing import List
from datetime import datetime, timezone

def create_user(session: Session, username: str, email: str, password_hash: str) -> models.Users:
    user = models.Users(username=username, email=email, password_hash=password_hash)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user

def get_user_by_username(session: Session, username: str) -> models.Users | None:
    statement = select(models.Users).where(models.Users.username == username)
    return session.exec(statement).first()

def get_user_by_id(session: Session, user_id: int) -> models.Users | None:
    return session.get(models.Users, user_id)

def get_branch_by_id(session: Session, branch_id: int) -> models.Branch | None:
    return session.get(models.Branch, branch_id)

def create_branch_if_not_exists(session: Session, name: str) -> models.Branch:
    stmt = select(models.Branch).where(models.Branch.name == name)
    found = session.exec(stmt).first()
    if found:
        return found
    b = models.Branch(name=name)
    session.add(b)
    session.commit()
    session.refresh(b)
    return b

def list_configs(session: Session, limit: int = 100, offset: int = 0) -> List[models.DeviceConfig]:
    stmt = (
        select(models.DeviceConfig)
        .limit(limit)
        .offset(offset)
        .order_by(models.DeviceConfig.id)
    )
    return session.exec(stmt).all()

def get_config(session: Session, config_id: int) -> models.DeviceConfig | None:
    return session.get(models.DeviceConfig, config_id)

def create_config(session: Session, data: dict, user_id: int | None) -> models.DeviceConfig:
    cfg = models.DeviceConfig(**data)
    session.add(cfg)
    session.commit()
    session.refresh(cfg)
    desc = f"Создана конфигурация: {cfg.name or ('id=' + str(cfg.id))}"
    al = models.AuditLog(config_id=cfg.id, action="CREATE", user_id=user_id, description=desc)
    session.add(al)
    session.commit()
    return cfg

def update_config(session: Session, config_id: int, data: dict, user_id: int | None) -> models.DeviceConfig | None:
    cfg = session.get(models.DeviceConfig, config_id)
    if not cfg:
        return None

    changes = []
    for key, val in data.items():
        old = getattr(cfg, key, None)
        if val is not None and val != old:
            changes.append(f"{key}: '{old}' -> '{val}'")
            setattr(cfg, key, val)

    cfg.last_modified = datetime.now(timezone.utc)
    session.add(cfg)
    session.commit()
    session.refresh(cfg)

    if changes:
        desc = "Изменено: " + "; ".join(changes)
        al = models.AuditLog(config_id=cfg.id, action="UPDATE", user_id=user_id, description=desc)
        session.add(al)
        session.commit()

    return cfg

def delete_config(session: Session, config_id: int, user_id: int | None) -> bool:
    cfg = session.get(models.DeviceConfig, config_id)
    if not cfg:
        return False

    desc = f"Удалена конфигурация: {cfg.name or ('id=' + str(cfg.id))}"
    al = models.AuditLog(config_id=cfg.id, action="DELETE", user_id=user_id, description=desc)

    session.add(al)
    session.delete(cfg)
    session.commit()
    return True

def get_audit_for_config(session: Session, config_id: int) -> List[models.AuditLog]:
    stmt = (
        select(models.AuditLog)
        .where(models.AuditLog.config_id == config_id)
        .order_by(models.AuditLog.timestamp.desc())
    )
    return session.exec(stmt).all()
