#!/usr/bin/env node
// Start the API (uvicorn, :8000) and the web client (Next.js, :3000) together.
// Ctrl+C stops both. Equivalent to running `npm run dev:api` and `npm run dev:web`
// in two terminals.
//
// Each service runs in its own process group so that shutdown reaches the real servers
// (npm → uv → uvicorn, npm → next → next-server), not only the npm wrapper. If either
// service exits, the other is stopped too.
import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const npm = isWindows ? "npm.cmd" : "npm";
const services = [
  { name: "api", script: "dev:api", color: "\x1b[36m" },
  { name: "web", script: "dev:web", color: "\x1b[35m" },
];
const reset = "\x1b[0m";
const children = [];
let shuttingDown = false;

function prefix(service, chunk) {
  const lines = chunk.toString().split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  for (const line of lines) process.stdout.write(`${service.color}[${service.name}]${reset} ${line}\n`);
}

function stopTree(child, signal = "SIGTERM") {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (isWindows) {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  try {
    process.kill(-child.pid, signal); // negative pid: the whole process group
  } catch {
    // group already gone
  }
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) stopTree(child);
  // Escalate if a server ignores SIGTERM.
  setTimeout(() => {
    for (const child of children) stopTree(child, "SIGKILL");
    process.exit(code);
  }, 5_000).unref();
  Promise.all(children.map((child) => new Promise((resolve) => child.once("exit", resolve)))).then(() =>
    process.exit(code),
  );
}

for (const service of services) {
  const child = spawn(npm, ["run", service.script], {
    stdio: ["ignore", "pipe", "pipe"],
    shell: isWindows,
    detached: !isWindows,
  });
  child.stdout.on("data", (chunk) => prefix(service, chunk));
  child.stderr.on("data", (chunk) => prefix(service, chunk));
  child.on("exit", (code, signal) => {
    prefix(service, `exited (${signal ?? `code ${code}`})`);
    shutdown(code ?? 0);
  });
  children.push(child);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
