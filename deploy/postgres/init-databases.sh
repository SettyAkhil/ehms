#!/bin/sh
# Runs once, on an empty Postgres data volume (docker-entrypoint-initdb.d).
# One login role per database; each role owns only its own database.
set -eu

: "${HMS_DB_PASSWORD:?HMS_DB_PASSWORD is required}"
: "${HRMS_DB_PASSWORD:?HRMS_DB_PASSWORD is required}"
: "${HR_OWNER_DB_PASSWORD:?HR_OWNER_DB_PASSWORD is required}"
: "${OCR_DB_PASSWORD:?OCR_DB_PASSWORD is required}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v hms_pw="$HMS_DB_PASSWORD" \
  -v hrms_pw="$HRMS_DB_PASSWORD" \
  -v hr_owner_pw="$HR_OWNER_DB_PASSWORD" \
  -v ocr_pw="$OCR_DB_PASSWORD" <<'EOSQL'
-- Main hospital database (Flask backend)
CREATE ROLE hms LOGIN PASSWORD :'hms_pw';
CREATE DATABASE hospai OWNER hms;

-- Legacy Node HRMS (frontend/server)
CREATE ROLE hrms_legacy LOGIN PASSWORD :'hrms_pw';
CREATE DATABASE hospai_enterprise OWNER hrms_legacy;

-- HR & Workforce (hr-api). hr_owner runs migrations and creates the
-- restricted runtime role hr_app (row-level security binds hr_app).
CREATE ROLE hr_owner LOGIN CREATEROLE PASSWORD :'hr_owner_pw';
CREATE DATABASE hospai_hr OWNER hr_owner;

-- Keppler OCR (ocr profile)
CREATE ROLE ocr LOGIN PASSWORD :'ocr_pw';
CREATE DATABASE keppler OWNER ocr;

-- Roles can't connect to databases they don't own. (hospai_hr keeps the
-- default CONNECT so the runtime role hr_app, created later by the hr-api
-- migration, can log in; RLS and table grants restrict what it sees.)
REVOKE ALL ON DATABASE hospai, hospai_enterprise, keppler FROM PUBLIC;
EOSQL

echo "EHMS databases created: hospai, hospai_enterprise, hospai_hr, keppler"
