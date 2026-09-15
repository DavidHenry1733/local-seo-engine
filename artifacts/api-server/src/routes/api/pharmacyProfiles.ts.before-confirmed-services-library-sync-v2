import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import {
  auditPharmacyProfile,
  normalizeProfileData,
  normalizeProfileDoc,
  PROFILE_SCHEMA_VERSION,
} from "../../../../../src/pharmacy/pharmacyProfileSchema.ts";
import { computeProfileCompleteness } from "../../../../../src/pharmacy/pharmacyProfileCompleteness.ts";
import { computeRequiredProfileCompleteness } from "../../../../../src/pharmacy/pharmacyProfileFieldClassification.ts";
import { computeWizardQualityScore } from "../../../../../src/pharmacy/pharmacyProfileWizardScoring.ts";
import { validateWizardStep } from "../../../../../src/pharmacy/pharmacyProfileWizardSteps.ts";
import { buildPlatformOperatingSystem } from "../../../../../src/pharmacy/pharmacyPlatformOperatingSystemService.ts";
import { resolveGoogleMapsEmbedUrlFromData } from "../../../../../src/pharmacy/pharmacyServicePageProfileContext.ts";
import { refreshPlatformAfterEnhancementComplete } from "../../../../../src/pharmacy/pharmacyEnhancementWorkspaceService.ts";
import { mapBrandProfileToPharmacyData } from "../../../../../src/pharmacy/pharmacyBrandProfileMapper.ts";
import { mergeWebsiteAnalysisIntoProfile } from "../../../../../src/pharmacy/pharmacyWebsiteAnalysisService.ts";
import type { BrandProfile } from "../../../../../src/generator/brandImporter.ts";
import {
  discoverPharmacyAreas,
} from "../../../../../src/pharmacy/pharmacyAreaDiscoveryService.ts";
import type { ProfileAreaEntry, PharmacyProfileData } from "../../../../../src/pharmacy/pharmacyProfileSchema.ts";
import { resolveTenantProfileSlug } from "../../../../../src/pharmacy/pharmacyTenantSlug.ts";
import { generateProfileLocalIntelligence } from "../../../../../src/pharmacy/pharmacyProfileLocalIntelligenceSelection.ts";
import {
  discoverCompetitors,
  loadPharmacyDiscoveryInput,
} from "../../../../../src/pharmacy/pharmacyCompetitorDiscovery.ts";
import { applyAutoConfirmOnSave } from "../../../../../src/pharmacy/pharmacyProfileWizardEnrichment.ts";
import { mapDiscoveredCompetitorsToProfile } from "../../../../../src/pharmacy/pharmacyProfileWizardEnrichment.ts";
import { autoPopulateGenerationProfileFields } from "../../../../../src/pharmacy/pharmacyProfileGenerationInputCompleteness.ts";
import { recordUploadedTenantLogo } from "../../../../../src/pharmacy/pharmacyTenantBrandIdentityContract.ts";
import { mergeServiceDeliveryProfileMaps } from "../../../../../src/pharmacy/pharmacyProfileV2Fields.ts";

const router = Router();
const ROOT = process.env.WORKSPACE_ROOT ?? "/home/inboxingproweb/pharmaconnect-growth-engine";
const BRAND_PROFILE_DIR = path.join(ROOT, "config", "projects");
const DIR = path.join(ROOT, "data", "pharmacy-profiles");
const LOGO_DIR = path.join(ROOT, "assets", "pharmacy-logos");

