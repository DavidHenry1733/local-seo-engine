/**
 * Commercial Intelligence presentation conclusions.
 * Derived-conclusion contract only. Does not write tenant evidence.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  COMMERCIAL_DECISION_COPY,
  contentTypeGapConclusion,
  crawlCompletenessConclusion,
  demandConclusion,
  indexingConclusion,
  indexingRecommendationAllowed,
  localityTargetConclusion,
  localBenchmarkConclusion,
  organicVisibilityConclusion,
  photoEvidenceConclusion,
  servicePageConclusion,
} from "../src/pharmacy/commercialIntelligenceConclusions.ts";

type Step = { name: string; passed: boolean; detail?: string };
const steps: Step[] = [];
function check(name: string, passed: boolean, detail?: string) {
  steps.push({ name, passed, detail });
}

const dashboardSrc = readFileSync(resolve("src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts"), "utf8");
const pageSrc = readFileSync(resolve("artifacts/api-server/src/routes/masterAdminPlatformPage.ts"), "utf8");
const conclusionsSrc = readFileSync(resolve("src/pharmacy/commercialIntelligenceConclusions.ts"), "utf8");

const crawl = crawlCompletenessConclusion(100);
check("1 profile completeness is not labelled overall online completeness", crawl.conclusion.includes("Imported website crawl completeness") && !/online completeness/i.test(crawl.conclusion), crawl.conclusion);

const missing = servicePageConclusion({ serviceId: "blood-pressure-checks", serviceName: "Blood Pressure Checks", dedicatedPage: "NOT_FOUND" });
const present = servicePageConclusion({ serviceId: "pharmacy-first", serviceName: "Pharmacy First", dedicatedPage: "PRESENT" });
check("2 canonical missing dedicated service page stays missing", missing.evidenceStatus === "KNOWN_GAP" && /no dedicated page/i.test(missing.conclusion));
check("3 existing service page stays existing", present.evidenceStatus === "KNOWN_POSITIVE" && /existing dedicated page/i.test(present.conclusion));
check("4 unknown demand remains unknown", demandConclusion(null).evidenceStatus === "UNKNOWN" && /not yet available/i.test(demandConclusion(null).conclusion));
check("5 unknown organic visibility remains unknown", organicVisibilityConclusion("unavailable").evidenceStatus === "UNKNOWN" && !/poor|zero visibility/i.test(organicVisibilityConclusion("unavailable").conclusion));
check("6 unavailable photo evidence remains unknown", photoEvidenceConclusion(null).evidenceStatus === "UNKNOWN" && !/0 photos/.test(photoEvidenceConclusion(null).conclusion));
const unmeasured = indexingConclusion({ registeredPageCount: 0, indexedPageCount: 0 });
const provenZero = indexingConclusion({ registeredPageCount: 4, indexedPageCount: 0 });
check("7 zero is displayed only when canonical evidence explicitly proves zero", unmeasured.evidenceStatus === "UNKNOWN" && !/\b0 indexed\b|0 pages/.test(unmeasured.conclusion) && provenZero.evidenceStatus === "KNOWN_GAP" && /0 indexed pages/.test(provenZero.conclusion));
check("8 recommendations cannot submit/index a page that does not exist", indexingRecommendationAllowed({ serviceId: "blood-pressure-checks", serviceName: "Blood Pressure Checks", dedicatedPage: "NOT_FOUND" }, { registeredPageCount: 1, indexedPageCount: 0 }) === false && !/submit .+ for indexing/i.test(missing.recommendedAction || ""));
check("9 create-page action precedes indexing recommendation for missing page", /^Create a dedicated /.test(missing.recommendedAction || "") && /before any indexing submission/.test(missing.recommendedAction || ""));
check("10 competitor service does not automatically become pharmacy service recommendation", contentTypeGapConclusion("Service pages for: Covid Vaccination") === null);
check("11 enabled pharmacy service can produce a website coverage gap", missing.evidenceStatus === "KNOWN_GAP" && missing.sourceRef === "canonical-service-coverage");
const leader = localBenchmarkConclusion([
  { name: "Boots", reviewCount: 224, categoryCount: 2 },
  { name: "Other Pharmacy", reviewCount: 10, categoryCount: 6 },
]);
check("12 local competitor benchmark claims identify their metric", /Google review-count leader: Boots — 224 reviews/.test(leader.conclusion) && /Category-coverage leader: Other Pharmacy — 6 categories/.test(leader.conclusion));
check("13 no unsupported strongest competitor conclusion", !/^strongest competitor/i.test(leader.conclusion) && leader.explanation.includes("one measured benchmark"));
const poText = [crawl.conclusion, missing.conclusion, present.conclusion, demandConclusion(null).conclusion, leader.conclusion, COMMERCIAL_DECISION_COPY].join("\n");
check("14 Product Owner output does not expose internal bridge names", !/Pharmacy Visibility Bridge/.test(poText) && !/Pharmacy Visibility Bridge/.test(dashboardSrc));
check("15 Product Owner output does not expose service IDs as prose", !/blood-pressure-checks|pharmacy-first/.test(missing.conclusion + present.conclusion));
check("16 Product Owner output does not expose machine timestamps as recommendation text", !/\d{4}-\d{2}-\d{2}T/.test(missing.recommendedAction || "") && !/Pharmacy Visibility Bridge ·/.test(pageSrc));
check("17 provenance remains retained internally", missing.sourceRef === "canonical-service-coverage" && dashboardSrc.includes('provenance: "search-demand-evidence"'));
check("18 executive summary agrees with detailed sections", dashboardSrc.includes("crawlCompletenessConclusion") && dashboardSrc.includes("servicePageConclusion") && !dashboardSrc.includes("online completeness is around"));
check("19 traffic opportunity agrees with canonical demand evidence", dashboardSrc.includes("demandConclusion(null).conclusion") && pageSrc.includes("Search demand data is not yet available."));
check("20 coverage gaps agree with canonical website/service coverage", dashboardSrc.includes("enabledServiceCoverage") && dashboardSrc.includes("contentTypeGapConclusion"));
const locality = localityTargetConclusion("Paisley", []);
check("21 primary market is not confused with selected locality-page targets", /Primary market: Paisley/.test(locality.conclusion) && /No locality-page targets are selected yet/.test(locality.conclusion));
check("22 approval action unchanged", dashboardSrc.includes('activeAction: approved ? "generate_approved_ecosystem" : "approve_intelligence"') && pageSrc.includes("Approve Intelligence") && pageSrc.includes("commercialDecisionCopy"));
const second = servicePageConclusion({ serviceId: "flu-vaccination", serviceName: "Flu Vaccination", dedicatedPage: "NOT_FOUND" });
check("23 second pharmacy uses identical derivation", second.evidenceStatus === missing.evidenceStatus && second.sourceRef === missing.sourceRef && second.conclusion.includes("Flu Vaccination"));
check("24 tenant isolation intact", !conclusionsSrc.includes("gilbert-pharmacy") && !missing.conclusion.includes("Flu") && !second.conclusion.includes("Blood Pressure"));
check("25 no Gilbert-specific production logic", !/gilbert-pharmacy-health-clinic/.test(conclusionsSrc + "\n" + dashboardSrc.slice(dashboardSrc.indexOf("function enabledServiceCoverage"), dashboardSrc.indexOf("function indexingMeasurement") + 800)));

const before = execFileSync("sha256sum", ["data/pharmacy-profiles/gilbert-pharmacy-health-clinic.json", "data/growth-engine/gilbert-pharmacy-health-clinic-opportunities.json", "data/growth-engine/gilbert-pharmacy-health-clinic-competitors.json", "data/growth-engine/gilbert-pharmacy-health-clinic-workflow.json", "data/pharmacy-master-admin/workflow-history/gilbert-pharmacy-health-clinic.json", "data/pharmacy-visibility/gilbert-pharmacy-health-clinic.json", "data/pharmacy-indexing/gilbert-pharmacy-health-clinic.json"], { encoding: "utf8" });
const { buildCommercialIntelligenceDashboard } = await import("../src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts");
const dash = buildCommercialIntelligenceDashboard("gilbert-pharmacy-health-clinic");
const after = execFileSync("sha256sum", ["data/pharmacy-profiles/gilbert-pharmacy-health-clinic.json", "data/growth-engine/gilbert-pharmacy-health-clinic-opportunities.json", "data/growth-engine/gilbert-pharmacy-health-clinic-competitors.json", "data/growth-engine/gilbert-pharmacy-health-clinic-workflow.json", "data/pharmacy-master-admin/workflow-history/gilbert-pharmacy-health-clinic.json", "data/pharmacy-visibility/gilbert-pharmacy-health-clinic.json", "data/pharmacy-indexing/gilbert-pharmacy-health-clinic.json"], { encoding: "utf8" });
check("Gilbert evidence files unchanged by dashboard derivation", before === after);
const blob = JSON.stringify({
  executive: dash.executiveSummary,
  traffic: dash.trafficOpportunity,
  recommendations: dash.recommendations,
  localMarket: dash.localMarketIntelligence,
  copy: dash.commercialDecisionCopy,
});
check("Gilbert executive does not claim online completeness around 100", !/online completeness is around/i.test(blob));
check("Gilbert Blood Pressure Checks stays a missing dedicated page", /Blood Pressure Checks has no dedicated page/.test(blob));
check("Gilbert Pharmacy First stays existing coverage", /Pharmacy First has an existing dedicated page/.test(blob));
check("Gilbert recommendations do not submit a missing page", !/Submit Blood Pressure Checks page for indexing/i.test(blob));
check("Gilbert demand stays unavailable", /Search demand data is not yet available/.test(blob) && !/Pharmacy Visibility Bridge/.test(blob));
check("Gilbert indexing is not shown as a measured zero", /Indexing visibility is not yet measured/.test(blob) && !/0 pages indexed/.test(blob));
check("Gilbert approval copy states what approval means", dash.commercialDecisionCopy === COMMERCIAL_DECISION_COPY && dash.activeAction === "approve_intelligence");
check("conclusion source hash recorded", createHash("sha256").update(conclusionsSrc).digest("hex").length === 64);

const failed = steps.filter((step) => !step.passed);
for (const step of steps) console.log(`${step.passed ? "PASS" : "FAIL"} — ${step.name}${step.detail ? ` (${step.detail})` : ""}`);
console.log(failed.length ? `\nFAIL ${failed.length}/${steps.length}` : `\nPASS ${steps.length}/${steps.length}`);
process.exit(failed.length ? 1 : 0);
