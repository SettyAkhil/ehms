# Legacy Node HRMS (frontend/server): /api/hr/* and the eSSL /iclock push.
FROM node:22-alpine

WORKDIR /opt/ehms/hrms

# The server only needs express, cors and pg -- not the whole frontend
# dependency tree. Versions match frontend/package.json.
RUN npm init -y >/dev/null \
 && npm install --omit=dev --no-audit --no-fund express@5.2.1 cors@2.8.6 pg@8.23.1 \
 && npm cache clean --force \
 && node -e "const p=require('./package.json');p.type='module';require('fs').writeFileSync('package.json',JSON.stringify(p,null,2))"

COPY frontend/server/ ./server/

USER node
ENV NODE_ENV=production HRMS_PORT=8011
EXPOSE 8011
CMD ["node", "server/app.mjs"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8011/health >/dev/null 2>&1 || exit 1
