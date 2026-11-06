"""HospAI HR service (FastAPI). Mounted behind the nginx gateway at
/api/v1/hr, /api/v1/attendance, ... ; OpenAPI at /api/v1/hr-docs."""

import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.routing import APIRoute
from sqlalchemy import text

from app import errors
from app.db import engine
from app.routers import attendance, dashboard, employees, engagement, facility, organization, payroll, strategy, talent, workforce
from app.services.common import correlation_id

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

app = FastAPI(
    title="HospAI HR & Workforce API",
    version="1.0.0",
    docs_url="/api/v1/hr-docs",
    openapi_url="/api/v1/hr-openapi.json",
    redoc_url=None,
)
errors.install(app)


@app.middleware("http")
async def context(request: Request, call_next):
    cid = request.headers.get("X-Correlation-ID") or uuid.uuid4().hex
    token = correlation_id.set(cid[:64])
    try:
        response = await call_next(request)
    finally:
        correlation_id.reset(token)
    response.headers["X-Correlation-ID"] = cid[:64]
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
    response.headers.setdefault("Cache-Control", "no-store")
    return response


# Every router carries its full prefix, so they are mounted without one. The list
# is kept because FastAPI (0.130+) no longer flattens included routers into
# app.routes; api_routes() is the stable way to enumerate the route table.
ROUTERS = (
    organization.router, employees.router, attendance.router, dashboard.router,
    workforce.approvals, workforce.work, workforce.att, workforce.lv,
    payroll.router,
    talent.rec, talent.onb, talent.docs, talent.trn, talent.perf, talent.comp, talent.grv,
    engagement.me, engagement.ann, engagement.rep, engagement.ops, engagement.cc,
    facility.fac, facility.mine, strategy.hr, strategy.tm, strategy.mine,
)
for r in ROUTERS:
    app.include_router(r)


def api_routes():
    """Every APIRoute the app serves: the ones declared on the app itself plus
    each mounted router's (whose paths already include the router prefix)."""
    yield from (r for r in app.routes if isinstance(r, APIRoute))
    for router in ROUTERS:
        yield from (r for r in router.routes if isinstance(r, APIRoute))

@app.get("/api/v1/hr/health", tags=["health"])
def health():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ok", "service": "hr-api"}
