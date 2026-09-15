#!/usr/bin/env npx tsx
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "src/pharmacy/contentEngine/validateLocalEvidenceGeographicDisambiguationV1.ts");
const result = spawnSync(process.execPath, ["--import", "tsx", target], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
