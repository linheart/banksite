from fastapi import Cookie
from typing import Dict
import uuid

_sessions: Dict[str, int] = {}

def create_session(user_id: int) -> str:
    sid = str(uuid.uuid4())
    _sessions[sid] = user_id
    return sid

def get_current_user_id(session_id: str | None = Cookie(default=None)) -> int | None:
    if not session_id:
        return None
    return _sessions.get(session_id)
