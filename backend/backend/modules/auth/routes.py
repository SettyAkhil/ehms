from flask import Blueprint, g, request, jsonify
from core.auth import (
    authenticate,
    create_session,
    check_username_exists,
    signup_hospital_admin,
    SESSION_COOKIE_NAME,
    get_session_user,
    delete_session,
    ADMIN_ROUTE_AUTH_COOKIE_NAME,
    get_user_sessions,
    delete_specific_session,
    delete_other_sessions,
)
from shared.hospital import request_hospital_id
from shared.session_auth import (
    require_platform_admin,
    session_cookie_settings as _session_cookie_settings,
)
from shared.audit import log_audit_event
from core.limiter import limiter
from utils.database import list_admin_roles, list_login_users_for_role, get_login_summary, list_admin_specialties
from core.auth import ASSIGNABLE_MODULES

auth_bp = Blueprint("auth", __name__)


@auth_bp.get("/api/auth/login-summary")
@limiter.limit("60 per minute")
def login_summary():
    summary = get_login_summary(hospital_id=request_hospital_id())
    return jsonify({**summary, "available_modules": len(ASSIGNABLE_MODULES), "security": "Server-side RBAC"})


@auth_bp.get("/api/auth/login-roles")
@limiter.limit("60 per minute")
def login_roles():
    """Return role labels for the sign-in selector, never user identities.

    A role is not an authentication secret.  This lets the login screen stay
    in sync when System Administration creates a role, without exposing staff
    usernames, passwords, or module grants before sign-in.
    """
    roles = [
        role for role in list_admin_roles(hospital_id=request_hospital_id())
        if str(role.get("status") or "active").lower() == "active"
    ]
    return jsonify(
        {
            "roles": [
                {
                    "id": role.get("id"),
                    "name": role.get("name"),
                    "description": role.get("description") or "",
                    "is_system": bool(role.get("is_system")),
                }
                for role in roles
            ]
        }
    )


@auth_bp.get("/api/auth/login-roles/<role_id>/users")
@limiter.limit("30 per minute")
def login_role_users(role_id):
    """Role-scoped active staff directory used by the second login step."""
    users = list_login_users_for_role(role_id, hospital_id=request_hospital_id())
    return jsonify({"users": users})


@auth_bp.get("/api/auth/login-specialties")
@limiter.limit("60 per minute")
def login_specialties():
    """Safe active specialty catalogue for doctor onboarding and sign-in UI."""
    specialties = [
        specialty for specialty in list_admin_specialties(hospital_id=request_hospital_id())
        if str(specialty.get("status") or "active").lower() == "active"
    ]
    return jsonify({
        "specialties": [
            {
                "id": specialty.get("id"),
                "specialty_name": specialty.get("specialty_name"),
                "department_name": specialty.get("department_name"),
                "status": specialty.get("status"),
            }
            for specialty in specialties
        ]
    })


@auth_bp.route("/api/auth/login", methods=["POST", "OPTIONS"])
@limiter.limit("20 per minute")
def login():
    if request.method == "OPTIONS":
        return ("", 204)
    payload = request.get_json(force=True)
    hospital_id = request_hospital_id()
    user = authenticate(
        payload.get("username", ""),
        payload.get("password", ""),
        hospital_id=hospital_id,
        expected_role_id=payload.get("selected_role_id"),
    )
    if not user:
        # Do not include the supplied password or other secrets in audit data.
        g.current_user = {
            "username": (payload.get("username") or "").strip() or "unknown",
            "hospital_id": hospital_id,
        }
        log_audit_event("login_failed", "auth", payload.get("username"), {"reason": "invalid_credentials"})
        return jsonify({"error": "Invalid credentials"}), 401
    if "error" in user:
        g.current_user = {
            "username": (payload.get("username") or "").strip() or "unknown",
            "hospital_id": hospital_id,
        }
        log_audit_event("login_failed", "auth", payload.get("username"), {"reason": "account_rejected"})
        return jsonify(user), 403
    g.current_user = user
    log_audit_event("login", "auth", str(user["id"]), {"result": "success"})
    session_token, _expires_at = create_session(
        user_id=user["id"],
        hospital_id=user["hospital_id"],
        ip_address=request.headers.get("X-Forwarded-For", request.remote_addr),
        user_agent=request.headers.get("User-Agent"),
    )
    response = jsonify({"user": {k: v for k, v in user.items() if k != "id"}})
    response.headers["Cache-Control"] = "no-store"
    response.set_cookie(
        SESSION_COOKIE_NAME, session_token, **_session_cookie_settings()
    )
    return response


