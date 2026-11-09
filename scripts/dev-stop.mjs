// Stops any detached or lingering dev servers across ports 3000, 8011, 8443.

import { execFileSync, execSync } from "node:child_process"

const PORTS = [3000, 8011, 8443]

for (const port of PORTS) {
  let pids = []
  if (process.platform === "win32") {
    try {
      const out = execSync(`netstat -ano`, { encoding: "utf8" })
      for (const line of out.split("\n")) {
        const parts = line.trim().split(/\s+/)
        if (
          parts.length >= 5 &&
          parts[1].endsWith(`:${port}`) &&
          parts[3] === "LISTENING"
        ) {
          pids.push(parts[4])
        }
      }
      pids = [...new Set(pids)]
    } catch {}
  } else {
    try {
      pids = execFileSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], {
        encoding: "utf8",
      })
        .split("\n")
        .map((p) => p.trim())
        .filter(Boolean)
    } catch {}
  }

  for (const pid of pids) {
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /F /PID ${pid}`)
      } else {
        process.kill(Number(pid), "SIGTERM")
      }
      console.log(`[dev-stop] stopped port ${port} (pid ${pid})`)
    } catch (err) {
      console.error(`[dev-stop] could not stop port ${port} pid ${pid}: ${err.message}`)
    }
  }
}
