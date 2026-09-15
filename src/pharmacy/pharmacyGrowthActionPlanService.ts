/**
 * Pharmacy Growth Action Plan V1 — prioritised actions from existing dashboard data.
 */
import fs from "node:fs";
import path from "node:path";
import { buildExecutiveDashboard, WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { readPharmacyIndexingSummary } from "./pharmacyIndexingBridgeService.ts";
import { computeProfileCompleteness } from "./pharmacyProfileCompleteness.ts";
import { getPharmacyPublishOutputStatus } from "./pharmacyPublishOutputService.ts";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import { readPharmacyVisibilityReport } from "./pharmacyVisibilityBridgeService.ts";
import { buildAuthorityGrowthActionDrafts } from "./pharmacyAuthorityReadinessService.ts";

export type GrowthActionCategory =
  | "Profile"
  | "Competitor Gap"
  | "Content"
  | "Publishing"
  | "Indexing"
  | "Visibility"
  | "Trust"
  | "Reviews"
  | "Local Coverage";

export type GrowthActionPriority = "Critical" | "High" | "Medium" | "Low";
export type GrowthActionStatus = "pending" | "in_progress" | "complete" | "deferred";
export type GrowthActionEffort = "low" | "medium" | "high";

export interface GrowthAction {
  id: string;
  title: string;
  category: GrowthActionCategory;
  priority: GrowthActionPriority;
  impact: string;
  effort: GrowthActionEffort;
  status: GrowthActionStatus;
  reason: string;
  evidence: string[];
  recommendedNextStep: string;
  linkedModule: string;
  linkedUrl: string;
  rankScore: number;
}

export interface PharmacyGrowthActionPlan {
  version: 1;
  slug: string;
  generatedAt: string;
  lastUpdated: string;
  totalActions: number;
  pendingActions: number;
  inProgressActions: number;
  completeActions: number;
  deferredActions: number;
  topPriorityActions: GrowthAction[];
  actionsByCategory: Partial<Record<GrowthActionCategory, GrowthAction[]>>;
  actions: GrowthAction[];
}

interface ActionDraft extends Omit<GrowthAction, "rankScore"> {
  rankScore?: number;
  urgency?: number;
  dependencyOrder?: number;
}

function safeSlug(slug: string): string {
  return String(slug || "pharmaconnect")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "pharmaconnect";
}

function readJson<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function planPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-growth-actions", `${safeSlug(slug)}.json`);
}

function priorityWeight(p: GrowthActionPriority): number {
  if (p === "Critical") return 4;
  if (p === "High") return 3;
  if (p === "Medium") return 2;
  return 1;
}

function effortWeight(e: GrowthActionEffort): number {
  if (e === "low") return 3;
  if (e === "medium") return 2;
  return 1;
}

function rankActions(drafts: ActionDraft[]): GrowthAction[] {
  return drafts
    .map((d) => ({
      ...d,
      rankScore:
        d.rankScore ??
        priorityWeight(d.priority) * 10 +
          (d.urgency ?? 3) * 4 +
          (d.dependencyOrder ?? 5) * 2 +
          effortWeight(d.effort),
    }))
    .sort((a, b) => b.rankScore - a.rankScore || a.title.localeCompare(b.title));
}

function groupByCategory(actions: GrowthAction[]): Partial<Record<GrowthActionCategory, GrowthAction[]>> {
  const grouped: Partial<Record<GrowthActionCategory, GrowthAction[]>> = {};
  for (const action of actions) {
    grouped[action.category] = grouped[action.category] || [];
    grouped[action.category]!.push(action);
  }
  return grouped;
}

function mergeStatuses(existing: PharmacyGrowthActionPlan | null, actions: GrowthAction[]): GrowthAction[] {
  const statusById = new Map((existing?.actions || []).map((a) => [a.id, a.status]));
  return actions.map((a) => ({
    ...a,
    status: statusById.get(a.id) || a.status,
  }));
}

