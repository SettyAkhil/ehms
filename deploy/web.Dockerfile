# Public web entry point: builds the hospital app and the Keppler OCR UI, then
# serves both with nginx and reverse-proxies every API path to its service.

FROM node:22-alpine AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine AS ocr-frontend
WORKDIR /build/ocr-frontend
COPY ocr-frontend/package.json ocr-frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY ocr-frontend/ ./
RUN npx vite build

FROM nginx:1.27-alpine
# The official image renders /etc/nginx/templates/*.template with envsubst at start.
RUN rm -f /etc/nginx/conf.d/default.conf
COPY deploy/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=frontend /build/frontend/dist /usr/share/nginx/html
COPY --from=ocr-frontend /build/ocr-frontend/dist /usr/share/nginx/keppler-ocr
# Only substitute our own variables; nginx's $uri etc. stay untouched.
ENV NGINX_ENVSUBST_FILTER="^(VLLM_UPSTREAM|CLIENT_MAX_BODY_SIZE)$" \
    VLLM_UPSTREAM="" \
    CLIENT_MAX_BODY_SIZE="200m"
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null 2>&1 || exit 1
