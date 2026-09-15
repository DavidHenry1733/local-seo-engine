/**
 * CPR-03 — Gold Standard Service Page acceptance workflow validation (read-only).
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import ts from "typescript";
import { renderMasterAdminPlatformShell } from "../artifacts/api-server/src/routes/masterAdminPlatformPage.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];
function check(name: string, pass: boolean, detail?: string) {
  checks.push({ name, pass, detail });
}

function extractScript(html: string): string {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("Embedded script not found");
  return m[1];
}

function main() {
  const page = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/masterAdminPlatformPage.ts"), "utf8");
  const api = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/api/masterAdminPlatform.ts"), "utf8");
  const recoverySrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/masterAdminCoreProductRecoveryService.ts"), "utf8");

  check("Phase 3 evidence review service", fs.existsSync(path.join(ROOT, "src/pharmacy/masterAdminCoreProductRecoveryEvidenceReviewService.ts")));
  check("Phase 5 commercial checklist service", fs.existsSync(path.join(ROOT, "src/pharmacy/masterAdminCoreProductRecoveryCommercialChecklistService.ts")));
  check("Evidence review API routes", api.includes("/service-page-evidence-review"));
  check("Evidence review modal", page.includes("speModal"));
  check("Evidence review approve button", page.includes("speApproveBtn"));
  check("Generation blocked without evidence approval", recoverySrc.includes("evidenceReviewApproved"));
  check("Commercial checklist in review UI", page.includes("sprCommercialChecklist"));
  check("Framework lock service", recoverySrc.includes("lockServicePageFrameworkV1"));
  check("Framework lock API", api.includes("/service-page-framework-lock"));

  const html = renderMasterAdminPlatformShell();
  const js = extractScript(html);
  new Function(js);
  const sf = ts.createSourceFile("master.js", js, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  check("Embedded JavaScript parse", !sf.parseDiagnostics.length);

  let buildPass = false;
  try {
    execSync("pnpm --dir artifacts/api-server build", { cwd: ROOT, stdio: "pipe" });
    buildPass = true;
  } catch (e) {
    check("API-server build", false, String(e));
  }
  if (buildPass) check("API-server build", true);

  const report = {
    sprint: "CPR-03",
    validatedAt: new Date().toISOString(),
    checks,
    acceptance: {
      customerCreated: "NO",
      websiteImport: "NOT RUN — Product Owner action required via dashboard",
      evidenceReview: "NOT RUN — Product Owner action required via dashboard",
      servicePageGenerated: "NO",
      commercialChecklist: "PENDING — requires generated service page",
      itemsPassed: 0,
      itemsFailed: 35,
      frameworkChanges: [
        "masterAdminCoreProductRecoveryEvidenceReviewService.ts",
        "masterAdminCoreProductRecoveryCommercialChecklistService.ts",
        "masterAdminCoreProductRecoveryService.ts",
        "masterAdminCoreProductRecoveryModel.ts",
        "masterAdminCustomerRecordLiteService.ts",
        "masterAdminPlatform.ts",
        "masterAdminPlatformPage.ts",
      ],
      frameworkLocked: "NO",
      status: checks.every((c) => c.pass) && buildPass ? "READY FOR PRODUCT OWNER GOLD STANDARD SERVICE PAGE REVIEW" : "BLOCKED",
    },
  };

  fs.mkdirSync(path.join(ROOT, "data/validation-reports"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "data/validation-reports/cpr-03-gold-standard-service-page.json"), JSON.stringify(report, null, 2));
  for (const c of checks) console.log(`${c.pass ? "PASS" : "FAIL"} — ${c.name}${c.detail ? ` (${c.detail})` : ""}`);
  console.log(JSON.stringify(report.acceptance, null, 2));
}

main();