function safeSlug(v: string) {
  return String(v || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function resolveProfileSlug(raw: string): string | null {
  return resolveTenantProfileSlug(raw) || (safeSlug(raw) && fs.existsSync(path.join(DIR, `${safeSlug(raw)}.json`)) ? safeSlug(raw) : null);
}

function profileSlugFromRequest(req: import("express").Request, res: import("express").Response): string | null {
  const resolved = resolveProfileSlug(String(req.params.slug || ""));
  if (!resolved) {
    res.status(400).json({ ok: false, error: "Unknown pharmacy slug — select a client from Client Portfolio." });
    return null;
  }
  return resolved;
}

function readProfileFile(slug: string) {
  const resolved = resolveTenantProfileSlug(slug) || slug;
  const file = path.join(DIR, `${resolved}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as {
    slug?: string;
    updatedAt?: string;
    version?: number;
    data?: Record<string, unknown>;
  };
}

router.get("/pharmacy/profile/:slug", (req, res) => {
  fs.mkdirSync(DIR, { recursive: true });
  const slug = profileSlugFromRequest(req, res);
  if (!slug) return;
  const raw = readProfileFile(slug);

  if (!raw) {
    return res.json({ ok: true, exists: false, profile: null });
  }

  const profile = normalizeProfileDoc(slug, raw);
  res.json({
    ok: true,
    exists: true,
    profile,
    audit: auditPharmacyProfile(slug, profile.data),
    completeness: computeProfileCompleteness(profile.data, slug),
    googleMapsEmbedUrl: resolveGoogleMapsEmbedUrlFromData(profile.data),
  });
});

router.get("/pharmacy/profile/:slug/audit", (req, res) => {
  fs.mkdirSync(DIR, { recursive: true });
  const slug = safeSlug(req.params.slug);
  const raw = readProfileFile(slug);

  if (!raw) {
    return res.status(404).json({ ok: false, error: "Saved pharmacy profile not found" });
  }

  const data = normalizeProfileData(raw.data || {});
  res.json({ ok: true, audit: auditPharmacyProfile(slug, data) });
});

router.post("/pharmacy/profile/:slug/audit", (req, res) => {
  const slug = safeSlug(req.params.slug);
  const raw = readProfileFile(slug);
  const mergedRaw = {
    ...(raw?.data || {}),
    ...(req.body || {}),
  };
  const data = normalizeProfileData(mergedRaw);
  res.json({
    ok: true,
    audit: auditPharmacyProfile(slug, data),
    completeness: computeProfileCompleteness(data, slug),
    requiredCompleteness: computeRequiredProfileCompleteness(data),
    googleMapsEmbedUrl: resolveGoogleMapsEmbedUrlFromData(data),
  });
});

router.post("/pharmacy/profile/:slug/wizard-validate", (req, res) => {
  const slug = safeSlug(req.params.slug);
  const raw = readProfileFile(slug);
  const step = Number(req.body?.step) || 1;
  const mergedRaw = {
    ...(raw?.data || {}),
    ...(req.body?.data || {}),
  };
  const data = normalizeProfileData(mergedRaw);
  const error = validateWizardStep(step, data);
  const quality = computeWizardQualityScore(data);
  res.json({
    ok: !error,
    error: error || null,
    wizardQuality: quality,
    requiredCompleteness: computeRequiredProfileCompleteness(data),
  });
});

router.post("/pharmacy/profile/:slug/wizard-enrich-local", async (req, res) => {
  const slug = safeSlug(req.params.slug);
  try {
    const raw = readProfileFile(slug);
    const data = normalizeProfileData(raw?.data || {});
    const discoveryInput = loadPharmacyDiscoveryInput(slug);

    const generated = await generateProfileLocalIntelligence({
      slug,
      address: data.addressLine1,
      postcode: data.postcode,
      townCity: data.townCity || data.primaryTown,
      latitude: discoveryInput.latitude ?? undefined,
      longitude: discoveryInput.longitude ?? undefined,
      demoMode: data.demoMode,
    });

    const competitors = await discoverCompetitors(slug, {
      ...discoveryInput,
      pharmacyName: data.pharmacyName || discoveryInput.pharmacyName,
      address: data.addressLine1 || discoveryInput.address,
      postcode: data.postcode || discoveryInput.postcode,
      town: data.townCity || data.primaryTown || discoveryInput.town,
    });

    const profileCompetitors = mapDiscoveredCompetitorsToProfile(
      competitors.competitors,
      data.profileCompetitors || [],
    );

    const localIntelligenceCandidates = { ...generated.groups };
    const enrichedAt = new Date().toISOString();

    res.json({
      ok: true,
      slug,
      source: generated.source,
      researchStatus: generated.researchStatus,
      groups: generated.groups,
      totals: generated.totals,
      localIntelligenceCandidates,
      profileCompetitors,
      profileWizardEnrichedAt: enrichedAt,
      competitorSource: competitors.source,
    });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/pharmacy/profile/:slug", (req, res) => {
  fs.mkdirSync(DIR, { recursive: true });
  const slug = profileSlugFromRequest(req, res);
  if (!slug) return;
  const file = path.join(DIR, `${slug}.json`);

  const existing = readProfileFile(slug);
  const body = req.body || {};
  const existingData = existing?.data || {};
  const mergedRaw = {
    ...existingData,
    ...body,
    serviceDeliveryProfiles: mergeServiceDeliveryProfileMaps(
      existingData.serviceDeliveryProfiles,
      body.serviceDeliveryProfiles !== undefined
        ? body.serviceDeliveryProfiles
        : existingData.serviceDeliveryProfiles,
    ),
  };

  const autoPopulated = autoPopulateGenerationProfileFields(applyAutoConfirmOnSave(mergedRaw as PharmacyProfileData)).data;
  const profile = {
    slug,
    updatedAt: new Date().toISOString(),
    version: PROFILE_SCHEMA_VERSION,
    data: normalizeProfileData(autoPopulated),
  };

  fs.writeFileSync(file, JSON.stringify(profile, null, 2));
  const refresh = refreshPlatformAfterEnhancementComplete(slug);
  const os = buildPlatformOperatingSystem(slug);
  const requiredCompleteness = computeRequiredProfileCompleteness(profile.data);
  const wizardQuality = computeWizardQualityScore(profile.data);
  res.json({
    ok: true,
    saved: true,
    profile,
    audit: auditPharmacyProfile(slug, profile.data),
    completeness: computeProfileCompleteness(profile.data, slug),
    requiredCompleteness,
    wizardQuality,
    nextStep: os.nextStep,
    growthProgrammeUrl: `/api/pharmacy-dashboard?slug=${encodeURIComponent(slug)}`,
    googleMapsEmbedUrl: resolveGoogleMapsEmbedUrlFromData(profile.data),
    refresh,
  });
});

router.post("/pharmacy/profile/:slug/discover-areas", (req, res) => {
  const slug = safeSlug(req.params.slug);
  try {
    const town = String(req.body?.town || "").trim();
    const limit = Number(req.body?.limit || 10);
    const preserveSelection = Array.isArray(req.body?.preserveSelection)
      ? (req.body.preserveSelection as ProfileAreaEntry[])
      : undefined;

    const discovery = discoverPharmacyAreas({ town, limit, preserveSelection });
    res.json({ ok: true, slug, discovery });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy/profile/:slug/save-areas", (req, res) => {
  fs.mkdirSync(DIR, { recursive: true });
  const slug = profileSlugFromRequest(req, res);
  if (!slug) return;
  const file = path.join(DIR, `${slug}.json`);
  const existing = readProfileFile(slug);
  const existingData = normalizeProfileData(existing?.data || {});

  const primaryTown = String(req.body?.primaryTown || req.body?.town || existingData.primaryTown || "").trim();
  const selectedAreas = Array.isArray(req.body?.selectedAreas)
    ? (req.body.selectedAreas as ProfileAreaEntry[])
    : existingData.selectedAreas;
  const manualAreas = Array.isArray(req.body?.manualAreas)
    ? req.body.manualAreas.map(String)
    : existingData.manualAreas;

  const profile = {
    slug,
    updatedAt: new Date().toISOString(),
    version: PROFILE_SCHEMA_VERSION,
    data: normalizeProfileData({
      ...existingData,
      primaryTown,
      primaryCity: primaryTown,
      townCity: primaryTown || existingData.townCity,
      selectedAreas,
      manualAreas,
      areaDiscoverySource: String(req.body?.areaDiscoverySource || existingData.areaDiscoverySource),
      areaDiscoveryUpdatedAt: String(req.body?.areaDiscoveryUpdatedAt || existingData.areaDiscoveryUpdatedAt),
    }),
  };

  fs.writeFileSync(file, JSON.stringify(profile, null, 2));
  res.json({
    ok: true,
    saved: true,
    profile,
    audit: auditPharmacyProfile(slug, profile.data),
    completeness: computeProfileCompleteness(profile.data, slug),
  });
});

function loadBrandProfile(slug: string): BrandProfile | null {
  const file = path.join(BRAND_PROFILE_DIR, slug, "brand-profile.json");
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as BrandProfile;
  } catch {
    return null;
  }
}

function saveBrandProfile(slug: string, brand: BrandProfile): string {
  const dir = path.join(BRAND_PROFILE_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "brand-profile.json");
  fs.writeFileSync(file, JSON.stringify({ ...brand, approved: true }, null, 2));
  return file;
}

router.post("/pharmacy/profile/:slug/analyze-website", async (req, res) => {
  const slug = safeSlug(req.params.slug);
  const url = String(req.body?.websiteUrl || req.body?.url || "").trim();
  if (!url) {
    return res.status(400).json({ ok: false, error: "Website URL is required" });
  }

  try {
    const existing = normalizeProfileData(readProfileFile(slug)?.data || {});
    const { analyzeWebsiteForPharmacy } = await import(
      "../../../../../src/pharmacy/pharmacyWebsiteAnalysisService.ts"
    );
    const analysis = await analyzeWebsiteForPharmacy(url, existing);

    saveBrandProfile(slug, { ...analysis.brand, approved: false });

    res.json({
      ok: true,
      slug,
      analysis,
      brandProfilePath: path.join(BRAND_PROFILE_DIR, slug, "brand-profile.json"),
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy/profile/:slug/apply-brand-import", (req, res) => {
  fs.mkdirSync(DIR, { recursive: true });
  const slug = profileSlugFromRequest(req, res);
  if (!slug) return;
  const existing = readProfileFile(slug);
  const existingData = normalizeProfileData(existing?.data || {});

  const brandFromBody = req.body as Partial<BrandProfile> & { analysisPatch?: Partial<PharmacyProfileData>; overwrite?: boolean } | undefined;
  const brand = brandFromBody?.sourceUrl || brandFromBody?.logoUrl || brandFromBody?.primaryColour
    ? ({ ...(loadBrandProfile(slug) || {}), ...brandFromBody, approved: true } as BrandProfile)
    : loadBrandProfile(slug);

  if (!brand) {
    return res.status(404).json({ ok: false, error: "No brand profile found. Run website analysis first." });
  }

  saveBrandProfile(slug, brand);
  const patch = {
    ...mapBrandProfileToPharmacyData(brand, existingData),
    ...(brandFromBody?.analysisPatch || {}),
  };

  if (brand.sourceUrl) {
    patch.websiteAnalysisAt = new Date().toISOString();
    patch.websiteAnalysisSourceUrl = brand.sourceUrl;
  }

  const overwrite = req.body?.overwrite === true;
  const { merged, applied, skipped } = mergeWebsiteAnalysisIntoProfile(patch, existingData, overwrite);
  const mergedRaw = {
    ...existingData,
    ...merged,
    websiteImportedFieldKeys: [...new Set([...(existingData.websiteImportedFieldKeys || []), ...applied])],
  };
  const profile = {
    slug,
    updatedAt: new Date().toISOString(),
    version: PROFILE_SCHEMA_VERSION,
    data: normalizeProfileData(mergedRaw),
  };

  fs.writeFileSync(path.join(DIR, `${slug}.json`), JSON.stringify(profile, null, 2));
  const refresh = refreshPlatformAfterEnhancementComplete(slug);
  res.json({
    ok: true,
    profile,
    patch,
    applied,
    skipped,
    brandProfilePath: path.join(BRAND_PROFILE_DIR, slug, "brand-profile.json"),
    completeness: computeProfileCompleteness(profile.data, slug),
    refresh,
  });
});

const logoUpload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, cb) {
      fs.mkdirSync(LOGO_DIR, { recursive: true });
      cb(null, LOGO_DIR);
    },
    filename(req, file, cb) {
      const slug = safeSlug(req.params.slug);
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = [".png", ".jpg", ".jpeg", ".webp", ".svg"].includes(ext) ? ext : ".png";
      cb(null, `${slug}${safeExt}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (/^image\//.test(file.mimetype) || file.originalname.endsWith(".svg")) cb(null, true);
    else cb(new Error("Logo must be an image file"));
  },
});

router.post("/pharmacy/profile/:slug/logo", (req, res, next) => {
  logoUpload.single("logo")(req, res, (err: unknown) => {
    if (err) return res.status(400).json({ ok: false, error: String(err) });
    next();
  });
}, (req, res) => {
  const slug = safeSlug(req.params.slug);
  if (!req.file) {
    return res.status(400).json({ ok: false, error: "No logo file uploaded" });
  }

  const logoUrl = `/assets/pharmacy-logos/${req.file.filename}`;
  const existing = readProfileFile(slug);
  const mergedRaw = {
    ...(existing?.data || {}),
    logoUrl,
  };

  const profile = {
    slug,
    updatedAt: new Date().toISOString(),
    version: PROFILE_SCHEMA_VERSION,
    data: normalizeProfileData(mergedRaw),
  };

  fs.writeFileSync(path.join(DIR, `${slug}.json`), JSON.stringify(profile, null, 2));
  const brand = recordUploadedTenantLogo(slug, logoUrl);
  res.json({
    ok: true,
    logoUrl,
    profile,
    brand,
    completeness: computeProfileCompleteness(profile.data, slug),
  });
});

export default router;
