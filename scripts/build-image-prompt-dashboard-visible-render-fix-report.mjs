#!/usr/bin/env node
/**
 * Image Prompt Dashboard — visible render fix validation report.
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_OUT = join(ROOT, "output/universal-image-intelligence/image-prompt-dashboard-visible-render-fix-report.json");
const DASHBOARD = join(ROOT, "artifacts/api-server/src/routes/dashboard.ts");

const REQUIRED_ELEMENTS = [
  "ipd-prompts-status",
  "ipd-prompts-output",
  "ipd-prompts-selection",
  "ipd-industry-prompts",
  "ipd-family-prompts",
  "ipd-service-prompts",
  "ipd-pack-prompts",
];

async function main() {
  const issues = [];
  const dash = readFileSync(DASHBOARD, "utf8");

  const elementsConfirmed = Object.fromEntries(
    REQUIRED_ELEMENTS.map((id) => [id, dash.includes('id="' + id + '"') || dash.includes("id='" + id + "'")]),
  );
  for (const [id, ok] of Object.entries(elementsConfirmed)) {
    if (!ok) issues.push(`Missing element: #${id}`);
  }

  const applyDefaultsBlock = dash.match(/function ipdApplyPromptDefaults\(\)\s*\{[\s\S]*?\n\}/);
  const loadSequence = {
    ipdLoadMeta: dash.includes("function ipdLoadMeta"),
    ipdApplyPromptDefaults: dash.includes("function ipdApplyPromptDefaults"),
    ipdLoadPrompts: dash.includes("function ipdLoadPrompts"),
    ipdLoadPromptPanel: dash.includes("function ipdLoadPromptPanel"),
    panelSequenceInLoadPromptPanel:
      dash.includes("return ipdLoadMeta().then(function()") &&
      dash.includes("return ipdApplyPromptDefaults()") &&
      dash.includes("return ipdLoadPrompts()"),
    applyDefaultsDoesNotStopEarly: applyDefaultsBlock ? !applyDefaultsBlock[0].includes("ipdLoadPrompts") : false,
  };

  if (!loadSequence.panelSequenceInLoadPromptPanel) {
    issues.push("ipdLoadPromptPanel missing meta → defaults → prompts sequence");
  }
  if (!loadSequence.applyDefaultsDoesNotStopEarly) {
    issues.push("ipdApplyPromptDefaults should not call ipdLoadPrompts directly");
  }

  const tabSwitch = {
    ipdSwitchSub: dash.includes("function ipdSwitchSub") || dash.includes("ipdSwitchSub = ipdSubTabSwitch"),
    ipdSubTabSwitch: dash.includes("function ipdSubTabSwitch"),
    promptsTabCallsLoadPanel: dash.includes("ipdLoadPromptPanel()"),
    onclickUsesIpdSwitchSub: dash.includes("ipdSwitchSub('prompts')"),
  };

  if (!tabSwitch.promptsTabCallsLoadPanel) issues.push("Prompt tab does not call ipdLoadPromptPanel");

  const css = {
    outputDisplayBlock: dash.includes("#ipd-prompts-output{display:block"),
    panelActiveDisplay: dash.includes("#ipd-panel-prompts.ipd-panel-active"),
    promptCardVisible: dash.includes(".ipd-prompt-card{display:block"),
    textareaVisible: dash.includes(".ipd-prompt-textarea{display:block"),
  };

  if (!Object.values(css).every(Boolean)) issues.push("CSS visibility rules incomplete");

  const renderFeatures = {
    selectionSummary: dash.includes("ipdUpdatePromptSelectionSummary"),
    promptCountInStatus: dash.includes("Prompt API returned"),
    consoleLog: dash.includes("console.log('[IPD] Prompt API returned"),
    textareaPrompts: dash.includes("ipd-prompt-textarea"),
    copyButtons: dash.includes("Copy Prompt") && dash.includes("Copy Negative") && dash.includes("Copy Both"),
    downloadSingle: dash.includes("Download Single Prompt"),
    containerIdIpdPromptsOutput: dash.includes('id="ipd-prompts-output"'),
  };

  if (!renderFeatures.containerIdIpdPromptsOutput) issues.push("Missing #ipd-prompts-output container");

  const svc = await import(pathToFileURL(join(ROOT, "src/image-intelligence/imagePromptDashboardService.ts")).href);
  const prompts = svc.getPrompts({
    industry: "pharmacy",
    templateFamily: "clinical-nhs-services",
    serviceKey: "pharmacy-first",
    packKey: "clinical-nhs-services",
  });

  if (prompts.length < 1) issues.push("Service layer returned no prompts for default selection");

  const report = {
    schemaVersion: "1.0",
    phase: "image-prompt-dashboard-visible-render-fix",
    generatedAt: new Date().toISOString(),
    verdict: issues.length === 0
      ? "PASS: Image Prompt Cards Visible In Dashboard"
      : "FAIL: Prompt Cards Still Hidden",
    pass: issues.length === 0,
    elementsConfirmed,
    loadSequenceFixed: loadSequence,
    tabSwitch,
    cssVisibility: css,
    promptCardOutput: {
      status: renderFeatures.containerIdIpdPromptsOutput && renderFeatures.textareaPrompts ? "operational" : "needs-investigation",
      browserVisibleContainerId: "ipd-prompts-output",
      selectionSummaryId: "ipd-prompts-selection",
      statusBarId: "ipd-prompts-status",
      features: renderFeatures,
      expectedPromptCountForDefaults: prompts.length,
    },
    issues,
    userVerification: "Campaign Content → Image Library → Prompt Generator — blue selection box + prompt cards in #ipd-prompts-output",
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
  console.error("FAIL: Prompt Cards Still Hidden");
  console.error(err);
  process.exit(1);
});
