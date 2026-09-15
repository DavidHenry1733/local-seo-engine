/**
 * Campaign Builder V1 — JSON + form API routes.
 */
import { Router } from "express";
import {
  advanceCampaignBuilderStep,
  approveCampaignBuilderAsset,
  buildCampaignBuilderApprovalSummary,
  buildCampaignBuilderList,
  buildCampaignBuilderOverview,
  buildCampaignBuilderReviewItems,
  campaignBuilderReadyToPublish,
  campaignBuilderStepUrl,
  loadCampaignBuilderSession,
  markCampaignBuilderGenerationCompleted,
  markCampaignBuilderGenerationStarted,
  markCampaignBuilderContextFrozen,
  parseCampaignBuilderAssetSelection,
  selectCampaignBuilderService,
  updateCampaignBuilderAreas,
  updateCampaignBuilderImageStrategy,
  updateCampaignBuilderSettings,
  confirmCampaignBuilderImagePlan,
} from "../../../../../src/pharmacy/growthEngineCampaignBuilderService.ts";
import type {
  CampaignBuilderImageStrategy,
  CampaignBuilderMode,
  CampaignBuilderTargetAreaMode,
  CampaignImageLocalMode,
} from "../../../../../src/pharmacy/growthEngineCampaignBuilderModel.ts";
import {
  generateContentPackage,
  verifyContentPackageHandoff,
} from "../../../../../src/pharmacy/pharmacyContentPackageService.ts";
import {
  buildCustomerCampaignGenerationContext,
  freezeCustomerCampaignGenerationContext,
  toCustomerFacingGenerationError,
  validateCustomerCampaignGenerationPayload,
} from "../../../../../src/pharmacy/contentEngine/customerCampaignGenerationContext.ts";
import { preflightPharmacyLocalEvidenceForCampaign } from "../../../../../src/pharmacy/contentEngine/pharmacyLocalEvidencePackContractV1.ts";
import { resolveTenantProfileSlug } from "../../../../../src/pharmacy/pharmacyTenantSlug.ts";
import {
  CAMPAIGN_BUILDER_ACTION_PATHS,
  campaignBuilderActionGetRedirect,
  campaignBuilderWizardUrl,
} from "../../../../../src/pharmacy/growthEngineCampaignBuilderRoutingService.ts";
import { reviewCentreUrl } from "../../../../../src/pharmacy/growthEngineReviewCentreService.ts";
import {
  generateOneLocalPageCandidate,
  preflightOneLocalPageCandidate,
  resolveOneLocalPageCandidateArea,
} from "../../../../../src/pharmacy/growthEngineLocalPageCandidateService.ts";
import {
  planOneLocalPageEvidencePreparation,
  saveOneLocalPageEvidencePreparationPlan,
} from "../../../../../src/pharmacy/growthEngineLocalPageEvidencePreparationService.ts";
import {
  authoriseLocalPageEvidencePlan,
  decorateLocalPageEvidencePlan,
  getLocalPageEvidenceRun,
  startLocalPageEvidenceCollection,
} from "../../../../../src/pharmacy/growthEngineLocalPageEvidenceCollectionService.ts";
import {
  CUSTOMER_REGISTRY_FOUNDATION_ERROR,
  ensurePharmacyPublishingRegistryFoundation,
  validatePharmacyPageRegistryFoundation,
} from "../../../../../src/pharmacy/pharmacyPublishingFoundationService.ts";

/**
 * Complete local post-generation preparation.
 *
 * Persists the tenant publishing-foundation registry only.
 * Does not generate public publish HTML, deploy, mark published, or register URLs for indexing.
 */
function completeGeneratedCampaignPipeline(slug: string): void {
  ensurePharmacyPublishingRegistryFoundation(slug);
}

function ensureGenerationRegistryPreflight(slug: string): { ok: true } | { ok: false; error: string } {
  try {
    ensurePharmacyPublishingRegistryFoundation(slug);
    const check = validatePharmacyPageRegistryFoundation(slug);
    if (!check.ok) return { ok: false, error: CUSTOMER_REGISTRY_FOUNDATION_ERROR };
    return { ok: true };
  } catch {
    return { ok: false, error: CUSTOMER_REGISTRY_FOUNDATION_ERROR };
  }
}

const router = Router();

