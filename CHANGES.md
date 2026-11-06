# What was changed and fixed in the code

Principle: nothing hardcoded. Every host, port, model name, key and URL comes from env; required values missing = startup failure. No `host.docker.internal`, no localhost fallbacks, no public dev keys.

## Files patched
| File | Change |
|---|---|
| `backend/backend/utils/embeddings.py` | Embeddings have their own env (`VLLM_EMBEDDING_URL`, `VLLM_EMBEDDING_MODEL`, `VLLM_API_KEY`). Before, they were posted to the chat server (no embedding model there) and failures were swallowed, storing zero vectors. Logs an error when unset. |
| `backend/backend/ai/vllm_provider.py` | Default URLs/models removed. |
| `backend/backend/core/celery_app.py` | localhost broker fallback removed. |
| `backend/backend/shared/app_factory.py`, `backend/backend/app.py` | CORS only from `CORS_ALLOWED_ORIGINS`; wildcard entries such as `https://*.example.com` supported. |
| `backend/backend/services/auth/app.py`, `backend/backend/app.py` | Demo users seeded only when `SEED_DEMO_USERS` is true/1/yes (was on by default). |
| `backend/hr-api/app/config.py` | URL defaults removed. |
| `backend/gateway/nginx.conf` | Dead `/api/v1/` rule that pointed at an unrelated host replaced by `return 404`. |
| `ocr-backend/core/config.py` | Env only. Refuses to start without `JWT_SECRET_KEY` and `UPLOAD_ENCRYPTION_KEY` (public dev keys removed). |
| `ocr-backend/api/main.py` | CORS from env. |
| `frontend/server/db/index.mjs`, `frontend/server/app.mjs` | Single `HRMS_DATABASE_URL` (was five `PG*` vars with `postgres/postgres` defaults); CORS from env. |

## Other changes made to make it deployable
- Removed the `backend/dpi-ocr` symlink and the dev deploy scripts; the four code folders are plain directories.
- Database role fix: hr-api needs its owner login to have `CREATEROLE` and `ADMIN OPTION` on the runtime login on PostgreSQL 16 (otherwise `permission denied to alter role` at startup).
- Real client IP: behind a reverse proxy, only the proxy's address is trusted for `X-Forwarded-For`.
- OCR runs with CPU-only torch (the CUDA build is 11.9 GB of the image for no benefit on a CPU host).

## Needs (see OPTIMIZATION_REPORT.md)
Container consolidation, legacy HR retirement, seed/sample-data removal, OCR integration, restructuring and naming, pinned dependencies, tests, backups.
