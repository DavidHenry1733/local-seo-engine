/**
 * CPR-15 — Live production path proof (read-only, no job creation).
 */
import fs from "node:fs";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

const REPO = "/home/inboxingproweb/pharmaconnect-growth-engine";
const DIST = `${REPO}/artifacts/api-server/dist/index.mjs`;

function sha16(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 16);
}

const modules = [
  { name: "masterAdminServicePageJobService", src: `${REPO}/src/pharmacy/masterAdminServicePageJobService.ts`, marker: "executeServicePageOnlyJob" },
  { name: "masterAdminJobWorkerService", src: `${REPO}/src/pharmacy/masterAdminJobWorkerService.ts`, marker: "processOneJob" },
  { name: "masterAdminServicePageGenerationReadinessService", src: `${REPO}/src/pharmacy/masterAdminServicePageGenerationReadinessService.ts`, marker: "evaluateServicePageGenerationReadiness" },
  { name: "pharmacyServicePageTenantContextService", src: `${REPO}/src/pharmacy/pharmacyServicePageTenantContextService.ts`, marker: "validateServicePageTenantContextGate" },
  { name: "pharmacyMasterPublishRenderer", src: `${REPO}/src/pharmacy/pharmacyMasterPublishRenderer.ts`, marker: "applyContextTokens" },
  { name: "pharmacyVisualServicePageRenderer", src: `${REPO}/src/pharmacy/pharmacyVisualServicePageRenderer.ts`, marker: "resolveSiteChromeColourTokens" },
  { name: "masterAdminPlatformPage", src: `${REPO}/artifacts/api-server/src/routes/masterAdminPlatformPage.ts`, marker: "renderSpgProgressPanel" },
];

const dist = fs.readFileSync(DIST, "utf8");
const distHash = sha16(DIST);
const pm2 = JSON.parse(execSync("pm2 jlist", { encoding: "utf8" }) as string).find((p: { name: string }) => p.name === "pharmaconnect-growth-engine");

const fingerprints = modules.map((m) => ({
  module: m.name,
  sourcePath: m.src,
  sourceSha256: sha16(m.src),
  compiledLocation: DIST,
  compiledSha256: distHash,
  markerInSource: fs.readFileSync(m.src, "utf8").includes(m.marker),
  markerInCompiled: dist.includes(m.marker),
}));

let branch = "unknown";
let commit = "unknown";
try {
  branch = execSync("git branch --show-current", { cwd: REPO, encoding: "utf8" }).trim();
  commit = execSync("git rev-parse HEAD", { cwd: REPO, encoding: "utf8" }).trim();
} catch {
  branch = fs.readFileSync(`${REPO}/.git/HEAD`, "utf8").trim().replace("ref: refs/heads/", "");
  commit = fs.readFileSync(`${REPO}/.git/refs/heads/${branch}`, "utf8").trim();
}

const legacyReachable = [
  "startWorkflowExecution",
  "nudgeMasterAdminJobQueue",
  "generate_ecosystem",
].map((m) => ({ marker: m, inCompiled: dist.includes(m), servicePageOnlyUses: m === "generate_ecosystem" ? dist.includes("isServicePageOnlyJob") : true }));

const uiContract = {
  renderSpgProgressPanel: dist.includes("renderSpgProgressPanel"),
  spgProgressSection: dist.includes("spgProgressSection"),
  pollSpgJobOnce: dist.includes("pollSpgJobOnce"),
  validateContext: dist.includes("validate-context"),
  statusField: dist.includes("status:job.status"),
  pollingMs1500: dist.includes("1500"),
};

console.log(
  JSON.stringify(
    {
      pm2: pm2
        ? {
            cwd: pm2.pm2_env?.pm_cwd,
            script: pm2.pm2_env?.pm_exec_path,
            pid: pm2.pid,
            restartTime: pm2.pm2_env?.pm_uptime ? new Date(pm2.pm2_env.pm_uptime).toISOString() : null,
            port: pm2.pm2_env?.env?.PORT,
            nodeEnv: pm2.pm2_env?.env?.NODE_ENV,
          }
        : null,
      repo: REPO,
      branch,
      commit,
      compiledEntry: DIST,
      fingerprints,
      legacyReachable,
      uiContract,
      allMarkersInCompiled: fingerprints.every((f) => f.markerInCompiled),
      uiContractPass: Object.values(uiContract).every(Boolean),
    },
    null,
    2,
  ),
);

process.exit(fingerprints.every((f) => f.markerInCompiled) && Object.values(uiContract).every(Boolean) ? 0 : 1);