function resolveSlug(raw: string): string | null {
  return resolveTenantProfileSlug(raw) || String(raw || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || null;
}

for (const action of CAMPAIGN_BUILDER_ACTION_PATHS) {
  router.get(`/growth-engine/:slug/campaign-builder/${action}`, (req, res) => {
    const redirectUrl = campaignBuilderActionGetRedirect(req.path, req.query as Record<string, unknown>);
    if (!redirectUrl) return res.status(404).type("text/plain").send("Not found");
    res.redirect(302, redirectUrl);
  });
}

router.get("/growth-engine/:slug/campaign-builder", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  const session = loadCampaignBuilderSession(slug);
  res.json({
    ok: true,
    session,
    campaigns: buildCampaignBuilderList(slug),
    overview: buildCampaignBuilderOverview(slug, session),
    approval: buildCampaignBuilderApprovalSummary(slug),
    review: buildCampaignBuilderReviewItems(slug),
    readyToPublish: campaignBuilderReadyToPublish(slug),
  });
});

router.post("/growth-engine/:slug/campaign-builder/select", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  const serviceId = String(req.body?.serviceId || "");
  if (!serviceId) return res.status(400).json({ ok: false, error: "serviceId required" });
  selectCampaignBuilderService(slug, serviceId);
  const wantsJson = req.headers.accept?.includes("application/json");
  const overviewUrl = campaignBuilderWizardUrl(slug, "areas", serviceId);
  if (wantsJson) return res.json({ ok: true, overviewUrl });
  res.redirect(302, overviewUrl);
});

router.post("/growth-engine/:slug/campaign-builder/discover-areas", (_req, res) => {
  res.status(400).json({
    ok: false,
    error: "Stored target areas already exist. Area discovery is not available in Campaign Builder.",
  });
});

router.post("/growth-engine/:slug/campaign-builder/areas", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  const modeRaw = String(req.body?.targetAreaMode || "").trim();
  if (modeRaw !== "wholeTown" && modeRaw !== "recommended" && modeRaw !== "selected") {
    return res.status(400).json({ ok: false, error: "Choose a target area coverage option." });
  }
  const mode = modeRaw as CampaignBuilderTargetAreaMode;
  const areaNames = Array.isArray(req.body?.targetAreas)
    ? req.body.targetAreas.map(String)
    : req.body?.targetAreas
      ? [String(req.body.targetAreas)]
      : [];
  const candidateSelection = Array.isArray(req.body?.candidateSelection)
    ? req.body.candidateSelection.map((row: { areaName?: string; selected?: boolean }) => ({
        areaName: String(row.areaName || ""),
        selected: row.selected === true || row.selected === "true" || row.selected === "on",
      }))
    : undefined;
  try {
    const session = updateCampaignBuilderAreas(slug, mode, areaNames, candidateSelection);
    const wantsJson = req.headers.accept?.includes("application/json");
    const settingsUrl = campaignBuilderWizardUrl(slug, "settings", session.selectedServiceId);
    if (wantsJson) return res.json({ ok: true, settingsUrl });
    res.redirect(302, settingsUrl);
  } catch (err: unknown) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

function parseSelectedStockImageIds(body: Record<string, unknown>): string[] | undefined {
  if (!body || !("selectedStockImageIds" in body)) return undefined;
  const raw = body.selectedStockImageIds;
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    return trimmed.split(",").map((id) => id.trim()).filter(Boolean);
  }
  return undefined;
}

function parseRequestAiImages(body: Record<string, unknown>): boolean | undefined {
  if (!body || !("requestAiImages" in body)) return undefined;
  const raw = body.requestAiImages;
  if (typeof raw === "boolean") return raw;
  const value = String(raw || "").toLowerCase();
  if (value === "true" || value === "yes" || value === "on" || value === "1") return true;
  if (value === "false" || value === "no" || value === "off" || value === "0" || value === "") return false;
  return undefined;
}

router.post("/growth-engine/:slug/campaign-builder/images", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  const body = (req.body || {}) as Record<string, unknown>;
  const raw = String(body.imageStrategy || "");
  const strategy = (["existing", "ai", "upload", "mixed"].includes(raw) ? raw : "existing") as CampaignBuilderImageStrategy;
  const localImageMode =
    "localImageMode" in body
      ? ((String(body.localImageMode || "shared") === "area-specific" ? "area-specific" : "shared") as CampaignImageLocalMode)
      : undefined;
  let deferredSlots: Record<string, boolean> | undefined;
  if (Array.isArray(body.deferSlots)) {
    deferredSlots = {};
    for (const slot of body.deferSlots) deferredSlots[String(slot)] = true;
  } else if (body.deferSlots && typeof body.deferSlots === "object") {
    deferredSlots = {};
    for (const [slot, value] of Object.entries(body.deferSlots as Record<string, unknown>)) {
      deferredSlots[slot] = value === true || value === "true" || value === "on";
    }
  }
  const selectedStockImageIds = parseSelectedStockImageIds(body);
  const requestAiImages = parseRequestAiImages(body);
  const session = updateCampaignBuilderImageStrategy(slug, strategy, localImageMode, deferredSlots, {
    selectedStockImageIds,
    requestAiImages,
  });
  const wantsJson = req.headers.accept?.includes("application/json");
  const imagesUrl = campaignBuilderWizardUrl(slug, "images", session.selectedServiceId);
  if (wantsJson) return res.json({ ok: true, imagesUrl, session });
  res.redirect(302, imagesUrl);
});

