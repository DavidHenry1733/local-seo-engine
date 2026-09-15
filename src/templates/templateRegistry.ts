/**
 * templateRegistry.ts
 *
 * Canonical registry of all available page templates.
 *
 * Each template is composed of an ordered list of reusable blocks rather than
 * a monolithic full-page design. Adding a new template means registering its
 * block order and metadata here — no structural code changes required.
 *
 * The first template (inboxingproweb_default) maps directly to the existing
 * cluster.html token-based renderer and service-location-v1.ts TypeScript
 * renderer. All subsequent templates share the same block vocabulary and can
 * be rendered once their CSS/HTML counterparts are implemented.
 */

import type {
  BlockDefinition,
  DefaultStyle,
  TemplateDefinition,
} from "./templateTypes";

// ── Shared block catalogue ────────────────────────────────────────────────────
// Each entry is reused across templates. Templates pick and order from this
// catalogue via their blockOrder arrays.

const BLOCKS: Record<string, BlockDefinition> = {

  hero: {
    blockId:      "hero",
    label:        "Hero — headline, intro, CTA, primary image",
    required:     true,
    contentHints: ["h1", "intro paragraph", "primary CTA button"],
    placeholders: ["{{H1}}", "{{INTRO}}", "{{CTA_TEXT}}", "{{CTA_URL}}", "{{HERO_IMAGE}}"],
  },

  money_page_link: {
    blockId:      "money_page_link",
    label:        "Money-page contextual link",
    required:     false,
    contentHints: ["prominent internal link to the top-converting service page"],
    placeholders: ["{{MONEY_PAGE_LINK_SECTION}}"],
  },

  ai_summary: {
    blockId:      "ai_summary",
    label:        "AI quick-answer summary",
    required:     false,
    contentHints: ["concise Q&A styled for AI search engines", "key facts bullet list"],
    placeholders: ["{{AI_SUMMARY_HEADING}}", "{{AI_SUMMARY_BODY}}"],
  },

  why_it_matters: {
    blockId:      "why_it_matters",
    label:        "Section 1 — Why this matters",
    required:     true,
    contentHints: ["problem statement", "cost of inaction", "local context"],
    placeholders: ["{{SECTION_1_HEADING}}", "{{SECTION_1_BODY}}"],
  },

  what_you_get: {
    blockId:      "what_you_get",
    label:        "Section 2 — What you get",
    required:     true,
    contentHints: ["service deliverables", "outcomes", "differentiators"],
    placeholders: ["{{SECTION_2_HEADING}}", "{{SECTION_2_BODY}}"],
  },

  enquiry_split: {
    blockId:      "enquiry_split",
    label:        "Enquiry split — text + supporting image",
    required:     false,
    contentHints: ["how enquiries work", "response time", "trust cue"],
    placeholders: ["{{ENQUIRY_SECTION_HEADING}}", "{{ENQUIRY_SECTION_BODY}}", "{{SUPPORT_IMAGE}}"],
  },

  competition: {
    blockId:      "competition",
    label:        "Competition / market context section",
    required:     false,
    contentHints: ["competitive landscape", "why act now", "market trend"],
    placeholders: ["{{COMPETITION_HEADING}}", "{{COMPETITION_BODY}}"],
  },

  no_website: {
    blockId:      "no_website",
    label:        "No-website warning section",
    required:     false,
    contentHints: ["risks of no online presence", "local credibility argument"],
    placeholders: ["{{NO_WEBSITE_HEADING}}", "{{NO_WEBSITE_BODY}}"],
  },

  process_steps: {
    blockId:      "process_steps",
    label:        "How it works — numbered step process",
    required:     false,
    contentHints: ["3–5 step process", "onboarding or service journey"],
    placeholders: ["{{PROCESS_HEADING}}", "{{PROCESS_STEPS}}"],
  },

  services_grid: {
    blockId:      "services_grid",
    label:        "Services / offerings grid",
    required:     false,
    contentHints: ["4–8 service tiles", "icon + short description per service"],
    placeholders: ["{{SERVICES_HEADING}}", "{{SERVICES_GRID}}"],
  },

  trust_signals: {
    blockId:      "trust_signals",
    label:        "Trust signals — badges, certifications, guarantees",
    required:     false,
    contentHints: ["accreditations", "guarantee statement", "years in business"],
    placeholders: ["{{TRUST_HEADING}}", "{{TRUST_ITEMS}}"],
  },

  gallery: {
    blockId:      "gallery",
    label:        "Gallery — before/after or portfolio images",
    required:     false,
    contentHints: ["3–6 portfolio images", "before/after pairs", "project photos"],
    placeholders: ["{{GALLERY_HEADING}}", "{{GALLERY_IMAGES}}"],
  },

  testimonials: {
    blockId:      "testimonials",
    label:        "Testimonials / customer reviews",
    required:     false,
    contentHints: ["2–4 star-rated reviews", "customer name and location"],
    placeholders: ["{{TESTIMONIALS_HEADING}}", "{{TESTIMONIALS_ITEMS}}"],
  },

  conversion_image: {
    blockId:      "conversion_image",
    label:        "Conversion image panel",
    required:     false,
    contentHints: ["trust-building visual", "team or results image"],
    placeholders: ["{{CONVERSION_IMAGE}}"],
  },

  map: {
    blockId:      "map",
    label:        "Map — embedded location map + address",
    required:     true,
    contentHints: ["Google Maps embed", "business address text", "view on Google Maps link"],
    placeholders: ["{{MAP_EMBED_URL}}", "{{BUSINESS_ADDRESS}}", "{{BUSINESS_NAME}}"],
  },

  areas_cover: {
    blockId:      "areas_cover",
    label:        "Areas we cover — hub-to-cluster link grid",
    required:     false,
    contentHints: ["list of served areas", "internal links to cluster pages"],
    placeholders: ["{{AREAS_HEADING}}", "{{AREAS_BODY}}", "{{AREAS_LINKS}}"],
  },

  cta_band: {
    blockId:      "cta_band",
    label:        "CTA band — full-width call to action",
    required:     true,
    contentHints: ["compelling headline", "one-sentence value prop", "primary CTA button"],
    placeholders: ["{{CTA_HEADING}}", "{{CTA_BODY}}", "{{CTA_BUTTON_TEXT}}", "{{CTA_URL}}"],
  },

  faq: {
    blockId:      "faq",
    label:        "FAQ — 3–6 question and answer pairs",
    required:     true,
    contentHints: ["price FAQ", "timeline FAQ", "results FAQ", "process FAQ"],
    placeholders: ["{{FAQ_ITEMS}}"],
  },

  resource_cards: {
    blockId:      "resource_cards",
    label:        "Resource cards — internal links grid",
    required:     false,
    contentHints: ["3–6 related page links", "hub/cluster cross-links"],
    placeholders: ["{{RESOURCE_CARDS}}"],
  },

  problems_grid: {
    blockId:      "problems_grid",
    label:        "Common problems we fix — issue card grid",
    required:     false,
    contentHints: ["6–9 problem/symptom cards", "icon + short description", "links to deeper service pages"],
    placeholders: ["{{PROBLEMS_HEADING}}", "{{PROBLEMS_GRID}}"],
  },

  pricing: {
    blockId:      "pricing",
    label:        "Pricing — package or rate table",
    required:     false,
    contentHints: ["2–3 tiered packages", "starting from price", "what's included"],
    placeholders: ["{{PRICING_HEADING}}", "{{PRICING_ITEMS}}"],
  },
};

