/**
 * SERVICE-CONFIRMATION-EVIDENCE-06E — stored website-import evidence on Step 4 (no live writes / no external calls).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildWizardServiceConfirmationOptions } from "../src/pharmacy/growthEngineWebsiteDiscoveredServiceReconciliation.ts";
import { renderWizardStepServices } from "../src/pharmacy/pharmacyProfileWizardSections.ts";
import { normalizeProfileDoc } from "../src/pharmacy/pharmacyProfileSchema.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures: string[] = [];
function assert(cond: boolean, msg: string) {
  if (!cond) failures.push(msg);
}

const slug = "yorkshire-pharmacy-and-health-clinic";
const profilePath = path.join(ROOT, "data/pharmacy-profiles", `${slug}.json`);
const beforeHash = fs.readFileSync(profilePath);
const beforeStat = fs.statSync(profilePath);
const raw = JSON.parse(beforeHash.toString("utf8"));
const data = normalizeProfileDoc(slug, raw).data;

console.log("== 06E stored-evidence validation ==");

const conf = buildWizardServiceConfirmationOptions(data, slug);
assert(conf.rows.length === 18, `Expected 18 rows, got ${conf.rows.length}`);
assert(conf.rows.filter((r) => r.detectedSuggestion).length === 15, "Expected 15 detected suggestions");
assert(
  conf.rows.filter((r) => r.checked).map((r) => r.serviceId).join(",") === "pharmacy-first",
  "Only Pharmacy First must remain checked",
);

const detected = conf.rows.filter((r) => r.detectedSuggestion);
for (const row of detected) {
  assert(row.evidence != null, `${row.serviceId} missing evidence object`);
  const ev = row.evidence!;
  const hasProvenance = Boolean(ev.sourceUrl) || Boolean(ev.evidenceText) || ev.confidence != null;
  assert(hasProvenance || ev.strength === "unavailable", `${row.serviceId} must show available provenance or unavailable`);
  if (ev.sourceUrl) {
    assert(ev.available || ev.strength === "weak", `${row.serviceId} URL present but marked unavailable incorrectly`);
  }
}

const weak = detected.filter((r) => r.evidence?.strength === "weak");
assert(weak.length >= 1, "Expected at least one weak-evidence detection from stored Yorkshire import");
console.log(
  "Weak evidence services:",
  weak.map((r) => ({ id: r.serviceId, url: r.evidence?.sourceUrl, conf: r.evidence?.confidence })),
);

const nonDetected = conf.rows.filter((r) => !r.detectedSuggestion);
for (const row of nonDetected) {
  assert(row.evidence == null, `${row.serviceId} must not invent evidence`);
}

const html = renderWizardStepServices(data, slug);
assert((html.match(/Detected suggestion/g) || []).length === 15, "HTML must show 15 Detected suggestion badges");
assert((html.match(/wizard-service-evidence/g) || []).length === 15, "HTML must show evidence blocks only for detections");
assert(html.includes("Weak evidence"), "Weak evidence must be visibly identified");
assert(html.includes("Open evidence page"), "Open evidence page control required when URLs exist");
assert(!html.includes("http://example.com"), "Must not invent external evidence URLs");

for (const row of nonDetected) {
  // catalogue-only rows should not render evidence containers keyed to their id in a detection block
  assert(
    !html.includes(`value="${row.serviceId}"`) || !new RegExp(`value="${row.serviceId}"[\\s\\S]{0,200}wizard-service-evidence`).test(html),
    `${row.serviceId} must not render invented evidence`,
  );
}

// No profile mutation
const afterHash = fs.readFileSync(profilePath);
const afterStat = fs.statSync(profilePath);
assert(Buffer.compare(beforeHash, afterHash) === 0, "Yorkshire profile bytes changed");
assert(beforeStat.mtimeMs === afterStat.mtimeMs, "Yorkshire profile mtime changed");

const opp = path.join(ROOT, "data/growth-engine", `${slug}-opportunities.json`);
assert(!fs.existsSync(opp), "GI opportunities artifact must remain absent");

if (failures.length) {
  console.error("FAIL");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}

console.log("PASS — SERVICE-CONFIRMATION-EVIDENCE-06E");
console.log(
  JSON.stringify(
    {
      rows: conf.rows.length,
      detected: detected.length,
      checked: conf.rows.filter((r) => r.checked).map((r) => r.serviceId),
      withUrl: detected.filter((r) => r.evidence?.sourceUrl).length,
      withText: detected.filter((r) => r.evidence?.evidenceText).length,
      withConfidence: detected.filter((r) => r.evidence?.confidence != null).length,
      weak: weak.map((r) => r.serviceId),
      strong: detected.filter((r) => r.evidence?.strength === "strong").map((r) => r.serviceId),
      unavailable: detected.filter((r) => r.evidence?.strength === "unavailable").map((r) => r.serviceId),
    },
    null,
    2,
  ),
);
