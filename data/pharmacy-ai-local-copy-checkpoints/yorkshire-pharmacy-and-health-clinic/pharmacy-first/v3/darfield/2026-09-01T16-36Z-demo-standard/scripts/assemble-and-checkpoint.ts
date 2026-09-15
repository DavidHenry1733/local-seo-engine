import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import { assemblePharmacyAiLocalPagePilotsV3 } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/pharmacyAiLocalPagePilotAssemblerV3.ts";
import { hashFileSha256 } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV1.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";
const GEN = path.join(
  ROOT,
  "data/pharmacy-ai-local-copy-diagnostics",
  SLUG, SERVICE, "v3/darfield/2026-09-01-demo-standard/generate-result.json",
);
const COPY_LIVE = path.join(ROOT, "data/pharmacy-ai-local-copy-pilots", SLUG, SERVICE, "v3/darfield.json");
const HTML_LIVE = path.join(ROOT, "output/pharmacy-ai-local-page-pilots", SLUG, SERVICE, "v3/local/darfield/index.html");
const WOMBWELL_COPY = path.join(ROOT, "data/pharmacy-ai-local-copy-pilots", SLUG, SERVICE, "v3/wombwell.json");
const WOMBWELL_HTML = path.join(ROOT, "output/pharmacy-ai-local-page-pilots", SLUG, SERVICE, "v3/local/wombwell/index.html");
const PACK = path.join(ROOT, "data/pharmacy-local-editorial-evidence-pilots", SLUG, SERVICE, "v3/darfield.json");
const WOMBWELL_PACK = path.join(ROOT, "data/pharmacy-local-editorial-evidence-pilots", SLUG, SERVICE, "v3/wombwell.json");
const PREVIOUS = path.join(
  ROOT,
  "data/pharmacy-ai-local-copy-checkpoints",
  SLUG, SERVICE, "v3/darfield/2026-09-01T06-54Z-previous-catalogue-candidate",
);
const CHECKPOINT = path.join(
  ROOT,
  "data/pharmacy-ai-local-copy-checkpoints",
  SLUG, SERVICE, "v3/darfield/2026-09-01T16-36Z-demo-standard",
);
const INDEX = path.join(ROOT, "data/pharmacy-ai-local-page-demo-references/_index.json");
const DECISION = path.join(
  ROOT,
  "data/pharmacy-ai-local-copy-decisions",
  SLUG, SERVICE, "v3/wombwell/2026-09-01-product-owner-demo-reference-acceptance.json",
);

function sha256(file: string): string {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function copyFile(src: string, dest: string) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function hashDirFiles(dir: string, prefix = ""): Array<{ checkpointPath: string; sha256: string; bytes: number }> {
  const out: Array<{ checkpointPath: string; sha256: string; bytes: number }> = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    const st = fs.statSync(full);
    if (st.isDirectory()) out.push(...hashDirFiles(full, rel));
    else out.push({ checkpointPath: rel, sha256: sha256(full), bytes: st.size });
  }
  return out;
}

const wombwellCopyBefore = hashFileSha256(WOMBWELL_COPY);
const wombwellHtmlBefore = hashFileSha256(WOMBWELL_HTML);
const wombwellPackBefore = hashFileSha256(WOMBWELL_PACK);
const darfieldPackBefore = hashFileSha256(PACK);
const indexBefore = hashFileSha256(INDEX);
const decisionBefore = hashFileSha256(DECISION);

const generated = JSON.parse(fs.readFileSync(GEN, "utf8")) as { ok: boolean; record: Record<string, unknown> };
if (!generated.ok || !generated.record) throw new Error("generation record missing");
fs.mkdirSync(path.dirname(COPY_LIVE), { recursive: true });
fs.writeFileSync(COPY_LIVE, `${JSON.stringify(generated.record, null, 2)}\n`, "utf8");

const assembled = assemblePharmacyAiLocalPagePilotsV3(SLUG, SERVICE, ["darfield"]);
if (!assembled.ok) throw new Error(`assemble failed: ${JSON.stringify(assembled)}`);
if (assembled.areas.some((a) => a.areaSlug !== "darfield") || assembled.files.some((f) => /wombwell/i.test(f))) {
  throw new Error("assemble wrote a non-Darfield file");
}

