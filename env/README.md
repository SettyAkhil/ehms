# Environment

No real secrets are included. `*.env.example` are the settings every component reads; `<...>` marks a value you must set. The code has no defaults for these, so a missing value fails at startup.

| File | Used by |
|---|---|
| `.env.example` | shared settings: public URL, session cookie, AI servers |
| `backend.env.example` | hospital Flask services + celery |
| `hr.env.example` | hr-api / hr-worker |
| `ocr.env.example` | ocr-backend (API + celery) |
| `hrms.env.example` | legacy Node HR (`frontend/server`) |
| `web.env.example` | reverse proxy settings |

Databases (4 PostgreSQL databases, one login each): main (`DATABASE_URL`), HR (`HR_DATABASE_URL` runtime login + `HR_DATABASE_OWNER_URL` for migrations), OCR (`DATABASE_URL` in `ocr.env`), legacy HR (`HRMS_DATABASE_URL`). Redis (main, db 0 and 2), a separate Redis for OCR, and Qdrant (`QDRANT_URL`).

AI servers: an OpenAI-compatible chat/vision server (`VLLM_BASE_URL`, model `qwen3-vl-8b`) and an embedding server (`VLLM_EMBEDDING_URL`, model `qwen3-embedding-0.6b`, 1024 dims, `RAG_EMBEDDING_DIM=1024`). Put your own addresses there.

Secrets to generate once and keep (losing them makes stored data unreadable): `SESSION_PEPPER`, `SETTINGS_ENCRYPTION_KEY`, `HR_SECRETS_KEY`, `JWT_SECRET_KEY`, `UPLOAD_ENCRYPTION_KEY`. `ops/gen-env.sh` generates them and creates the env files from the examples (run it from this folder: `./ops/gen-env.sh`; it exits 1 until all `<...>` values are filled). Or generate by hand: `openssl rand -hex 32` for peppers/JWT, a Fernet key (`python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`) for the encryption keys, after checking what each one expects in the code.

Local run: `SESSION_COOKIE_SECURE=false` over plain http; `CORS_ALLOWED_ORIGINS` = the URL you browse from; `SEED_DEMO_USERS=true` only for testing (demo passwords are repo-known; removing them is task B3).
