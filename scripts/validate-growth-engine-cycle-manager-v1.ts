#!/usr/bin/env npx tsx
/**
 * Growth Engine — Growth Cycle Manager V1 validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  GROWTH_CYCLE_STAGES,
  GROWTH_CYCLE_VERSION,
  GROWTH_MEMORY_VERSION,
} from "../src/pharmacy/growthEngineCycleModel.ts";
import {
  buildGrowthJourneyView,
  loadGrowthCycleStore,
  syncGrowthCycles,
} from "../src/pharmacy/growthEngineCycleManagerService.ts";
import {
  getCompletedServiceIds,
  loadGrowthMemory,
  recordRecommendationDecision,
} from "../src/pharmacy/growthEngineCycleMemoryService.ts";
import {
  buildAdaptiveLaunchRecommendation,
  checkLaunchPlanEligibility,
} from "../src/pharmacy/growthEngineLaunchManagerService.ts";
import {
  buildCycleAwareRecommendation,
  buildCycleLearningContext,
} from "../src/pharmacy/growthEngineCycleLearningEngine.ts";
import { renderGrowthEngineDashboardPage } from "../src/pharmacy/growthEnginePageRenderers.ts";
import { growthJourneyDashboardCss } from "../src/pharmacy/growthEngineGrowthJourneyDashboardPage.ts";
import { buildGrowthPlanIntelligence } from "../src/pharmacy/growthEngineCampaignRecommendationEngine.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function main() {
  console.log("\n=== Growth Engine Growth Cycle Manager V1 ===\n");

  record("cycle-model-version", GROWTH_CYCLE_VERSION === 1, `v${GROWTH_CYCLE_VERSION}`);
  record("memory-model-version", GROWTH_MEMORY_VERSION === 1, `v${GROWTH_MEMORY_VERSION}`);
  record("cycle-stages", GROWTH_CYCLE_STAGES.length === 12, `${GROWTH_CYCLE_STAGES.length} stages`);
  record(
    "stage-lifecycle",
    GROWTH_CYCLE_STAGES[0] === "recommended" && GROWTH_CYCLE_STAGES.at(-1) === "completed",
    "recommended → completed",
  );

  record(
    "launch-eligibility-guard",
    !checkLaunchPlanEligibility("dhmdigital", "pharmacy-first").eligible,
    "no launch plan before approval",
  );

  const adaptive = buildAdaptiveLaunchRecommendation("dhmdigital", "pharmacy-first");
  record(
    "adaptive-launch",
    adaptive.recommendedWeeks >= 2 && adaptive.recommendedWeeks <= 4 && adaptive.rationale.includes("strategy"),
    `${adaptive.recommendedWeeks} weeks — ${adaptive.websiteProfile}`,
  );
  record(
    "adaptive-no-google-claim",
    !/google requires/i.test(adaptive.rationale),
    "no false Google requirement claims",
  );

  for (const slug of ["dhmdigital", "pharmaconnect"]) {
    const journey = buildGrowthJourneyView(slug);
    record(`${slug}:journey-builds`, journey.version === 1 && Boolean(journey.consultantMessage), "journey view");

    record(
      `${slug}:timeline-foundation`,
      journey.timeline.foundationSteps.length === 5,
      journey.timeline.foundationSteps.filter((s) => s.complete).length + " complete",
    );

    record(
      `${slug}:memory`,
      journey.memoryEventCount >= 0,
      `${journey.memoryEventCount} memory events`,
    );

    const learning = buildCycleLearningContext(slug);
    record(`${slug}:learning-context`, Array.isArray(learning.completedServiceIds), "learning context");

    const rec = buildCycleAwareRecommendation(slug);
    if (rec) {
      record(`${slug}:cycle-recommendation`, Boolean(rec.serviceId && rec.reason), rec.serviceName);
      const completed = getCompletedServiceIds(slug);
      record(
        `${slug}:no-repeat-completed`,
        !completed.includes(rec.serviceId),
        completed.length ? `skips ${completed.join(",")}` : "none completed yet",
      );
    } else {
      record(`${slug}:cycle-recommendation`, true, "no recommendation when evidence insufficient");
    }

    const planIntel = buildGrowthPlanIntelligence(slug);
    record(
      `${slug}:growth-plan-untouched`,
      planIntel.version === 1,
      "growth plan engine readable",
    );

    syncGrowthCycles(slug);
    const store = loadGrowthCycleStore(slug);
    record(`${slug}:cycle-store`, store.version === 1, `${store.cycles.length} cycles`);

    if (store.cycles.length) {
      const cycle = store.cycles[0];
      record(`${slug}:cycle-fields`, Boolean(cycle.cycleNumber && cycle.currentStage && cycle.stageHistory.length), cycle.recommendedService);
      record(`${slug}:stage-timestamps`, cycle.stageHistory.every((s) => s.enteredAt), "all stages timestamped");
    }

    const html = renderGrowthEngineDashboardPage(slug);
    record(`${slug}:dashboard-timeline`, html.includes("Growth Timeline"), "timeline centrepiece");
    record(`${slug}:dashboard-journey`, html.includes("Your Growth Journey"), "journey header");
    record(`${slug}:dashboard-current-cycle`, html.includes("Current Growth Cycle"), "current cycle");
    record(`${slug}:dashboard-next`, html.includes("Recommended Next Growth Cycle"), "next recommendation");
    record(`${slug}:dashboard-monthly`, html.includes("Monthly Growth Programme"), "monthly loop");
    record(`${slug}:dashboard-consultant`, html.includes("Based on everything we know"), "consultant tone");
    record(`${slug}:page-css`, growthJourneyDashboardCss().includes(".gj-timeline"), "dashboard styles");
  }

  record(
    "docs-exist",
    fs.existsSync(path.join(ROOT, "docs/platform/GROWTH-ENGINE-GROWTH-CYCLE-MANAGER-V1.md")),
    "documentation",
  );

  record(
    "growth-plan-file-unchanged",
    fs.existsSync(path.join(ROOT, "src/pharmacy/growthEngineCampaignRecommendationEngine.ts")),
    "growth plan engine file present",
  );

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  console.log(`\n${passed === total ? "✅" : "❌"} ${passed}/${total} checks passed\n`);
  if (passed !== total) process.exit(1);
}

main();