router.post("/growth-engine/:slug/campaign-builder/images/confirm", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  try {
    const selectedStockImageIds = parseSelectedStockImageIds(req.body || {});
    const requestAiImages = parseRequestAiImages(req.body || {});
    if (selectedStockImageIds !== undefined || requestAiImages !== undefined) {
      updateCampaignBuilderImageStrategy(slug, "existing", undefined, undefined, {
        selectedStockImageIds,
        requestAiImages,
      });
    }
    const session = confirmCampaignBuilderImagePlan(slug);
    const wantsJson = req.headers.accept?.includes("application/json");
    const overviewUrl = campaignBuilderWizardUrl(slug, "overview", session.selectedServiceId);
    if (wantsJson) return res.json({ ok: true, overviewUrl, session });
    res.redirect(302, overviewUrl);
  } catch (err: unknown) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/growth-engine/:slug/campaign-builder/settings", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  const mode = (String(req.body?.mode || "all") === "manual" ? "manual" : "all") as CampaignBuilderMode;
  const selection = parseCampaignBuilderAssetSelection(req.body || {});
  const session = updateCampaignBuilderSettings(slug, mode, selection);
  const wantsJson = req.headers.accept?.includes("application/json");
  const imagesUrl = campaignBuilderWizardUrl(slug, "images", session.selectedServiceId);
  if (wantsJson) return res.json({ ok: true, imagesUrl });
  res.redirect(302, imagesUrl);
});

router.post("/growth-engine/:slug/campaign-builder/advance", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  const step = String(req.body?.step || "choose");
  const session = advanceCampaignBuilderStep(slug, step as never);
  res.json({ ok: true, session });
});

router.get("/growth-engine/:slug/campaign-builder/local-page-candidate", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  const session = loadCampaignBuilderSession(slug);
  const campaignId = String(req.query?.campaign || req.query?.campaignId || session.selectedServiceId || "");
  if (!campaignId) return res.status(400).json({ ok: false, error: "Select a campaign first" });
  const area = String(req.query?.area || req.query?.areaSlug || "").trim();
  const resolvedArea = area || resolveOneLocalPageCandidateArea(slug)?.areaSlug || "";
  if (!resolvedArea) return res.status(400).json({ ok: false, error: "Select a target area first" });
  const preflight = preflightOneLocalPageCandidate(slug, campaignId, resolvedArea);
  return res.json({ ok: true, preflight });
});

router.get("/growth-engine/:slug/campaign-builder/local-page-evidence-plan", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  const session = loadCampaignBuilderSession(slug);
  const campaignId = String(req.query?.campaign || req.query?.campaignId || session.selectedServiceId || "");
  if (!campaignId) return res.status(400).json({ ok: false, error: "Select a campaign first" });
  const area = String(req.query?.area || req.query?.areaSlug || "").trim();
  const plan = decorateLocalPageEvidencePlan(planOneLocalPageEvidencePreparation(slug, campaignId, area || undefined));
  return res.json({
    ok: true,
    executed: plan.executed,
    paidCallsMade: plan.paidCallsMade,
    plan,
  });
});

router.post("/growth-engine/:slug/campaign-builder/local-page-evidence-plan", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  const session = loadCampaignBuilderSession(slug);
  const campaignId = String(req.body?.campaign || req.body?.campaignId || session.selectedServiceId || "");
  if (!campaignId) return res.status(400).json({ ok: false, error: "Select a campaign first" });
  const area = String(req.body?.area || req.body?.areaSlug || req.body?.areaName || "").trim();
  if (req.body?.execute === true) {
    return res.status(403).json({
      ok: false,
      executed: false,
      paidCallsMade: 0,
      error: "This endpoint does not start collection. Authorise the exact plan, then use the collection route. No provider calls were made.",
    });
  }
  const saved = saveOneLocalPageEvidencePreparationPlan({
    slug,
    serviceId: campaignId,
    areaSlug: area || undefined,
    confirm: Boolean(req.body?.confirm),
  });
  const plan = decorateLocalPageEvidencePlan(saved.plan);
  return res.json({
    ok: true,
    executed: plan.executed,
    paidCallsMade: plan.paidCallsMade,
    file: saved.file,
    plan,
    detail: "Preparation plan saved. No paid calls were made.",
  });
});

