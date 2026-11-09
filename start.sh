#!/usr/bin/env bash
# ============================================================
# HospAI Enterprise HMS - Automated Unix/macOS/WSL Launcher
# ============================================================
set -e

echo "============================================================"
echo "       HospAI Enterprise Hospital Management System         "
echo "============================================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed. Please install Node.js v18+."
    exit 1
fi
echo "[OK] Node.js detected: $(node -v)"

# Install dependencies if missing
if [ ! -d "frontend/node_modules" ]; then
    echo "[INFO] Installing frontend dependencies..."
    npm --prefix frontend install
else
    echo "[OK] Frontend dependencies verified."
fi

PORT=8443
echo ""
echo "[STARTING] Launching HospAI Enterprise HMS on http://localhost:$PORT"
echo "[CREDENTIALS] System Administrator: admin / password123"
echo ""

npm --prefix frontend run dev -- --host 0.0.0.0 --port $PORT
