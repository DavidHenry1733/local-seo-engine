/**
 * NT-E2E-31 — Production page-slot inventory from canonical plan (generic, tenant-agnostic).
 */
import type { ContentPageSlotPlan, ContentPageType } from "../pharmacyImageLibraryAssignmentService.ts";
import { RC1_IMG1_PAGE_SLOT_PLANS } from "../pharmacyImageLibraryAssignmentService.ts";
import {
  readCanonicalEcosystemGenerationPlan,
  type CanonicalEcosystemGenerationPlan,
  type CanonicalPagePlanEntry,
} from "../masterAdminCanonicalEcosystemGenerationPlanService.ts";

export type ProductionImageSlotPlan = ContentPageSlotPlan;

const BLOG_SLOT_TEMPLATE: Omit<ContentPageSlotPlan, "pageSlug">[] = [
  { pageType: "blog", serviceId: "pharmacy-first", slot: "hero", libraryRef: "", role: "blog-hero" },
  { pageType: "blog", serviceId: "pharmacy-first", slot: "support", libraryRef: "", role: "blog-editorial" },
  { pageType: "blog", serviceId: "pharmacy-first", slot: "conversion", libraryRef: "", role: "blog-cta" },
];

const CLUSTER_SLOT_TEMPLATE: Omit<ContentPageSlotPlan, "pageSlug">[] = [
  { pageType: "homepage", serviceId: "pharmacy-first", slot: "hero", libraryRef: "", role: "cluster-hero" },
  { pageType: "homepage", serviceId: "pharmacy-first", slot: "support", libraryRef: "", role: "cluster-supporting" },
  { pageType: "homepage", serviceId: "pharmacy-first", slot: "trust", libraryRef: "", role: "cluster-trust" },
  { pageType: "homepage", serviceId: "pharmacy-first", slot: "conversion", libraryRef: "", role: "cluster-conversion" },
];

const FAQ_SLOT_TEMPLATE: Omit<ContentPageSlotPlan, "pageSlug">[] = [
  { pageType: "guide", serviceId: "pharmacy-first", slot: "hero", libraryRef: "", role: "faq-hero" },
];

const SUPPORTING_SLOT_TEMPLATE: Omit<ContentPageSlotPlan, "pageSlug">[] = [
  { pageType: "guide", serviceId: "pharmacy-first", slot: "hero", libraryRef: "", role: "supporting-hero" },
];

function servicePageSlotPlans(serviceId: string, pageSlug = serviceId): ProductionImageSlotPlan[] {
  return (["hero", "support", "trust", "conversion"] as const).map((slot) => ({
    pageType: "service" as const,
    pageSlug,
    serviceId,
    slot,
    libraryRef: "",
    role: `service-${slot}`,
  }));
}

function clusterPageSlug(canonicalSlug: string): string {
  const bare = canonicalSlug.replace(/^cluster-/, "");
  return `local-cluster-${bare}`;
}

function slotsForPage(page: CanonicalPagePlanEntry, serviceId: string): ProductionImageSlotPlan[] {
  const rc1Match = RC1_IMG1_PAGE_SLOT_PLANS.filter(
    (p) => p.pageSlug === page.slug && p.serviceId === serviceId,
  );
  if (rc1Match.length) return rc1Match;

  if (page.pageType === "service" || page.slug === serviceId) {
    return servicePageSlotPlans(serviceId, page.slug || serviceId);
  }
  if (page.pageType === "cluster-page") {
    return CLUSTER_SLOT_TEMPLATE.map((t) => ({
      ...t,
      pageSlug: clusterPageSlug(page.slug),
      serviceId,
    }));
  }
  if (page.pageType === "blog") {
    return BLOG_SLOT_TEMPLATE.map((t) => ({
      ...t,
      pageSlug: page.slug,
      serviceId,
    }));
  }
  if (page.pageType === "faq") {
    return FAQ_SLOT_TEMPLATE.map((t) => ({
      ...t,
      pageSlug: page.slug,
      serviceId,
    }));
  }
  if (page.pageType === "supporting") {
    return SUPPORTING_SLOT_TEMPLATE.map((t) => ({
      ...t,
      pageSlug: page.slug,
      serviceId,
    }));
  }
  return [];
}

export function buildProductionPageSlotInventory(
  slug: string,
  serviceId: string,
  plan?: CanonicalEcosystemGenerationPlan | null,
): ProductionImageSlotPlan[] {
  const canonical = plan || readCanonicalEcosystemGenerationPlan(slug);
  if (!canonical) {
    const rc1 = RC1_IMG1_PAGE_SLOT_PLANS.filter((p) => p.serviceId === serviceId);
    return rc1.length ? rc1 : servicePageSlotPlans(serviceId);
  }
  const included = canonical.pageInventory.filter((p) => p.inclusionStatus === "included");
  const slots: ProductionImageSlotPlan[] = [];
  const seen = new Set<string>();
  for (const page of included) {
    for (const slot of slotsForPage(page, serviceId)) {
      const key = `${slot.pageSlug}:${slot.serviceId}:${slot.slot}`;
      if (seen.has(key)) continue;
      seen.add(key);
      slots.push(slot);
    }
  }
  if (slots.length) return slots;
  const rc1 = RC1_IMG1_PAGE_SLOT_PLANS.filter((p) => p.serviceId === serviceId);
  return rc1.length ? rc1 : servicePageSlotPlans(serviceId);
}

export function mapSlotPageType(pageType: ContentPageType, role: string): ContentPageType {
  if (role.startsWith("cluster-")) return "homepage";
  return pageType;
}
