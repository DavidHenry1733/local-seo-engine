/**
 * Master Admin Platform V1 — JSON API for pharmacy client management.
 */
import { Router } from "express";
import { requireAdmin } from "../../middlewares/requireAuth.js";
import {
  archivePharmacyClient,
  buildMasterAdminClientCard,
  buildMasterAdminPortfolio,
  createPharmacyWorkspace,
  deleteDemoPharmacyClient,
  discoverAreasForWizard,
  getAvailableServicesForWizard,
  previewWizardSummary,
  resolveUniqueSlug,
  safeAdminSlug,
  slugFromPharmacyName,
  WorkspaceProvisioningError,
  type CreatePharmacyWizardInput,
} from "../../../../../src/pharmacy/pharmacyMasterAdminService.ts";
import {
  adminClientSlugAvailable,
  createAdminPharmacyClient,
  listAdminClientPharmacies,
  previewAdminClientSlug,
  type AdminClientCreateInput,
} from "../../../../../src/pharmacy/adminClientCreationService.ts";
import type { GrowthPlanTier } from "../../../../../src/pharmacy/pharmacyCustomerExperienceService.ts";

const router = Router();

router.use(requireAdmin);

router.get("/master-admin/clients", (_req, res) => {
  res.json({ ok: true, clients: listAdminClientPharmacies() });
});

router.post("/master-admin/clients/preview-slug", (req, res) => {
  const name = String(req.body?.pharmacyName || "").trim();
  if (!name) {
    return res.status(400).json({ ok: false, error: "Pharmacy name is required" });
  }
  const slug = previewAdminClientSlug(name);
  res.json({ ok: true, slug, available: adminClientSlugAvailable(slug) });
});

router.post("/master-admin/clients", (req, res) => {
  try {
    const input = req.body as AdminClientCreateInput;
    const result = createAdminPharmacyClient(input);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/master-admin/portfolio", (req, res) => {
  const stage = String(req.query.stage || "all");
  const search = String(req.query.search || "");
  const includeArchived = req.query.includeArchived === "1";
  const portfolio = buildMasterAdminPortfolio({
    stage: stage as "all" | "onboarding" | "building" | "growing" | "published" | "needs_attention",
    search,
    includeArchived,
  });
  res.json({ ok: true, ...portfolio, services: getAvailableServicesForWizard() });
});

router.get("/master-admin/pharmacies/:slug", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const card = buildMasterAdminClientCard(slug);
  if (!card) {
    return res.status(404).json({ ok: false, error: "Pharmacy not found" });
  }
  res.json({ ok: true, client: card });
});

router.post("/master-admin/pharmacies/preview-slug", (req, res) => {
  const name = String(req.body?.pharmacyName || "").trim();
  const slug = req.body?.slug
    ? safeAdminSlug(String(req.body.slug))
    : resolveUniqueSlug(slugFromPharmacyName(name || "pharmacy"));
  res.json({ ok: true, slug, available: Boolean(slug) });
});

router.post("/master-admin/pharmacies/discover-areas", (req, res) => {
  const town = String(req.body?.town || req.body?.primaryTown || "").trim();
  const limit = Number(req.body?.limit || 10);
  if (!town) {
    return res.status(400).json({ ok: false, error: "Primary town is required" });
  }
  try {
    const areas = discoverAreasForWizard(town, limit);
    res.json({ ok: true, town, areas });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err) });
  }
});

router.post("/master-admin/pharmacies/preview", (req, res) => {
  const input = req.body as CreatePharmacyWizardInput;
  res.json({ ok: true, preview: previewWizardSummary(input) });
});

router.post("/master-admin/pharmacies", async (req, res) => {
  try {
    const input = req.body as CreatePharmacyWizardInput;
    const result = await createPharmacyWorkspace({
      ...input,
      growthPlanTier: (input.growthPlanTier || "starter") as GrowthPlanTier,
      isDemo: input.isDemo === true,
    });
    res.json({ ok: true, verified: true, ...result });
  } catch (err) {
    if (err instanceof WorkspaceProvisioningError) {
      return res.status(422).json({
        ok: false,
        verified: false,
        error: err.message,
        provisioningReport: err.report,
      });
    }
    res.status(400).json({ ok: false, verified: false, error: String(err) });
  }
});

router.post("/master-admin/pharmacies/:slug/archive", (req, res) => {
  try {
    const entry = archivePharmacyClient(req.params.slug);
    res.json({ ok: true, entry });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err) });
  }
});

router.delete("/master-admin/pharmacies/:slug", (req, res) => {
  try {
    const result = deleteDemoPharmacyClient(req.params.slug);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err) });
  }
});

export default router;
