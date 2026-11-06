# EHMS - Optimization and Remediation Report (for the dev team)

Date: 2026-11-04. Scope: staging deployment of the Enterprise Hospital Management System.
Basis: what was observed while containerizing and running the app. Items marked VERIFY are inferences from logs/config that the dev should confirm in code.

---

## A. Already solved during this deployment

| # | Problem | Resolution |
|---|---|---|
| 1 | Symlink `backend/dpi-ocr -> ../ocr-backend` and `deploy.sh` re-creating it; broke on zip/prod | Removed; build contexts point at the real folder |
| 2 | 9 near-identical service Dockerfiles; 25 containers; 4 Postgres containers | One backend image (SERVICE/PORT env), one Postgres server with 4 databases and one login each |
| 3 | Containers ran as root (gateway, web, hrms) | Non-root uids (101, 10001, 10002, 10003, node), `cap_drop: ALL`, `no-new-privileges`, multi-stage builds, memory limits, log rotation |
| 4 | OCR image 11.9 GB (full CUDA torch, nvidia libs, triton) | CPU torch installed first: 4.4 GB |
| 5 | Hardcoded hosts, ports, model names, DB URLs, localhost fallbacks in code (`host.docker.internal`, `localhost:6379`, `keppler:keppler@...`, `qwen2.5-vl-7b`) | Defaults removed; all from env; compose fails if missing |
| 6 | Public dev encryption key and JWT secret in OCR code (`DEV_UPLOAD_ENCRYPTION_KEY`, `dev-only-insecure-secret`) | OCR refuses to start without its own keys |
| 7 | Hardcoded CORS origins (`*.hospai.ai`, localhost:5173) | `CORS_ALLOWED_ORIGINS` env only, wildcard entries supported |
| 8 | Backend embeddings posted to the chat vLLM (8700), which has no embedding model; failure swallowed, zero vectors stored | Separate `VLLM_EMBEDDING_URL`; logs an error when unset |
| 9 | Demo-user seeding defaulted to ON, and empty value counted as ON | Seeds only when `SEED_DEMO_USERS` is true/1/yes |
| 10 | Legacy HRMS read five PG* variables with insecure defaults (`postgres/postgres`) | Single `HRMS_DATABASE_URL`, fails fast |
| 11 | Dead gateway rule `/api/v1/` -> `host.docker.internal:8000` (an unrelated app, `ccus_app`) crashed nginx when host missing | Replaced by 404 |
| 12 | hr-api: `--forwarded-allow-ips='*'` | env-driven (still `*` on private network, see C) |
| 13 | HR bootstrap failure on PG16 role rules | CREATEROLE + ADMIN OPTION in DB init |
| 14 | Qdrant crash (snapshots dir), gunicorn control-socket error | Mounts / HOME=/tmp |
| 15 | Shared-server name collisions (`hospai-*` belongs to another stack) | Project/images/network renamed `ehms`; containers `hms-*` |
| 17 | Secrets scattered in committed examples/compose | Per-group env files, generated once by `gen-env.sh`, mode 600 |

## B. Requested restructuring (decisions for the dev, with recommendations)

### B1. Reduce the container list to 1 or 2 application containers  (effort: L)
Today: 18 app containers + 4 data containers. Why it is 18: nine Flask "services" that share ONE codebase, ONE database and ONE Redis (so they give no data isolation), plus a gateway whose only job is routing them.

Recommendation, in order of payoff:
1. **Collapse the 9 Flask services into one Flask app** (blueprints already exist: `backend/backend/modules/<module>/routes.py`, 26 modules; the legacy monolith `backend/backend/app.py` still exists and registers them). One gunicorn with N workers replaces 9 containers; the gateway's 36 prefix rules disappear (the web container routes `/hms-api` straight to it). Pros: 9 -> 1 container, no inter-service hops, one DB pool (9x2x5=90 connections -> 1 pool), far less RAM. Cons: lose per-service restart/limits; heavy modules (AI/Whisper) should be a separate process.
2. Target layout: **`ehms-app`** (Flask monolith + hr module + legacy-HR replacement, see B2) and **`ehms-ocr`** (OCR API), plus workers using the same images (celery commands), plus the frontend web container. That is 2 application images, about 4 containers (app, app-worker, ocr, ocr-worker) + web = 5 instead of 18.
3. Merge `hms-hr-records` (`/api/employees`, `/api/hr`, `/api/audit`) into the single app; its `/api/hr` routes are already shadowed by the legacy Node HR.
4. If a literal "1 container" is wanted: run app + worker under a process supervisor, or use Celery in-process (`CELERY_TASK_ALWAYS_EAGER`) for small installs. Not recommended for production.