const operatorReview = {
  kind: "darfield-v3-demo-standard-source-review",
  copyRewritten: false,
  production: "provider-generated-with-operator-source-review-of-review-required-findings",
  productOwnerAccepted: false,
  findings: [
    {
      field: "heroIntroduction",
      sentence:
        "Yorkshire Pharmacy & Health Clinic provides this service to people living in Darfield and the surrounding Barnsley area.",
      resolution:
        "Supported as in-area premises plus borough identity. Parallel to the accepted Wombwell hero second sentence. Not rewritten.",
      source: "canonical pharmacy profile; Darfield is in the Metropolitan Borough of Barnsley.",
    },
    {
      field: "localIntroduction",
      sentence: "The area is home to a public library and the Darfield History Society, which runs local history group sessions.",
      resolution:
        "Library fact and History Society sessions are on the saved Barnsley Council Darfield Library body. Connector 'which' is grammar, not a new fact. Not rewritten.",
      source: "https://www.barnsley.gov.uk/services/libraries/find-a-library/darfield-library/",
    },
    {
      field: "localContextHeading",
      sentence: "Why Darfield patients start with the pharmacist",
      resolution: "This is the existing template section role from the v3 writing brief, not a local fact. Not rewritten.",
      source: "buildAiLocalNarrativeWritingBriefV3",
    },
    {
      field: "localContextParagraphs[0]",
      sentence:
        "Pharmacy First can help with eligible common conditions, and the pharmacist will confirm what can be assessed on the day according to NHS pathway criteria.",
      resolution:
        "Restates locked clinical facts. The same sentence was in the accepted Wombwell source-corrected demo. Not rewritten.",
      source: "PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1",
    },
    {
      field: "relationshipToPharmacy",
      sentence:
        "Pharmacy First consultations for Darfield residents are provided at Yorkshire Pharmacy & Health Clinic in Darfield.",
      resolution:
        "Correct in-area premises statement. 'residents' is the same wording the Product Owner accepted for Wombwell. Not rewritten.",
      source: "canonical pharmacy profile — premises in Darfield",
    },
  ],
};

fs.mkdirSync(path.join(CHECKPOINT, "review"), { recursive: true });
fs.writeFileSync(path.join(CHECKPOINT, "review/operator-review.json"), `${JSON.stringify(operatorReview, null, 2)}\n`);

copyFile(COPY_LIVE, path.join(CHECKPOINT, "copy/darfield-candidate.json"));
copyFile(HTML_LIVE, path.join(CHECKPOINT, "html/index.html"));
copyFile(path.join(PREVIOUS, "copy/darfield-previous.json"), path.join(CHECKPOINT, "copy/previous-catalogue-darfield.json"));
copyFile(path.join(PREVIOUS, "html/index.html"), path.join(CHECKPOINT, "html/previous-catalogue-index.html"));
copyFile(PACK, path.join(CHECKPOINT, "evidence/original-darfield-pack.json"));
copyFile(
  path.join(ROOT, "data/pharmacy-local-editorial-research-supplements", SLUG, SERVICE, "v3/darfield/2026-09-01-demo-standard-research.json"),
  path.join(CHECKPOINT, "evidence/research.json"),
);
copyFile(
  path.join(ROOT, "data/pharmacy-local-editorial-research-supplements", SLUG, SERVICE, "v3/darfield/2026-09-01-demo-standard-cost-ledger.json"),
  path.join(CHECKPOINT, "evidence/research-cost-ledger.json"),
);
copyFile(
  path.join(ROOT, "data/pharmacy-local-editorial-research-supplements", SLUG, SERVICE, "v3/darfield/2026-09-01-demo-standard-generation-cost-ledger.json"),
  path.join(CHECKPOINT, "evidence/generation-cost-ledger.json"),
);
copyFile(GEN, path.join(CHECKPOINT, "diagnostics/generate-result.json"));

const label = [
  "DARFIELD V3 DEMO-STANDARD CANDIDATE",
  "Reuse of the accepted Wombwell content roles and tone.",
  "Not Product Owner accepted. Not published. Not approved.",
  "Previous catalogue Darfield candidate kept recoverable.",
].join("\n");
fs.writeFileSync(path.join(CHECKPOINT, "LABEL.txt"), `${label}\n`);
fs.writeFileSync(
  path.join(CHECKPOINT, "README.md"),
  [
    "# Darfield v3 demo-standard candidate",
    "",
    "Isolated Pharmacy First local candidate produced by reusing the accepted Wombwell process.",
    "Not Product Owner acceptance, clinical approval, campaign approval, or publication.",
    "Previous catalogue Darfield files are in `copy/previous-catalogue-darfield.json` and `html/previous-catalogue-index.html`.",
    "",
  ].join("\n"),
);

if (hashFileSha256(WOMBWELL_COPY) !== wombwellCopyBefore) throw new Error("Wombwell copy changed");
if (hashFileSha256(WOMBWELL_HTML) !== wombwellHtmlBefore) throw new Error("Wombwell HTML changed");
if (hashFileSha256(WOMBWELL_PACK) !== wombwellPackBefore) throw new Error("Wombwell pack changed");
if (hashFileSha256(PACK) !== darfieldPackBefore) throw new Error("Darfield original pack changed");
if (hashFileSha256(DECISION) !== decisionBefore) throw new Error("acceptance decision changed");

