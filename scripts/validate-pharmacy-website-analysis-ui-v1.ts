#!/usr/bin/env npx tsx
/**
 * PharmaConnect Website Analysis UI V1 — validates panel wiring and bundled script output.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  renderBrandImportClientScript,
  renderBrandImportPanelHtml,
} from "../src/generator/brandImportPanel.ts";
import { analyzeWebsiteForPharmacy } from "../src/pharmacy/pharmacyWebsiteAnalysisService.ts";
import { normalizeProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SLUG = process.argv[2] || "pharmaconnect";
const BROOK = "https://pharmacy.inboxingproweb.com";

let pass = 0;
let fail = 0;

function check(id: string, ok: boolean, detail: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${id} — ${detail}`);
  if (ok) pass++;
  else fail++;
}

console.log(`\nPharmaConnect Website Analysis UI V1 — ${SLUG}\n`);

const panel = renderBrandImportPanelHtml({ mode: "pharmacy", websiteUrl: BROOK });
check("panel-analyse-button", panel.includes("Analyse Existing Website"), "button label");
check("panel-result-summary", panel.includes("bi-analysis-summary"), "summary panel");
check("panel-results", panel.includes("bi-results"), "results panel");
check("panel-apply-btn", panel.includes("Apply to Profile"), "apply button");
check("panel-error-box", panel.includes("bi-error"), "error visibility element");
check("panel-imported-summary-title", panel.includes("Imported Website Summary"), "summary heading");

const script = renderBrandImportClientScript("pharmacy");
check("script-biRun-global", script.includes("window.biRun"), "biRun exposed");
check("script-biRender", script.includes("function biRender"), "render function");
check("script-renderAnalysisSummary", script.includes("function renderAnalysisSummary"), "summary render");
check("script-no-literal-analyzeEndpoint", !script.includes("${analyzeEndpoint}"), "no broken placeholder");
check("script-no-literal-applyEndpoint", !script.includes("${applyEndpoint}"), "no broken apply placeholder");
check(
  "script-correct-analyze-url",
  script.includes("/api/pharmacy/profile/'+biSlug()+'/analyze-website"),
  "analyze endpoint wired",
);
check("script-websiteUrl-payload", script.includes("websiteUrl: url"), "websiteUrl in payload");
check("script-showBiError", script.includes("function showBiError"), "visible error handler");
check("script-apply-brand-import", script.includes("/apply-brand-import"), "apply endpoint");
check("script-shows-results-after-analyze", script.includes("results.style.display = 'block'"), "results panel shown");

const profilesRoute = fs.readFileSync(
  path.join(ROOT, "artifacts/api-server/src/routes/api/pharmacyProfiles.ts"),
  "utf8",
);
check("api-accepts-websiteUrl", profilesRoute.includes("websiteUrl"), "API accepts websiteUrl");

(async () => {
  const analysis = await analyzeWebsiteForPharmacy(BROOK, normalizeProfileData({}));
  check("analysis-brand-logo", Boolean(analysis.brand.logoUrl), "logo for render test");
  check("analysis-phases", analysis.phases.length >= 6, `${analysis.phases.length} phases`);
  check("analysis-checklist", analysis.checklist.length > 0, "checklist items");
  check("analysis-can-render-summary", Boolean(analysis.projectedCompleteness), "completion score");

  const lseScript = renderBrandImportClientScript("lse");
  check("lse-still-uses-brand-import", lseScript.includes("/api/brand-import/"), "LSE mode intact");
  check("lse-no-broken-placeholder", !lseScript.includes("${analyzeEndpoint}"), "LSE script clean");

  // Rebuild check — run build before this script in CI, or verify dist if present
  const distPath = path.join(ROOT, "artifacts/api-server/dist/index.mjs");
  if (fs.existsSync(distPath)) {
    const dist = fs.readFileSync(distPath, "utf8");
    check("dist-no-broken-analyzeEndpoint", !dist.includes("fetch('${analyzeEndpoint}'"), "bundled fetch not broken");
    check("dist-has-analyze-route", dist.includes("/pharmacy/profile/:slug/analyze-website"), "API route in bundle");
  }

  const out = path.join(ROOT, "data/validation-reports", `website-analysis-ui-v1-${SLUG}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(
    out,
    JSON.stringify({ pass: fail === 0, passed: pass, failed: fail, generatedAt: new Date().toISOString() }, null, 2),
  );

  console.log(`\nReport: ${out}`);
  console.log(fail === 0 ? `\n✅ PASS — ${pass}/${pass + fail}\n` : `\n❌ FAIL — ${pass}/${pass + fail}\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
