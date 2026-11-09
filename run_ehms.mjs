import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isWin = process.platform === 'win32';

function killProcessTree(pid) {
  if (isWin) {
    try {
      spawn('taskkill', ['/pid', pid.toString(), '/T', '/F'], { stdio: 'ignore' });
    } catch (_) {}
  } else {
    try {
      process.kill(-pid, 'SIGTERM');
    } catch (_) {}
  }
}

const processes = [];

function startProcess(name, cmd, args, cwd, env = {}) {
  const fullEnv = { ...process.env, ...env };
  const child = spawn(cmd, args, {
    cwd,
    env: fullEnv,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  processes.push({ name, child });

  child.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      if (line.trim()) console.log(`[${name}] ${line.trim()}`);
    }
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      if (line.trim()) console.error(`[${name}] ${line.trim()}`);
    }
  });

  child.on('exit', (code, signal) => {
    console.log(`[${name}] process exited with code ${code} / signal ${signal}`);
  });

  return child;
}

console.log('========================================================');
console.log(' Starting Enterprise Hospital Management System (EHMS)');
console.log('========================================================\n');

// 1. Start Python Backend (Flask Monolith on port 8010)
const backendEnv = {
  PORT: '8010',
  DATABASE_URL: 'postgresql://postgres@localhost:5432/hospai',
  REDIS_URL: 'memory://',
  CELERY_TASK_ALWAYS_EAGER: 'true',
  CORS_ALLOWED_ORIGINS: 'http://localhost:8443,http://localhost:5173,http://127.0.0.1:8443,http://127.0.0.1:5173',
  SESSION_COOKIE_SECURE: 'false',
  SEED_DEMO_USERS: 'true',
  SEED_INITIAL_ADMIN: 'true',
  SESSION_PEPPER: 'f4b7a1c8d2e3f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0',
  SETTINGS_ENCRYPTION_KEY: 'e1d2c3b4a5f60718293a4b5c6d7e8f90',
  PYTHONUNBUFFERED: '1',
};
console.log('-> Launching Hospital Core Backend on :8010...');
startProcess('Backend', 'python', ['app.py'], path.join(__dirname, 'backend', 'backend'), backendEnv);

// 2. Start Node HRMS Server (Express on port 8011)
const hrmsEnv = {
  HRMS_PORT: '8011',
  HRMS_DATABASE_URL: 'postgresql://postgres@localhost:5432/hospai_enterprise',
  CORS_ALLOWED_ORIGINS: 'http://localhost:8443,http://localhost:5173,http://127.0.0.1:8443,http://127.0.0.1:5173',
};
console.log('-> Launching HRMS Backend on :8011...');
startProcess('HRMS', 'node', ['server/app.mjs'], path.join(__dirname, 'frontend'), hrmsEnv);

// 3. Start Keppler OCR Frontend (Vite on port 3000)
console.log('-> Launching Keppler OCR UI on :3000...');
startProcess('OCR-UI', 'npx', ['vite', '--port', '3000', '--host', '0.0.0.0'], path.join(__dirname, 'ocr-frontend'), {});

// 4. Start Hospital Main Frontend (Vite on port 8443)
console.log('-> Launching Hospital Main Web Application on :8443...');
startProcess('Frontend', 'npx', ['vite', '--port', '8443', '--host', '0.0.0.0'], path.join(__dirname, 'frontend'), {
  PORT: '8443',
});

function cleanup() {
  console.log('\nShutting down all services...');
  for (const { name, child } of processes) {
    if (child.pid) {
      console.log(`Stopping ${name} (PID ${child.pid})...`);
      killProcessTree(child.pid);
    }
  }
  setTimeout(() => process.exit(0), 1000);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

