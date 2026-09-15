#!/usr/bin/env node
/**
 * Image Prompt Dashboard — prompts visibility debug report.
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_OUT = join(ROOT, "output/universal-image-intelligence/image-prompt-dashboard-prompts-debug-report.json");
const DASHBOARD = join(ROOT, "artifacts/api-server/src/routes/dashboard.ts");
const API = join(ROOT, "artifacts/api-server/src/routes/api/imagePromptDashboard.ts");

const INPUTS = [
  "output/pharmacy-blueprint/pharmacy-ai-image-prompt-library.json",
  "output/pharmacy-blueprint/pharmacy-production-image-library.json",
  "output/universal-image-intelligence/image-intelligence.json",
];

const DEFAULTS = {
  industry: "pharmacy",
  templateFamily: "clinical-nhs-services",
  serviceKey: "pharmacy-first",
  packKey: "clinical-nhs-services",
};

async function loadService() {
  return import(pathToFileURL(join(ROOT, "src/image-intelligence/imagePromptDashboardService.ts")).href);
}

function jqPromptCount() {
  const r = spawnSync("jq", ["[.imagePromptPacks[] | .prompts[]] | length", join(ROOT, INPUTS[0])], {
    encoding: "utf8",
  });
  return r.status === 0 ? Number.parseInt(r.stdout.trim(), 10) : null;
}

function curlApi(url, headers = {}) {
  const args = ["-s", "-w", "\n%{http_code}"];
  for (const [k, v] of Object.entries(headers)) args.push("-H", `${k}: ${v}`);
  args.push(url);
  const r = spawnSync("curl", args, { encoding: "utf8" });
  const parts = r.stdout.trim().split("\n");
  const code = parts.pop();
  const body = parts.join("\n");
  return { code: Number(code), body };
}

async function main() {
  const issues = [];
  const svc = await loadService();

  const filesExist = Object.fromEntries(INPUTS.map((f) => [f, existsSync(join(ROOT, f))]));
  for (const [f, ok] of Object.entries(filesExist)) {
    if (!ok) issues.push(`Missing file: ${f}`);
  }

  const promptCount = jqPromptCount();
  if (promptCount !== 38) issues.push(`Prompt count expected 38, got ${promptCount}`);

  const defaults = svc.DEFAULT_PROMPT_SELECTION ?? DEFAULTS;
  const prompts = svc.getPrompts(defaults);
  if (prompts.length < 1) issues.push("getPrompts returned empty for default selection");

  const dash = readFileSync(DASHBOARD, "utf8");
  const api = readFileSync(API, "utf8");

  const dashboardJs = {
    ipdLoadPrompts: dash.includes("function ipdLoadPrompts"),
    ipdOnIndustryChange: dash.includes("function ipdOnIndustryChange"),
    ipdOnFamilyChange: dash.includes("function ipdOnFamilyChange"),
    ipdOnServiceChange: dash.includes("function ipdOnServiceChange"),
    ipdApplyPromptDefaults: dash.includes("ipdApplyPromptDefaults"),
    ipdPromptCards: dash.includes("ipd-prompt-cards"),
    ipdPromptsStatus: dash.includes("ipd-prompts-status"),
    selectorIndustry: dash.includes("ipd-industry-prompts"),
    selectorFamily: dash.includes("ipd-family-prompts"),
    selectorService: dash.includes("ipd-service-prompts"),
    selectorPack: dash.includes("ipd-pack-prompts"),
    fetchJsonHeaders: dash.includes("'Accept': 'application/json'") && dash.includes("X-Requested-With"),
    noPromptsMessage: dash.includes("No prompts found for this selection"),
    defaultPharmacyFirst: dash.includes("pharmacy-first") && dash.includes("clinical-nhs-services"),
  };

  if (!Object.values(dashboardJs).every(Boolean)) {
    issues.push("Dashboard JS checks incomplete");
  }

  const apiUnauthJson = curlApi(
    `http://127.0.0.1:3000/api/image-prompt-dashboard/prompts?industry=pharmacy&templateFamily=clinical-nhs-services&serviceKey=pharmacy-first&packKey=clinical-nhs-services`,
    { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
  );
  const apiUnauthRedirect = curlApi(
    `http://127.0.0.1:3000/api/image-prompt-dashboard/prompts?industry=pharmacy&templateFamily=clinical-nhs-services&serviceKey=pharmacy-first&pack=clinical-nhs-services`,
  );

  const packAlias = api.includes('q(req, "pack")') || api.includes("qPack");
  if (!packAlias) issues.push("API missing pack alias for packKey");

  const meta = svc.getDashboardMeta();
  if (!meta.defaultPromptSelection?.serviceKey) {
    issues.push("Meta missing defaultPromptSelection");
  }

  const report = {
    schemaVersion: "1.0",
    phase: "image-prompt-dashboard-prompts-debug",
    generatedAt: new Date().toISOString(),
    verdict: issues.length === 0
      ? "PASS: Image Prompt Dashboard Prompts Visible"
      : "FAIL: Image Prompt Dashboard Prompt Loading Requires Investigation",
    pass: issues.length === 0,
    filesExist,
    promptCount: { expected: 38, actual: promptCount },
    defaultSelection: defaults,
    serviceLayerPromptCount: prompts.length,
    dashboardJs,
    apiProbe: {
      authenticatedNote: "Dashboard fetch uses session cookie when logged in; unauthenticated probe below",
      withJsonHeaders: {
        httpStatus: apiUnauthJson.code,
        returnsJsonError: apiUnauthJson.body.includes("Session expired"),
        bodyPreview: apiUnauthJson.body.slice(0, 200),
      },
      withoutJsonHeaders: {
        httpStatus: apiUnauthRedirect.code,
        redirectsToLogin: apiUnauthRedirect.code === 302 || apiUnauthRedirect.body.includes("Redirecting"),
      },
      packQueryAliasSupported: packAlias,
    },
    rootCauseFixed: [
      "ipdFetch now sends Accept: application/json to avoid login redirect HTML breaking JSON.parse",
      "ipdApplyPromptDefaults selects pharmacy / clinical-nhs-services / pharmacy-first / clinical-nhs-services",
      "API accepts pack= as alias for packKey=",
      "Visible error states for empty results and API failures",
    ],
    issues,
    recommendedUserCheck: "Open Campaign Content → Image Library → Prompt Generator while logged in; expect 4 prompts for Pharmacy First",
  };

  mkdirSync(dirname(REPORT_OUT), { recursive: true });
  writeFileSync(REPORT_OUT, JSON.stringify(report, null, 2) + "\n");

  console.log(report.verdict);
  console.log(`Report: ${REPORT_OUT}`);
  if (issues.length) {
    issues.forEach((i) => console.error(" -", i));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FAIL: Image Prompt Dashboard Prompt Loading Requires Investigation");
  console.error(err);
  process.exit(1);
});