// ── Default styles per vertical ───────────────────────────────────────────────

const webAgencyStyle: DefaultStyle = {
  primaryColor: "#003A6D",
  accentColor:  "#1CA9C9",
  heroStyle:    "split_image_right",
  fontStack:    "sans_modern",
  borderRadius: "soft",
  ctaStyle:     "solid",
};

const tradesStyle: DefaultStyle = {
  primaryColor: "#1B3A4B",
  accentColor:  "#E8851A",
  heroStyle:    "split_image_right",
  fontStack:    "sans_modern",
  borderRadius: "sharp",
  ctaStyle:     "solid",
};

const beautyStyle: DefaultStyle = {
  primaryColor: "#4A1942",
  accentColor:  "#C9779A",
  heroStyle:    "centred",
  fontStack:    "serif_trust",
  borderRadius: "rounded",
  ctaStyle:     "gradient",
};

const professionalStyle: DefaultStyle = {
  primaryColor: "#1A2E44",
  accentColor:  "#2563EB",
  heroStyle:    "split_image_right",
  fontStack:    "serif_trust",
  borderRadius: "soft",
  ctaStyle:     "outline",
};

const retailStyle: DefaultStyle = {
  primaryColor: "#1F3D2B",
  accentColor:  "#E63946",
  heroStyle:    "split_image_left",
  fontStack:    "display_bold",
  borderRadius: "soft",
  ctaStyle:     "solid",
};