router.post("/growth-engine/:slug/campaign-builder/local-page-evidence-authorise", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  const session = loadCampaignBuilderSession(slug);
  const campaignId = String(req.body?.campaign || req.body?.campaignId || session.selectedServiceId || "");
  if (!campaignId) return res.status(400).json({ ok: false, error: "Select a campaign first" });
  const area = String(req.body?.area || req.body?.areaSlug || req.body?.areaName || "").trim();
  const result = authoriseLocalPageEvidencePlan({
    slug,
    serviceId: campaignId,
    areaSlug: area || undefined,
    spendingCapUsd: Number(req.body?.spendingCapUsd),
    confirmAuthorise: req.body?.confirmAuthorise === true,
    planFingerprint: req.body?.planFingerprint ? String(req.body.planFingerprint) : undefined,
    authorisedBy: String(req.session?.userId || "authenticated-session"),
  });
  if (!result.ok) return res.status(result.status).json({ ok: false, error: result.error });
  return res.json({
    ok: true,
    authorisation: result.authorisation,
    plan: result.plan,
    detail: "This exact plan is authorised against the evidence-only cap. AI generation is not authorised. No provider calls were made yet.",
  });
});

router.post("/growth-engine/:slug/campaign-builder/local-page-evidence-collect", async (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  const session = loadCampaignBuilderSession(slug);
  const campaignId = String(req.body?.campaign || req.body?.campaignId || session.selectedServiceId || "");
  if (!campaignId) return res.status(400).json({ ok: false, error: "Select a campaign first" });
  const area = String(req.body?.area || req.body?.areaSlug || req.body?.areaName || "").trim();
  const result = await startLocalPageEvidenceCollection({
    slug,
    serviceId: campaignId,
    areaSlug: area || undefined,
    allowLiveProviders: true,
  });
  if (!result.ok) return res.status(result.status).json({ ok: false, error: result.error, run: result.run || null });
  return res.json({
    ok: true,
    duplicate: result.duplicate,
    run: result.run,
    plan: result.plan,
  });
});

router.get("/growth-engine/:slug/campaign-builder/local-page-evidence-run", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  const session = loadCampaignBuilderSession(slug);
  const campaignId = String(req.query?.campaign || req.query?.campaignId || session.selectedServiceId || "");
  if (!campaignId) return res.status(400).json({ ok: false, error: "Select a campaign first" });
  const area = String(req.query?.area || req.query?.areaSlug || "").trim();
  const plan = decorateLocalPageEvidencePlan(planOneLocalPageEvidencePreparation(slug, campaignId, area || undefined));
  const run = getLocalPageEvidenceRun(slug, campaignId, plan.areaSlug);
  if (run && run.slug !== slug) {
    return res.status(403).json({ ok: false, error: "Cross-tenant evidence run access is not allowed." });
  }
  return res.json({ ok: true, run, plan });
});

router.post("/growth-engine/:slug/campaign-builder/generate-local-page-candidate", async (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  const session = loadCampaignBuilderSession(slug);
  const campaignId = String(req.body?.campaign || req.body?.campaignId || session.selectedServiceId || "");
  if (!campaignId) return res.status(400).json({ ok: false, error: "Select a campaign first" });
  const area = String(req.body?.area || req.body?.areaSlug || req.body?.areaName || "").trim();
  const result = await generateOneLocalPageCandidate({
    slug,
    serviceId: campaignId,
    areaSlug: area || undefined,
  });
  if (!result.ok) {
    return res.status(400).json({ ok: false, error: result.error, preflight: result.preflight });
  }
  return res.json({
    ok: true,
    reviewUrl: result.reviewUrl,
    previewUrl: result.previewUrl,
    areaSlug: result.areaSlug,
    assembled: result.assembled,
  });
});

