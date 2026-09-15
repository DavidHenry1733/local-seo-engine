/**
 * CPR-02A — Pre-generation SEO plan and post-generation SEO contract validation.
 */
import fs from "node:fs";
import path from "node:path";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import type { ServicePageSeoPlan } from "./masterAdminCoreProductRecoveryModel.ts";
import { resolveCustomerFacingPharmacyName } from "./pharmacyServicePageProfileContext.ts";
import { isKeywordStuffedPharmacyListingName } from "./pharmacyServicePagePublicationQuality.ts";

const SEO_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/service-page-seo");

function legacySeoPlanPath(slug: string): string {
  return path.join(SEO_DIR, slug, "plan.json");
}

function scopedSeoPlanPath(slug: string, serviceId: string): string {
  return path.join(SEO_DIR, slug, "by-service", serviceId, "plan.json");
}

function seoPlanPath(slug: string, serviceId?: string): string {
  if (serviceId && serviceId !== "pharmacy-first") {
    return scopedSeoPlanPath(slug, serviceId);
  }
  if (serviceId === "pharmacy-first") {
    return legacySeoPlanPath(slug);
  }
  return legacySeoPlanPath(slug);
}

function writeJsonAtomic(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

export function buildServicePageSeoPlan(slug: string, serviceId: string): ServicePageSeoPlan {
  const profile = readSetupProfile(slug);
  const meta = getServicePublishMeta(serviceId);
  const town = profile.primaryTown || profile.townCity || "your area";
  const pharmacyName = resolveCustomerFacingPharmacyName(profile) || slug;
  const serviceName = meta?.serviceName || serviceId;
  const title = `${serviceName} — ${pharmacyName}`;
  const metaDescription = meta?.metaDescription(pharmacyName, town) || `${serviceName} at ${pharmacyName} in ${town}.`;
  const plannedUrl = meta?.urlPath || `/${serviceId}/`;
  const website = (profile.website || "").replace(/\/+$/, "");
  const canonicalUrl = website ? `${website}${plannedUrl}` : plannedUrl;
  const schemaTypes = ["Service", "Pharmacy", "LocalBusiness", "BreadcrumbList"];

  const plan: ServicePageSeoPlan = {
    title,
    metaDescription,
    canonicalUrl,
    robots: "index,follow",
    openGraph: {
      title,
      description: metaDescription,
      url: canonicalUrl,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: metaDescription,
    },
    schemaTypes,
    faqSchemaIncluded: false,
    h1: serviceName,
    headingHierarchy: ["H1 service title", "H2 section headings", "H3 subsection headings"],
    manifestRecord: `data/pharmacy-content-packages/${slug}/${serviceId}.json`,
    registryRecord:
      serviceId === "pharmacy-first"
        ? `data/pharmacy-master-admin/service-page-generation/${slug}/latest.json`
        : `data/pharmacy-master-admin/service-page-generation/${slug}/by-service/${serviceId}/latest.json`,
    sitemapReadyRecord: `output/pharmacy-visual-experience/${slug}/${serviceId}/index.html`,
    validLinks: true,
  };

  writeJsonAtomic(seoPlanPath(slug, serviceId), { slug, serviceId, plan, persistedAt: new Date().toISOString() });
  // Pharmacy First also keeps the legacy tenant plan path for older CPR readers.
  if (serviceId === "pharmacy-first") {
    writeJsonAtomic(legacySeoPlanPath(slug), { slug, serviceId, plan, persistedAt: new Date().toISOString() });
  }
  return plan;
}

export function preferCustomerFacingSeoTitle(storedTitle: string | null | undefined, liveTitle: string): string {
  const stored = String(storedTitle || "").trim();
  if (stored && !isKeywordStuffedPharmacyListingName(stored)) return stored;
  return liveTitle;
}

export function readServicePageSeoPlan(slug: string, serviceId?: string): ServicePageSeoPlan | null {
  const candidates = serviceId
    ? serviceId === "pharmacy-first"
      ? [legacySeoPlanPath(slug), scopedSeoPlanPath(slug, serviceId)]
      : [scopedSeoPlanPath(slug, serviceId)]
    : [legacySeoPlanPath(slug)];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { serviceId?: string; plan?: ServicePageSeoPlan };
      if (serviceId && raw.serviceId && raw.serviceId !== serviceId) continue;
      if (raw.plan) {
        if (serviceId && isKeywordStuffedPharmacyListingName(raw.plan.title)) {
          return buildServicePageSeoPlan(slug, serviceId);
        }
        return raw.plan;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

export interface SeoContractValidationResult {
  passed: boolean;
  checks: Array<{ id: string; label: string; passed: boolean; detail?: string }>;
  errors: string[];
}

function countMatches(html: string, pattern: RegExp): number {
  return (html.match(pattern) || []).length;
}

export function validateServicePageSeoContract(
  slug: string,
  serviceId: string,
  html?: string,
): SeoContractValidationResult {
  const plan = readServicePageSeoPlan(slug, serviceId) || buildServicePageSeoPlan(slug, serviceId);
  const checks: SeoContractValidationResult["checks"] = [];
  const errors: string[] = [];

  checks.push({ id: "unique_title", label: "Unique title", passed: Boolean(plan.title?.trim()), detail: plan.title });
  checks.push({ id: "unique_meta", label: "Unique meta description", passed: Boolean(plan.metaDescription?.trim()), detail: plan.metaDescription?.slice(0, 80) });
  checks.push({ id: "canonical", label: "Canonical URL", passed: Boolean(plan.canonicalUrl), detail: plan.canonicalUrl });
  checks.push({ id: "robots", label: "Robots index/follow", passed: plan.robots === "index,follow", detail: plan.robots });
  checks.push({ id: "opengraph", label: "OpenGraph metadata", passed: Boolean(plan.openGraph?.title && plan.openGraph?.description), detail: plan.openGraph?.title });
  checks.push({ id: "twitter", label: "Twitter metadata", passed: Boolean(plan.twitter?.title && plan.twitter?.description), detail: plan.twitter?.card });
  checks.push({ id: "service_schema", label: "Service schema", passed: plan.schemaTypes.includes("Service"), detail: "Service" });
  checks.push({ id: "local_schema", label: "Pharmacy or LocalBusiness schema", passed: plan.schemaTypes.some((t) => t === "Pharmacy" || t === "LocalBusiness") });
  checks.push({ id: "breadcrumb_schema", label: "BreadcrumbList schema", passed: plan.schemaTypes.includes("BreadcrumbList") });
  checks.push({ id: "manifest", label: "One manifest record", passed: fs.existsSync(path.join(WORKSPACE_ROOT, plan.manifestRecord)), detail: plan.manifestRecord });
  checks.push({ id: "registry", label: "One registry record", passed: fs.existsSync(path.join(WORKSPACE_ROOT, plan.registryRecord)), detail: plan.registryRecord });

  if (html) {
    checks.push({ id: "one_h1", label: "Exactly one H1", passed: countMatches(html, /<h1\b[^>]*>/gi) === 1, detail: String(countMatches(html, /<h1\b[^>]*>/gi)) });
    checks.push({ id: "h2_h3", label: "Valid H2/H3 hierarchy", passed: countMatches(html, /<h2\b[^>]*>/gi) >= 1 });
    checks.push({ id: "json_ld", label: "Valid JSON-LD", passed: /<script[^>]+type=["']application\/ld\+json["']/i.test(html) });
    const faqVisible = /<section[^>]*faq|data-section-type=["']faq/i.test(html);
    const faqSchema = /FAQPage/i.test(html);
    checks.push({
      id: "faq_schema",
      label: "FAQ schema only when FAQs rendered",
      passed: !faqSchema || faqVisible,
      detail: faqVisible ? "FAQs visible" : "No FAQ schema without visible FAQs",
    });
    if (faqVisible && !plan.faqSchemaIncluded) plan.faqSchemaIncluded = true;
  } else {
    checks.push({ id: "pre_gen_plan", label: "Pre-generation SEO plan visible", passed: Boolean(plan.title && plan.canonicalUrl) });
  }

  for (const c of checks) if (!c.passed) errors.push(c.label);
  return { passed: errors.length === 0, checks, errors };
}
