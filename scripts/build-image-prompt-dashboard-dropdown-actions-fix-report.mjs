#!/usr/bin/env node
/**
 * Image Prompt Dashboard — dropdown and action button fix validation report.
 * Run: node --import tsx scripts/build-image-prompt-dashboard-dropdown-actions-fix-report.mjs
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_OUT = join(
  ROOT,
  "output/universal-image-intelligence/image-prompt-dashboard-dropdown-actions-fix-report.json",
);

const REQUIRED_FEATURED = [
  "pharmacy-first",
  "nhs-flu-vaccination",
  "private-ear-wax-removal",
  "travel-vaccinations",
  "pharmacy-weight-loss-programme",
];

const DEFAULTS = {
  industry: "pharmacy",
  templateFamily: "clinical-nhs-services",
  serviceKey: "pharmacy-first",
  packKey: "clinical-nhs-services",
};

async function loadService() {
  const modPath = join(ROOT, "src/image-intelligence/imagePromptDashboardService.ts");
  return import(pathToFileURL(modPath).href);
}

function checkDashboardSource() {
  const dashPath = join(ROOT, "artifacts/api-server/src/routes/dashboard.ts");
  const dash = readFileSync(dashPath, "utf8");
  const fnChecks = [
    "ipdLoadMeta",
    "ipdApplyPromptDefaults",
    "ipdOnIndustryChange",
    "ipdOnFamilyChange",
    "ipdOnServiceChange",
    "ipdLoadPromptPanel",
    "ipdLoadPrompts",
    "ipdCopyPrompt",
    "ipdCopyBothFromCard",
    "ipdDownloadSinglePrompt",
    "ipdDownloadPromptPack",
    "ipdInitPromptActions",
    "data-ipd-action",
    "ipdResolveServices",
  ].map((name) => ({ name, present: dash.includes(name) }));

  return {
    serviceLabelNotCampaign: dash.includes('>Service<select id="ipd-service-prompts"'),
    noInlineCopyOnclick: !dash.includes('onclick="ipdCopyPrompt(document.getElementById'),
    delegatedActions: dash.includes("data-ipd-action") && dash.includes("ipdInitPromptActions"),
    fetchDownload: dash.includes("ipdFetchDownload"),
    functions: fnChecks,
    allFunctionsPresent: fnChecks.every((f) => f.present),
  };
}

async function fetchMeta(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/api/image-prompt-dashboard/meta`, {
      headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, status: res.status, error: "non-json", preview: text.slice(0, 200) };
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, error: (err).message };
  }
}

async function main() {
  const issues = [];
  const svc = await loadService();
  const dash = checkDashboardSource();

  const meta = svc.getDashboardMeta();
  const clinicalServices = svc.listPromptGeneratorServices("pharmacy", "clinical-nhs-services");
  const serviceKeys = clinicalServices.map((s) => s.serviceKey);

  const featuredPresent = REQUIRED_FEATURED.every((k) => serviceKeys.includes(k));
  const pharmacyFirstPresent = serviceKeys.includes("pharmacy-first");
  const defaultsMatch =
    meta.defaultPromptSelection?.industry === DEFAULTS.industry &&
    meta.defaultPromptSelection?.templateFamily === DEFAULTS.templateFamily &&
    meta.defaultPromptSelection?.serviceKey === DEFAULTS.serviceKey &&
    meta.defaultPromptSelection?.packKey === DEFAULTS.packKey;

  const metaHasServicesByFamily =
    meta.servicesByTemplateFamily &&
    Array.isArray(meta.servicesByTemplateFamily["clinical-nhs-services"]) &&
    meta.servicesByTemplateFamily["clinical-nhs-services"].some((s) => s.serviceKey === "pharmacy-first");

  const metaHasServicesByIndustry =
    meta.servicesByIndustry?.pharmacy?.some((s) => s.serviceKey === "pharmacy-first");

  const featuredHub = (meta.featuredHubServices ?? []).map((s) => s.serviceKey);
  const featuredHubComplete = REQUIRED_FEATURED.every((k) => featuredHub.includes(k));

  if (!dash.serviceLabelNotCampaign) issues.push("Service dropdown label missing or still says Campaign");
  if (!dash.delegatedActions) issues.push("Delegated data-ipd-action handlers not found");
  if (dash.noInlineCopyOnclick === false) issues.push("Inline onclick copy handlers still present");
  if (!dash.allFunctionsPresent) issues.push("One or more IPD functions missing from dashboard.ts");
  if (!featuredPresent) issues.push("Featured hub services not all present in clinical-nhs-services dropdown list");
  if (!pharmacyFirstPresent) issues.push("pharmacy-first missing from service list");
  if (!defaultsMatch) issues.push("defaultPromptSelection does not match required defaults");
  if (!metaHasServicesByFamily) issues.push("meta.servicesByTemplateFamily missing clinical-nhs-services with pharmacy-first");
  if (!metaHasServicesByIndustry) issues.push("meta.servicesByIndustry.pharmacy missing pharmacy-first");
  if (!featuredHubComplete) issues.push("meta.featuredHubServices incomplete");

  const prompts = svc.getPrompts({
    industry: DEFAULTS.industry,
    templateFamily: DEFAULTS.templateFamily,
    serviceKey: DEFAULTS.serviceKey,
    packKey: DEFAULTS.packKey,
  });
  const sampleImageKey = prompts[0]?.imageKey ?? "hero";

  const exportSingle = svc.exportSinglePrompt({
    industry: DEFAULTS.industry,
    templateFamily: DEFAULTS.templateFamily,
    serviceKey: DEFAULTS.serviceKey,
    packKey: DEFAULTS.packKey,
    imageKey: sampleImageKey,
  });

  const apiBase = process.env.IPD_API_BASE || "http://127.0.0.1:3000";
  const liveMeta = await fetchMeta(apiBase);

  let apiStatus = "skipped";
  let apiNotes = "Live API not reachable — service-layer validation only";
  if (liveMeta.ok && liveMeta.data) {
    const liveKeys = (liveMeta.data.servicesByTemplateFamily?.["clinical-nhs-services"] ?? []).map(
      (s) => s.serviceKey,
    );
    apiStatus = liveKeys.includes("pharmacy-first") ? "ok" : "missing-pharmacy-first";
    apiNotes = `HTTP ${liveMeta.status}; clinical services count=${liveKeys.length}; pharmacy-first=${liveKeys.includes("pharmacy-first")}`;
    if (!liveKeys.includes("pharmacy-first")) issues.push("Live API meta missing pharmacy-first in clinical-nhs-services");
  } else if (liveMeta.status === 401) {
    apiStatus = "auth-required";
    apiNotes = "API returned 401 — meta structure validated at service layer only";
  } else if (liveMeta.error) {
    apiStatus = "unreachable";
    apiNotes = liveMeta.error;
  }

  const pass = issues.length === 0;

  const report = {
    generatedAt: new Date().toISOString(),
    result: pass
      ? "PASS: Image Prompt Dashboard Dropdown And Actions Fixed"
      : "FAIL: Image Prompt Dashboard Actions Still Require Investigation",
    dropdownStatus: {
      serviceLabel: dash.serviceLabelNotCampaign ? "Service" : "unknown",
      featuredServicesInClinicalList: featuredPresent,
      featuredHubServices: featuredHub,
      clinicalServiceCount: clinicalServices.length,
      sampleServiceNames: clinicalServices.slice(0, 8).map((s) => s.serviceName),
    },
    defaultServiceStatus: {
      defaults: meta.defaultPromptSelection,
      defaultsMatchRequired: defaultsMatch,
      pharmacyFirstInList: pharmacyFirstPresent,
    },
    actionButtonStatus: {
      delegatedEventListener: dash.delegatedActions,
      noInlineOnclickCopy: dash.noInlineCopyOnclick,
      fetchBlobDownload: dash.fetchDownload,
      functions: dash.functions,
    },
    apiStatus: {
      status: apiStatus,
      notes: apiNotes,
      servicesByTemplateFamily: metaHasServicesByFamily,
      servicesByIndustry: metaHasServicesByIndustry,
      featuredHubServices: featuredHubComplete,
      defaultPromptSelection: !!meta.defaultPromptSelection,
    },
    validationNotes: {
      exportSinglePromptWorks: !!exportSingle,
      issues,
    },
  };

  mkdirSync(dirname(REPORT_OUT), { recursive: true });
  writeFileSync(REPORT_OUT, JSON.stringify(report, null, 2) + "\n");
  console.log(report.result);
  console.log("Report:", REPORT_OUT);
  if (issues.length) {
    console.error("Issues:", issues);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
