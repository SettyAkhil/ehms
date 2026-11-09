# Keppler OCR API (FastAPI) and its Celery worker (same image). Optional
# profile "ocr". CPU-only torch is installed first: the default CUDA build
# adds ~7 GB for no benefit on a CPU host.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HOME=/opt/ehms/models

RUN apt-get update \
 && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 libgomp1 curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/ehms/ocr-backend

RUN pip install --index-url https://download.pytorch.org/whl/cpu torch torchvision
COPY ocr-backend/requirements.txt ./requirements.txt
RUN pip install -r requirements.txt

COPY ocr-backend/ ./

RUN useradd --system --uid 10004 --home-dir /opt/ehms ehms \
 && mkdir -p /opt/ehms/ocr-backend/uploads /opt/ehms/models \
 && chown -R ehms:ehms /opt/ehms/ocr-backend/uploads /opt/ehms/models

USER ehms
EXPOSE 7620

CMD ["sh", "-c", "alembic upgrade head && exec uvicorn api.main:app --host 0.0.0.0 --port 7620 --proxy-headers --forwarded-allow-ips \"${FORWARDED_ALLOW_IPS:-127.0.0.1}\""]