### B2. Retire legacy HR (Node `hrms`) and go to 3 databases  (effort: M-L)
Facts: README says the current HR screens use hr-api; Node HRMS is "still mounted, not yet retired". It owns the `/iclock` biometric push and `/api/hr/*` (63 routes) and database HMS HR LEGACY (`hospai_enterprise`). `backend/hr-api/app/tools/migrate_legacy.py` already exists (reads `LEGACY_DATABASE_URL`).
Steps:
1. Confirm the frontend no longer calls `/hms-api/api/hr/*` except where listed below (known gaps: `outdoor-entries`, `abnormalities`, `generate-memo`, `recalculate` in `frontend/src/services/hrmsDb.ts` hit routes Node does not even have -> already 404).
2. Move the eSSL `/iclock` push endpoint (`cdata`, `getrequest`, `devicecmd`) into hr-api. hr-api already has attendance integrations/devices; verify feature parity (overtime, staff loans, roster) before cutting over.
3. Run `migrate_legacy.py` once; then drop `hospai_enterprise`, `hms_legacy`, `hrms.env`, the `hrms` Dockerfile, and the nginx `/hms-api/api/hr` + `/iclock` locations (pointing `/iclock` at hr-api).
4. Result: **3 databases** (HMS MAIN, HMS HR, HMS OCR), 1 fewer container, 1 fewer Node codebase, one fewer role.
Optional further step: HMS HR into HMS MAIN is NOT recommended (separate RLS design, separate Alembic history).

### B3. Remove seed profiles completely  (effort: S-M)
Observed: DB seeds 13 users, 8 doctors, 1 hospital, plus HR tenant. Frontend has hardcoded sample patients (Lokesh P, Appanna Chinnapati, Suresh Nair, P-100260...) compiled into the bundle in `services/db.ts`, `OPWorkflow.tsx`, `bedDb.ts`, `labOrdersDb.ts`, `surgeryDb.ts`; the Patient Search screen says "8 registered patients in database / Database Live Sync Active" while the server table has 0 rows. This misleads testers and produces 404s (`/api/icu/P-100260/...`).
Do:
1. Delete `create_default_users()` and `SEED_DEMO_USERS` (backend `app.py`, `services/auth/app.py`, `utils/database.py`); replace with a one-time bootstrap command `create-admin` (or use `POST /api/auth/setup-admin`) that takes credentials from env/prompt.
2. Delete `frontend/src/lib/demoCredentials.ts` and the role-picker's fake password gate (`password123`, `Admin@123`, `staff123`). Login must authenticate each real user.
3. Remove frontend sample data and the offline mock layer (`lib/api.ts` mock answers, `memoryStore.mjs` import in `vite.config.ts`). Add a `VITE_DEMO_DATA=false` guard if sample data is still wanted for demos.
4. Remove default doctors seeding, or make it a documented optional fixture.
5. Make the UI label honest ("local cache" vs server).
Acceptance: fresh DB has 0 users until bootstrap; no screen shows data that is not in Postgres.

### B4. Code base structure and unique names  (effort: M)
- `backend/backend/` double folder; rename to `backend/app/` (or `ehms_api/`). Update imports and the `COPY` lines.
- Flat module namespaces such as `shared`, `core`, `utils`, `ai`, `modules` are generic top-level Python package names. Put everything under one package (`ehms.*`) to avoid collisions and enable normal imports (today blueprints do `from app import (...)` and `app.py` patches `sys.modules`; see its comment at line 10).
- One naming scheme everywhere. Currently: HospAI / hospai / HMS / EHMS / Keppler / dpi-ocr / Drake. Decide product names: EHMS (system), `ehms-ocr` (Keppler), `ehms-hr`. Rename DB names (`hospai`, `hospai_hr`, `keppler`) only if migrating; at minimum rename cookie `hospai_session`, nginx comments, README, `HospAI` strings in UI.
- Remove remaining references to the old product/dev-machine names (`Enterprise-Hospital-Management-System`, `/home/<dev>/Desktop/...`, `keppler-backend`, `dpi-ocr--main`, `vllm-qwen-7b`) in docs and `.claude/settings.local.json`; `docs/ACCOUNTS_MODULE_DOCUMENTATION.md` links point at a dev laptop.
- Delete `AGENTS.md`/`CLAUDE.md` content that describes dev-machine specifics; keep a short ARCHITECTURE.md.
- `frontend/server/` (Node HRMS) lives inside the frontend package and shares `node_modules` with it: disappears with B2.
- Restore a tests folder per component, run in CI; add `Makefile` or `just` for build/run.
- Pin dependencies: all `requirements.txt` use `>=` (flask, lightrag-hku, ultralytics...). Generate lock files (`pip freeze` / pip-tools / uv) and install from them.
- Remove unused dependencies: `lightrag-hku`, `faster-whisper`, `opencv`, `boto3` in the hospital backend image (1.64 GB) if only one service uses them; split requirements per service group.
- Remove dev files shipped in the build context: `Keppler.jpeg`, `datasets/` (check runtime need), `postman/`, `load/`, `newmig.sh`.