router.post("/growth-engine/:slug/campaign-builder/generate", async (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  let session = loadCampaignBuilderSession(slug);
  const campaignId = String(req.body?.campaign || req.body?.campaignId || session.selectedServiceId || "");
  if (!campaignId) return res.status(400).json({ ok: false, error: "Select a campaign first" });
  if (session.selectedServiceId !== campaignId) {
    session = selectCampaignBuilderService(slug, campaignId);
  }
  try {
    const customerContext = buildCustomerCampaignGenerationContext(slug, campaignId, session);
    const payload = validateCustomerCampaignGenerationPayload(customerContext);
    if (!payload.ok) {
      return res.status(400).json({ ok: false, error: payload.errors[0] });
    }
    const registryPreflight = ensureGenerationRegistryPreflight(slug);
    if (!registryPreflight.ok) {
      return res.status(400).json({ ok: false, error: registryPreflight.error });
    }
    const evidencePreflight = preflightPharmacyLocalEvidenceForCampaign(slug, campaignId);
    if (!evidencePreflight.ok) {
      return res.status(400).json({ ok: false, error: evidencePreflight.customerError });
    }
    markCampaignBuilderGenerationStarted(slug);
    freezeCustomerCampaignGenerationContext(customerContext);
    markCampaignBuilderContextFrozen(slug, customerContext.frozenAt);
    const result = await generateContentPackage(slug, session.selectedServiceId, { customerContext });
    if (!result.ok) {
      return res.status(result.manifest ? 200 : 500).json({
        ok: false,
        error: toCustomerFacingGenerationError(result.error || "We could not create your campaign. Please try again."),
        manifest: result.manifest,
      });
    }
    completeGeneratedCampaignPipeline(slug);
    const serviceId = session.selectedServiceId;
    const handoff = verifyContentPackageHandoff(slug, serviceId);
    if (!handoff.ok) {
      return res.status(500).json({
        ok: false,
        error: `Campaign output handoff failed: ${handoff.reason}`,
        handoff,
      });
    }
    markCampaignBuilderGenerationCompleted(slug);
    const reviewUrl = serviceId ? reviewCentreUrl(slug, serviceId) : campaignBuilderStepUrl(slug, "review");
    return res.json({ ok: true, reviewUrl, manifest: result.manifest });
  } catch (err: unknown) {
    const error = toCustomerFacingGenerationError(err);
    const status = /^Campaign generation cannot start:/.test(error) ? 400 : 500;
    return res.status(status).json({ ok: false, error });
  }
});

router.post("/growth-engine/:slug/campaign-builder/approve-asset", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  const assetKey = String(req.body?.assetKey || "");
  if (!assetKey) return res.status(400).json({ ok: false, error: "assetKey required" });
  approveCampaignBuilderAsset(slug, assetKey);
  const wantsJson = req.headers.accept?.includes("application/json");
  if (wantsJson) return res.json({ ok: true, review: buildCampaignBuilderReviewItems(slug) });
  res.redirect(campaignBuilderStepUrl(slug, "review"));
});

router.post("/growth-engine/:slug/campaign-builder/regenerate", async (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid slug" });
  const session = loadCampaignBuilderSession(slug);
  if (!session.selectedServiceId) return res.status(400).json({ ok: false, error: "No campaign selected" });
  try {
    const customerContext = buildCustomerCampaignGenerationContext(slug, session.selectedServiceId, session);
    const payload = validateCustomerCampaignGenerationPayload(customerContext);
    if (!payload.ok) {
      return res.status(400).json({ ok: false, error: payload.errors[0] });
    }
    const registryPreflight = ensureGenerationRegistryPreflight(slug);
    if (!registryPreflight.ok) {
      return res.status(400).json({ ok: false, error: registryPreflight.error });
    }
    const evidencePreflight = preflightPharmacyLocalEvidenceForCampaign(slug, session.selectedServiceId);
    if (!evidencePreflight.ok) {
      return res.status(400).json({ ok: false, error: evidencePreflight.customerError });
    }
    freezeCustomerCampaignGenerationContext(customerContext);
    markCampaignBuilderContextFrozen(slug, customerContext.frozenAt);
    const result = await generateContentPackage(slug, session.selectedServiceId, { customerContext });
    if (!result.ok) {
      return res.status(500).json({
        ok: false,
        error: toCustomerFacingGenerationError(result.error || "Regeneration failed"),
      });
    }
    completeGeneratedCampaignPipeline(slug);
    const wantsJson = req.headers.accept?.includes("application/json");
    const serviceId = session.selectedServiceId;
    const handoff = verifyContentPackageHandoff(slug, serviceId);
    if (!handoff.ok) {
      return res.status(500).json({
        ok: false,
        error: `Campaign output handoff failed: ${handoff.reason}`,
        handoff,
      });
    }
    markCampaignBuilderGenerationCompleted(slug);
    const reviewUrl = serviceId ? reviewCentreUrl(slug, serviceId) : campaignBuilderStepUrl(slug, "review");
    if (wantsJson) return res.json({ ok: true, reviewUrl });
    res.redirect(reviewUrl);
  } catch (err: unknown) {
    const error = toCustomerFacingGenerationError(err);
    const status = /^Campaign generation cannot start:/.test(error) ? 400 : 500;
    return res.status(status).json({ ok: false, error });
  }
});

export default router;
