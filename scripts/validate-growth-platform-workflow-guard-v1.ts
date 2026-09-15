import {
  isCommercialIntelligenceGenerated,
  isCommercialIntelligenceEvidenceComplete,
  isCommercialIntelligenceReadyForReview,
  runCompetitorAnalysisWorkflowAction,
  runLocalMarketIntelligenceWorkflowAction,
  approveCommercialIntelligence,
} from "../src/pharmacy/masterAdminCommercialIntelligenceWorkflowService.ts";

import {
  resolveGrowthPlatform,
} from "../src/pharmacy/growthPlatformResolverService.ts";

let passed = 0;
let failed = 0;

function check(id: string, ok: boolean, detail: string) {
  if (ok) {
    passed++;
    console.log(`PASS  ${id} — ${detail}`);
  } else {
    failed++;
    console.log(`FAIL  ${id} — ${detail}`);
  }
}

console.log("\n=== GROWTH PLATFORM WORKFLOW GUARD V1 ===\n");

const slug = "pharmaconnect";

const platform = resolveGrowthPlatform(slug);

check(
  "platform-national",
  platform.platform === "national",
  platform.platform,
);

check(
  "commercial-generated-false",
  isCommercialIntelligenceGenerated(slug) === false,
  String(isCommercialIntelligenceGenerated(slug)),
);

check(
  "commercial-ready-false",
  isCommercialIntelligenceReadyForReview(slug) === false,
  String(isCommercialIntelligenceReadyForReview(slug)),
);

check(
  "commercial-evidence-false",
  isCommercialIntelligenceEvidenceComplete(slug) === false,
  String(isCommercialIntelligenceEvidenceComplete(slug)),
);

const competitor = await runCompetitorAnalysisWorkflowAction(
  slug,
  "platform-guard-validation",
);

check(
  "local-competitor-action-blocked",
  competitor.ok === false,
  competitor.evidence,
);

check(
  "national-competitor-message",
  /National Competitor Intelligence/i.test(
    `${competitor.evidence} ${competitor.errors.join(" ")}`,
  ),
  `${competitor.evidence} ${competitor.errors.join(" ")}`,
);

const localMarket = await runLocalMarketIntelligenceWorkflowAction(
  slug,
  "platform-guard-validation",
);

check(
  "local-market-action-blocked",
  localMarket.ok === false,
  localMarket.evidence,
);

check(
  "local-market-not-applicable",
  /not applicable/i.test(
    `${localMarket.evidence} ${localMarket.errors.join(" ")}`,
  ),
  `${localMarket.evidence} ${localMarket.errors.join(" ")}`,
);

check(
  "no-google-local-instruction",
  /No Google Places or local healthcare discovery was executed/i.test(
    localMarket.errors.join(" "),
  ),
  localMarket.errors.join(" "),
);

const approval = approveCommercialIntelligence(
  slug,
  "platform-guard-validation",
);

check(
  "national-approval-blocked",
  approval.ok === false,
  approval.evidence,
);

check(
  "national-approval-requirements",
  /National Competitor Intelligence.*National Market Intelligence.*National Growth Intelligence/i.test(
    approval.errors.join(" "),
  ),
  approval.errors.join(" "),
);

const legacy = resolveGrowthPlatform("__validation_legacy_local__");

check(
  "legacy-remains-local",
  legacy.platform === "local",
  legacy.platform,
);

check(
  "legacy-local-engine-applicable",
  legacy.contract.localEngineApplicable === true,
  String(legacy.contract.localEngineApplicable),
);

console.log(
  `\n${failed ? "FAIL" : "PASS"} — ${passed}/${passed + failed} checks\n`,
);

if (failed) process.exit(1);
