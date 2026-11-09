# HR & Workforce API (FastAPI) and its Celery worker/beat (same image).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/ehms/hr-api

COPY backend/hr-api/requirements.txt ./requirements.txt
RUN pip install -r requirements.txt

COPY backend/hr-api/ ./

RUN useradd --system --uid 10003 --home-dir /opt/ehms/hr-api ehms \
 && mkdir -p /data/hr-documents \
 && chown -R ehms:ehms /data/hr-documents

USER ehms
EXPOSE 8020

# Migrations (as hr_owner) + hr_app login, then the API.
CMD ["sh", "-c", "python -m app.bootstrap && exec uvicorn app.main:app --host 0.0.0.0 --port 8020 --proxy-headers --forwarded-allow-ips \"${FORWARDED_ALLOW_IPS:-127.0.0.1}\""]
