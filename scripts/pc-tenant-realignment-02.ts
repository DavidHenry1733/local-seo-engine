/**
 * PC-TENANT-REALIGNMENT-02 — controlled realignment of canonical pharmaconnect tenant.
 * Does not touch _archive/pharmaconnect/pre-commercial-realignment-01 or Leeds Pharmacy.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  restoreArchivedPharmacyClient,
  readMasterAdminRegistry,
  safeAdminSlug,
} from "../src/pharmacy/pharmacyMasterAdminService.ts";
import {
  readSetupProfile,
  writeSetupProfile,
} from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { normalizeProfileData, PROFILE_SCHEMA_VERSION } from "../src/pharmacy/pharmacyProfileSchema.ts";
import { writePharmacyCampaignStore } from "../src/pharmacy/pharmacyCampaignService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SLUG = "pharmaconnect";
const ARCHIVE_ROOT = path.join(ROOT, "_archive/pharmaconnect/pre-commercial-realignment-01");

const COMMERCIAL_SERVICES = [
  {
    id: "pharmacy-website-design",
    serviceName: "Pharmacy Website Design",
    description: "Professional website design built specifically for community pharmacies.",
  },
  {
    id: "pharmacy-local-seo",
    serviceName: "Pharmacy Local SEO",
    description: "Local search optimisation to help pharmacies attract nearby patients.",
  },
  {
    id: "pharmacy-email-marketing",
    serviceName: "Pharmacy Email Marketing",
    description: "Email marketing support for pharmacy patient communication and growth.",
  },
  {
    id: "pharmacy-website-hosting",
    serviceName: "Pharmacy Website Hosting",
    description: "Secure website hosting for community pharmacy websites.",
  },
  {
    id: "pharmacy-growth-audits",
    serviceName: "Pharmacy Growth Audits",
    description: "Digital growth audits for community pharmacy visibility and conversion.",
  },
] as const;

function assertArchiveImmutable(): void {
  if (!fs.existsSync(ARCHIVE_ROOT)) {
    throw new Error(`Preservation snapshot missing: ${ARCHIVE_ROOT}`);
  }
  const manifest = path.join(ARCHIVE_ROOT, "MANIFEST.json");
  if (!fs.existsSync(manifest)) {
    throw new Error(`Preservation manifest missing: ${manifest}`);
  }
}

function rmPath(target: string): void {
  if (!fs.existsSync(target)) return;
  // Never touch the preservation snapshot.
  const resolved = path.resolve(target);
  if (resolved === path.resolve(ARCHIVE_ROOT) || resolved.startsWith(path.resolve(ARCHIVE_ROOT) + path.sep)) {
    throw new Error(`Refusing to modify preservation snapshot: ${target}`);
  }
  if (resolved.includes(`${path.sep}leeds-pharmacy`) || resolved.endsWith(`${path.sep}leeds-pharmacy`)) {
    throw new Error(`Refusing to modify Leeds Pharmacy path: ${target}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}

function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

function loadProjectConfig(): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "config/projects/pharmaconnect.json"), "utf8")) as Record<
    string,
    unknown
  >;
}

function clearContaminatedRuntimeArtifacts(): string[] {
  const removed: string[] = [];
  const targets = [
    // Intelligence / competitors / growth
    "data/pharmacy-competitor-intelligence/pharmaconnect.json",
    "data/pharmacy-competitor-intelligence/pharmaconnect-intelligence.json",
    "data/pharmacy-competitor-intelligence/pharmaconnect-gap-analysis.json",
    "data/pharmacy-competitor-intelligence/pharmaconnect-dashboard.json",
    "artifacts/data/pharmacy-competitor-intelligence/pharmaconnect.json",
    "artifacts/data/pharmacy-competitor-intelligence/pharmaconnect-intelligence.json",
    "data/pharmacy-intelligence/pharmaconnect.json",
    "data/pharmacy-local-intelligence/pharmaconnect.json",
    "data/pharmacy-opportunity-engine/pharmaconnect.json",
    "data/pharmacy-opportunity-engine/pharmaconnect-dashboard.json",
    "data/pharmacy-growth-journey/pharmaconnect.json",
    "data/pharmacy-growth-actions/pharmaconnect.json",
    "artifacts/data/pharmacy-growth-actions/pharmaconnect.json",
    "data/pharmacy-executive-dashboard/pharmaconnect.json",
    "artifacts/data/pharmacy-executive-dashboard/pharmaconnect.json",
    "data/pharmacy-visibility/pharmaconnect.json",
    "data/pharmacy-indexing/pharmaconnect.json",
    "data/pharmacy-registry/pharmaconnect.json",
    "data/pharmacy-publishing-settings/pharmaconnect.json",
    "artifacts/data/pharmacy-publishing-settings/pharmaconnect.json",
    "data/pharmacy-campaign-launch-queue/pharmaconnect.json",
    "artifacts/data/pharmacy-campaign-launch-queue/pharmaconnect.json",
    "data/pharmacy-asset-workflow/pharmaconnect.json",
    "data/pharmacy-authority-readiness/pharmaconnect.json",
    "data/pharmacy-authority-enhancements/pharmaconnect.json",
    "data/pharmacy-enhancement-workspace/pharmaconnect.json",
    "artifacts/data/pharmacy-enhancement-workspace/pharmaconnect.json",
    "data/pharmacy-quality-audit/pharmaconnect.json",
    "data/pharmacy-human-readability-audit/pharmaconnect.json",
    "data/pharmacy-human-quality-audit-v2/pharmaconnect.json",
    "data/pharmacy-image-assignments/pharmaconnect.json",
    "data/pharmacy-content-image-placeholders/pharmaconnect.json",
    "data/pharmacy-content-blueprints/pharmaconnect-demo-pharmacy.json",
    "data/growth-engine/pharmaconnect-opportunities.json",
    "data/growth-engine/pharmaconnect-cycles.json",
    "data/growth-engine/pharmaconnect-campaign-builder.json",
    "data/growth-engine/pharmaconnect-review-centre.json",
    "data/growth-engine/pharmaconnect-workflow.json",
    // Generation / locality packs
    "data/pharmacy-content-packages/pharmaconnect",
    "data/pharmacy-generation-reports/pharmaconnect",
    "data/pharmacy-service-hubs/pharmaconnect",
    "data/pharmacy-generated-service-pages/pharmaconnect",
    "data/pharmacy-generated-service-area-pages/pharmaconnect",
    "data/pharmacy-local-relevance-packs/pharmaconnect",
    "data/pharmacy-area-personas/pharmaconnect",
    "data/pharmacy-area-narratives/pharmaconnect",
    "data/pharmacy-area-differentiation/pharmaconnect",
    "data/pharmacy-master-admin/canonical-ecosystem-plans/pharmaconnect",
    "data/pharmacy-master-admin/active-service-campaign/pharmaconnect.json",
    // Prepared / preview output
    "output/pharmacy-publish/pharmaconnect",
    "output/pharmacy-content-ecosystem/pharmaconnect",
    "output/pharmacy-area-preview-v1/pharmaconnect",
    "output/pharmacy-master-publish/pharmaconnect",
    "output/pharmacy-visual-experience/pharmaconnect",
    "output/pharmacy-preview-v2/pharmaconnect",
    "output/pharmacy-hub-preview-v1/pharmaconnect",
    "output/pharmaconnect",
    "output/pharmaconnect-demo-pharmacy",
  ];

  for (const rel of targets) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    rmPath(abs);
    removed.push(rel);
  }
  return removed;
}

function writeCleanCommercialServiceLibrary(): void {
  const now = new Date().toISOString();
  const doc = {
    slug: SLUG,
    updatedAt: now,
    analysedAt: null,
    maxAreas: 8,
    selectedServices: COMMERCIAL_SERVICES.map((s) => s.id),
    recommendedServices: [] as string[],
    services: COMMERCIAL_SERVICES.map((s) => ({
      id: s.id,
      category: "pharmacy-digital-growth",
      serviceName: s.serviceName,
      description: s.description,
      enabled: true,
      selected: true,
      recommended: false,
    })),
  };
  writeJson(path.join(ROOT, "data/pharmacy-service-library/pharmaconnect.json"), doc);
}

function writeCleanCampaignStore(): void {
  writePharmacyCampaignStore({
    version: 1,
    slug: SLUG,
    updatedAt: new Date().toISOString(),
    campaigns: [],
  } as any);
}

function writeEmptyRegistryAndIndexing(): void {
  const now = new Date().toISOString();
  writeJson(path.join(ROOT, "data/pharmacy-registry/pharmaconnect.json"), {
    version: 1,
    slug: SLUG,
    generatedAt: now,
    pages: [],
  });
  writeJson(path.join(ROOT, "data/pharmacy-indexing/pharmaconnect.json"), {
    version: 1,
    slug: SLUG,
    totalRegistered: 0,
    readyToSubmit: 0,
    submitted: 0,
    indexed: 0,
    notIndexed: 0,
    failed: 0,
    sitemapUrl: null,
    lastUpdated: now,
  });
}

function writeMinimalGrowthEngineStartState(): void {
  const now = new Date().toISOString();
  writeJson(path.join(ROOT, "data/growth-engine/pharmaconnect-workflow.json"), {
    version: 1,
    acknowledgements: {},
    lastOperator: null,
  });
  writeJson(path.join(ROOT, "data/growth-engine/pharmaconnect-campaign-builder.json"), {
    version: 1,
    slug: SLUG,
    updatedAt: now,
    step: null,
    selectedServiceId: null,
    mode: null,
    assetSelection: {},
    generationStartedAt: null,
    generationCompletedAt: null,
    approvedAssets: [],
  });
  writeJson(path.join(ROOT, "data/growth-engine/pharmaconnect-review-centre.json"), {
    version: 1,
    slug: SLUG,
    updatedAt: now,
    campaigns: [],
  });
  writeJson(path.join(ROOT, "data/growth-engine/pharmaconnect-cycles.json"), {
    version: 1,
    slug: SLUG,
    updatedAt: now,
    cycles: [],
  });
  // No current opportunities / growth plan evidence.
  writeJson(path.join(ROOT, "data/growth-engine/pharmaconnect-opportunities.json"), {
    version: 1,
    slug: SLUG,
    generatedAt: null,
    overview: { total: 0, high: 0, medium: 0, low: 0 },
    opportunities: [],
    missingContent: [],
    localVisibility: [],
    roadmap: [],
    readyToBuild: null,
    websiteAnalysisPlaceholders: [],
    dataSources: [],
    status: "NOT_RUN",
  });
}

function writeMinimumCommercialProfile(project: Record<string, unknown>): void {
  const navItems = Array.isArray(project.navItems) ? project.navItems : [];
  const footerLinks = Array.isArray(project.footerLinks) ? project.footerLinks : [];
  const branding = (project.branding || {}) as Record<string, unknown>;

  const clean = normalizeProfileData({
    pharmacyName: "PharmaConnect",
    tradingName: "PharmaConnect",
    companyName: String(project.legalName || "DHM Digital Limited"),
    companyRegistrationNumber: String(project.companyNumber || ""),
    website: "https://pharmaconnect.uk/",
    phone: String(project.phone || ""),
    email: String(project.email || "support@pharmaconnect.uk"),
    businessEmail: String(project.email || "support@pharmaconnect.uk"),
    addressLine1: "Moorgate Crofts Business Centre",
    addressLine2: "South Grove",
    primaryTown: "Rotherham",
    townCity: "Rotherham",
    postcode: "S60 2DH",
    county: "South Yorkshire",
    country: "United Kingdom",
    platformClientStatus: "setup_required",
    independentPharmacy: false,
    demoMode: false,
    tone: String(project.toneOfVoice || "professional"),
    logoUrl: String(project.logoUrl || ""),
    headerLogoUrl: String(project.logoUrl || ""),
    footerLogoUrl: String(project.logoUrl || ""),
    brandPrimaryColor: String(branding.primaryColor || project.brandColour || "#005eb8"),
    brandAccentColor: String(branding.accentColor || "#1ca9c9"),
    brandCtaColor: "#f59e0b",
    brandBackgroundColor: "#ffffff",
    brandTextColor: "#1f2933",
    selectedServices: COMMERCIAL_SERVICES.map((s) => s.id),
    priorityServices: COMMERCIAL_SERVICES.map((s) => s.id),
    detectedWebsiteServices: [],
    coverageAreas: Array.isArray(project.serviceAreas) ? project.serviceAreas.map(String) : [],
    rankingAreas: [],
    nearbyAreas: [],
    selectedAreas: [],
    manualAreas: [],
    localAreas: [],
    websiteImportSnapshot: null,
    websiteImportedFieldKeys: [],
    websiteAnalysisSourceUrl: "",
    websiteAnalysisAt: "",
    googlePlaceId: "",
    googleBusinessProfileUrl: "",
    googleMapsEmbedUrl: "",
    gphcNumber: "",
    nhsProfileUrl: "",
    reviewerName: "",
    superintendentPharmacistName: "",
    superintendentName: "",
    pharmacyOwnerName: "",
    uniqueSellingPoints: [],
    targetPatientGroups: [],
    mainCompetitors: [],
    preferredCta: String(project.primaryCtaText || "Request a Free Pharmacy Audit"),
    headerCtaText: String(project.primaryCtaText || "Request a Free Pharmacy Audit"),
    headerCtaUrl: String(project.primaryCtaUrl || "https://pharmaconnect.uk/contact-us/"),
    primaryGrowthGoal: String(project.mainService || "Pharmacy Digital Growth"),
    headerNavLinks: navItems.map((item: any, index: number) => ({
      label: String(item.label || ""),
      url: String(item.href || ""),
      order: index + 1,
      visible: true,
    })),
    footerLinks: footerLinks.map((item: any, index: number) => ({
      label: String(item.label || ""),
      url: String(item.href || ""),
      order: index + 1,
    })),
    footerCompanyNumber: String(project.companyNumber || ""),
    footerPrivacyPolicyUrl: String(project.privacyUrl || ""),
    footerTermsUrl: String(project.termsUrl || ""),
    trustDataStatus: "incomplete",
  });

  writeSetupProfile(SLUG, clean, { bumpPresentationRevision: true });
}

function syncRegistryBusinessName(): void {
  const registryPath = path.join(ROOT, "data/pharmacy-master-admin/registry.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8")) as {
    version?: number;
    updatedAt?: string;
    clients: Array<Record<string, unknown>>;
  };
  const idx = registry.clients.findIndex((c) => c.slug === SLUG);
  if (idx < 0) throw new Error("pharmaconnect registry entry missing after restore");
  registry.clients[idx] = {
    ...registry.clients[idx],
    pharmacyName: "PharmaConnect",
    updatedAt: new Date().toISOString(),
    archived: false,
    archivedAt: undefined,
  };
  // Ensure no duplicate active PharmaConnect tenants were introduced.
  const duplicates = registry.clients.filter(
    (c) => c.slug !== SLUG && String(c.pharmacyName || "").toLowerCase() === "pharmaconnect" && !c.archived,
  );
  if (duplicates.length) {
    throw new Error(`Unexpected duplicate PharmaConnect tenants: ${duplicates.map((d) => d.slug).join(",")}`);
  }
  registry.updatedAt = new Date().toISOString();
  writeJson(registryPath, registry);
}

function main(): void {
  assertArchiveImmutable();
  const project = loadProjectConfig();

  const restored = restoreArchivedPharmacyClient(SLUG);
  if (restored.archived) throw new Error("Restore failed — tenant still archived");

  const removed = clearContaminatedRuntimeArtifacts();
  writeCleanCommercialServiceLibrary();
  writeCleanCampaignStore();
  writeEmptyRegistryAndIndexing();
  writeMinimalGrowthEngineStartState();
  writeMinimumCommercialProfile(project);
  syncRegistryBusinessName();

  const profile = readSetupProfile(SLUG);
  const registry = readMasterAdminRegistry();
  const entry = registry.clients.find((c) => c.slug === safeAdminSlug(SLUG));
  const campaigns = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data/pharmacy-campaigns/pharmaconnect.json"), "utf8"),
  ) as { campaigns?: unknown[] };
  const library = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data/pharmacy-service-library/pharmaconnect.json"), "utf8"),
  ) as { selectedServices?: string[]; services?: Array<{ id: string; selected?: boolean }> };
  const pageReg = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data/pharmacy-registry/pharmaconnect.json"), "utf8"),
  ) as { pages?: unknown[] };
  const indexing = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data/pharmacy-indexing/pharmaconnect.json"), "utf8"),
  ) as Record<string, unknown>;

  const clinicalStillSelected = (library.services || []).some(
    (s) =>
      s.selected &&
      ![
        "pharmacy-website-design",
        "pharmacy-local-seo",
        "pharmacy-email-marketing",
        "pharmacy-website-hosting",
        "pharmacy-growth-audits",
      ].includes(s.id),
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        schemaVersion: PROFILE_SCHEMA_VERSION,
        tenant: {
          slug: SLUG,
          archived: Boolean(entry?.archived),
          registryName: entry?.pharmacyName,
          profileName: profile.pharmacyName,
          website: profile.website,
        },
        commercialServices: library.selectedServices,
        clinicalStillSelected,
        campaigns: (campaigns.campaigns || []).length,
        registryPages: (pageReg.pages || []).length,
        indexing,
        removedCount: removed.length,
        removedSample: removed.slice(0, 40),
        archiveIntact: fs.existsSync(path.join(ARCHIVE_ROOT, "MANIFEST.json")),
        projectBusinessType: project.businessType,
        projectMainService: project.mainService,
        appDomain: project.appDomain,
      },
      null,
      2,
    ),
  );
}

main();
