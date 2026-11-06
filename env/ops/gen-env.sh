#!/usr/bin/env bash
# Creates the env files from the *.example files, fills <generated> with random
# secrets and <auto-port> with a free port. Re-runs never change existing values.
# Exits 1 while any <placeholder> is left to fill in by hand.
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
command -v openssl >/dev/null || { echo "openssl is required"; exit 1; }

rnd() { openssl rand -base64 "$1" | tr '+/' '-_' | tr -d '\n'; }
pick_port() {
  local p i
  for i in $(seq 1 200); do
    p=$(( (RANDOM % 20000) + 20000 ))
    ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${p}$" || { echo "$p"; return; }
  done
  echo "no free port found" >&2; exit 1
}

todo=0
for ex in .env.example backend.env.example hr.env.example ocr.env.example hrms.env.example web.env.example; do
  f="${ex%.example}"
  [ -f "$ex" ] || { echo "missing $ex"; exit 1; }
  [ -f "$f" ] || { cp "$ex" "$f"; echo "created $f"; }
  chmod 600 "$f"
  tmp="$(mktemp)"
  while IFS= read -r line || [ -n "$line" ]; do
    if [[ "$line" =~ ^([A-Z0-9_]+)=\<generated\>$ ]]; then
      key="${BASH_REMATCH[1]}"
      case "$key" in SESSION_PEPPER|JWT_SECRET_KEY) n=48 ;; *) n=32 ;; esac
      echo "$key=$(rnd $n)" >> "$tmp"; echo "  generated $key ($f)"
    elif [[ "$line" =~ ^WEB_PORT=\<auto-port\>$ ]]; then
      port="$(pick_port)"; echo "WEB_PORT=$port" >> "$tmp"
      echo "  chosen WEB_PORT=$port (point the edge proxy at the host LAN IP:$port)"
    else
      printf '%s\n' "$line" >> "$tmp"
    fi
  done < "$f"
  cat "$tmp" > "$f"; rm -f "$tmp"
  left="$(grep -nE '^[A-Z0-9_]+=<[^>]*>' "$f" || true)"
  if [ -n "$left" ]; then echo; echo "Fill in $f:"; echo "$left"; todo=1; fi
done
[ "$todo" = 0 ] && echo "all env files complete" || exit 1