### B5. OCR code: stale code and proper integration  (effort: L)
Current state (as observed): `ocr-backend/` and `ocr-frontend/` are a copy of a separate product ("Keppler AI Medical Document Intelligence Platform") dropped into the repo as a whole. Integration is: an iframe at `/keppler-ocr/`, a second login system (JWT in its own `users` table), a service account `hms-embed` that the iframe silently registers/logs into (first call returns 401 `/api/v1/auth/login`, then registers), its own Postgres database, its own Redis, its own Qdrant, its own React app and UI kit, and its own env (`OCR_JWT_SECRET`). Meanwhile the hospital backend already has its own OCR code (`/api/ocr`, `/api/ocr-portal`, `ai-service`, `symptom_ai_rag`, `lightrag`) that duplicates it. Two OCR pipelines, two RAG implementations, two embedding paths.
Problems found:
1. In-container ML: loads `BAAI/bge-m3` and `bge-reranker-v2-m3` (about 3.5 GB) on CPU inside both ocr-api and ocr-worker, downloaded from the internet at first request, although vLLM servers already run on this LAN (`qwen3-embedding-0.6b` on :8701). Also TrOCR handwriting model, ultralytics DocLayout-YOLO weights downloaded on demand. Needs: remote embedding/rerank endpoints or a dedicated model service, weights baked/pre-seeded, no runtime downloads (air-gapped hospital).
2. Sparse vectors (BGE-M3 lexical weights) are used for hybrid search in `rag_engine.py`; OpenAI-style `/v1/embeddings` returns dense only. Decide: keep hybrid (needs BGE-M3 sidecar) or dense-only with BM25 in Qdrant.
3. Embedding dimension coupling: Qdrant collection `keppler_documents` was built for BGE-M3 (1024); backend RAG default `RAG_EMBEDDING_DIM=768` (nomic). Make dimension a startup assertion against the collection, not a default.
4. Auth: replace the `hms-embed` auto-register hack with SSO: validate the existing `hospai_session` cookie (as hr-api already does via `HR_AUTH_SERVICE_URL`) or a signed token from hms-auth. Delete the OCR `users` registration endpoint (`POST /api/v1/auth/register` is open), `admin/*` roles and the second `JWT_SECRET_KEY`.
5. Frontend: drop the second React app and iframe; port the four screens (OCR upload, PDF summarizer, RAG assistant, vault) into `frontend/` using its design system, or at least share the header/session. Remove `base: "/keppler-ocr/"` coupling.
6. API surface: OCR is mounted at `/api/v1/...` while the hospital API is `/hms-api/api/...`; the browser route `/api/*` is globally captured by the OCR upstream. Namespace it (`/hms-api/api/ocr/...`) so there is one API prefix.
7. Data: OCR documents (uploads, results, vault) are not linked to hospital patients/UMR; integrate so results attach to `patients`/`documents` in HMS MAIN instead of an island database. Possible end state: OCR DB merged as a schema in HMS MAIN or kept separate behind one API.
8. Startup: `on_startup` runs `initialize_extended_schema()` (DDL at startup) AND Alembic runs `ocr-migrate`; pick Alembic only. `_warm_rag_models` blocks startup to load models.
9. Image: 4.4 GB (torch CPU, ultralytics, pandas, scikit-learn, PyMuPDF, xhtml2pdf, google-generativeai). Remove unused (`google-generativeai` "optional, future use"), drop `pandas` if only used in scripts, remove `fitz` deprecation (`import pymupdf`).
10. Runtime writes: `os.makedirs(settings.UPLOAD_DIR)` at import; uploads path derived from `__file__`; make configurable and mounted (done via volume) and move encryption to a storage layer.
11. Workers: Celery `--concurrency` 4 originally; each worker process may load models again (RAM x N).
12. Config class reads `.env` file in addition to env (`class Config: env_file`): remove, env only.
13. Scripts for dataset conversion/model training (`ocr-backend/scripts`) are not runtime; keep in a separate repo/tool.
14. Dead/legacy: `modules/rag_chatbot.py` removal comments, `Keppler.jpeg`, `README`, `dpi-ocr` naming in compose project names.
Target: "OCR as a module": a library/service with clean interfaces `extract(document)->structured`, `summarize`, `ask(question, scope)`, backed by the LAN vLLM servers; SSO; stored against patient records.

