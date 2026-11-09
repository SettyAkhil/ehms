# ============================================================
# HospAI Enterprise HMS - Automated Windows Launcher
# ============================================================
$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "       HospAI Enterprise Hospital Management System         " -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verify Node.js and npm
try {
    $nodeVersion = node -v
    Write-Host "[OK] Node.js detected: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install Node.js (v18+) from https://nodejs.org" -ForegroundColor Yellow
    Exit 1
}

# 2. Check and Install Dependencies if needed
if (-not (Test-Path "frontend/node_modules")) {
    Write-Host "[INFO] Installing frontend dependencies..." -ForegroundColor Yellow
    npm --prefix frontend install
} else {
    Write-Host "[OK] Frontend dependencies verified." -ForegroundColor Green
}

# 3. Launch Development Server
$port = 8443
Write-Host ""
Write-Host "[STARTING] Launching HospAI Enterprise HMS on http://localhost:$port" -ForegroundColor Cyan
Write-Host "[CREDENTIALS] System Administrator: admin / password123" -ForegroundColor Yellow
Write-Host ""

Start-Process "http://localhost:$port" -ErrorAction SilentlyContinue

npm --prefix frontend run dev -- --host 0.0.0.0 --port $port