function buildActionDrafts(slug: string): ActionDraft[] {
  const safe = safeSlug(slug);
  const profileDoc = readJson<{ data?: Record<string, unknown> }>(
    path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${safe}.json`),
  );
  const profile = normalizeProfileData(profileDoc?.data || {});
  const completeness = computeProfileCompleteness(profile, safe);
  const town = profile.townCity || "Rotherham";
  const indexing = readPharmacyIndexingSummary(safe);
  const visibility = readPharmacyVisibilityReport(safe);
  const publishOutput = getPharmacyPublishOutputStatus(safe);
  const executive = buildExecutiveDashboard(safe);
  const competitorDash =
    readJson<any>(path.join(WORKSPACE_ROOT, "data/pharmacy-competitor-intelligence", `${safe}-dashboard.json`)) ||
    readJson<any>(path.join(WORKSPACE_ROOT, "data/pharmacy-opportunity-engine", `${safe}-dashboard.json`));
  const growthJourney = readJson<any>(path.join(WORKSPACE_ROOT, "data/pharmacy-growth-journey", `${safe}.json`));

  const drafts: ActionDraft[] = [];
  const dashUrl = (hash: string) => `/api/pharmacy-growth-dashboard?slug=${safe}${hash}`;

  if (!profile.logoUrl) {
    drafts.push({
      id: "profile-add-logo",
      title: "Add pharmacy logo to complete profile",
      category: "Profile",
      priority: "High",
      impact: "Logo completes branding and improves trust on every published page header.",
      effort: "low",
      status: "pending",
      reason: `Profile completeness is at ${completeness.score}% — logo is the remaining branding gap.`,
      evidence: completeness.missingItems.filter((m) => m.toLowerCase().includes("logo")),
      recommendedNextStep: "Upload your pharmacy logo in the Profile Dashboard branding section.",
      linkedModule: "Profile Dashboard",
      linkedUrl: `/api/pharmacy-profile-dashboard?slug=${safe}#branding`,
      dependencyOrder: 10,
      urgency: 4,
    });
  }

  if (completeness.score < 100 && completeness.missingItems.length > 0) {
    drafts.push({
      id: "profile-complete-missing-fields",
      title: "Complete remaining profile fields",
      category: "Profile",
      priority: completeness.score >= 90 ? "Medium" : "High",
      impact: "Full profile data powers headers, footers, trust blocks and local access sections.",
      effort: "low",
      status: "pending",
      reason: `${completeness.score}% profile complete with ${completeness.missingItems.length} item(s) still missing.`,
      evidence: completeness.missingItems.slice(0, 5),
      recommendedNextStep: "Review the completeness panel and fill any missing business, trust or CTA fields.",
      linkedModule: "Profile Dashboard",
      linkedUrl: `/api/pharmacy-profile-dashboard?slug=${safe}`,
      dependencyOrder: 10,
      urgency: 3,
    });
  }

  const gphcGeneric = String(profile.gphcPremisesUrl || "").includes("pharmacyregulation.org/registers/pharmacy");
  if (gphcGeneric || !profile.nhsProfileUrl) {
    drafts.push({
      id: "trust-add-regulatory-links",
      title: "Add real GPhC and NHS profile links before live launch",
      category: "Trust",
      priority: "High",
      impact: "Verified regulatory links strengthen patient trust and E-E-A-T signals.",
      effort: "low",
      status: "pending",
      reason: "Trust credentials should link to your specific premises registration before go-live.",
      evidence: [
        gphcGeneric ? "GPhC URL appears to use generic register path" : "",
        !profile.nhsProfileUrl ? "NHS profile URL not set" : "",
      ].filter(Boolean),
      recommendedNextStep: "Paste your premises-specific GPhC and NHS profile URLs in the profile trust section.",
      linkedModule: "Profile Dashboard",
      linkedUrl: `/api/pharmacy-profile-dashboard?slug=${safe}#trust`,
      dependencyOrder: 9,
      urgency: 4,
    });
  }

  if ((indexing?.readyToSubmit ?? 0) > 0) {
    drafts.push({
      id: "indexing-submit-ready-pages",
      title: "Submit all ready pages for indexing",
      category: "Indexing",
      priority: "Critical",
      impact: "Submitted pages enter Google's index queue — required before visibility can build.",
      effort: "low",
      status: "pending",
      reason: `${indexing!.readyToSubmit} published page(s) are registered and ready to submit.`,
      evidence: [`${indexing!.totalRegistered} pages registered`, `${indexing!.readyToSubmit} ready to submit`],
      recommendedNextStep: "Click Submit Ready Pages on the Growth Journey indexing section.",
      linkedModule: "Indexing Bridge",
      linkedUrl: dashUrl("#indexing"),
      dependencyOrder: 8,
      urgency: 5,
    });
  }

  if (indexing && indexing.submitted > 0 && indexing.indexed < indexing.totalRegistered) {
    drafts.push({
      id: "indexing-refresh-status",
      title: "Refresh indexing status for submitted pages",
      category: "Indexing",
      priority: "High",
      impact: "Confirms which service pages Google has indexed so visibility tracking stays accurate.",
      effort: "low",
      status: "pending",
      reason: `${indexing.submitted} submitted · ${indexing.indexed} indexed · ${indexing.notIndexed} not indexed.`,
      evidence: [`Last indexing update: ${indexing.lastUpdated}`, `Sitemap: ${indexing.sitemapUrl}`],
      recommendedNextStep: "Run Refresh Indexing Status, then review indexed vs not-indexed counts.",
      linkedModule: "Indexing Bridge",
      linkedUrl: dashUrl("#indexing"),
      dependencyOrder: 7,
      urgency: 4,
    });
  }

  if (indexing && indexing.indexed > 0) {
    drafts.push({
      id: "visibility-refresh-after-indexing",
      title: "Refresh visibility tracking after indexing",
      category: "Visibility",
      priority: "High",
      impact: "Updates keyword visibility estimates once pages move from submitted to indexed.",
      effort: "low",
      status: "pending",
      reason: `${indexing.indexed} indexed page(s) — visibility score is ${visibility?.estimatedVisibilityScore ?? "not yet calculated"}.`,
      evidence: visibility
        ? [`${visibility.visiblePageCount} visible services`, `Score: ${visibility.estimatedVisibilityScore}`]
        : ["Visibility report not yet refreshed"],
      recommendedNextStep: "Click Refresh Visibility Status on the Growth Journey dashboard.",
      linkedModule: "Visibility Bridge",
      linkedUrl: dashUrl("#visibility"),
      dependencyOrder: 6,
      urgency: 4,
    });
  }

  const notVisible = (visibility?.services || []).filter((s) => s.visibilityStatus === "not_visible");
  for (const svc of notVisible.slice(0, 2)) {
    drafts.push({
      id: `visibility-improve-${svc.serviceId}`,
      title: `Improve visibility for ${svc.serviceId.replace(/-/g, " ")}`,
      category: "Visibility",
      priority: "Medium",
      impact: `Recover organic visibility for "${svc.primaryKeyword}".`,
      effort: "medium",
      status: "pending",
      reason: `Page is ${svc.indexedStatus} — not yet visible for primary local keyword.`,
      evidence: [svc.competitorOpportunity, svc.recommendedAction],
      recommendedNextStep: svc.recommendedAction,
      linkedModule: "Visibility Bridge",
      linkedUrl: dashUrl("#visibility"),
      dependencyOrder: 5,
      urgency: 3,
    });
  }

  drafts.push({
    id: "competitor-promote-pharmacy-first",
    title: "Promote Pharmacy First as a priority service",
    category: "Competitor Gap",
    priority: "High",
    impact: "Pharmacy First is a high-intent NHS service with strong local search demand.",
    effort: "medium",
    status: "pending",
    reason: "Benchmark service page is published — competitors also promote Pharmacy First locally.",
    evidence: [
      visibility?.services.find((s) => s.serviceId === "pharmacy-first")?.competitorOpportunity ||
        "60% of local competitors promote Pharmacy First",
      "Pharmacy First page published and in visibility registry",
    ],
    recommendedNextStep: "Feature Pharmacy First in GBP posts, review responses and front-of-site navigation.",
    linkedModule: "Competitor Intelligence",
    linkedUrl: `/api/pharmacy-competitor-dashboard?slug=${safe}`,
    dependencyOrder: 4,
    urgency: 4,
  });

  const reviewOpp = (competitorDash?.opportunities || []).find(
    (o: any) => o.category === "reviews" || String(o.id || "").includes("review"),
  );
  if (reviewOpp) {
    drafts.push({
      id: "reviews-improve-request-workflow",
      title: "Improve review request workflow",
      category: "Reviews",
      priority: "High",
      impact: String(reviewOpp.impact || "Higher review volume improves local pack visibility and patient trust."),
      effort: "medium",
      status: "pending",
      reason: String(reviewOpp.description || "Local competitors average more Google reviews than your pharmacy."),
      evidence: [String(reviewOpp.description || ""), String(reviewOpp.action || "")].filter(Boolean),
      recommendedNextStep: String(
        reviewOpp.action ||
          "Launch post-visit review requests via SMS, receipt QR codes and consultation follow-up.",
      ),
      linkedModule: "Executive Dashboard",
      linkedUrl: `/api/pharmacy-executive-dashboard?slug=${safe}`,
      dependencyOrder: 4,
      urgency: 5,
    });
  }

  const ecoGbp = path.join(
    WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    safe,
    "pharmacy-first/packs/gbp-posts.json",
  );
  if (fs.existsSync(ecoGbp)) {
    drafts.push({
      id: "content-gbp-posts-pharmacy-first",
      title: "Build Google Business Profile posts from Pharmacy First ecosystem",
      category: "Content",
      priority: "Medium",
      impact: "GBP posts reinforce service relevance and drive local discovery between website updates.",
      effort: "low",
      status: "pending",
      reason: "Pharmacy First content ecosystem includes ready GBP post assets.",
      evidence: ["GBP post pack available at pharmacy-first/packs/gbp-posts.json"],
      recommendedNextStep: "Copy ecosystem GBP posts into your Google Business Profile weekly schedule.",
      linkedModule: "Content Ecosystem",
      linkedUrl: `/api/pharmacy-content-ecosystem-preview/pharmacy-first/`,
      dependencyOrder: 3,
      urgency: 3,
    });
  }

  drafts.push({
    id: "content-travel-vaccinations-seasonal",
    title: "Publish Travel Vaccinations content before peak travel season",
    category: "Content",
    priority: "Medium",
    impact: "Travel health searches spike before school holidays — early visibility captures bookings.",
    effort: "low",
    status: "pending",
    reason: `Travel Vaccinations page is published for ${town} — refresh promotion ahead of peak demand.`,
    evidence: [
      visibility?.services.find((s) => s.serviceId === "travel-vaccinations")?.primaryKeyword ||
        `travel vaccinations ${town}`,
      "70% of local competitors promote travel vaccinations",
    ],
    recommendedNextStep: "Schedule GBP posts and email reminders highlighting travel clinic availability.",
    linkedModule: "Visual Experience",
    linkedUrl: `/api/pharmacy-visual-experience/travel-vaccinations/`,
    dependencyOrder: 3,
    urgency: 3,
  });

  const priorityAreas = (profile.rankingAreas || []).filter((a) => a.toLowerCase() !== town.toLowerCase()).slice(0, 4);
  if (priorityAreas.length > 0) {
    drafts.push({
      id: "local-coverage-expand-area-pages",
      title: `Expand local coverage pages for priority ${town} areas`,
      category: "Local Coverage",
      priority: "Medium",
      impact: "Area-specific pages capture service + neighbourhood searches competitors may miss.",
      effort: "high",
      status: "pending",
      reason: `${publishOutput.pageCount} pages published including area variants — prioritise high-intent neighbourhoods.`,
      evidence: priorityAreas.map((a) => `Priority area: ${a}`),
      recommendedNextStep: `Review area pages for ${priorityAreas.slice(0, 3).join(", ")} and ensure indexing is submitted.`,
      linkedModule: "Publishing",
      linkedUrl: `/api/pharmacy-executive-dashboard?slug=${safe}`,
      dependencyOrder: 2,
      urgency: 2,
    });
  }

  if (indexing?.sitemapUrl) {
    drafts.push({
      id: "publishing-verify-sitemap-live",
      title: "Verify sitemap is live on production domain",
      category: "Publishing",
      priority: "Medium",
      impact: "Live sitemap helps Google discover all registered service pages efficiently.",
      effort: "low",
      status: "pending",
      reason: `${publishOutput.pageCount} HTML pages published — sitemap registered at ${indexing.sitemapUrl}.`,
      evidence: [`Publish output: ${publishOutput.pageCount} pages`, `Registry: ${indexing.totalRegistered} benchmark URLs`],
      recommendedNextStep: "Confirm sitemap.xml is accessible on your live domain and submitted in Search Console.",
      linkedModule: "Indexing Bridge",
      linkedUrl: dashUrl("#indexing"),
      dependencyOrder: 7,
      urgency: 3,
    });
  }

  for (const opp of (competitorDash?.opportunities || []).slice(0, 4)) {
    const serviceId = opp.relatedServices?.[0];
    if (!serviceId) continue;
    const id = `competitor-gap-${serviceId}`;
    if (drafts.some((d) => d.id === id)) continue;
    drafts.push({
      id,
      title: String(opp.title || `Close competitor gap for ${serviceId}`),
      category: "Competitor Gap",
      priority: (opp.priority === "Critical" ? "Critical" : opp.priority === "High" ? "High" : "Medium") as GrowthActionPriority,
      impact: String(opp.impact || "Reduces competitor advantage in local service searches."),
      effort: "medium",
      status: "pending",
      reason: String(opp.description || "Competitor intelligence identified a local service gap."),
      evidence: [String(opp.description || ""), `Service: ${serviceId}`],
      recommendedNextStep: String(opp.action || "Review competitor report and strengthen local landing pages."),
      linkedModule: "Competitor Intelligence",
      linkedUrl: `/api/pharmacy-competitor-dashboard?slug=${safe}`,
      dependencyOrder: 3,
      urgency: opp.priority === "High" ? 4 : 3,
    });
  }

  if (competitorDash?.gaps?.trustGap) {
    drafts.push({
      id: "trust-close-trust-gap",
      title: "Close the local trust signals gap",
      category: "Trust",
      priority: "Medium",
      impact: String(competitorDash.gaps.trustGap.summary || "Stronger trust signals support conversion and local rankings."),
      effort: "medium",
      status: "pending",
      reason: "Competitor trust comparison shows room to strengthen credentials and proof points.",
      evidence: (competitorDash.gaps.trustGap.details || []).slice(0, 3).map(String),
      recommendedNextStep: "Surface GPhC registration, NHS services and consultation room credentials on every service page.",
      linkedModule: "Profile Dashboard",
      linkedUrl: `/api/pharmacy-profile-dashboard?slug=${safe}#trust`,
      dependencyOrder: 5,
      urgency: 3,
    });
  }

  if (growthJourney?.roadmap) {
    const monitoring = growthJourney.roadmap.find((s: any) => s.id === "monitoring");
    if (monitoring && monitoring.pct < 100) {
      drafts.push({
        id: "content-review-ecosystem-assets",
        title: "Review content ecosystem assets for priority services",
        category: "Content",
        priority: "Low",
        impact: "Email, FAQ and social packs extend reach without new page generation.",
        effort: "low",
        status: "pending",
        reason: "Content ecosystem assets exist for Pharmacy First — extend use across channels.",
        evidence: ["Pharmacy First ecosystem includes FAQ, email and social packs"],
        recommendedNextStep: "Open the Pharmacy First content ecosystem and schedule one asset per week.",
        linkedModule: "Content Ecosystem",
        linkedUrl: `/api/pharmacy-content-ecosystem-preview/pharmacy-first/`,
        dependencyOrder: 2,
        urgency: 2,
      });
    }
  }

  for (const execAction of executive.actionPlan.actions.slice(0, 3)) {
    const id = `executive-${execAction.id}`;
    if (drafts.some((d) => d.id === id)) continue;
    drafts.push({
      id,
      title: execAction.title,
      category: execAction.category === "reviews" ? "Reviews" : "Competitor Gap",
      priority: (execAction.priority === "Critical"
        ? "Critical"
        : execAction.priority === "High"
          ? "High"
          : "Medium") as GrowthActionPriority,
      impact: execAction.why,
      effort: (execAction.effort === "low" ? "low" : execAction.effort === "high" ? "high" : "medium") as GrowthActionEffort,
      status: "pending",
      reason: "Prioritised by executive dashboard action engine.",
      evidence: [execAction.why, `${execAction.priority} priority · ${execAction.timeframe}`],
      recommendedNextStep: execAction.title,
      linkedModule: "Executive Dashboard",
      linkedUrl: `/api/pharmacy-executive-dashboard?slug=${safe}`,
      dependencyOrder: 3,
      urgency: 3,
    });
  }

  for (const authorityAction of buildAuthorityGrowthActionDrafts(safe)) {
    if (drafts.some((d) => d.id === authorityAction.id)) continue;
    drafts.push({
      id: authorityAction.id,
      title: authorityAction.title,
      category: "Trust",
      priority: authorityAction.priority,
      impact: "Resolves Authority & AI Readiness blockers before live publish and indexing.",
      effort: authorityAction.priority === "Critical" ? "low" : "medium",
      status: "pending",
      reason: authorityAction.reason,
      evidence: authorityAction.evidence,
      recommendedNextStep: authorityAction.recommendedNextStep,
      linkedModule: authorityAction.linkedModule,
      linkedUrl: authorityAction.linkedUrl,
      dependencyOrder: authorityAction.priority === "Critical" ? 11 : 8,
      urgency: authorityAction.priority === "Critical" ? 5 : 4,
    });
  }

  return drafts;
}

