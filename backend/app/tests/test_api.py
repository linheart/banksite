from typing import Any

import pytest
from fastapi.testclient import TestClient

PASSWORD = "password123"

ROLE_USERS = {
    "admin": {"username": "admin_user", "email": "admin_user@example.com"},
    "operator": {"username": "operator_user", "email": "operator_user@example.com"},
    "viewer": {"username": "viewer_user", "email": "viewer_user@example.com"},
    "auditor": {"username": "auditor_user", "email": "auditor_user@example.com"},
}


def register_user(client: TestClient, username: str, email: str, password: str = PASSWORD):
    return client.post(
        "/api/register",
        json={
            "username": username,
            "email": email,
            "password": password,
        },
    )


def login_user(client: TestClient, username: str, password: str = PASSWORD):
    return client.post(
        "/api/login",
        json={
            "username": username,
            "password": password,
        },
    )


def request_as(client: TestClient, method: str, path: str, payload: dict[str, Any] | None = None):
    caller = getattr(client, method.lower())
    if payload is None:
        return caller(path)
    return caller(path, json=payload)


@pytest.fixture
def seeded_context(client: TestClient):
    for role in ("admin", "operator", "viewer", "auditor"):
        user = ROLE_USERS[role]
        response = register_user(client, user["username"], user["email"])
        assert response.status_code == 200

    admin_login = login_user(client, ROLE_USERS["admin"]["username"])
    assert admin_login.status_code == 200

    primary_branch_response = client.post("/api/branches", json={"name": "Primary-Branch"})
    assert primary_branch_response.status_code == 201
    primary_branch_id = primary_branch_response.json()["id"]

    deletable_branch_response = client.post("/api/branches", json={"name": "Deletable-Branch"})
    assert deletable_branch_response.status_code == 201
    deletable_branch_id = deletable_branch_response.json()["id"]

    create_config_response = client.post(
        "/api/configs",
        json={
            "branch_id": primary_branch_id,
            "name": "base-config",
            "device_type": "router",
            "config_text": "set interfaces ge-0/0/0 description uplink",
        },
    )
    assert create_config_response.status_code == 200
    config_id = create_config_response.json()["id"]

    users_response = client.get("/api/users")
    assert users_response.status_code == 200
    users_payload = users_response.json()
    user_id_by_name = {item["username"]: item["user_id"] for item in users_payload}

    operator_update = client.put(
        f"/api/users/{user_id_by_name[ROLE_USERS['operator']['username']]}",
        json={"role": "operator", "branch_ids": [primary_branch_id]},
    )
    assert operator_update.status_code == 200

    viewer_update = client.put(
        f"/api/users/{user_id_by_name[ROLE_USERS['viewer']['username']]}",
        json={"role": "viewer", "branch_ids": [primary_branch_id]},
    )
    assert viewer_update.status_code == 200

    auditor_update = client.put(
        f"/api/users/{user_id_by_name[ROLE_USERS['auditor']['username']]}",
        json={"role": "auditor", "branch_ids": []},
    )
    assert auditor_update.status_code == 200

    return {
        "ids": {
            "primary_branch_id": primary_branch_id,
            "deletable_branch_id": deletable_branch_id,
            "config_id": config_id,
            "admin_user_id": user_id_by_name[ROLE_USERS["admin"]["username"]],
            "viewer_user_id": user_id_by_name[ROLE_USERS["viewer"]["username"]],
        }
    }


