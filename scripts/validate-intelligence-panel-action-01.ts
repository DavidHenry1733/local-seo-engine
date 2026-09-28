#!/usr/bin/env npx tsx
/**
 * Intelligence panel renders the canonical current workflow action.
 * Uses the production page functions. Does not call Gilbert continue-workflow.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PAGE = path.join(ROOT, "artifacts/api-server/src/routes/masterAdminPlatformPage.ts");

interface Check { id: string; pass: boolean; detail: string }
const checks: Check[] = [];
function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function extractFunction(src: string, name: string): string {
  const start = src.indexOf(`function ${name}`);
  if (start < 0) return "";
  let depth = 0;
  let started = false;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") { depth++; started = true; }
    else if (ch === "}") {
      depth--;
      if (started && depth === 0) return src.slice(start, i + 1);
    }
  }
  return "";
}

function harness(page: string) {
  const canonical = extractFunction(page, "canonicalIntelligenceWorkflowAction");
  const render = extractFunction(page, "renderCanonicalIntelligenceWorkflowAction");
  const calls: string[] = [];
  const nodes: Record<string, Record<string, unknown>> = {};
  function make(id: string) {
    const el: Record<string, unknown> = {
      id,
      textContent: "",
      className: "",
      disabled: false,
      style: {} as Record<string, string>,
      onclick: null as null | (() => void),
      attrs: {} as Record<string, string>,
      children: [] as Array<Record<string, unknown>>,
    };
    el.setAttribute = (k: string, v: string) => { (el.attrs as Record<string, string>)[k] = v; };
    el.removeAttribute = (k: string) => { delete (el.attrs as Record<string, string>)[k]; };
    el.insertBefore = (child: Record<string, unknown>) => {
      (el.children as Array<Record<string, unknown>>).unshift(child);
      nodes[String(child.id)] = child;
    };
    nodes[id] = el;
    return el;
  }
  make("openCirBtn");
  make("udIntelligenceActionRow");
  make("udIntelligenceLead");
  (nodes.openCirBtn.attrs as Record<string, string>).onclick = "openCommercialIntelligenceReview()";
  nodes.openCirBtn.textContent = "Open Commercial Intelligence";
  const document = {
    getElementById(id: string) { return nodes[id] || null; },
    createElement() { return make(""); },
  };
  const context = vm.createContext({
    document,
    continueWorkflow(id: string) { calls.push(id); },
  });
  vm.runInContext(`${canonical}\n${render}\nthis.api={canonical:canonicalIntelligenceWorkflowAction,render:renderCanonicalIntelligenceWorkflowAction};`, context);
  return {
    calls,
    nodes,
    api: (context as { api: {
      canonical: (c: Record<string, unknown>) => { stage: string; actionId: string; label: string; enabled: boolean } | null;
      render: (c: Record<string, unknown>) => void;
    } }).api,
  };
}

function customer(stage: string, actionId: string, label: string, enabled: boolean, slug = "fixture-pharmacy") {
  return {
    slug,
    currentStage: stage,
    currentStageLabel: "Commercial Intelligence",
    nextAction: label,
    orchestration: {
      stageActionId: enabled || actionId ? actionId : null,
      canContinue: enabled,
      blockingReason: enabled ? null : "Previous stage incomplete",
    },
  };
}

function main() {
  console.log("\n=== INTELLIGENCE PANEL ACTION 01 ===\n");
  const page = fs.readFileSync(PAGE, "utf8");
  const h = harness(page);
  const cont = extractFunction(page, "continueWorkflow");

  const competitor = customer("competitor_analysis", "orchestrate_competitor_analysis", "Generate Competitor Analysis", true);
  h.api.render(competitor);
  const run = h.nodes.udIntelligenceRunBtn;
  record("1-competitor-label", run?.textContent === "Generate Competitor Analysis", String(run?.textContent));
  record("2-local-market-label", h.api.canonical(customer("local_market_intelligence", "orchestrate_local_market_intelligence", "Generate Local Market Intelligence", true))?.label === "Generate Local Market Intelligence", "local market");
  h.api.render(customer("local_market_intelligence", "orchestrate_local_market_intelligence", "Generate Local Market Intelligence", true));
  record("2b-local-market-rendered", h.nodes.udIntelligenceRunBtn?.textContent === "Generate Local Market Intelligence", String(h.nodes.udIntelligenceRunBtn?.textContent));
  h.api.render(customer("generate_growth_intelligence", "orchestrate_growth_intelligence", "Generate Growth Intelligence", true));
  record("3-growth-label", h.nodes.udIntelligenceRunBtn?.textContent === "Generate Growth Intelligence", String(h.nodes.udIntelligenceRunBtn?.textContent));

  const spec = h.api.canonical(competitor);
  record("4-action-from-canonical-model", spec?.actionId === "orchestrate_competitor_analysis" && page.includes("competitor_analysis:'orchestrate_competitor_analysis'"), spec?.actionId || "");
  h.api.render(competitor);
  const onclick = h.nodes.udIntelligenceRunBtn?.onclick as (() => void) | null;
  onclick?.();
  record("5-competitor-calls-orchestrate", h.calls.at(-1) === "orchestrate_competitor_analysis", String(h.calls.at(-1)));
  h.api.render(customer("local_market_intelligence", "orchestrate_local_market_intelligence", "Generate Local Market Intelligence", true));
  (h.nodes.udIntelligenceRunBtn?.onclick as () => void)();
  record("6-local-market-calls-orchestrate", h.calls.at(-1) === "orchestrate_local_market_intelligence", String(h.calls.at(-1)));
  h.api.render(customer("generate_growth_intelligence", "orchestrate_growth_intelligence", "Generate Growth Intelligence", true));
  (h.nodes.udIntelligenceRunBtn?.onclick as () => void)();
  record("7-growth-calls-orchestrate", h.calls.at(-1) === "orchestrate_growth_intelligence", String(h.calls.at(-1)));
  record(
    "8-authenticated-continue-path",
    cont.includes("withAuthHandoff(") && cont.includes("'/continue-workflow'") && page.includes("continueWorkflow(spec.actionId)"),
    "withAuthHandoff continueWorkflow",
  );
  h.api.render(competitor);
  const view = h.nodes.openCirBtn;
  record(
    "9-open-does-not-replace-workflow",
    view?.textContent === "Open Commercial Intelligence" &&
      (view?.attrs as Record<string, string>).onclick === "openCommercialIntelligenceReview()" &&
      h.nodes.udIntelligenceRunBtn?.textContent === "Generate Competitor Analysis",
    `${view?.textContent} | ${h.nodes.udIntelligenceRunBtn?.textContent}`,
  );
  h.api.render(customer("commercial_intelligence", "approve_commercial_intelligence", "Review Commercial Intelligence", true));
  record("10-completed-hides-previous", h.nodes.udIntelligenceRunBtn?.style && (h.nodes.udIntelligenceRunBtn.style as Record<string, string>).display === "none", "review stage hides run");
  const blocked = customer("competitor_analysis", "orchestrate_competitor_analysis", "Generate Competitor Analysis", false);
  h.api.render(blocked);
  const blockedClick = h.nodes.udIntelligenceRunBtn?.onclick;
  record(
    "11-blocked-not-executable",
    h.nodes.udIntelligenceRunBtn?.disabled === true && blockedClick == null && h.api.canonical(blocked)?.enabled === false,
    `disabled=${h.nodes.udIntelligenceRunBtn?.disabled}`,
  );
  const second = customer("competitor_analysis", "orchestrate_competitor_analysis", "Generate Competitor Analysis", true, "second-pharmacy");
  record("12-second-pharmacy-same-renderer", h.api.canonical(second)?.actionId === h.api.canonical(competitor)?.actionId && h.api.canonical(second)?.label === "Generate Competitor Analysis", "same action");
  record("13-tenant-isolation", !canonicalSourceHasSlug(page), "no tenant branch");
  record("14-no-gilbert-production-logic", !extractFunction(page, "canonicalIntelligenceWorkflowAction").includes("gilbert") && !extractFunction(page, "renderCanonicalIntelligenceWorkflowAction").includes("gilbert"), "generic");
  record(
    "view-preserved-in-markup",
    page.includes('onclick="openCommercialIntelligenceReview()"') && page.includes(">Open Commercial Intelligence</button>"),
    "static view control remains",
  );
  record(
    "overwrite-removed",
    !page.includes("giBtn.setAttribute('onclick','continueWorkflow") && !page.includes("legacy-intelligence-panel"),
    "superseded overwrite is not in the page",
  );
  record(
    "shell-owns-action",
    page.includes("renderCanonicalIntelligenceWorkflowAction(c);"),
    "body renderer",
  );

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} PASS`);
  if (failed.length) process.exit(1);
}

function canonicalSourceHasSlug(page: string): boolean {
  const src = extractFunction(page, "canonicalIntelligenceWorkflowAction") + extractFunction(page, "renderCanonicalIntelligenceWorkflowAction");
  return src.includes("gilbert") || src.includes("pharmacy-health-clinic");
}

main();