const plumberLocalStyle: DefaultStyle = {
  primaryColor: "#0F2D4A",
  accentColor:  "#E5380D",
  heroStyle:    "split_image_right",
  fontStack:    "sans_modern",
  borderRadius: "sharp",
  ctaStyle:     "solid",
};

// ── Template definitions ──────────────────────────────────────────────────────

const inboxingproweb_default: TemplateDefinition = {
  templateId:   "inboxingproweb_default",
  templateName: "InboxingProWeb Default",
  description:  "The original InboxingProWeb layout — professional services cluster page with AI summary, split sections, competition block, map and FAQ.",
  industryType: ["web_design", "digital_marketing", "seo_agency"],
  supportedPageTypes: ["hub", "area", "service"],
  blockOrder: [
    BLOCKS.hero,
    BLOCKS.money_page_link,
    BLOCKS.ai_summary,
    BLOCKS.why_it_matters,
    BLOCKS.what_you_get,
    BLOCKS.enquiry_split,
    BLOCKS.competition,
    BLOCKS.no_website,
    BLOCKS.map,
    BLOCKS.cta_band,
    BLOCKS.faq,
    BLOCKS.resource_cards,
  ],
  defaultStyle: webAgencyStyle,
  requiredImageSlots: ["hero", "support", "trust", "conversion"],
  recommendedContentSections: [
    "Why local web design matters",
    "What you get with our service",
    "How enquiries work",
    "Competitors in your market",
    "Consequences of no website",
    "Find us",
    "Frequently asked questions",
    "Related local pages",
  ],
};

const trades_home_services: TemplateDefinition = {
  templateId:   "trades_home_services",
  templateName: "Trades & Home Services",
  description:  "Built for plumbers, electricians, builders, cleaners and other trade businesses. Emphasises trust signals, process steps, service grid and local testimonials.",
  industryType: ["plumbing", "electrical", "building_trades", "cleaning", "landscaping", "roofing"],
  supportedPageTypes: ["hub", "area", "service", "landing"],
  blockOrder: [
    BLOCKS.hero,
    BLOCKS.trust_signals,
    BLOCKS.services_grid,
    BLOCKS.why_it_matters,
    BLOCKS.process_steps,
    BLOCKS.what_you_get,
    BLOCKS.conversion_image,
    BLOCKS.testimonials,
    BLOCKS.map,
    BLOCKS.cta_band,
    BLOCKS.faq,
    BLOCKS.areas_cover,
  ],
  defaultStyle: tradesStyle,
  requiredImageSlots: ["hero", "work_example", "team_or_van"],
  recommendedContentSections: [
    "Why choose a local trades professional",
    "Our services at a glance",
    "How we work — step by step",
    "What our customers say",
    "Areas we cover",
    "Find us",
    "Frequently asked questions",
  ],
};