const index = JSON.parse(fs.readFileSync(INDEX, "utf8")) as {
  kind: string;
  updatedAt: string;
  entries: Array<Record<string, unknown>>;
};
if (index.entries[0]?.areaSlug !== "wombwell" || index.entries[0]?.status !== "product-owner-accepted-demo-reference") {
  throw new Error("Wombwell index entry drifted");
}
const darfieldEntry = {
  title: "Pharmacy First local-page candidate — Darfield (reuse of accepted Wombwell standard)",
  status: "isolated-candidate-reuse-test-not-product-owner-accepted",
  tenantSlug: SLUG,
  serviceId: SERVICE,
  areaSlug: "darfield",
  recordedAt: new Date().toISOString(),
  candidateCheckpoint: path.relative(ROOT, CHECKPOINT),
  previousCandidateCheckpoint: path.relative(ROOT, PREVIOUS),
  previewUrl: `https://app.pharmaconnect.uk/api/growth-engine/${SLUG}/review-preview?campaign=pharmacy-first&asset=ai-local-area-page-pilot-v3&area=darfield`,
  clinicalApproval: false,
  publication: false,
  productOwnerAccepted: false,
  doesNotProveAutomatedGeneration: true,
  doesNotApproveOtherPages: true,
  reuseOf: "wombwell product-owner-accepted-demo-reference",
  reuseRule: "Reused Wombwell content roles and tone. Did not copy Wombwell facts.",
};
index.entries = [index.entries[0], ...index.entries.slice(1).filter((row) => row.areaSlug !== "darfield"), darfieldEntry];
index.updatedAt = darfieldEntry.recordedAt;
fs.writeFileSync(INDEX, `${JSON.stringify(index, null, 2)}\n`);

const manifest = {
  kind: "darfield-v3-demo-standard-checkpoint",
  label: "DARFIELD — REUSE OF ACCEPTED WOMBWELL LOCAL CONTENT STANDARD",
  status: "isolated-candidate-not-published",
  approved: false,
  published: false,
  productOwnerAccepted: false,
  locked: true,
  aiCalled: true,
  newResearch: true,
  stylisticRewrite: false,
  copyRewrittenAfterGeneration: false,
  checkpointAt: new Date().toISOString(),
  previewUrl: darfieldEntry.previewUrl,
  isolatedCandidateCopy: path.relative(ROOT, COPY_LIVE),
  isolatedCandidateHtml: path.relative(ROOT, HTML_LIVE),
  isolatedCandidateCopySha256: hashFileSha256(COPY_LIVE),
  isolatedCandidateHtmlSha256: hashFileSha256(HTML_LIVE),
  previousCatalogueCopySha256: "7069e5d86f5519d5557c46acac7727d125a9e564aeeac5773114dd68aed55834",
  previousCatalogueHtmlSha256: "fb6d1c6052eaf197e9c6d34892edf14a5a7d3e40101d18a045b2bbe58b8ca422",
  previousCandidateRecoverable: true,
  wombwellReferenceUnchanged: true,
  protectedHashes: {
    wombwellCopy: wombwellCopyBefore,
    wombwellHtml: wombwellHtmlBefore,
    wombwellEditorialPack: wombwellPackBefore,
    darfieldOriginalPack: darfieldPackBefore,
    wombwellAcceptanceDecision: decisionBefore,
    indexBeforeUpdate: indexBefore,
    headingleyHtml: hashFileSha256(
      path.join(ROOT, "output/pharmacy-content-ecosystem/leeds-pharmacy/pharmacy-first/local/headingley/index.html"),
    ),
    yorkshireEcosystemWombwell: hashFileSha256(
      path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, SERVICE, "local/wombwell/index.html"),
    ),
  },
  assembled: assembled.areas,
  files: hashDirFiles(CHECKPOINT).filter((row) => row.checkpointPath !== "MANIFEST.json"),
};
fs.writeFileSync(path.join(CHECKPOINT, "MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      assembled: assembled.areas,
      skipped: assembled.skipped,
      darfieldCopySha256: manifest.isolatedCandidateCopySha256,
      darfieldHtmlSha256: manifest.isolatedCandidateHtmlSha256,
      wombwellCopyUnchanged: hashFileSha256(WOMBWELL_COPY) === wombwellCopyBefore,
      wombwellHtmlUnchanged: hashFileSha256(WOMBWELL_HTML) === wombwellHtmlBefore,
      packUnchanged: hashFileSha256(PACK) === darfieldPackBefore,
      checkpoint: path.relative(ROOT, CHECKPOINT),
      previewUrl: darfieldEntry.previewUrl,
    },
    null,
    2,
  ),
);
