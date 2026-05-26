import { spawnSync } from "node:child_process";

const projectSlug = process.argv[2] || "inboxingproweb";

function run(label, cmd, args) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: false });
  if (result.status !== 0) {
    console.error(`✗ Failed: ${label}`);
    process.exit(result.status || 1);
  }
}

run("Sync page registry", "node", ["scripts/sync-page-registry.mjs", projectSlug]);
run("Registry live health", "node", ["scripts/registry-health.mjs", projectSlug]);

console.log("\n✓ Post-deploy checks complete");