export function readPharmacyGrowthActionPlan(slug: string): PharmacyGrowthActionPlan | null {
  return readJson<PharmacyGrowthActionPlan>(planPath(slug));
}

export function refreshPharmacyGrowthActionPlan(slug: string): {
  planPath: string;
  plan: PharmacyGrowthActionPlan;
} {
  const safe = safeSlug(slug);
  const existing = readPharmacyGrowthActionPlan(safe);
  const ranked = rankActions(buildActionDrafts(safe));
  const actions = mergeStatuses(existing, ranked);
  const now = new Date().toISOString();

  const plan: PharmacyGrowthActionPlan = {
    version: 1,
    slug: safe,
    generatedAt: existing?.generatedAt || now,
    lastUpdated: now,
    totalActions: actions.length,
    pendingActions: actions.filter((a) => a.status === "pending").length,
    inProgressActions: actions.filter((a) => a.status === "in_progress").length,
    completeActions: actions.filter((a) => a.status === "complete").length,
    deferredActions: actions.filter((a) => a.status === "deferred").length,
    topPriorityActions: actions.slice(0, 5),
    actionsByCategory: groupByCategory(actions),
    actions,
  };

  const file = planPath(safe);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(plan, null, 2));

  return { planPath: file, plan };
}

export function updateGrowthActionStatus(
  slug: string,
  actionId: string,
  status: GrowthActionStatus,
): PharmacyGrowthActionPlan {
  const safe = safeSlug(slug);
  let plan = readPharmacyGrowthActionPlan(safe);
  if (!plan) {
    plan = refreshPharmacyGrowthActionPlan(safe).plan;
  }

  const allowed: GrowthActionStatus[] = ["pending", "in_progress", "complete", "deferred"];
  if (!allowed.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  const action = plan.actions.find((a) => a.id === actionId);
  if (!action) {
    throw new Error(`Action not found: ${actionId}`);
  }

  action.status = status;
  plan.actions = plan.actions.map((a) => (a.id === actionId ? { ...a, status } : a));
  plan.topPriorityActions = plan.actions.slice(0, 5);
  plan.actionsByCategory = groupByCategory(plan.actions);
  plan.pendingActions = plan.actions.filter((a) => a.status === "pending").length;
  plan.inProgressActions = plan.actions.filter((a) => a.status === "in_progress").length;
  plan.completeActions = plan.actions.filter((a) => a.status === "complete").length;
  plan.deferredActions = plan.actions.filter((a) => a.status === "deferred").length;
  plan.lastUpdated = new Date().toISOString();

  fs.writeFileSync(planPath(safe), JSON.stringify(plan, null, 2));
  return plan;
}

export function getPharmacyGrowthActionPlanStatus(slug: string): {
  plan: PharmacyGrowthActionPlan | null;
  planPath: string;
  planExists: boolean;
} {
  const safe = safeSlug(slug);
  const file = planPath(safe);
  return {
    plan: readPharmacyGrowthActionPlan(safe),
    planPath: file,
    planExists: fs.existsSync(file),
  };
}
