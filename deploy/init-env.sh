#!/bin/sh
# Fill every empty secret in .env (created from .env.example if missing).
# Re-runnable: values that are already set are never changed.
set -eu

cd "$(dirname "$0")/.."
[ -f .env ] || cp .env.example .env

command -v openssl >/dev/null 2>&1 || { echo "openssl is required" >&2; exit 1; }

hex()    { openssl rand -hex "$1"; }
fernet() { openssl rand -base64 32 | tr '+/' '-_' | tr -d '\n'; }
readable_password() { openssl rand -base64 18 | tr -d '/+=\n' | cut -c1-16; }

fill() {
  key="$1"; value="$2"
  if grep -qE "^${key}=$" .env; then
    # value contains only [A-Za-z0-9_=-], safe for sed with | delimiter
    sed -i.bak "s|^${key}=$|${key}=${value}|" .env && rm -f .env.bak
    echo "  generated ${key}"
  fi
}

echo "Filling empty secrets in .env"
for k in POSTGRES_SUPERUSER_PASSWORD HMS_DB_PASSWORD HRMS_DB_PASSWORD \
         HR_OWNER_DB_PASSWORD HR_APP_DB_PASSWORD OCR_DB_PASSWORD REDIS_PASSWORD; do
  fill "$k" "$(hex 24)"
done
fill SESSION_PEPPER "$(hex 32)"
fill OCR_JWT_SECRET_KEY "$(hex 32)"
fill SETTINGS_ENCRYPTION_KEY "$(fernet)"
fill HR_SECRETS_KEY "$(fernet)"
fill OCR_UPLOAD_ENCRYPTION_KEY "$(fernet)"

if grep -qE "^INITIAL_ADMIN_PASSWORD=$" .env; then
  pw="Ehms-$(readable_password)"
  fill INITIAL_ADMIN_PASSWORD "$pw"
  echo ""
  echo "  First sign-in:  admin / $pw"
  echo "  (change it in Administration right after the first login)"
fi

chmod 600 .env 2>/dev/null || true

if grep -qE "^PUBLIC_URL=https://hms.example-hospital.in$" .env; then
  echo ""
  echo "  Now set PUBLIC_URL in .env to the address users will open."
fi
echo "Done. Back up .env somewhere safe."
