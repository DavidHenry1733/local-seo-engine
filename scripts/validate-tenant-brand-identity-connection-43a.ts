#!/usr/bin/env npx tsx
/**
 * TENANT-BRAND-IDENTITY-CONNECTION-43A
 * No-write fixtures against locked Yorkshire campaigns. Does not regenerate or publish.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { renderCustomerSetupConfirmPage } from "../src/pharmacy/growthEngineCustomerSetupConfirmPage.ts";
import { renderPremiumCustomerDashboardPage } from "../src/pharmacy/growthEnginePremiumCustomerDashboardPage.ts";
import { renderReviewCentrePage } from "../src/pharmacy/growthEngineReviewCentrePage.ts";
import {
  COMMERCIAL_BLUE_UI_BASELINE_ID,
  COMMERCIAL_BLUE_UI_TOKENS,
  usesCommercialBlueBaseline,
} from "../src/pharmacy/pharmacyCommercialBlueUiBaseline.ts";
import {
  renderApprovedLocalityPreviewHtml,
  renderBenchmarkPagePreviewHtml,
} from "../src/pharmacy/pharmacyContentEcosystemPreviewRoute.ts";
import { PHARMACONNECT_DESIGN_SYSTEM_V1_COMMERCIAL_LOCK } from "../src/pharmacy/pharmacyDesignSystemV1.ts";
import {
  packageLockedCampaignStagingRelease,
  resolveLockedCampaignStagingInventory,
} from "../src/pharmacy/pharmacyLockedCampaignStagingPublishService.ts";
import {
  TENANT_BRAND_IDENTITY_CONTRACT_ID,
  TENANT_BRAND_IDENTITY_OVERLAY_MARKER,
  isPollutedBlackHex,
  isSafeApprovedAvailableFont,
  loadTenantBrandIdentityRecord,
  recordUploadedTenantLogo,
  resolveTenantBrandIdentity,
  resolveTenantBrandIdentityFromParts,
  type TenantBrandIdentityRecord,
} from "../src/pharmacy/pharmacyTenantBrandIdentityContract.ts";
import {
  extractTenantBrandLogoFromHtml,
  extractTenantBrandOverlayCss,
  extractTenantBrandRevisionFromHtml,
} from "../src/pharmacy/pharmacyTenantBrandPresentationOverlay.ts";
import { getPharmacyTenantBrandIdentityPath } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const FIXTURE_SLUG = "pc-brand-identity-fixture-43a";
const FLU_BANK = "eb79f51391b6b6e5cd0b4ac02d6cbe235306159a8847aa704eb5d64f7f4d1ce3";
const CAMPAIGNS = ["flu-vaccinations", "travel-vaccinations", "pharmacy-first", "blood-pressure-checks"] as const;
const DNA_LOGO =
  "https://yorkshirepharmacyhealthclinic.co.uk/img/Instances/5/1753_20250223210617_1.png";

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}
const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string): void {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} — ${detail}`);
}

function shaFile(file: string): string | null {
  if (!fs.existsSync(file)) return null;
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function shaDir(dir: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const files: string[] = [];
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(dir);
  const hash = crypto.createHash("sha256");
  for (const file of files.sort()) {
    hash.update(path.relative(dir, file));
    hash.update(fs.readFileSync(file));
  }
  return hash.digest("hex");
}

function overlayToken(css: string, name: string): string {
  return (css.match(new RegExp(`--${name}:([^;!]+)`))?.[1] || "").trim();
}

function snapshotIntegrity(): Record<string, string | null> {
  const out: Record<string, string | null> = {
    fluBankFile: shaFile(
      path.join(ROOT, "data/pharmacy-approved-service-banks/banks/flu-vaccinations", `${FLU_BANK}.json`),
    ),
    bankRegistry: shaFile(path.join(ROOT, "data/pharmacy-approved-service-banks/registry.json")),
    stagingCurrent: shaDir(path.join("/var/www/pharmaconnect-sites", SLUG, "current")),
    stagingReleases: shaDir(path.join("/var/www/pharmaconnect-sites", SLUG, "releases")),
  };
  for (const campaign of CAMPAIGNS) {
    out[`approval:${campaign}`] = shaFile(
      path.join(ROOT, "data/pharmacy-master-admin/campaign-approvals", SLUG, `${campaign}.json`),
    );
    out[`service:${campaign}`] = shaFile(
      path.join(ROOT, "output/pharmacy-visual-experience", SLUG, campaign, "index.html"),
    );
    out[`local:${campaign}`] = shaDir(
      path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, campaign),
    );
    out[`bank:${campaign}`] = shaDir(
      path.join(ROOT, "data/pharmacy-approved-service-banks/banks", campaign),
    );
  }
  return out;
}

function confirmedRecord(fields: TenantBrandIdentityRecord["fields"]): TenantBrandIdentityRecord {
  return {
    version: TENANT_BRAND_IDENTITY_CONTRACT_ID,
    slug: SLUG,
    confirmationStatus: "confirmed",
    confirmedAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
    uploadedLogoUrl: "",
    fields,
  };
}

function main(): void {
  const before = snapshotIntegrity();
  const yorkshire = resolveTenantBrandIdentity(SLUG);
  const overlayCss = extractTenantBrandOverlayCss(
    renderBenchmarkPagePreviewHtml(
      path.join(ROOT, "output/pharmacy-visual-experience", SLUG, "flu-vaccinations", "index.html"),
      "flu-vaccinations",
      SLUG,
      "service-page",
    ),
  );
  const profile = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data/pharmacy-profiles", `${SLUG}.json`), "utf8"),
  ) as { data?: { brandHeaderBackgroundColor?: string; brandFooterBackgroundColor?: string } };
  const header = String(profile.data?.brandHeaderBackgroundColor || "");
  const footer = String(profile.data?.brandFooterBackgroundColor || "");

  record(
    "imported-evidence",
    yorkshire.logoUrl.source === "brand-dna" &&
      yorkshire.logoUrl.value === DNA_LOGO &&
      yorkshire.logoUrl.confidence === 90 &&
      yorkshire.primaryColor.source === "brand-dna" &&
      yorkshire.primaryColor.value.toLowerCase() === "#005eb8" &&
      yorkshire.secondaryColor.source === "brand-dna" &&
      yorkshire.headingFont.value === "Poppins" &&
      yorkshire.bodyFont.value === "Inter" &&
      yorkshire.contractId === TENANT_BRAND_IDENTITY_CONTRACT_ID &&
      yorkshire.confirmationStatus === "unconfirmed",
    `logo=${yorkshire.logoUrl.source}/${yorkshire.logoUrl.confidence} primary=${yorkshire.primaryColor.value}/${yorkshire.primaryColor.source} fonts=${yorkshire.headingFont.value}/${yorkshire.bodyFont.value}`,
  );

  const confirmed = resolveTenantBrandIdentityFromParts({
    slug: SLUG,
    stored: confirmedRecord({
      logoUrl: "https://example.test/confirmed-logo.png",
      primaryColor: "#112233",
      secondaryColor: "#445566",
      accentColor: "#778899",
      headingFont: "Inter",
      bodyFont: "Poppins",
    }),
  });
  record(
    "confirmed-precedence",
    confirmed.logoUrl.source === "po-confirmed" &&
      confirmed.logoUrl.value === "https://example.test/confirmed-logo.png" &&
      confirmed.primaryColor.source === "po-confirmed" &&
      confirmed.primaryColor.value.toLowerCase() === "#112233" &&
      confirmed.headingFont.source === "po-confirmed" &&
      confirmed.headingFont.value === "Inter" &&
      confirmed.bodyFont.value === "Poppins",
    `logo=${confirmed.logoUrl.source} primary=${confirmed.primaryColor.value} heading=${confirmed.headingFont.value}`,
  );

  const polluted = resolveTenantBrandIdentityFromParts({
    slug: SLUG,
    stored: confirmedRecord({
      logoUrl: DNA_LOGO,
      primaryColor: "#000000",
      secondaryColor: "#000",
      accentColor: "#000000",
      headingFont: "Poppins",
      bodyFont: "Inter",
    }),
  });
  record(
    "polluted-defaults-excluded",
    isPollutedBlackHex(header) &&
      isPollutedBlackHex(footer) &&
      polluted.primaryColor.source === "brand-dna" &&
      polluted.primaryColor.value.toLowerCase() !== "#000000" &&
      !/#000000|#000\b/i.test(overlayCss) &&
      overlayToken(overlayCss, "brand-primary").toLowerCase() === yorkshire.primaryColor.value.toLowerCase(),
    `profileHeader=${header} overlayPrimary=${overlayToken(overlayCss, "brand-primary")} pollutedResolved=${polluted.primaryColor.source}/${polluted.primaryColor.value}`,
  );

  const fixturePath = getPharmacyTenantBrandIdentityPath(FIXTURE_SLUG);
  try {
    const uploaded = recordUploadedTenantLogo(FIXTURE_SLUG, `/assets/pharmacy-logos/${FIXTURE_SLUG}.png`);
    const stored = loadTenantBrandIdentityRecord(FIXTURE_SLUG);
    const profilesRoute = fs.readFileSync(
      path.join(ROOT, "artifacts/api-server/src/routes/api/pharmacyProfiles.ts"),
      "utf8",
    );
    record(
      "logo-upload-persistence",
      uploaded.logoUrl.source === "uploaded-tenant-asset" &&
        stored?.uploadedLogoUrl === `/assets/pharmacy-logos/${FIXTURE_SLUG}.png` &&
        profilesRoute.includes("recordUploadedTenantLogo") &&
        profilesRoute.includes('router.post("/pharmacy/profile/:slug/logo"'),
      `source=${uploaded.logoUrl.source} stored=${stored?.uploadedLogoUrl || "none"}`,
    );
  } finally {
    if (fs.existsSync(fixturePath)) fs.unlinkSync(fixturePath);
  }

  const unsafe = resolveTenantBrandIdentityFromParts({
    slug: SLUG,
    stored: confirmedRecord({
      logoUrl: DNA_LOGO,
      primaryColor: "#005EB8",
      secondaryColor: "#00478a",
      accentColor: "#1CA9C9",
      headingFont: "Comic Sans MS",
      bodyFont: "https://unverified.example/font.woff2",
    }),
  });
  record(
    "safe-font-fallback",
    !isSafeApprovedAvailableFont("Comic Sans MS") &&
      unsafe.headingFont.value === "Poppins" &&
      unsafe.bodyFont.value === "Inter" &&
      unsafe.headingFont.source !== "po-confirmed" &&
      unsafe.bodyFont.source !== "po-confirmed" &&
      /Poppins/.test(unsafe.googleFontsHref) &&
      /Inter/.test(unsafe.googleFontsHref) &&
      !/Comic/i.test(unsafe.googleFontsHref),
    `heading=${unsafe.headingFont.value}/${unsafe.headingFont.source} body=${unsafe.bodyFont.value}/${unsafe.bodyFont.source}`,
  );

  const previewParity: string[] = [];
  const stagingParity: string[] = [];
  const schemaOk: string[] = [];
  for (const campaign of CAMPAIGNS) {
    const serviceFile = path.join(ROOT, "output/pharmacy-visual-experience", SLUG, campaign, "index.html");
    const localityFile = path.join(
      ROOT,
      "output/pharmacy-content-ecosystem",
      SLUG,
      campaign,
      "local/darfield/index.html",
    );
    const sourceService = fs.readFileSync(serviceFile, "utf8");
    const sourceLocality = fs.readFileSync(localityFile, "utf8");
    const servicePreview = renderBenchmarkPagePreviewHtml(serviceFile, campaign, SLUG, "service-page");
    const localityPreview = renderApprovedLocalityPreviewHtml(sourceLocality, {
      slug: SLUG,
      serviceId: campaign,
      localitySlug: "darfield",
    });
    const inventory = resolveLockedCampaignStagingInventory(SLUG, campaign);
    const packed = packageLockedCampaignStagingRelease(inventory);
    if (!packed.ok) {
      stagingParity.push(`${campaign}: ${packed.blockers.join("; ")}`);
      continue;
    }
    const stagingService =
      packed.pkg.files.find((f) => f.relativePath === `${campaign}/index.html`)?.contents.toString("utf8") || "";
    const stagingLocality =
      packed.pkg.files.find((f) => f.relativePath === `${campaign}/local/darfield/index.html`)?.contents.toString(
        "utf8",
      ) || "";
    const serviceCss = extractTenantBrandOverlayCss(servicePreview);
    const localityCss = extractTenantBrandOverlayCss(localityPreview);
    const stagingCss = extractTenantBrandOverlayCss(stagingService);
    const revision = yorkshire.revision;
    const sameTokens =
      extractTenantBrandRevisionFromHtml(servicePreview) === revision &&
      extractTenantBrandRevisionFromHtml(localityPreview) === revision &&
      overlayToken(serviceCss, "brand-primary") === overlayToken(localityCss, "brand-primary") &&
      overlayToken(serviceCss, "brand-secondary") === overlayToken(localityCss, "brand-secondary") &&
      overlayToken(serviceCss, "brand-accent") === overlayToken(localityCss, "brand-accent") &&
      overlayToken(serviceCss, "brand-font-heading") === overlayToken(localityCss, "brand-font-heading") &&
      overlayToken(serviceCss, "brand-font-body") === overlayToken(localityCss, "brand-font-body");
    if (!sameTokens) previewParity.push(campaign);
    const stagingSame =
      packed.pkg.brandRevision === revision &&
      extractTenantBrandRevisionFromHtml(stagingService) === revision &&
      extractTenantBrandRevisionFromHtml(stagingLocality) === revision &&
      overlayToken(stagingCss, "brand-primary") === overlayToken(serviceCss, "brand-primary") &&
      extractTenantBrandLogoFromHtml(stagingService) === yorkshire.logoUrl.value &&
      extractTenantBrandLogoFromHtml(servicePreview) === yorkshire.logoUrl.value &&
      stagingService.includes(TENANT_BRAND_IDENTITY_OVERLAY_MARKER) &&
      stagingLocality.includes(TENANT_BRAND_IDENTITY_OVERLAY_MARKER);
    if (!stagingSame) stagingParity.push(campaign);
    const schema =
      sourceService.includes('<script type="application/ld+json">') &&
      servicePreview.includes('<script type="application/ld+json">') &&
      localityPreview.includes('<script type="application/ld+json">') &&
      stagingService.includes('<script type="application/ld+json">') &&
      stagingLocality.includes('<script type="application/ld+json">') &&
      !sourceService.includes(TENANT_BRAND_IDENTITY_OVERLAY_MARKER) &&
      !sourceLocality.includes(TENANT_BRAND_IDENTITY_OVERLAY_MARKER);
    if (!schema) schemaOk.push(campaign);
  }
  record(
    "preview-staging-parity",
    previewParity.length === 0 && stagingParity.length === 0,
    previewParity.length || stagingParity.length
      ? `preview=${previewParity.join(",") || "ok"} staging=${stagingParity.join(",") || "ok"}`
      : "service/locality/staging share overlay tokens, logo and revision on all four campaigns",
  );

  const confirmHtml = renderCustomerSetupConfirmPage(SLUG);
  record(
    "brand-review-ui",
    confirmHtml.includes('data-brand-review="v1"') &&
      confirmHtml.includes("Brand Review") &&
      confirmHtml.includes("brandLogoPreview") &&
      confirmHtml.includes("brandPrimaryColor") &&
      confirmHtml.includes("brandHeadingFont") &&
      confirmHtml.includes("brandFontPreview") &&
      confirmHtml.includes("Confidence") &&
      confirmHtml.includes("Source:") &&
      confirmHtml.includes("/api/pharmacy/profile/") &&
      confirmHtml.includes("/logo") &&
      confirmHtml.includes("confirmBrandBtn") &&
      confirmHtml.includes("brandLogoFile") &&
      usesCommercialBlueBaseline(confirmHtml),
    "Brand Review panel has logo, swatches, fonts, evidence/confidence, confirm/edit and logo upload",
  );

  const reviewCentre = renderReviewCentrePage(SLUG, "flu-vaccinations");
  const dashboard = renderPremiumCustomerDashboardPage(SLUG);
  record(
    "po-blue-ui-integrity",
    usesCommercialBlueBaseline(reviewCentre) &&
      usesCommercialBlueBaseline(dashboard) &&
      usesCommercialBlueBaseline(confirmHtml) &&
      reviewCentre.includes(COMMERCIAL_BLUE_UI_BASELINE_ID) &&
      dashboard.includes(COMMERCIAL_BLUE_UI_BASELINE_ID) &&
      !reviewCentre.includes(TENANT_BRAND_IDENTITY_OVERLAY_MARKER) &&
      !dashboard.includes(TENANT_BRAND_IDENTITY_OVERLAY_MARKER) &&
      reviewCentre.toLowerCase().includes(COMMERCIAL_BLUE_UI_TOKENS.primary) &&
      PHARMACONNECT_DESIGN_SYSTEM_V1_COMMERCIAL_LOCK === true,
    "Review Centre, dashboard and setup chrome stay commercial blue; overlay is preview-only",
  );

  const after = snapshotIntegrity();
  const mutated = Object.keys(before).filter((key) => before[key] !== after[key]);
  const fluBankPath = path.join(
    ROOT,
    "data/pharmacy-approved-service-banks/banks/flu-vaccinations",
    `${FLU_BANK}.json`,
  );
  record(
    "four-campaign-content-schema-hash",
    mutated.length === 0 &&
      schemaOk.length === 0 &&
      fs.existsSync(fluBankPath) &&
      Boolean(before.fluBankFile) &&
      CAMPAIGNS.every((campaign) => before[`approval:${campaign}`] && before[`service:${campaign}`]),
    mutated.length || schemaOk.length
      ? `mutated=${mutated.join(",") || "none"} schema=${schemaOk.join(",") || "ok"}`
      : "four locked campaigns, Flu bank hash, JSON-LD and source HTML unchanged",
  );

  const yorkshireContract = getPharmacyTenantBrandIdentityPath(SLUG);
  record(
    "no-yorkshire-contract-write",
    !fs.existsSync(yorkshireContract) && !fs.existsSync(getPharmacyTenantBrandIdentityPath(FIXTURE_SLUG)),
    "validator left no tenant-brand files on disk",
  );

  const failedIds = checks.filter((c) => !c.pass).map((c) => c.id);
  if (failedIds.length) {
    console.error(`FAIL ${failedIds.join(", ")}`);
    process.exit(1);
  }
  console.log("PASS tenant-brand-identity-connection-43a");
}

main();
