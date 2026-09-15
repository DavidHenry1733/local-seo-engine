#!/usr/bin/env npx tsx
import { execFileSync } from "node:child_process";
import fs from "node:fs";

type Check = { name: string; pass: boolean; detail: string };

const checks: Check[] = [];

function run(command: string, args: string[] = []): string {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function record(name: string, pass: boolean, detail: string): void {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} - ${detail}`);
}

function pm2App() {
  const apps = JSON.parse(run("pm2", ["jlist"]));
  return apps.find((app: any) => app.name === "pharmaconnect-growth-engine");
}

function portOwners(): string[] {
  const output = run("ss", ["-ltnp"]);
  return output.split("\n").filter((line) => line.includes(":3001"));
}

function httpCode(url: string): string {
  return run("curl", ["-sS", "-o", "/dev/null", "-w", "%{http_code}", url]).trim();
}

async function main(): Promise<void> {
  try {
    run("pnpm", ["--dir", "artifacts/api-server", "build"]);
    record("source build succeeds", true, "pnpm --dir artifacts/api-server build");
  } catch (error) {
    record("source build succeeds", false, String(error));
  }

  record("dist/index.mjs exists", fs.existsSync("artifacts/api-server/dist/index.mjs"), "artifacts/api-server/dist/index.mjs");

  const owners = portOwners();
  record("port 3001 has one listener", owners.length === 1, owners.join(" | ") || "no listener");

  const rootCode = httpCode("http://127.0.0.1:3001/");
  record("root route responds", rootCode === "200", `HTTP ${rootCode}`);

  const before = pm2App();
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const after = pm2App();
  record(
    "PM2 process is not repeatedly restarting",
    before?.pid === after?.pid && before?.pm2_env?.restart_time === after?.pm2_env?.restart_time && after?.pm2_env?.status === "online",
    `pid ${before?.pid} -> ${after?.pid}, restarts ${before?.pm2_env?.restart_time} -> ${after?.pm2_env?.restart_time}`,
  );

  const logs = run("pm2", ["logs", "pharmaconnect-growth-engine", "--lines", "80", "--nostream"]);
  const lastServerListening = logs.lastIndexOf("Server listening");
  const recentLogs = lastServerListening >= 0 ? logs.slice(lastServerListening) : logs;
  const startupErrorPattern = /EADDRINUSE|ERR_MODULE_NOT_FOUND|growthEngineApiRouter is not defined|Error listening on port/i;
  record("no current startup errors", !startupErrorPattern.test(recentLogs), "checked PM2 logs after latest Server listening marker");

  const failed = checks.filter((check) => !check.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
