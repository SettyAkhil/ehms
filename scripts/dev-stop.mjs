import { spawn } from 'node:child_process';

const ports = [8010, 8011, 3000, 8443];
console.log(`Stopping services on ports ${ports.join(', ')}...`);

if (process.platform === 'win32') {
  for (const port of ports) {
    try {
      const netstat = spawn('powershell', ['-Command', `Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`]);
      netstat.on('close', () => {});
    } catch (_) {}
  }
}
console.log('Done.');

