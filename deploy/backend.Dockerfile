# Hospital core backend (Flask, all modules in one app: backend/backend/app.py)
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# libglib2.0-0 / libgomp1: runtime libs for opencv-headless and faster-whisper
RUN apt-get update \
 && apt-get install -y --no-install-recommends libglib2.0-0 libgomp1 curl \
 && rm -rf /var/lib/apt/lists/*

# Code lives at /opt/ehms/backend/backend so the app's own relative paths
# resolve to /opt/ehms/backend/uploads and .../backend/rag_workspaces (volumes).
WORKDIR /opt/ehms/backend/backend

COPY backend/backend/requirements.txt ./requirements.txt
RUN pip install -r requirements.txt

COPY backend/backend/ ./

RUN useradd --system --uid 10001 --home-dir /opt/ehms ehms \
 && mkdir -p /opt/ehms/backend/uploads /opt/ehms/backend/backend/rag_workspaces \
 && chown -R ehms:ehms /opt/ehms/backend/uploads /opt/ehms/backend/backend/rag_workspaces

USER ehms
# gunicorn writes its control socket under $HOME; keep it in a writable place.
ENV HOME=/tmp
EXPOSE 8010

# One process, many threads: schema bootstrap runs once at import, and the
# Postgres pool is thread-safe. Tune with GUNICORN_CMD_ARGS.
ENV GUNICORN_CMD_ARGS="--workers 1 --threads 16 --timeout 300 --graceful-timeout 30 --access-logfile -"
CMD ["gunicorn", "--bind", "0.0.0.0:8010", "app:app"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD curl -fsS http://127.0.0.1:8010/api/auth/login-summary >/dev/null || exit 1