const beauty_clinic: TemplateDefinition = {
  templateId:   "beauty_clinic",
  templateName: "Beauty & Clinic",
  description:  "Designed for hair salons, beauty therapists, aesthetics clinics and nail studios. Gallery-first layout with before/after images, treatment grid and warm testimonials.",
  industryType: ["beauty", "hair_salon", "aesthetics", "nail_studio", "spa", "wellness"],
  supportedPageTypes: ["hub", "area", "service", "landing"],
  blockOrder: [
    BLOCKS.hero,
    BLOCKS.services_grid,
    BLOCKS.why_it_matters,
    BLOCKS.gallery,
    BLOCKS.trust_signals,
    BLOCKS.what_you_get,
    BLOCKS.testimonials,
    BLOCKS.pricing,
    BLOCKS.map,
    BLOCKS.cta_band,
    BLOCKS.faq,
    BLOCKS.resource_cards,
  ],
  defaultStyle: beautyStyle,
  requiredImageSlots: ["hero", "treatment_gallery_1", "treatment_gallery_2", "salon_interior"],
  recommendedContentSections: [
    "Our treatments and services",
    "Why clients choose us",
    "Portfolio and results gallery",
    "Client reviews",
    "Pricing and packages",
    "Find the salon",
    "Frequently asked questions",
  ],
};

const professional_services: TemplateDefinition = {
  templateId:   "professional_services",
  templateName: "Professional Services",
  description:  "For accountants, solicitors, financial advisers, consultants and other professional service firms. Authority-first layout with process, content depth and trust cues.",
  industryType: ["accountancy", "legal", "financial_advice", "consulting", "hr", "insurance"],
  supportedPageTypes: ["hub", "area", "service", "landing"],
  blockOrder: [
    BLOCKS.hero,
    BLOCKS.ai_summary,
    BLOCKS.trust_signals,
    BLOCKS.why_it_matters,
    BLOCKS.what_you_get,
    BLOCKS.process_steps,
    BLOCKS.enquiry_split,
    BLOCKS.conversion_image,
    BLOCKS.testimonials,
    BLOCKS.map,
    BLOCKS.cta_band,
    BLOCKS.faq,
    BLOCKS.areas_cover,
  ],
  defaultStyle: professionalStyle,
  requiredImageSlots: ["hero", "office_or_team", "consultation"],
  recommendedContentSections: [
    "Why specialist local expertise matters",
    "What our service includes",
    "How the process works",
    "Client outcomes and case results",
    "Who we work with",
    "Find our office",
    "Frequently asked questions",
  ],
};

const retail_local_shop: TemplateDefinition = {
  templateId:   "retail_local_shop",
  templateName: "Retail & Local Shop",
  description:  "For independent retailers, market traders, boutiques and local product shops. Product-forward layout with strong visual storytelling and community connection.",
  industryType: ["retail", "boutique", "market_stall", "food_drink", "gifts", "homewares"],
  supportedPageTypes: ["hub", "area", "service", "landing"],
  blockOrder: [
    BLOCKS.hero,
    BLOCKS.services_grid,
    BLOCKS.why_it_matters,
    BLOCKS.gallery,
    BLOCKS.what_you_get,
    BLOCKS.conversion_image,
    BLOCKS.testimonials,
    BLOCKS.map,
    BLOCKS.cta_band,
    BLOCKS.faq,
    BLOCKS.resource_cards,
  ],
  defaultStyle: retailStyle,
  requiredImageSlots: ["hero", "product_showcase", "shop_front"],
  recommendedContentSections: [
    "What we stock and offer",
    "Why shop local with us",
    "Customer favourites",
    "What shoppers say",
    "Find our shop",
    "Frequently asked questions",
  ],
};