## C. Security items still open

| # | Item | Fix |
|---|---|---|
| 1 | Demo logins with repo-known passwords; `admin` is owner | B3 |
| 4 | Redis without password, Postgres trust only by network | set `requirepass`, `scram` only, `pg_hba` restricted to ehms-net subnet |
| 5 | `FORWARDED_ALLOW_IPS=*` on hr-api | set to the gateway container IP/CIDR |
| 6 | Two vLLM servers published on 0.0.0.0:8700/8701 with API key `local` | bind to LAN IP/firewall, real key |
| 9 | No read-only root filesystem (removed to keep it simple) | add `read_only` + tmpfs per container once stable |
| 10 | Dependency audit/ image scan never run | `pip-audit`, `npm audit`, `trivy image` in CI |
| 11 | Base images unpinned (`python:3.11-slim`, `node:22-alpine`, `postgres:16`, `redis:7`) | pin by digest |
| 12 | Platform admin (`PLATFORM_ADMIN_*`), `ADMIN_ROUTE_*` unset/undocumented | decide, document, generate |
| 13 | Secrets in `deploy/storage` neighbours: storage inside code tree | move to `/srv/ehms/storage` |
| 14 | Compose env_file exposes ALL values to each container, including unused ones | split env to least-privilege per service |

## D. Reliability and operations (not done)

1. Backups: `pg_dump -Fc` for 3 DBs (4 today), Qdrant snapshot, `deploy/storage`, env files (losing the Fernet keys = unreadable data). Test restore. Nothing exists yet.
2. Healthchecks exist for HTTP services; Celery workers/ocr-migrate have none. Add `celery inspect ping`.
3. `depends_on` does not cross stacks: app can start before DB; apps retry only if their code does (verify auth-service migration retries).
4. Resource sizing are guesses (backend 768 MB, OCR 3 GB, ai 2 GB, Postgres 2 GB, shared_buffers 512 MB). Measure with `docker stats` under load; set Postgres `max_connections` consistent with pools (9 services x 2 workers x 5).
5. Whisper `small` on CPU inside hms-ai; a Whisper vLLM server already runs on the LAN and is unused. Use the remote server (code change in `ai/whisper_provider.py`).
6. Logs: json-file 10 MB x 3 only; no centralization, no request IDs, no metrics (`/metrics`, Prometheus), no alerts.
7. DB schema management: main DB tables created by `auth-service` at startup (103 tables) with ad hoc migrations in `utils/database.py` (hand-written SQL). Move to Alembic like hr-api and OCR; make migration a separate one-shot container like `ocr-migrate`.
8. Gunicorn `sync` workers for services with long calls (AI uses gthread with 300 s timeout); consider async/uvicorn workers.
9. `/api/health` is shallow; add readiness that checks DB/Redis.
10. Frontend state: much clinical data lives only in browser localStorage (OP encounters, pharmacy queue, lab orders, insurance cases, bed board, locally created bills). It is lost on cache clear and invisible across desks. This is the biggest functional gap for real use: move each store to its API (`syncOPVisitsWithBackend` already exists for one).
11. 404s at runtime: `/api/icu/P-100260/...` (client invented IDs), `/api/hr/events` is a long-lived stream (retired with legacy HR).
12. Build time: images are rebuilt on the host with internet; consider a registry + CI and `docker compose pull`.
13. Time zone: Asia/Kolkata set for HR only; set `TZ` consistently and keep DB in UTC.

## E. Suggested order of work

1. B3 remove seed/sample data + real admin bootstrap (blocks real use).  2. Backups + secrets hygiene (C4, D1).  3. B2 retire legacy HR -> 3 DBs.  4. B1 collapse hospital services into one app.  5. B5 OCR integration (SSO, remote models, one UI).  6. B4 rename/restructure, pinned deps, tests, CI.  7. Move browser-only stores to the server (D10).