SCENARIOS = [
    {
        "name": "get me",
        "method": "get",
        "path": "/api/me",
        "expected": {"admin": 200, "operator": 200, "viewer": 200, "auditor": 200},
    },
    {
        "name": "refresh token",
        "method": "post",
        "path": "/api/token/refresh",
        "json": {},
        "expected": {"admin": 200, "operator": 200, "viewer": 200, "auditor": 200},
    },
    {
        "name": "list branches",
        "method": "get",
        "path": "/api/branches",
        "expected": {"admin": 200, "operator": 200, "viewer": 200, "auditor": 200},
    },
    {
        "name": "create branch",
        "method": "post",
        "path": "/api/branches",
        "json": {"name": "RoleMatrix-New-Branch"},
        "expected": {"admin": 201, "operator": 403, "viewer": 403, "auditor": 403},
    },
    {
        "name": "get branch by id",
        "method": "get",
        "path": "/api/branches/{primary_branch_id}",
        "expected": {"admin": 200, "operator": 200, "viewer": 200, "auditor": 200},
    },
    {
        "name": "update branch",
        "method": "put",
        "path": "/api/branches/{primary_branch_id}",
        "json": {"name": "RoleMatrix-Renamed-Primary"},
        "expected": {"admin": 200, "operator": 403, "viewer": 403, "auditor": 403},
    },
    {
        "name": "list configs",
        "method": "get",
        "path": "/api/configs",
        "expected": {"admin": 200, "operator": 200, "viewer": 200, "auditor": 200},
    },
    {
        "name": "get config by id",
        "method": "get",
        "path": "/api/configs/{config_id}",
        "expected": {"admin": 200, "operator": 200, "viewer": 200, "auditor": 200},
    },
    {
        "name": "create config",
        "method": "post",
        "path": "/api/configs",
        "json": lambda context: {
            "branch_id": context["ids"]["primary_branch_id"],
            "name": "role-matrix-config",
            "device_type": "router",
            "config_text": "set protocols ospf area 0 interface ge-0/0/1",
        },
        "expected": {"admin": 200, "operator": 200, "viewer": 403, "auditor": 403},
    },
    {
        "name": "update config",
        "method": "put",
        "path": "/api/configs/{config_id}",
        "json": {"device_type": "firewall"},
        "expected": {"admin": 200, "operator": 200, "viewer": 403, "auditor": 403},
    },
    {
        "name": "list audit",
        "method": "get",
        "path": "/api/audit",
        "expected": {"admin": 200, "operator": 200, "viewer": 200, "auditor": 200},
    },
    {
        "name": "get config audit",
        "method": "get",
        "path": "/api/configs/{config_id}/audit",
        "expected": {"admin": 200, "operator": 200, "viewer": 200, "auditor": 200},
    },
    {
        "name": "list users",
        "method": "get",
        "path": "/api/users",
        "expected": {"admin": 200, "operator": 403, "viewer": 403, "auditor": 403},
    },
    {
        "name": "update viewer",
        "method": "put",
        "path": "/api/users/{viewer_user_id}",
        "json": lambda context: {
            "role": "viewer",
            "branch_ids": [context["ids"]["primary_branch_id"]],
        },
        "expected": {"admin": 200, "operator": 403, "viewer": 403, "auditor": 403},
    },
    {
        "name": "update own admin role",
        "method": "put",
        "path": "/api/users/{admin_user_id}",
        "json": {"role": "viewer", "branch_ids": []},
        "expected": {"admin": 400, "operator": 403, "viewer": 403, "auditor": 403},
    },
    {
        "name": "delete branch",
        "method": "delete",
        "path": "/api/branches/{deletable_branch_id}",
        "expected": {"admin": 204, "operator": 403, "viewer": 403, "auditor": 403},
    },
    {
        "name": "delete config",
        "method": "delete",
        "path": "/api/configs/{config_id}",
        "expected": {"admin": 200, "operator": 403, "viewer": 403, "auditor": 403},
    },
    {
        "name": "logout",
        "method": "post",
        "path": "/api/logout",
        "json": {},
        "expected": {"admin": 200, "operator": 200, "viewer": 200, "auditor": 200},
    },
]


@pytest.mark.parametrize("role", ["admin", "operator", "viewer", "auditor"])
def test_role_permissions_matrix(client: TestClient, seeded_context, role: str):
    role_username = ROLE_USERS[role]["username"]

    for scenario in SCENARIOS:
        login_response = login_user(client, role_username)
        assert login_response.status_code == 200

        path = scenario["path"].format(**seeded_context["ids"])
        payload = scenario.get("json")
        if callable(payload):
            payload = payload(seeded_context)
        response = request_as(client, scenario["method"], path, payload)
        expected_status = scenario["expected"][role]

        assert response.status_code == expected_status, (
            f"role={role}, scenario={scenario['name']}, expected={expected_status}, "
            f"got={response.status_code}, body={response.text}"
        )


def test_auth_flow_register_login_me_refresh_logout(client: TestClient):
    register_response = register_user(client, "admin_one", "admin_one@example.com")
    assert register_response.status_code == 200
    assert register_response.json()["role"] == "admin"

    login_response = login_user(client, "admin_one")
    assert login_response.status_code == 200

    me_response = client.get("/api/me")
    assert me_response.status_code == 200

    refresh_response = client.post("/api/token/refresh", json={})
    assert refresh_response.status_code == 200

    logout_response = client.post("/api/logout", json={})
    assert logout_response.status_code == 200

    me_after_logout = client.get("/api/me")
    assert me_after_logout.status_code == 401


def test_refresh_requires_cookie(client: TestClient):
    response = client.post("/api/token/refresh", json={})
    assert response.status_code == 401