// ── plumber_local_service ─────────────────────────────────────────────────────
// Purpose: Generate local SEO service/location landing pages for plumbing
// businesses that rank for "{service} {location}" keywords and convert
// visitors into phone calls and callback requests.
//
// This is NOT a homepage template. The H1 = service + location keyword.
// It supports both hub pages ("emergency plumber Sheffield") and cluster
// pages ("emergency plumber Crookes") through the same block order.

const plumber_local_service: TemplateDefinition = {
  templateId:   "plumber_local_service",
  templateName: "Local Plumber — Service/Location Page",
  description:  "Local SEO landing page for plumbing service + location keywords. Converts visitors into phone calls. Supports hub pages and cluster area pages. NOT a homepage.",
  industryType: ["plumbing", "drainage", "heating", "gas_engineer"],
  supportedPageTypes: ["hub", "area", "service", "landing"],
  blockOrder: [
    BLOCKS.hero,
    BLOCKS.trust_signals,
    BLOCKS.services_grid,
    BLOCKS.why_it_matters,
    BLOCKS.areas_cover,
    BLOCKS.problems_grid,
    BLOCKS.process_steps,
    BLOCKS.testimonials,
    BLOCKS.gallery,
    BLOCKS.map,
    BLOCKS.cta_band,
    BLOCKS.faq,
  ],
  defaultStyle: plumberLocalStyle,
  requiredImageSlots: ["hero", "service_image", "work_example", "cta_image"],
  recommendedContentSections: [
    "Trust signals — Gas Safe, insured, local, guaranteed",
    "What the service covers in this location",
    "Why choosing a local plumber in [location] matters",
    "Areas covered near [location]",
    "Common plumbing problems we fix",
    "How to book — step by step",
    "Customer reviews from [location]",
    "Work examples and before/after",
    "Find us — [location] map",
    "Frequently asked questions — [service] [location]",
  ],
};

// ── Registry map ──────────────────────────────────────────────────────────────

export const TEMPLATE_REGISTRY: Record<string, TemplateDefinition> = {
  inboxingproweb_default,
  trades_home_services,
  beauty_clinic,
  professional_services,
  retail_local_shop,
  plumber_local_service,
};

export const TEMPLATE_IDS = Object.keys(TEMPLATE_REGISTRY) as TemplateId[];

export type TemplateId = keyof typeof TEMPLATE_REGISTRY;

// ── Lookup helpers ────────────────────────────────────────────────────────────

/**
 * Resolve a template by ID. Falls back to inboxingproweb_default if the
 * requested ID is not registered, logging a warning.
 */
export function getTemplate(id: string): TemplateDefinition {
  const t = TEMPLATE_REGISTRY[id];
  if (!t) {
    console.warn(`[templateRegistry] Unknown templateId "${id}" — falling back to inboxingproweb_default`);
    return TEMPLATE_REGISTRY.inboxingproweb_default;
  }
  return t;
}

/**
 * Return all templates that support a given industry tag.
 */
export function getTemplatesForIndustry(industryTag: string): TemplateDefinition[] {
  return Object.values(TEMPLATE_REGISTRY).filter((t) =>
    t.industryType.includes(industryTag)
  );
}

/**
 * Return all templates that support a given page type.
 */
export function getTemplatesForPageType(pageType: string): TemplateDefinition[] {
  return Object.values(TEMPLATE_REGISTRY).filter((t) =>
    t.supportedPageTypes.includes(pageType as TemplateDefinition["supportedPageTypes"][number])
  );
}

/**
 * Return a lightweight summary list suitable for UI dropdowns / pickers.
 */
export function listTemplates(): Array<{
  templateId:   string;
  templateName: string;
  description:  string;
  industryType: string[];
}> {
  return Object.values(TEMPLATE_REGISTRY).map(({ templateId, templateName, description, industryType }) => ({
    templateId,
    templateName,
    description,
    industryType,
  }));
}