@auth_bp.get("/api/auth/check-username")
def check_username():
    username = request.args.get("username")
    if not username:
        return jsonify({"available": False, "error": "username required"}), 400
    available = not check_username_exists(username, hospital_id=request_hospital_id())
    return jsonify({"available": available})


@auth_bp.route("/api/auth/setup-admin", methods=["POST", "OPTIONS"])
@limiter.limit("3 per minute")
def setup_hospital_admin():
    if request.method == "OPTIONS":
        return ("", 204)
    admin_gate = require_platform_admin()
    if admin_gate:
        return admin_gate
    hospital_id = request_hospital_id()
    payload = request.get_json(force=True)
    result = signup_hospital_admin(payload, hospital_id=hospital_id)
    if not result.get("success"):
        message = (result.get("message") or "").lower()
        status = 409 if "already configured" in message else 400
        return jsonify(result), status

    user = authenticate(
        payload.get("username", ""),
        payload.get("password", ""),
        hospital_id=hospital_id,
    )
    if not user:
        return (
            jsonify(
                {
                    "success": False,
                    "message": "Admin created but automatic login failed.",
                }
            ),
            500,
        )

    session_token, _expires_at = create_session(
        user_id=user["id"],
        hospital_id=user["hospital_id"],
        ip_address=request.headers.get("X-Forwarded-For", request.remote_addr),
        user_agent=request.headers.get("User-Agent"),
    )
    response = jsonify(
        {
            "success": True,
            "message": result["message"],
            "user": {k: v for k, v in user.items() if k != "id"},
        }
    )
    response.headers["Cache-Control"] = "no-store"
    response.set_cookie(
        SESSION_COOKIE_NAME, session_token, **_session_cookie_settings()
    )
    return response, 201


@auth_bp.get("/api/auth/session")
def auth_session():
    token = request.cookies.get(SESSION_COOKIE_NAME)
    user = get_session_user(token)
    if not user:
        response = jsonify({"user": None, "error": "Authentication required"})
        response.headers["Cache-Control"] = "no-store"
        return response, 200
    response = jsonify({"user": {k: v for k, v in user.items() if k != "id"}})
    response.headers["Cache-Control"] = "no-store"
    return response


@auth_bp.post("/api/auth/logout")
def logout():
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if session_token:
        delete_session(session_token)
    response = jsonify({"message": "Logged out successfully"})
    response.set_cookie(SESSION_COOKIE_NAME, "", expires=0)
    return response


@auth_bp.get("/api/auth/sessions")
def list_sessions():
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    user = get_session_user(session_token)
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    sessions = get_user_sessions(user["id"])
    return jsonify(sessions)


@auth_bp.delete("/api/auth/sessions/<int:session_id>")
def revoke_session(session_id):
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    user = get_session_user(session_token)
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    delete_specific_session(session_id, user["id"])
    return jsonify({"message": "Session revoked"})


@auth_bp.delete("/api/auth/sessions")
def revoke_other_sessions():
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    user = get_session_user(session_token)
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    delete_other_sessions(user["id"], session_token)
    response = jsonify({"message": "All other sessions revoked"})
    response.delete_cookie(ADMIN_ROUTE_AUTH_COOKIE_NAME, path="/")
    return response
