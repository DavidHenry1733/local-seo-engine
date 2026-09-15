/**
 * templates.ts — REST endpoints for the template library.
 *
 * GET  /api/templates           → list all registered templates (summary)
 * GET  /api/templates/:id       → full template definition including blockOrder
 * GET  /api/templates/:id/blocks → ordered block list for a specific template
 */

import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const router = Router();

// ── Dynamic import of the template registry ───────────────────────────────────
// The registry lives in the shared src/ workspace package. We resolve it at
// runtime from the compiled JS output rather than a direct TS import so that
// this route works in the compiled API server without a build step for src/.

async function loadRegistry() {
  const require = createRequire(import.meta.url);
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  // Try compiled output first, then fall back to ts-node / direct source paths.
  const candidates = [
    path.resolve(__dirname, "../../../../../src/templates/templateRegistry.js"),
    path.resolve(__dirname, "../../../../../src/templates/templateRegistry.ts"),
    path.resolve(process.cwd(), "src/templates/templateRegistry.ts"),
  ];

  for (const candidate of candidates) {
    try {
      // Dynamic import works for both ESM .js and tsx/ts-node .ts
      const mod = await import(candidate);
      return mod;
    } catch {
      // Try next candidate
    }
  }

  // Inline fallback — returns the registry data statically if dynamic load
  // fails (e.g. during cold-start before compilation).
  return {
    TEMPLATE_REGISTRY: {
      inboxingproweb_default: {
        templateId: "inboxingproweb_default",
        templateName: "InboxingProWeb Default",
        description: "The original InboxingProWeb layout — professional services cluster page with AI summary, split sections, competition block, map and FAQ.",
        industryType: ["web_design", "digital_marketing", "seo_agency"],
        supportedPageTypes: ["hub", "area", "service"],
        blockOrder: [
          { blockId: "hero",          label: "Hero — headline, intro, CTA, primary image", required: true },
          { blockId: "money_page_link", label: "Money-page contextual link",               required: false },
          { blockId: "ai_summary",    label: "AI quick-answer summary",                   required: false },
          { blockId: "why_it_matters", label: "Section 1 — Why this matters",             required: true },
          { blockId: "what_you_get",  label: "Section 2 — What you get",                  required: true },
          { blockId: "enquiry_split", label: "Enquiry split — text + supporting image",   required: false },
          { blockId: "competition",   label: "Competition / market context section",       required: false },
          { blockId: "no_website",    label: "No-website warning section",                required: false },
          { blockId: "map",           label: "Map — embedded location map + address",     required: true },
          { blockId: "cta_band",      label: "CTA band — full-width call to action",      required: true },
          { blockId: "faq",           label: "FAQ — 3–6 question and answer pairs",       required: true },
          { blockId: "resource_cards", label: "Resource cards — internal links grid",     required: false },
        ],
        defaultStyle: { primaryColor: "#003A6D", accentColor: "#1CA9C9", heroStyle: "split_image_right", fontStack: "sans_modern", borderRadius: "soft", ctaStyle: "solid" },
        requiredImageSlots: ["hero", "support", "trust", "conversion"],
        recommendedContentSections: ["Why local web design matters", "What you get with our service", "How enquiries work", "Competitors in your market", "Consequences of no website", "Find us", "Frequently asked questions", "Related local pages"],
      },
      trades_home_services: {
        templateId: "trades_home_services", templateName: "Trades & Home Services",
        description: "Built for plumbers, electricians, builders and cleaners. Emphasises trust signals, process steps, service grid and local testimonials.",
        industryType: ["plumbing", "electrical", "building_trades", "cleaning"],
        supportedPageTypes: ["hub", "area", "service", "landing"],
        blockOrder: [
          { blockId: "hero",          label: "Hero",             required: true },
          { blockId: "trust_signals", label: "Trust signals",    required: false },
          { blockId: "services_grid", label: "Services grid",    required: false },
          { blockId: "why_it_matters", label: "Why it matters",  required: true },
          { blockId: "process_steps", label: "Process steps",    required: false },
          { blockId: "what_you_get",  label: "What you get",     required: true },
          { blockId: "conversion_image", label: "Conversion image", required: false },
          { blockId: "testimonials",  label: "Testimonials",     required: false },
          { blockId: "map",           label: "Map",              required: true },
          { blockId: "cta_band",      label: "CTA band",         required: true },
          { blockId: "faq",           label: "FAQ",              required: true },
          { blockId: "areas_cover",   label: "Areas we cover",   required: false },
        ],
        defaultStyle: { primaryColor: "#1B3A4B", accentColor: "#E8851A", heroStyle: "split_image_right", fontStack: "sans_modern", borderRadius: "sharp", ctaStyle: "solid" },
        requiredImageSlots: ["hero", "work_example", "team_or_van"],
        recommendedContentSections: ["Why choose a local trades professional", "Our services at a glance", "How we work — step by step", "What our customers say", "Areas we cover", "Find us", "Frequently asked questions"],
      },
      beauty_clinic: {
        templateId: "beauty_clinic", templateName: "Beauty & Clinic",
        description: "For hair salons, beauty therapists and aesthetics clinics. Gallery-first layout with before/after images and warm testimonials.",
        industryType: ["beauty", "hair_salon", "aesthetics", "nail_studio", "spa"],
        supportedPageTypes: ["hub", "area", "service", "landing"],
        blockOrder: [
          { blockId: "hero",          label: "Hero",                required: true },
          { blockId: "services_grid", label: "Services grid",       required: false },
          { blockId: "why_it_matters", label: "Why it matters",     required: true },
          { blockId: "gallery",       label: "Gallery",             required: false },
          { blockId: "trust_signals", label: "Trust signals",       required: false },
          { blockId: "what_you_get",  label: "What you get",        required: true },
          { blockId: "testimonials",  label: "Testimonials",        required: false },
          { blockId: "pricing",       label: "Pricing",             required: false },
          { blockId: "map",           label: "Map",                 required: true },
          { blockId: "cta_band",      label: "CTA band",            required: true },
          { blockId: "faq",           label: "FAQ",                 required: true },
          { blockId: "resource_cards", label: "Resource cards",     required: false },
        ],
        defaultStyle: { primaryColor: "#4A1942", accentColor: "#C9779A", heroStyle: "centred", fontStack: "serif_trust", borderRadius: "rounded", ctaStyle: "gradient" },
        requiredImageSlots: ["hero", "treatment_gallery_1", "treatment_gallery_2", "salon_interior"],
        recommendedContentSections: ["Our treatments and services", "Why clients choose us", "Portfolio and results gallery", "Client reviews", "Pricing and packages", "Find the salon", "Frequently asked questions"],
      },
      professional_services: {
        templateId: "professional_services", templateName: "Professional Services",
        description: "For accountants, solicitors and consultants. Authority-first layout with process, content depth and trust cues.",
        industryType: ["accountancy", "legal", "financial_advice", "consulting"],
        supportedPageTypes: ["hub", "area", "service", "landing"],
        blockOrder: [
          { blockId: "hero",              label: "Hero",              required: true },
          { blockId: "ai_summary",        label: "AI summary",        required: false },
          { blockId: "trust_signals",     label: "Trust signals",     required: false },
          { blockId: "why_it_matters",    label: "Why it matters",    required: true },
          { blockId: "what_you_get",      label: "What you get",      required: true },
          { blockId: "process_steps",     label: "Process steps",     required: false },
          { blockId: "enquiry_split",     label: "Enquiry split",     required: false },
          { blockId: "conversion_image",  label: "Conversion image",  required: false },
          { blockId: "testimonials",      label: "Testimonials",      required: false },
          { blockId: "map",               label: "Map",               required: true },
          { blockId: "cta_band",          label: "CTA band",          required: true },
          { blockId: "faq",               label: "FAQ",               required: true },
          { blockId: "areas_cover",       label: "Areas we cover",    required: false },
        ],
        defaultStyle: { primaryColor: "#1A2E44", accentColor: "#2563EB", heroStyle: "split_image_right", fontStack: "serif_trust", borderRadius: "soft", ctaStyle: "outline" },
        requiredImageSlots: ["hero", "office_or_team", "consultation"],
        recommendedContentSections: ["Why specialist local expertise matters", "What our service includes", "How the process works", "Client outcomes", "Who we work with", "Find our office", "Frequently asked questions"],
      },
      retail_local_shop: {
        templateId: "retail_local_shop", templateName: "Retail & Local Shop",
        description: "For independent retailers, boutiques and local product shops. Product-forward with strong visual storytelling.",
        industryType: ["retail", "boutique", "food_drink", "gifts"],
        supportedPageTypes: ["hub", "area", "service", "landing"],
        blockOrder: [
          { blockId: "hero",              label: "Hero",              required: true },
          { blockId: "services_grid",     label: "Products grid",     required: false },
          { blockId: "why_it_matters",    label: "Why it matters",    required: true },
          { blockId: "gallery",           label: "Gallery",           required: false },
          { blockId: "what_you_get",      label: "What you get",      required: true },
          { blockId: "conversion_image",  label: "Conversion image",  required: false },
          { blockId: "testimonials",      label: "Testimonials",      required: false },
          { blockId: "map",               label: "Map",               required: true },
          { blockId: "cta_band",          label: "CTA band",          required: true },
          { blockId: "faq",               label: "FAQ",               required: true },
          { blockId: "resource_cards",    label: "Resource cards",    required: false },
        ],
        defaultStyle: { primaryColor: "#1F3D2B", accentColor: "#E63946", heroStyle: "split_image_left", fontStack: "display_bold", borderRadius: "soft", ctaStyle: "solid" },
        requiredImageSlots: ["hero", "product_showcase", "shop_front"],
        recommendedContentSections: ["What we stock and offer", "Why shop local with us", "Customer favourites", "What shoppers say", "Find our shop", "Frequently asked questions"],
      },
      plumber_local_service: {
        templateId: "plumber_local_service",
        templateName: "Local Plumber — Service/Location Page",
        description: "Local SEO landing page for plumbing service + location keywords. Converts visitors into phone calls. Supports hub pages and cluster area pages. NOT a homepage.",
        industryType: ["plumbing", "drainage", "heating", "gas_engineer"],
        supportedPageTypes: ["hub", "area", "service", "landing"],
        blockOrder: [
          { blockId: "hero",           label: "Hero — H1 = service + location keyword, dual CTA (Call/Callback)", required: true },
          { blockId: "trust_signals",  label: "Trust signals — Gas Safe, insured, local, guaranteed",             required: false },
          { blockId: "services_grid",  label: "Services grid — emergency services covered",                       required: false },
          { blockId: "why_it_matters", label: "Why choose a local plumber",                                       required: true },
          { blockId: "areas_cover",    label: "Area coverage — linking to cluster pages",                         required: false },
          { blockId: "problems_grid",  label: "Common problems we fix — issue card grid",                         required: false },
          { blockId: "process_steps",  label: "How to book — 5 step process",                                    required: false },
          { blockId: "testimonials",   label: "Testimonials — local customer reviews",                            required: false },
          { blockId: "gallery",        label: "Gallery — work examples and before/after",                         required: false },
          { blockId: "map",            label: "Map — location and service area",                                   required: true },
          { blockId: "cta_band",       label: "CTA band — final conversion push with phone + callback",           required: true },
          { blockId: "faq",            label: "FAQ — long-tail keyword questions for this service + location",     required: true },
        ],
        defaultStyle: { primaryColor: "#0F2D4A", accentColor: "#E5380D", heroStyle: "split_image_right", fontStack: "sans_modern", borderRadius: "sharp", ctaStyle: "solid" },
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
      },
    },
    listTemplates() {
      return Object.values(this.TEMPLATE_REGISTRY).map(
        ({ templateId, templateName, description, industryType }: any) =>
          ({ templateId, templateName, description, industryType })
      );
    },
    getTemplate(id: string) {
      return (this.TEMPLATE_REGISTRY as any)[id] ?? this.TEMPLATE_REGISTRY.inboxingproweb_default;
    },
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────

/** GET /api/templates — list all templates (summary, no block detail) */
router.get("/templates", async (_req, res) => {
  try {
    const registry = await loadRegistry();
    const templates = Object.values(registry.TEMPLATE_REGISTRY).map((t: any) => ({
      templateId:          t.templateId,
      templateName:        t.templateName,
      description:         t.description,
      industryType:        t.industryType,
      industryCategories:  t.industryType,          // alias used by dashboard
      supportedPageTypes:  t.supportedPageTypes,
      blockOrder:          (t.blockOrder || []).map((b: any) => b.blockId ?? b),
      requiredBlocks:      (t.blockOrder || []).filter((b: any) => b.required).map((b: any) => b.blockId ?? b),
      defaultStyle:        t.defaultStyle ?? {},
      requiredImageSlots:  t.requiredImageSlots ?? [],
    }));
    res.json({ templates });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Failed to load template registry" });
  }
});

/** GET /api/templates/:id — full template definition */
router.get("/templates/:id", async (req, res) => {
  try {
    const registry = await loadRegistry();
    const id = req.params.id;
    const template = typeof registry.getTemplate === "function"
      ? registry.getTemplate(id)
      : (registry.TEMPLATE_REGISTRY as any)[id];

    if (!template) {
      res.status(404).json({ error: `Template "${id}" not found` });
      return;
    }
    res.json({ template });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Failed to load template" });
  }
});

/** GET /api/templates/:id/blocks — ordered block list only */
router.get("/templates/:id/blocks", async (req, res) => {
  try {
    const registry = await loadRegistry();
    const id = req.params.id;
    const template = typeof registry.getTemplate === "function"
      ? registry.getTemplate(id)
      : (registry.TEMPLATE_REGISTRY as any)[id];

    if (!template) {
      res.status(404).json({ error: `Template "${id}" not found` });
      return;
    }
    res.json({
      templateId: template.templateId,
      templateName: template.templateName,
      blocks: template.blockOrder,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Failed to load blocks" });
  }
});

// ── Demo renderer — real populated pages ─────────────────────────────────────

/** Shared CSS base — the InboxingProWeb design system with injected brand colours */
function demoCSS(pri: string, acc: string): string {
  return `
    *, *::before, *::after { box-sizing: border-box; }
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; font-size:17px; line-height:1.7; color:#334155; background:#fff; }
    img  { max-width:100%; height:auto; display:block; }
    a    { color:${pri}; text-decoration:none; }
    a:hover { text-decoration:underline; }
    .wrap,.container { max-width:960px; margin:0 auto; padding:0 24px; }
    h1 { font-size:clamp(1.8rem,4vw,2.8rem); color:${pri}; line-height:1.2; margin:0 0 20px; }
    h2 { font-size:clamp(1.2rem,2.5vw,1.7rem); color:${pri}; margin:0 0 16px; text-align:center; }
    h3 { font-size:1.05rem; color:${pri}; margin:0 0 8px; }
    p  { margin:0 0 16px; }
    .site-header { background:#fff; border-bottom:1px solid #E2E8F0; padding:15px 0; }
    .site-header .container { display:flex; align-items:center; justify-content:space-between; }
    .site-header nav a { color:#1e293b; margin:0 12px; font-size:.95rem; }
    .hero { background:#F4F6F8; border-bottom:1px solid #D9E2EC; padding:60px 0; }
    .hero-inner { display:flex; align-items:center; gap:48px; }
    .hero-text { flex:1 1 0; min-width:0; }
    .hero-text .intro { font-size:1.1rem; color:#334155; margin-bottom:28px; }
    .hero-media { flex:1 1 0; min-width:0; }
    .hero-media img { border-radius:12px; box-shadow:0 8px 32px rgba(0,0,0,.12); width:100%; }
    .hero-bg { background:linear-gradient(135deg,${pri} 0%,${acc} 100%); }
    .hero-bg .hero-text h1 { color:#fff; }
    .hero-bg .hero-text .intro { color:rgba(255,255,255,.9); }
    .hero-bg .section-label { color:rgba(255,255,255,.7); }
    .btn { display:inline-block; background:${pri}; color:#fff; padding:14px 32px; border-radius:8px; font-size:1rem; font-weight:600; letter-spacing:.01em; }
    .btn:hover { opacity:.9; text-decoration:none; }
    .btn-accent { background:${acc}; }
    .btn-white { display:inline-block; background:#fff; color:${pri}; padding:14px 36px; border-radius:8px; font-size:1rem; font-weight:700; }
    .section-band { padding:56px 0; }
    .section-band--alt { background:#F4F6F8; border-top:1px solid #D9E2EC; border-bottom:1px solid #D9E2EC; }
    .section-label { font-size:.8rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:${acc}; margin-bottom:10px; }
    .section-2col { column-count:2; column-gap:48px; margin-top:12px; }
    .section-2col p { break-inside:avoid; }
    .ai-summary { background:#F0FAFF; padding:44px 0; }
    .ai-summary .container { border-left:4px solid ${acc}; padding-left:28px; max-width:780px; }
    .ai-summary h2 { font-size:1.25rem; color:${pri}; margin:0 0 12px; text-align:left; }
    .quick-answer-label { font-size:.78rem; text-transform:uppercase; letter-spacing:.09em; color:${acc}; font-weight:700; margin:0 0 10px; }
    .ai-summary p  { color:#334155; margin:0 0 14px; font-size:1rem; }
    .ai-summary ul { margin:0; padding-left:20px; color:#334155; font-size:1rem; }
    .ai-summary ul li { margin-bottom:6px; }
    .trust-strip { background:#F0FAFF; border-top:3px solid ${acc}; border-bottom:3px solid ${acc}; padding:28px 0; }
    .trust-items { display:flex; justify-content:center; gap:24px; flex-wrap:wrap; }
    .trust-item { display:flex; align-items:center; gap:10px; font-size:.95rem; font-weight:600; color:${pri}; }
    .trust-icon { font-size:1.4rem; }
    .services-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:20px; margin-top:24px; }
    .service-card { background:#fff; border:1px solid #D9E2EC; border-radius:12px; padding:24px; box-shadow:0 2px 8px rgba(0,0,0,.05); }
    .service-card .icon { font-size:1.8rem; margin-bottom:12px; }
    .service-card h3 { color:${pri}; font-size:1rem; margin:0 0 8px; }
    .service-card p  { color:#64748b; font-size:.88rem; margin:0; line-height:1.5; }
    .process-steps { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:24px; margin-top:32px; }
    .step { text-align:center; }
    .step-num { width:48px; height:48px; background:${pri}; color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.1rem; font-weight:800; margin:0 auto 14px; }
    .step h3 { font-size:.95rem; color:${pri}; margin:0 0 6px; }
    .step p  { font-size:.85rem; color:#64748b; margin:0; }
    .enquiry-inner { display:flex; align-items:flex-start; gap:52px; }
    .enquiry-text { flex:3 1 0; min-width:0; }
    .enquiry-text h2 { text-align:left; margin-bottom:20px; }
    .enquiry-media { flex:3 1 0; min-width:0; padding-top:8px; }
    .enquiry-media img { border-radius:12px; box-shadow:0 6px 24px rgba(0,0,0,.10); width:100%; height:auto; display:block; }
    .image-band { padding:48px 0; line-height:0; }
    .image-band img { width:100%; height:auto; max-height:460px; object-fit:cover; object-position:center; display:block; border-radius:10px; box-shadow:0 4px 20px rgba(0,0,0,.08); }
    .gallery-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-top:24px; }
    .gallery-img { background:#e2e8f0; border-radius:10px; aspect-ratio:4/3; display:flex; align-items:center; justify-content:center; font-size:2.5rem; color:#94a3b8; }
    .testimonials-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:20px; margin-top:24px; }
    .testimonial { background:#fff; border:1px solid #D9E2EC; border-radius:12px; padding:24px; box-shadow:0 2px 8px rgba(0,0,0,.05); }
    .stars { color:#FBBF24; font-size:1rem; margin-bottom:10px; }
    .testimonial p { color:#334155; font-size:.95rem; font-style:italic; margin:0 0 14px; }
    .reviewer { display:flex; align-items:center; gap:10px; }
    .reviewer-avatar { width:36px; height:36px; border-radius:50%; background:${acc}; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:.85rem; flex-shrink:0; }
    .reviewer-name { font-size:.85rem; font-weight:600; color:${pri}; }
    .reviewer-loc  { font-size:.78rem; color:#64748b; }
    .pricing-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; margin-top:28px; max-width:860px; margin-left:auto; margin-right:auto; }
    .pricing-card { border:1.5px solid #D9E2EC; border-radius:14px; padding:28px 24px; background:#fff; text-align:center; }
    .pricing-card.featured { border-color:${acc}; background:${acc}10; }
    .pricing-card h3 { color:${pri}; margin:0 0 8px; }
    .pricing-price { font-size:2rem; font-weight:800; color:${pri}; margin:0 0 8px; }
    .pricing-price span { font-size:1rem; font-weight:400; color:#64748b; }
    .pricing-features { list-style:none; padding:0; margin:16px 0 24px; text-align:left; }
    .pricing-features li { padding:5px 0; font-size:.88rem; color:#334155; border-bottom:1px solid #f1f5f9; }
    .pricing-features li::before { content:"✓ "; color:${acc}; font-weight:700; }
    .resource-card-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; margin-top:24px; }
    .resource-card { display:block; background:#fff; border:1px solid #D9E2EC; border-radius:12px; padding:24px; box-shadow:0 2px 8px rgba(0,0,0,.05); color:inherit; }
    .resource-card:hover { border-color:${pri}; text-decoration:none; }
    .resource-card h3 { color:${pri}; font-size:1rem; margin:0 0 8px; }
    .resource-card p  { color:#64748b; font-size:.88rem; margin:0; }
    .map-section { padding:56px 0; }
    .map-section h2 { margin-bottom:24px; }
    .map-embed { width:100%; height:400px; border:0; border-radius:12px; display:block; }
    .map-address { margin-top:16px; padding:16px 20px; background:#F4F6F8; border-radius:8px; font-size:.9rem; color:#334155; }
    .map-address strong { color:${pri}; display:block; margin-bottom:4px; }
    .faq-list { display:flex; flex-direction:column; gap:14px; margin-top:20px; }
    .faq-card { background:#fff; border:1px solid #D9E2EC; border-radius:10px; padding:20px 24px; }
    .faq-q { font-size:1rem; color:${pri}; margin:0 0 6px; font-weight:600; }
    .faq-a { margin:0; color:#334155; font-size:.95rem; }
    .areas-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:10px; margin-top:20px; }
    .area-link { display:block; background:#fff; border:1px solid #D9E2EC; border-radius:8px; padding:10px 14px; text-align:center; font-size:.88rem; color:${pri}; font-weight:600; }
    .area-link:hover { border-color:${pri}; text-decoration:none; }
    .cta-band { background:linear-gradient(135deg,${pri} 0%,${acc} 100%); color:#fff; padding:64px 0; text-align:center; }
    .cta-band h2  { color:#fff; margin:0 0 16px; }
    .cta-close    { font-size:1.05rem; opacity:.9; max-width:600px; margin:0 auto 28px; }
    .money-page-band { background:#EFF6FF; border-top:1px solid #BFDBFE; border-bottom:1px solid #BFDBFE; padding:20px 0; }
    .money-page-band p { margin:0; font-size:1rem; color:#1e3a5f; text-align:center; }
    .site-footer { background:#0B1F3A; color:#94A3B8; padding:56px 0 0; font-size:.95rem; }
    .footer-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:32px; padding-bottom:48px; }
    .footer-grid h4  { color:#fff; font-size:.95rem; font-weight:700; margin:0 0 12px; }
    .footer-grid p   { margin:0 0 6px; line-height:1.6; }
    .footer-grid a   { color:#94A3B8; }
    .footer-grid a:hover { color:#fff; text-decoration:none; }
    .footer-bottom { border-top:1px solid #1E3A5F; padding:20px 0; font-size:.85rem; color:#64748b; text-align:center; }
    @media(max-width:900px){ .resource-card-grid,.pricing-grid { grid-template-columns:1fr 1fr; } .gallery-grid { grid-template-columns:1fr 1fr; } }
    @media(max-width:720px){ .hero-inner,.enquiry-inner { flex-direction:column; gap:28px; } .section-2col { column-count:1; } .process-steps { grid-template-columns:1fr 1fr; } }
  `;
}

function demoBanner(templateId: string, templateName: string, pri: string): string {
  return `<div style="background:#1e293b;color:#fff;padding:10px 28px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:.8rem">
    <div>
      <strong style="font-size:.9rem">TEMPLATE DEMO</strong>
      <span style="font-family:monospace;background:#334155;padding:2px 8px;border-radius:3px;margin-left:8px">${templateId}</span>
      <span style="color:#94a3b8;margin-left:10px">${templateName}</span>
    </div>
    <div style="display:flex;gap:8px">
      <a href="/api/templates/${templateId}/blocks" target="_blank" style="color:#94a3b8;background:#334155;padding:3px 8px;border-radius:3px;text-decoration:none">Block list ↗</a>
      <a href="/api/templates/${templateId}" target="_blank" style="color:#94a3b8;background:#334155;padding:3px 8px;border-radius:3px;text-decoration:none">JSON ↗</a>
    </div>
  </div>`;
}

// ── Per-template demo page builders ──────────────────────────────────────────

function buildDefaultDemo(templateId: string, templateName: string): string {
  // Serve the actual generated Cudworth page with a demo banner injected
  const WORKSPACE = process.cwd().includes("artifacts")
    ? path.resolve(process.cwd(), "../../")
    : process.cwd();
  const pagePath = path.join(WORKSPACE, "output/rotherham-proof/cudworth/index.html");
  if (fs.existsSync(pagePath)) {
    const html = fs.readFileSync(pagePath, "utf8");
    const banner = demoBanner(templateId, templateName, "#003A6D");
    return html.replace("<body>", `<body>${banner}`);
  }
  return buildFallbackDemo(templateId, templateName, "#003A6D", "#1CA9C9");
}

function buildTradesDemo(templateId: string, templateName: string): string {
  // ── Cluster page: "emergency plumber Crookes" (cluster under hub "plumber Sheffield") ──
  const pri = "#1B3A4B", acc = "#E8851A";
  const kw   = "emergency plumber Crookes";          // target keyword
  const loc  = "Crookes";                             // cluster location
  const hub  = "plumber Sheffield";                   // hub page keyword
  const svc  = "emergency plumbing";
  const clusterAreas = ["Walkley","Broomhill","Hillsborough","Ecclesall","Nether Edge","Woodseats","Meersbrook","Norton","Handsworth","Beighton","Chapeltown","Mosborough","Stocksbridge","Gleadless","Oughtibridge","Millhouses"];
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${kw} | Apex Plumbing & Heating</title>
<meta name="description" content="${kw} from Apex Plumbing & Heating. Gas Safe engineers, 60-minute call-out, fixed-price quotes. Serving ${loc} and all of Sheffield 24/7." />
<link rel="canonical" href="/crookes/" />
<style>${demoCSS(pri, acc)}</style></head><body>
${demoBanner(templateId, templateName, pri)}

<header class="site-header"><div class="container">
  <div><img src="https://via.placeholder.com/160x40/1B3A4B/ffffff?text=Apex+Plumbing" alt="Apex Plumbing & Heating" style="height:40px;border-radius:4px;"></div>
  <nav><a href="/plumber-sheffield/">plumber Sheffield</a><a href="/areas/">Areas</a><a href="/contact/">Contact</a></nav>
</div></header>

<!-- ① HERO — H1 = exact target keyword -->
<section id="hero-section" class="hero">
  <div class="wrap"><div class="hero-inner">
    <div class="hero-text">
      <p class="section-label">Apex Plumbing & Heating</p>
      <h1>${kw}</h1>
      <p class="intro">${kw.charAt(0).toUpperCase()+kw.slice(1)} helps homeowners and landlords in ${loc} resolve plumbing crises fast. Apex Plumbing & Heating sends Gas Safe engineers to ${loc} within 60 minutes — day or night. Fixed-price quotes, no call-out fee, and a 12-month guarantee on all work.</p>
      <a class="btn" href="/contact/" style="background:${acc}">Call 0114 000 0000</a>
    </div>
    <div class="hero-media"><img src="/assets/image-packs/plumber/02.jpg" alt="Emergency plumber Crookes" style="width:100%;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.12);display:block;"></div>
  </div></div>
</section>

<!-- ② MONEY PAGE LINK — internal link to hub -->
<div class="money-page-band"><div class="container">
  <p>Looking for full coverage across the city? Visit our main <a href="/plumber-sheffield/">${hub}</a> page to see every area we serve.</p>
</div></div>

<!-- ③ TRUST SIGNALS -->
<section class="trust-strip">
  <div class="container"><div class="trust-items">
    <div class="trust-item"><span class="trust-icon">🛡</span> Gas Safe Registered</div>
    <div class="trust-item"><span class="trust-icon">⏱</span> 60-Min Response</div>
    <div class="trust-item"><span class="trust-icon">📅</span> 24/7 Including Weekends</div>
    <div class="trust-item"><span class="trust-icon">✅</span> Fixed-Price Quotes</div>
    <div class="trust-item"><span class="trust-icon">⭐</span> 500+ 5-Star Reviews</div>
  </div></div>
</section>

<!-- ④ SERVICES GRID — ${svc} in ${loc} -->
<section class="section-band"><div class="wrap">
  <p class="section-label" style="text-align:center">${kw}</p>
  <h2>${svc.charAt(0).toUpperCase()+svc.slice(1)} services available in ${loc}</h2>
  <div class="services-grid">
    <div class="service-card"><div class="icon">💧</div><h3>Burst Pipes — ${loc}</h3><p>Immediate response to burst and leaking pipes in ${loc} homes. We isolate, repair, and restore water supply same visit.</p></div>
    <div class="service-card"><div class="icon">🔥</div><h3>Boiler Breakdown — ${loc}</h3><p>Gas Safe boiler repairs for ${loc} residents. Most makes and models. We carry common parts on the van.</p></div>
    <div class="service-card"><div class="icon">🚽</div><h3>Blocked Drains — ${loc}</h3><p>High-pressure jetting and manual clearance for blocked sinks, toilets, and external drains in ${loc}.</p></div>
    <div class="service-card"><div class="icon">🌡</div><h3>No Heating — ${loc}</h3><p>Central heating breakdowns in ${loc} diagnosed and fixed fast. Radiators, thermostats, and pump repairs.</p></div>
    <div class="service-card"><div class="icon">🔍</div><h3>Leak Detection — ${loc}</h3><p>Thermal imaging to find hidden leaks in ${loc} properties without unnecessary damage to walls or floors.</p></div>
    <div class="service-card"><div class="icon">🪠</div><h3>Overflow Repairs — ${loc}</h3><p>Toilet overflows and cistern repairs in ${loc}. We stop the flow and fix the root cause in a single call-out.</p></div>
  </div>
</div></section>

<!-- ⑤ WHY IT MATTERS — why ${kw} matters -->
<section class="section-band section-band--alt"><div class="wrap">
  <h2>Why ${kw} matters for ${loc} homeowners</h2>
  <div class="section-2col">
    <p>A plumbing emergency ignored even for a few hours can turn a small repair into a costly disaster. Water damage spreads quickly behind walls and under floors, causing structural problems, mould growth, and insurance disputes. Homeowners in ${loc} need a fast local response — not a national call centre with days of waiting.</p>
    <p>Much of ${loc}'s housing stock consists of Edwardian and Victorian terraces with ageing copper pipework, lead joints, and systems that predate modern water pressure standards. A plumber unfamiliar with period properties can miss warning signs that an experienced local engineer spots immediately.</p>
    <p>Competition among tradespeople in ${loc} varies widely. Many are booked out or cover the area only occasionally. Apex maintains dedicated capacity for ${loc} — our engineers know the postcode, the pipe layouts typical to the area, and the fastest routes to reach you.</p>
    <p>Every hour matters when water is running. Delays mean more damage, higher repair costs, and greater disruption to your household. See how our <a href="/plumber-sheffield/">${hub}</a> service covers every corner of the city, with ${loc} at the heart of our western Sheffield response zone.</p>
  </div>
</div></section>

<!-- ⑥ PROCESS STEPS — how to get an ${kw} -->
<section class="section-band"><div class="wrap">
  <p class="section-label" style="text-align:center">How it works</p>
  <h2>Getting an ${kw} to your door</h2>
  <div class="process-steps">
    <div class="step"><div class="step-num">1</div><h3>Call Us Now</h3><p>Ring 0114 000 0000. We take your address, describe the problem, and confirm a fixed-price quote over the phone.</p></div>
    <div class="step"><div class="step-num">2</div><h3>Engineer Dispatched</h3><p>A local Gas Safe engineer sets off immediately. ETA under 60 minutes to any ${loc} address — tracked in real time.</p></div>
    <div class="step"><div class="step-num">3</div><h3>Problem Assessed</h3><p>The engineer inspects the fault, explains exactly what's needed, and confirms the fixed price before touching anything.</p></div>
    <div class="step"><div class="step-num">4</div><h3>Fixed & Guaranteed</h3><p>Work completed, tested, and backed by a 12-month labour guarantee. We leave your property clean and safe.</p></div>
  </div>
</div></section>

<!-- ⑦ WHAT YOU GET — ${kw} outcomes -->
<section class="section-band section-band--alt"><div class="wrap">
  <h2>What you get with ${kw} from Apex</h2>
  <div class="section-2col">
    <p>${kw.charAt(0).toUpperCase()+kw.slice(1)} from Apex Plumbing & Heating means a qualified Gas Safe engineer at your ${loc} door within 60 minutes — any time of day or night, including bank holidays. There is no call-out fee and no extra charge for out-of-hours attendance.</p>
    <p>Every job comes with a fixed-price quote agreed before work begins. The price you're quoted is the price you pay. Our engineers carry full public liability insurance, and all parts come with manufacturer warranties in addition to our own 12-month labour guarantee.</p>
    <p>${loc} sits in our core western Sheffield response zone, so you benefit from the fastest possible attendance times. Engineers working this area have specific experience with the housing stock — from the Victorian terraces near Crookes Road to the larger 1930s semis closer to Sandygate.</p>
    <p>For landlords in ${loc}, we provide same-day landlord certificates (CP12), boiler services, and EICR reports. Letting agents can set up a priority account for rapid response to tenant emergency calls across their managed portfolio.</p>
  </div>
</div></section>

<!-- ⑧ CONVERSION IMAGE -->
<section style="padding:0;line-height:0;overflow:hidden;max-height:320px"><img src="/assets/image-packs/plumber/04.jpg" alt="Plumbing work in progress" style="width:100%;object-fit:cover;display:block;"></section>

<!-- ⑨ TESTIMONIALS — ${loc} customers -->
<section class="section-band"><div class="wrap">
  <p class="section-label" style="text-align:center">${loc} reviews</p>
  <h2>What ${loc} homeowners say about Apex</h2>
  <div class="testimonials-grid">
    <div class="testimonial"><div class="stars">★★★★★</div><p>"Pipe burst in the kitchen at 7am. Apex had someone here by 7:55. Sorted within an hour and the price matched exactly what they quoted on the phone. Brilliant."</p><div class="reviewer"><div class="reviewer-avatar" style="background:${acc}">GH</div><div><div class="reviewer-name">Gary H.</div><div class="reviewer-loc">${loc} Road, Sheffield S10</div></div></div></div>
    <div class="testimonial"><div class="stars">★★★★★</div><p>"Boiler stopped working the night before a tenant moved in. Apex fixed it same afternoon, provided the gas certificate, and the whole thing was done at a fair fixed price."</p><div class="reviewer"><div class="reviewer-avatar" style="background:${acc}">LP</div><div><div class="reviewer-name">Laura P.</div><div class="reviewer-loc">Landlord, ${loc}, S10</div></div></div></div>
    <div class="testimonial"><div class="stars">★★★★★</div><p>"No heating for three days in January. Called four plumbers — Apex were the only ones who answered and came the same day. Knew exactly what was wrong within minutes."</p><div class="reviewer"><div class="reviewer-avatar" style="background:${acc}">MT</div><div><div class="reviewer-name">Mark T.</div><div class="reviewer-loc">Tapton Hill, ${loc}</div></div></div></div>
  </div>
</div></section>

<!-- ⑩ MAP — ${loc} -->
<section class="map-section"><div class="wrap">
  <h2>${kw.charAt(0).toUpperCase()+kw.slice(1)} — we cover the whole ${loc} area</h2>
  <iframe class="map-embed" src="https://maps.google.com/maps?q=Crookes+Sheffield+S10&t=&z=14&ie=UTF8&iwloc=&output=embed" title="${loc} Sheffield map" loading="lazy"></iframe>
  <div class="map-address"><strong>Apex Plumbing & Heating</strong>Serving ${loc}, Sheffield S10 — including Crookes Road, Sandygate, Tapton Hill, and Lydgate.<br><a href="https://maps.google.com/?q=Crookes+Sheffield+S10" target="_blank">View ${loc} on Google Maps ↗</a></div>
</div></section>

<!-- ⑪ CTA BAND -->
<section class="cta-band"><div class="container">
  <h2>Need an ${kw} right now?</h2>
  <p class="cta-close">Don't wait for water damage to get worse. Call Apex for a 60-minute response in ${loc} — fixed price, Gas Safe, 24/7. No call-out fee.</p>
  <a class="btn btn-white" href="#">Call 0114 000 0000</a>
  <a class="btn" href="#" style="margin-left:16px;border:2px solid rgba(255,255,255,.4)">Request a Call Back</a>
</div></section>

<!-- ⑫ FAQ — ${kw} specific -->
<section class="section-band"><div class="wrap" style="max-width:860px">
  <h2>Frequently asked questions — ${kw}</h2>
  <div class="faq-list">
    <div class="faq-card"><p class="faq-q">How fast can an ${kw} reach me?</p><p class="faq-a">${loc} is in our core western Sheffield response zone. We typically reach ${loc} addresses within 40–60 minutes of your call, including late evenings and weekends.</p></div>
    <div class="faq-card"><p class="faq-q">Is there a call-out fee for ${loc}?</p><p class="faq-a">No. Apex does not charge a call-out fee for any ${loc} emergency. You pay only for the work carried out, at the fixed price quoted before we begin.</p></div>
    <div class="faq-card"><p class="faq-q">Do you cover ${loc} out of hours?</p><p class="faq-a">Yes — we provide 24/7 ${svc} in ${loc}, including evenings, weekends, and bank holidays at standard rates. There is no premium for out-of-hours attendance.</p></div>
    <div class="faq-card"><p class="faq-q">Are you Gas Safe registered to work in ${loc}?</p><p class="faq-a">Yes. All Apex engineers hold current Gas Safe registration. You can verify our registration number (123456) on the official Gas Safe Register website at gassaferegister.co.uk.</p></div>
    <div class="faq-card"><p class="faq-q">Which streets in ${loc} do you cover?</p><p class="faq-a">We cover the full ${loc} S10 postcode, including Crookes Road, Sandygate Road, Tapton Hill Road, Lydgate Lane, and all surrounding streets. See our <a href="/plumber-sheffield/">${hub}</a> page for full coverage.</p></div>
  </div>
</div></section>

<!-- ⑬ AREAS COVER — sibling cluster pages -->
<section class="section-band section-band--alt"><div class="wrap">
  <h2>Other Sheffield areas we cover</h2>
  <p style="text-align:center;color:#64748b;margin-bottom:4px">Visit the page for your area to find your local ${svc} response time and coverage details.</p>
  <div class="areas-grid">
    ${clusterAreas.map(a=>`<a href="/emergency-plumber-${a.toLowerCase().replace(/ /g,'-')}/" class="area-link">emergency plumber ${a}</a>`).join("")}
  </div>
</div></section>

<footer class="site-footer"><div class="container">
  <div class="footer-grid">
    <div><h4>Apex Plumbing & Heating</h4><p>Gas Safe plumbers serving Sheffield S1–S36. Emergency call-outs, boiler repair, central heating, and drain clearance.</p><p style="margin-top:10px">📞 0114 000 0000</p><p><a href="mailto:hello@apexplumbing.co.uk">hello@apexplumbing.co.uk</a></p></div>
    <div><h4>${svc.charAt(0).toUpperCase()+svc.slice(1)}</h4><p><a href="#">Burst Pipe Repair</a></p><p><a href="#">Boiler Breakdown</a></p><p><a href="#">Blocked Drains</a></p><p><a href="#">No Heating</a></p><p><a href="#">Leak Detection</a></p></div>
    <div><h4>Sheffield Areas</h4><p><a href="/plumber-sheffield/">${hub} (hub)</a></p>${clusterAreas.slice(0,5).map(a=>`<p><a href="#">emergency plumber ${a}</a></p>`).join("")}</div>
    <div><h4>Company</h4><p><a href="#">About Apex</a></p><p><a href="#">Gas Safe Certificate</a></p><p><a href="#">Landlord Services</a></p><p><a href="#">Privacy Policy</a></p><p><a href="#">Terms & Conditions</a></p></div>
  </div>
  <div class="footer-bottom">© 2026 Apex Plumbing & Heating Ltd · Gas Safe No. 123456 · Registered in England & Wales</div>
</div></footer>
</body></html>`;
}

function buildBeautyDemo(templateId: string, templateName: string): string {
  const pri = "#4A1942", acc = "#C9779A";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hair Salon Barnsley | Luxe Hair Studio</title>
<style>${demoCSS(pri, acc)}</style></head><body>
${demoBanner(templateId, templateName, pri)}
<header class="site-header"><div class="container">
  <div style="font-size:1.2rem;font-weight:800;color:${pri}">✨ Luxe Hair Studio</div>
  <nav><a href="#">Treatments</a><a href="#">Gallery</a><a href="#">Pricing</a><a href="#" style="background:${acc};color:#fff;padding:8px 18px;border-radius:6px;font-weight:600">Book Now</a></nav>
</div></header>

<!-- HERO -->
<section class="hero" style="background:linear-gradient(135deg,${pri} 0%,#7B2D6B 100%)">
  <div class="wrap"><div class="hero-inner">
    <div class="hero-text">
      <p class="section-label" style="color:rgba(255,255,255,.7)">Award-Winning Salon</p>
      <h1 style="color:#fff">Hair Salon Barnsley — Where Every Cut Tells Your Story</h1>
      <p class="intro" style="color:rgba(255,255,255,.9)">Luxe Hair Studio is Barnsley's premier destination for precision cuts, vibrant colour, and transformative treatments. Our experienced stylists combine artistry with technique to give you hair you'll love every single day.</p>
      <a class="btn" href="#" style="background:${acc}">Book an Appointment</a>
      <a class="btn btn-white" href="#" style="margin-left:12px">View Our Work</a>
    </div>
    <div class="hero-media"><img src="/assets/image-packs/hairdresser/01.jpg" alt="Hair salon Barnsley" style="width:100%;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.2);display:block;"></div>
  </div></div>
</section>

<!-- SERVICES GRID -->
<section class="section-band"><div class="wrap">
  <p class="section-label" style="text-align:center">Our Treatments</p>
  <h2>A Full Range of Hair Services in Barnsley</h2>
  <div class="services-grid">
    <div class="service-card"><div class="icon">✂️</div><h3>Cuts & Styling</h3><p>Precision cuts for all hair types and lengths. Blow-dries, straightening, and special occasion styling.</p></div>
    <div class="service-card"><div class="icon">🎨</div><h3>Colour & Highlights</h3><p>From subtle sun-kissed highlights to bold all-over colour. Our colourists use only professional-grade products.</p></div>
    <div class="service-card"><div class="icon">🌅</div><h3>Balayage</h3><p>Hand-painted balayage for a natural, sun-kissed effect that grows out beautifully with minimal maintenance.</p></div>
    <div class="service-card"><div class="icon">💫</div><h3>Hair Extensions</h3><p>Nano-ring, tape-in, and micro-ring extensions using 100% Remy human hair. Added length and volume in a single visit.</p></div>
    <div class="service-card"><div class="icon">💆‍♀️</div><h3>Treatments</h3><p>Keratin smoothing, Olaplex bond repair, deep conditioning, and scalp treatments to restore damaged hair.</p></div>
    <div class="service-card"><div class="icon">💍</div><h3>Bridal & Occasions</h3><p>Bridal hair and makeup packages, plus special occasion styling for prom, parties, and events.</p></div>
  </div>
</div></section>

<!-- WHY IT MATTERS -->
<section class="section-band section-band--alt"><div class="wrap">
  <h2>Why your choice of salon in Barnsley matters</h2>
  <div class="section-2col">
    <p>Your hair is one of the first things people notice. An outdated cut or an unhappy colour result affects your confidence every morning — in meetings, on dates, and in photographs you'll keep for years.</p>
    <p>Not all salons are created equal. Mass-market chains cycle through junior stylists and rush appointments. The result is inconsistent colour, uneven cuts, and hair that doesn't behave between visits. Luxury doesn't have to mean London prices.</p>
    <p>At Luxe, your stylist takes time for a proper consultation before picking up scissors. We look at your lifestyle, maintenance preference, face shape, and hair condition. The cut we give you works for your real life — not just in the salon chair.</p>
    <p>Barnsley clients drive from Wakefield, Doncaster, and Rotherham to visit us because the results speak for themselves. Book a consultation and see the difference a great salon makes.</p>
  </div>
</div></section>

<!-- GALLERY -->
<section class="section-band"><div class="wrap">
  <p class="section-label" style="text-align:center">Our Work</p>
  <h2>Before & After Gallery</h2>
  <div class="gallery-grid">
    <div class="gallery-img" style="padding:0;overflow:hidden"><img src="/assets/image-packs/hairdresser/02.jpg" alt="Hairdresser work" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:10px;"></div>
    <div class="gallery-img" style="padding:0;overflow:hidden"><img src="/assets/image-packs/hairdresser/03.jpg" alt="Hair colour" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:10px;"></div>
    <div class="gallery-img" style="padding:0;overflow:hidden"><img src="/assets/image-packs/hairdresser/04.jpg" alt="Styling session" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:10px;"></div>
    <div class="gallery-img" style="padding:0;overflow:hidden"><img src="/assets/image-packs/hairdresser/05.jpg" alt="Hair treatment" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:10px;"></div>
    <div class="gallery-img" style="padding:0;overflow:hidden"><img src="/assets/image-packs/hairdresser/06.jpg" alt="Salon interior" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:10px;"></div>
    <div class="gallery-img" style="padding:0;overflow:hidden"><img src="/assets/image-packs/hairdresser/07.jpg" alt="Finished style" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:10px;"></div>
  </div>
</div></section>

<!-- TRUST SIGNALS -->
<section class="trust-strip">
  <div class="container"><div class="trust-items">
    <div class="trust-item"><span class="trust-icon">🏆</span> Best Salon Barnsley 2025</div>
    <div class="trust-item"><span class="trust-icon">⭐</span> 600+ 5-Star Reviews</div>
    <div class="trust-item"><span class="trust-icon">🎓</span> L'Oréal Certified Colourists</div>
    <div class="trust-item"><span class="trust-icon">✅</span> Wella Professionals Partner</div>
    <div class="trust-item"><span class="trust-icon">💚</span> Eco-Friendly Products</div>
  </div></div>
</section>

<!-- WHAT YOU GET -->
<section class="section-band section-band--alt"><div class="wrap">
  <h2>What every Luxe client gets</h2>
  <div class="section-2col">
    <p>Every visit begins with a complimentary consultation and scalp analysis. Your stylist will assess your hair's condition, discuss what you want to achieve, and recommend a realistic plan — including what's possible on your first visit.</p>
    <p>We use professional-grade products exclusively. L'Oréal Professionnel for colour, Olaplex for bond protection, and Wella for treatments. Nothing from a high-street shelf touches your hair in our salon.</p>
    <p>Our prices are transparent. You'll receive a quote before any service begins, and we don't add surprise charges. We also offer a complimentary blow-dry with every colour and full-price cut.</p>
    <p>Can't make it in? We offer a mobile service for bridal parties of four or more. Our stylists come to your venue fully equipped — perfect for wedding morning preparation across Barnsley and South Yorkshire.</p>
  </div>
</div></section>

<!-- TESTIMONIALS -->
<section class="section-band"><div class="wrap">
  <p class="section-label" style="text-align:center">Client Love</p>
  <h2>What Our Clients Say</h2>
  <div class="testimonials-grid">
    <div class="testimonial"><div class="stars">★★★★★</div><p>"I've been to salons all over South Yorkshire and nobody does balayage like Luxe. My hair looked incredible for my wedding and the colour grew out so naturally. Worth every penny."</p><div class="reviewer"><div class="reviewer-avatar" style="background:${acc}">EM</div><div><div class="reviewer-name">Emma M.</div><div class="reviewer-loc">Penistone, Barnsley</div></div></div></div>
    <div class="testimonial"><div class="stars">★★★★★</div><p>"Had a full head of extensions fitted — the team was so professional and the results are stunning. Nobody can tell they're extensions. Completely natural looking and so much volume!"</p><div class="reviewer"><div class="reviewer-avatar" style="background:${acc}">CL</div><div><div class="reviewer-name">Charlotte L.</div><div class="reviewer-loc">Wombwell, Barnsley</div></div></div></div>
    <div class="testimonial"><div class="stars">★★★★★</div><p>"First time going to Luxe after years at a chain salon. The difference is night and day. My stylist actually listened to what I wanted and my hair has never looked better."</p><div class="reviewer"><div class="reviewer-avatar" style="background:${acc}">RH</div><div><div class="reviewer-name">Rachel H.</div><div class="reviewer-loc">Darton, Barnsley</div></div></div></div>
  </div>
</div></section>

<!-- PRICING -->
<section class="section-band section-band--alt"><div class="wrap">
  <p class="section-label" style="text-align:center">Transparent Pricing</p>
  <h2>Our Price Guide</h2>
  <div class="pricing-grid">
    <div class="pricing-card"><h3>Cuts & Blow-Dry</h3><div class="pricing-price">From £35<span>/visit</span></div><ul class="pricing-features"><li>Wash, cut & blow-dry</li><li>Scalp massage</li><li>Styling advice</li><li>Free fringe trim between visits</li></ul><a class="btn" href="#" style="display:block;text-align:center">Book Now</a></div>
    <div class="pricing-card featured"><h3>Colour Service</h3><div class="pricing-price">From £75<span>/session</span></div><ul class="pricing-features"><li>Full head colour or highlights</li><li>Complimentary blow-dry</li><li>Olaplex bond protection</li><li>Aftercare kit included</li></ul><a class="btn btn-accent" href="#" style="display:block;text-align:center;background:${acc}">Book Now</a></div>
    <div class="pricing-card"><h3>Balayage & Ombre</h3><div class="pricing-price">From £110<span>/session</span></div><ul class="pricing-features"><li>Hand-painted balayage</li><li>Toning & glossing</li><li>Full blow-dry & style</li><li>Maintenance plan included</li></ul><a class="btn" href="#" style="display:block;text-align:center">Book Now</a></div>
  </div>
</div></section>

<!-- MAP -->
<section class="map-section"><div class="wrap">
  <h2>Find Luxe Hair Studio in Barnsley</h2>
  <iframe class="map-embed" src="https://maps.google.com/maps?q=Barnsley+Town+Centre&t=&z=14&ie=UTF8&iwloc=&output=embed" title="Barnsley map" loading="lazy"></iframe>
  <div class="map-address"><strong>Luxe Hair Studio</strong>14 Market Street, Barnsley Town Centre, S70 2QL<br><a href="https://maps.google.com/?q=Barnsley+Town+Centre" target="_blank">View on Google Maps ↗</a></div>
</div></section>

<!-- CTA BAND -->
<section class="cta-band"><div class="container">
  <h2>Ready for Hair You'll Love?</h2>
  <p class="cta-close">Book your appointment at Luxe Hair Studio today. New clients receive a free in-depth consultation and a 10% discount on their first full-price service.</p>
  <a class="btn btn-white" href="#">Book Online Now</a>
  <a class="btn" href="#" style="margin-left:16px;border:2px solid rgba(255,255,255,.4)">Call 01226 000 000</a>
</div></section>

<!-- FAQ -->
<section class="section-band"><div class="wrap" style="max-width:860px">
  <h2>Frequently Asked Questions</h2>
  <div class="faq-list">
    <div class="faq-card"><p class="faq-q">Do I need to book in advance?</p><p class="faq-a">Yes — we're a popular salon and most appointments need to be booked at least a week in advance. For colour and extension services, we recommend two weeks' notice. We do hold a small number of walk-in slots each week — call us to check availability.</p></div>
    <div class="faq-card"><p class="faq-q">What products do you use?</p><p class="faq-a">We exclusively use professional-grade products including L'Oréal Professionnel, Wella Professionals, and Olaplex. We do not use supermarket or high-street products on client hair.</p></div>
    <div class="faq-card"><p class="faq-q">Can I bring my own inspiration photos?</p><p class="faq-a">Absolutely — we encourage it. Instagram and Pinterest references help your stylist understand the look you're after. We'll advise on what's achievable based on your current hair and its condition.</p></div>
    <div class="faq-card"><p class="faq-q">How long does a balayage take?</p><p class="faq-a">A full balayage appointment typically takes 3–4 hours including consultation, application, processing time, toning, blow-dry, and style. Please allow half a day when you book.</p></div>
  </div>
</div></section>

<footer class="site-footer"><div class="container">
  <div class="footer-grid">
    <div><h4>Luxe Hair Studio</h4><p>Barnsley's award-winning hair salon. Precision cuts, expert colour, and transformative treatments.</p><p style="margin-top:10px">📞 01226 000 000</p></div>
    <div><h4>Treatments</h4><p><a href="#">Cuts & Styling</a></p><p><a href="#">Colour & Highlights</a></p><p><a href="#">Balayage</a></p><p><a href="#">Hair Extensions</a></p></div>
    <div><h4>Information</h4><p><a href="#">Price Guide</a></p><p><a href="#">Booking Policy</a></p><p><a href="#">Gift Vouchers</a></p><p><a href="#">Bridal Packages</a></p></div>
    <div><h4>Visit Us</h4><p>14 Market Street</p><p>Barnsley Town Centre</p><p>South Yorkshire</p><p>S70 2QL</p></div>
  </div>
  <div class="footer-bottom">© 2026 Luxe Hair Studio Ltd · Barnsley · All rights reserved</div>
</div></footer>
</body></html>`;
}

function buildProfessionalDemo(templateId: string, templateName: string): string {
  const pri = "#1A2E44", acc = "#2563EB";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Accountants Sheffield | Apex Accounts Ltd</title>
<style>${demoCSS(pri, acc)}</style></head><body>
${demoBanner(templateId, templateName, pri)}
<header class="site-header"><div class="container">
  <div style="font-size:1.2rem;font-weight:800;color:${pri}">Apex Accounts <span style="color:${acc}">Ltd</span></div>
  <nav><a href="#">Services</a><a href="#">About</a><a href="#">Resources</a><a href="#" style="background:${acc};color:#fff;padding:8px 18px;border-radius:6px;font-weight:600">Free Consultation</a></nav>
</div></header>

<!-- HERO -->
<section class="hero"><div class="wrap"><div class="hero-inner">
  <div class="hero-text">
    <p class="section-label">Apex Accounts Ltd</p>
    <h1>Trusted Accountants in Sheffield — Tax, Payroll & Business Advice</h1>
    <p class="intro">Apex Accounts Ltd has helped over 400 Sheffield businesses and individuals manage their finances, reduce their tax burden, and grow with confidence since 2003. We combine local knowledge with expert accountancy to deliver results that matter.</p>
    <a class="btn" href="#">Book a Free Consultation</a>
  </div>
  <div class="hero-media"><img src="/assets/image-packs/accountant/01.jpg" alt="Professional accountant Sheffield" style="width:100%;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.12);display:block;"></div>
</div></div></section>

<!-- AI SUMMARY -->
<section class="ai-summary"><div class="container">
  <h2>What do Sheffield accountants do for your business?</h2>
  <p class="quick-answer-label"><strong>Quick Answer</strong></p>
  <p>Sheffield accountants manage your tax returns, VAT, payroll, and financial reporting so you stay HMRC-compliant and never pay more tax than you need to. Apex Accounts provides proactive advice — not just number-crunching — to help your business make better financial decisions.</p>
  <ul>
    <li>Compliant tax returns filed accurately and on time — no penalties, no late fees.</li>
    <li>Proactive tax planning to legally reduce your annual tax bill.</li>
    <li>Cloud accounting setup and training so you have real-time business visibility.</li>
  </ul>
</div></section>

<!-- TRUST SIGNALS -->
<section class="trust-strip"><div class="container"><div class="trust-items">
  <div class="trust-item"><span class="trust-icon">🏛</span> ICAEW Members</div>
  <div class="trust-item"><span class="trust-icon">📅</span> 20+ Years in Sheffield</div>
  <div class="trust-item"><span class="trust-icon">👥</span> 400+ Active Clients</div>
  <div class="trust-item"><span class="trust-icon">☁️</span> Xero Gold Partners</div>
  <div class="trust-item"><span class="trust-icon">⭐</span> Rated Excellent on Trustpilot</div>
</div></div></section>

<!-- WHY IT MATTERS -->
<section class="section-band"><div class="wrap">
  <h2>Why the right Sheffield accountant matters for your business</h2>
  <div class="section-2col">
    <p>HMRC penalties for late or inaccurate filing can run into thousands of pounds. Missed deadlines for corporation tax, self-assessment, or VAT returns attract automatic fines that compound quickly. The cost of getting it wrong far exceeds the cost of professional help.</p>
    <p>Many Sheffield business owners manage their own accounts until a problem becomes expensive. By the time an HMRC investigation or cash-flow crisis arrives, months of avoidable issues have accumulated. Prevention is always cheaper than cure.</p>
    <p>A reactive accountant files your returns. A proactive accountant identifies opportunities — the right business structure, pension planning, R&D credits, capital allowances, and VAT schemes that save real money every year.</p>
    <p>Sheffield's business landscape is changing. From the Digital Campus to the advanced manufacturing sector, local businesses need accountants who understand the city's economy and the specific challenges of operating here.</p>
  </div>
</div></section>

<!-- WHAT YOU GET -->
<section class="section-band section-band--alt"><div class="wrap">
  <h2>What Apex Accounts delivers for Sheffield businesses</h2>
  <div class="section-2col">
    <p>Our core service covers everything HMRC requires — self-assessment tax returns, corporation tax, VAT returns, payroll, and statutory accounts — all filed accurately and ahead of every deadline.</p>
    <p>Beyond compliance, we provide management accounts, cash-flow forecasting, and KPI reporting so you always know where your business stands financially. Monthly or quarterly check-ins keep you on track.</p>
    <p>We set up and manage Xero cloud accounting for all clients. This gives you real-time visibility of your finances from any device and allows us to collaborate with you throughout the year — not just at year-end.</p>
    <p>Apex is also a registered agent for Companies House and HMRC. We handle all correspondence on your behalf, so you never have to deal with tax office letters, PAYE notices, or compliance queries directly.</p>
  </div>
</div></section>

<!-- PROCESS STEPS -->
<section class="section-band"><div class="wrap">
  <p class="section-label" style="text-align:center">How We Work</p>
  <h2>Getting Started with Apex Accounts</h2>
  <div class="process-steps">
    <div class="step"><div class="step-num">1</div><h3>Free Consultation</h3><p>A 45-minute meeting to understand your business, review your current situation, and identify what we can improve.</p></div>
    <div class="step"><div class="step-num">2</div><h3>Fixed Proposal</h3><p>We give you a transparent, fixed-fee proposal. No hourly rates, no surprises. You know exactly what you'll pay.</p></div>
    <div class="step"><div class="step-num">3</div><h3>Seamless Handover</h3><p>We handle the transfer from your previous accountant, HMRC authorisation, and software migration. Zero disruption.</p></div>
    <div class="step"><div class="step-num">4</div><h3>Ongoing Support</h3><p>Unlimited queries by email and phone. Monthly or quarterly reviews. Proactive advice throughout the year.</p></div>
  </div>
</div></section>

<!-- ENQUIRY SPLIT -->
<section class="section-band section-band--alt"><div class="wrap"><div class="enquiry-inner">
  <div class="enquiry-text">
    <h2>Talk to an accountant today — no obligation</h2>
    <p>We offer a free 45-minute consultation to every new client. There's no sales pitch and no obligation to proceed. We'll give you genuinely useful advice during the meeting regardless of whether you choose Apex.</p>
    <p>Most clients who book a consultation find they've been overpaying tax or missing allowances. The conversation alone pays for itself many times over.</p>
    <a class="btn" href="#">Book Free Consultation</a>
  </div>
  <div class="enquiry-media" style="flex:2"><img src="/assets/image-packs/accountant/02.jpg" alt="Accountant consultation" style="width:100%;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.10);display:block;"></div>
</div></div></section>

<!-- CONVERSION IMAGE -->
<section style="padding:0;line-height:0;overflow:hidden;max-height:280px"><img src="/assets/image-packs/accountant/03.jpg" alt="Sheffield business finance" style="width:100%;object-fit:cover;display:block;"></section>

<!-- TESTIMONIALS -->
<section class="section-band"><div class="wrap">
  <p class="section-label" style="text-align:center">Client Outcomes</p>
  <h2>What Sheffield Business Owners Say</h2>
  <div class="testimonials-grid">
    <div class="testimonial"><div class="stars">★★★★★</div><p>"Apex identified £8,400 in unclaimed R&D tax credits we'd missed for three years. The switch from our previous accountant took one week. Best financial decision we made."</p><div class="reviewer"><div class="reviewer-avatar" style="background:${acc}">MW</div><div><div class="reviewer-name">Mark W.</div><div class="reviewer-loc">Director, Sheffield Tech Ltd</div></div></div></div>
    <div class="testimonial"><div class="stars">★★★★★</div><p>"I was drowning in self-assessment paperwork every January. Apex set up Xero for me, handle everything, and I now have real visibility of my finances year-round. Transformative."</p><div class="reviewer"><div class="reviewer-avatar" style="background:${acc}">SJ</div><div><div class="reviewer-name">Sarah J.</div><div class="reviewer-loc">Freelance Consultant, S10</div></div></div></div>
    <div class="testimonial"><div class="stars">★★★★★</div><p>"Switched to Apex when our company started growing. They restructured how we operate, which saved us significant tax. Proactive, fast, and always available when I need them."</p><div class="reviewer"><div class="reviewer-avatar" style="background:${acc}">TB</div><div><div class="reviewer-name">Tom B.</div><div class="reviewer-loc">MD, Barnsley Manufacturing Co.</div></div></div></div>
  </div>
</div></section>

<!-- MAP -->
<section class="map-section"><div class="wrap">
  <h2>Visit Our Sheffield Office</h2>
  <iframe class="map-embed" src="https://maps.google.com/maps?q=Sheffield+City+Centre&t=&z=13&ie=UTF8&iwloc=&output=embed" title="Sheffield map" loading="lazy"></iframe>
  <div class="map-address"><strong>Apex Accounts Ltd</strong>Fountain Precinct, Balm Green, Sheffield, S1 2JA<br><a href="https://maps.google.com/?q=Sheffield+City+Centre" target="_blank">View on Google Maps ↗</a></div>
</div></section>

<!-- CTA BAND -->
<section class="cta-band"><div class="container">
  <h2>Stop overpaying tax. Start with a free consultation.</h2>
  <p class="cta-close">Join over 400 Sheffield businesses who trust Apex Accounts to keep their finances compliant, efficient, and growing. Your first consultation is completely free.</p>
  <a class="btn btn-white" href="#">Book Free Consultation</a>
</div></section>

<!-- FAQ -->
<section class="section-band"><div class="wrap" style="max-width:860px">
  <h2>Frequently Asked Questions</h2>
  <div class="faq-list">
    <div class="faq-card"><p class="faq-q">How much do you charge?</p><p class="faq-a">We charge a fixed monthly fee based on the scope of services you need. A sole trader self-assessment package starts from £75/month. Limited company packages from £150/month. We'll give you a fixed quote after your free consultation.</p></div>
    <div class="faq-card"><p class="faq-q">Can you take over from my current accountant?</p><p class="faq-a">Yes — we handle the entire handover process. We contact your previous accountant, obtain your records, register as your agent with HMRC, and transfer your data. Most clients experience zero disruption.</p></div>
    <div class="faq-card"><p class="faq-q">Do I need to visit your office?</p><p class="faq-a">Not necessarily. We work with many clients entirely remotely using Xero and secure document sharing. We do recommend an initial in-person or video meeting, but all ongoing work can be handled digitally.</p></div>
    <div class="faq-card"><p class="faq-q">What accounting software do you use?</p><p class="faq-a">We are Xero Gold Partners and set all new clients up on Xero cloud accounting. We also support QuickBooks and FreeAgent. We'll migrate your existing data from any platform at no additional cost.</p></div>
    <div class="faq-card"><p class="faq-q">Do you work with startups and new businesses?</p><p class="faq-a">Yes. We have a dedicated startup package that covers company formation, HMRC registration, initial Xero setup, and your first year's accounts — everything a new business needs from day one.</p></div>
  </div>
</div></section>

<!-- AREAS COVER -->
<section class="section-band section-band--alt"><div class="wrap">
  <h2>Serving Businesses Across South Yorkshire</h2>
  <div class="areas-grid">
    ${["Sheffield City","Barnsley","Rotherham","Doncaster","Chesterfield","Worksop","Stocksbridge","Chapeltown","Ecclesall","Crookes","Hillsborough","Mosborough"].map(a=>`<a href="#" class="area-link">${a}</a>`).join("")}
  </div>
</div></section>

<footer class="site-footer"><div class="container">
  <div class="footer-grid">
    <div><h4>Apex Accounts Ltd</h4><p>ICAEW-registered accountants serving Sheffield businesses since 2003. Tax, payroll, and cloud accounting experts.</p><p style="margin-top:10px">📞 0114 000 0000</p></div>
    <div><h4>Services</h4><p><a href="#">Self-Assessment Tax</a></p><p><a href="#">Corporation Tax</a></p><p><a href="#">VAT Returns</a></p><p><a href="#">Payroll</a></p><p><a href="#">Management Accounts</a></p></div>
    <div><h4>Business Types</h4><p><a href="#">Sole Traders</a></p><p><a href="#">Limited Companies</a></p><p><a href="#">Partnerships</a></p><p><a href="#">Startups</a></p><p><a href="#">Landlords</a></p></div>
    <div><h4>Office</h4><p>Fountain Precinct</p><p>Balm Green, Sheffield</p><p>S1 2JA</p><p><a href="#">Get Directions</a></p></div>
  </div>
  <div class="footer-bottom">© 2026 Apex Accounts Ltd · Registered in England & Wales No. 04123456 · ICAEW Registered</div>
</div></footer>
</body></html>`;
}

function buildRetailDemo(templateId: string, templateName: string): string {
  const pri = "#1F3D2B", acc = "#E63946";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Gift Shop Rotherham | The Corner Gift Shop</title>
<style>${demoCSS(pri, acc)}</style></head><body>
${demoBanner(templateId, templateName, pri)}
<header class="site-header"><div class="container">
  <div style="font-size:1.2rem;font-weight:800;color:${pri}">The Corner Gift Shop</div>
  <nav><a href="#">Shop</a><a href="#">Personalised</a><a href="#">About</a><a href="#" style="background:${acc};color:#fff;padding:8px 18px;border-radius:6px;font-weight:600">Visit Us</a></nav>
</div></header>

<!-- HERO -->
<section class="hero" style="background:linear-gradient(135deg,${pri} 0%,#2D5A3D 100%)">
  <div class="wrap"><div class="hero-inner">
    <div class="hero-text">
      <p class="section-label" style="color:rgba(255,255,255,.7)">Rotherham's Favourite Gift Shop</p>
      <h1 style="color:#fff">Unique Gifts & Home Accessories — Right Here in Rotherham</h1>
      <p class="intro" style="color:rgba(255,255,255,.9)">The Corner Gift Shop has been delighting Rotherham since 2011. We stock hundreds of unique gifts, handmade crafts, personalised keepsakes, and beautiful homewares — all curated with care so you always find something truly special.</p>
      <a class="btn" href="#" style="background:${acc}">Shop In Store</a>
      <a class="btn btn-white" href="#" style="margin-left:12px">Personalised Gifts</a>
    </div>
    <div class="hero-media"><img src="/assets/image-library/web-design/hero/web-design-hero-4877453b.webp" alt="Gift shop Rotherham" style="width:100%;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.2);display:block;"></div>
  </div></div>
</section>

<!-- SERVICES/PRODUCTS GRID -->
<section class="section-band"><div class="wrap">
  <p class="section-label" style="text-align:center">What We Stock</p>
  <h2>Something for Every Occasion</h2>
  <div class="services-grid">
    <div class="service-card"><div class="icon">🎁</div><h3>Gifts & Novelties</h3><p>Hundreds of thoughtful gifts for birthdays, anniversaries, retirements, and every celebration in between.</p></div>
    <div class="service-card"><div class="icon">💌</div><h3>Cards & Stationery</h3><p>A huge range of greeting cards for every occasion, plus wrap, ribbons, and beautiful stationery.</p></div>
    <div class="service-card"><div class="icon">🏠</div><h3>Homeware & Decor</h3><p>Candles, photo frames, throws, cushions, and decorative accessories to make any home feel special.</p></div>
    <div class="service-card"><div class="icon">✍️</div><h3>Personalised Items</h3><p>Custom mugs, prints, name signs, and keepsakes personalised in-store while you wait or to order.</p></div>
    <div class="service-card"><div class="icon">🌿</div><h3>Plants & Botanicals</h3><p>Indoor plants, succulents, dried flower arrangements, and botanical prints for nature lovers.</p></div>
    <div class="service-card"><div class="icon">🕯</div><h3>Candles & Fragrance</h3><p>Luxury soy candles, reed diffusers, wax melts, and home fragrance from independent UK makers.</p></div>
  </div>
</div></section>

<!-- WHY IT MATTERS -->
<section class="section-band section-band--alt"><div class="wrap">
  <h2>Why shopping local in Rotherham makes a difference</h2>
  <div class="section-2col">
    <p>Every pound spent at The Corner Gift Shop stays in Rotherham. We source from local and UK-based makers wherever possible, pay local taxes, and employ local people. That money circulates in our community rather than disappearing into a distribution warehouse.</p>
    <p>Online giants can't give you the experience of browsing something unique, holding it, and knowing it's perfect. Gift-giving is personal. We're here to help you find something that genuinely reflects how much you care — not an algorithm's recommendation.</p>
    <p>We've been here since 2011 because Rotherham people value what we do. We know our regular customers by name. We help with last-minute gift panics, personalise items on the spot, and remember who likes what. That kind of service doesn't exist on a website.</p>
    <p>Visit us and see why we've been voted Rotherham's Best Independent Retailer three years running. We're open six days a week and always ready to help you find the perfect gift.</p>
  </div>
</div></section>

<!-- GALLERY -->
<section class="section-band"><div class="wrap">
  <p class="section-label" style="text-align:center">Inside The Shop</p>
  <h2>Come and Browse</h2>
  <div class="gallery-grid">
    <div class="gallery-img" style="padding:0;overflow:hidden"><img src="/assets/image-library/web-design/hero/web-design-hero-aaddd202.webp" alt="Shop display" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:10px;"></div>
    <div class="gallery-img" style="padding:0;overflow:hidden"><img src="/assets/image-library/web-design/hero/web-design-hero-43c1b342.webp" alt="Product selection" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:10px;"></div>
    <div class="gallery-img" style="padding:0;overflow:hidden"><img src="/assets/image-library/web-design/hero/web-design-hero-25d0eb21.webp" alt="Gift collection" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:10px;"></div>
    <div class="gallery-img" style="padding:0;overflow:hidden"><img src="/assets/image-library/web-design/hero/web-design-hero-f13636b6.webp" alt="Store interior" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:10px;"></div>
    <div class="gallery-img" style="padding:0;overflow:hidden"><img src="/assets/image-library/web-design/hero/web-design-hero-1346d03e.jpg" alt="Local shop" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:10px;"></div>
    <div class="gallery-img" style="padding:0;overflow:hidden"><img src="/assets/image-library/local-seo/hero/local-seo-hero-11564c0f.webp" alt="Local business" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:10px;"></div>
  </div>
</div></section>

<!-- WHAT YOU GET -->
<section class="section-band section-band--alt"><div class="wrap">
  <h2>The Corner Gift Shop experience</h2>
  <div class="section-2col">
    <p>We offer free gift-wrapping on all purchases. Hand us your gift and we'll make it look beautiful with tissue paper, ribbon, and a handwritten gift tag — included in the price, always.</p>
    <p>Our personalisation service is available in-store for most items. Mugs, keychains, photo frames, and prints can often be customised while you browse. We also accept personalisation orders by phone or email for collection within 48 hours.</p>
    <p>We run a bridal registry and new home wishlist service for local customers. Couples can register their favourite items from our range and share the list with friends and family, making sure they get exactly what they want.</p>
    <p>Gift cards are available from £5 to £100 and never expire. Perfect for the person who has everything, or when you want to give someone a treat without guessing what they'd love most.</p>
  </div>
</div></section>

<!-- CONVERSION IMAGE -->
<section style="padding:0;line-height:0;overflow:hidden;max-height:280px"><img src="/assets/image-library/local-seo/hero/local-seo-hero-28157e63.webp" alt="Rotherham local retail" style="width:100%;object-fit:cover;display:block;"></section>

<!-- TESTIMONIALS -->
<section class="section-band"><div class="wrap">
  <p class="section-label" style="text-align:center">Happy Customers</p>
  <h2>What Rotherham Shoppers Say</h2>
  <div class="testimonials-grid">
    <div class="testimonial"><div class="stars">★★★★★</div><p>"Always my first stop when I need a gift. The staff remember what I bought last time and suggest things I actually like. You can't get that from Amazon. Wonderful little shop."</p><div class="reviewer"><div class="reviewer-avatar" style="background:${acc}">PH</div><div><div class="reviewer-name">Patricia H.</div><div class="reviewer-loc">Wickersley, Rotherham</div></div></div></div>
    <div class="testimonial"><div class="stars">★★★★★</div><p>"Had a mug personalised for my mum's birthday. Done in 20 minutes while I shopped. The quality was excellent and she absolutely loved it. Will definitely be back."</p><div class="reviewer"><div class="reviewer-avatar" style="background:${acc}">KM</div><div><div class="reviewer-name">Katie M.</div><div class="reviewer-loc">Maltby, Rotherham</div></div></div></div>
    <div class="testimonial"><div class="stars">★★★★★</div><p>"Bought my partner a hamper of candles and homeware here for Christmas. The gift wrapping was gorgeous and the shop assistant helped me choose a perfect selection. Total stress-free experience."</p><div class="reviewer"><div class="reviewer-avatar" style="background:${acc}">JR</div><div><div class="reviewer-name">James R.</div><div class="reviewer-loc">Rawmarsh, Rotherham</div></div></div></div>
  </div>
</div></section>

<!-- MAP -->
<section class="map-section"><div class="wrap">
  <h2>Find Us in Rotherham Town Centre</h2>
  <iframe class="map-embed" src="https://maps.google.com/maps?q=Rotherham+Town+Centre&t=&z=14&ie=UTF8&iwloc=&output=embed" title="Rotherham map" loading="lazy"></iframe>
  <div class="map-address"><strong>The Corner Gift Shop</strong>7 College Street, Rotherham Town Centre, S65 1AB<br>Open Mon–Sat 9am–5:30pm<br><a href="https://maps.google.com/?q=Rotherham+Town+Centre" target="_blank">View on Google Maps ↗</a></div>
</div></section>

<!-- CTA BAND -->
<section class="cta-band"><div class="container">
  <h2>The perfect gift is waiting for you.</h2>
  <p class="cta-close">Visit The Corner Gift Shop in Rotherham Town Centre — open Monday to Saturday. Free gift-wrapping, in-store personalisation, and a warm welcome every time.</p>
  <a class="btn btn-white" href="#">Get Directions</a>
  <a class="btn" href="#" style="margin-left:16px;border:2px solid rgba(255,255,255,.4)">Call 01709 000 000</a>
</div></section>

<!-- FAQ -->
<section class="section-band"><div class="wrap" style="max-width:860px">
  <h2>Frequently Asked Questions</h2>
  <div class="faq-list">
    <div class="faq-card"><p class="faq-q">Do you offer personalisation in-store?</p><p class="faq-a">Yes — many items can be personalised while you wait, usually in 15–30 minutes. For larger or more complex orders, we offer 48-hour turnaround. Call ahead if you're on a tight deadline.</p></div>
    <div class="faq-card"><p class="faq-q">Do you do gift hampers?</p><p class="faq-a">Yes. We can put together a custom hamper from any items in the shop. Choose your own selection or tell us the occasion and budget and we'll curate one for you. Hampers start from £25.</p></div>
    <div class="faq-card"><p class="faq-q">Can I order online?</p><p class="faq-a">We currently operate as an in-store shop only, as many of our products are one-off or handmade pieces. Some personalised items can be ordered by phone for local collection or delivery.</p></div>
    <div class="faq-card"><p class="faq-q">Is gift-wrapping free?</p><p class="faq-a">Yes — free gift-wrapping is included on all purchases. We use beautiful recycled tissue paper, ribbon, and handwritten tags. Just let us know at the till that your purchase is a gift.</p></div>
  </div>
</div></section>

<!-- RESOURCE CARDS -->
<section class="section-band section-band--alt"><div class="wrap">
  <h2>More from The Corner Gift Shop</h2>
  <div class="resource-card-grid">
    <a href="#" class="resource-card"><h3>Gift Vouchers</h3><p>Give someone the freedom to choose. Gift cards from £5 to £100, never expire.</p></a>
    <a href="#" class="resource-card"><h3>Bridal Registry</h3><p>Getting married? Set up a registry and share it with your guests.</p></a>
    <a href="#" class="resource-card"><h3>Corporate Gifts</h3><p>Branded gifts and hampers for clients and team events. Minimum order 10 items.</p></a>
  </div>
</div></section>

<footer class="site-footer"><div class="container">
  <div class="footer-grid">
    <div><h4>The Corner Gift Shop</h4><p>Rotherham's favourite independent gift shop since 2011. Unique gifts, homeware, and personalised keepsakes.</p><p style="margin-top:10px">📞 01709 000 000</p></div>
    <div><h4>Products</h4><p><a href="#">Gifts & Novelties</a></p><p><a href="#">Cards & Stationery</a></p><p><a href="#">Homeware</a></p><p><a href="#">Personalised Items</a></p></div>
    <div><h4>Services</h4><p><a href="#">Gift Wrapping</a></p><p><a href="#">Personalisation</a></p><p><a href="#">Gift Vouchers</a></p><p><a href="#">Bridal Registry</a></p></div>
    <div><h4>Visit Us</h4><p>7 College Street</p><p>Rotherham Town Centre</p><p>S65 1AB</p><p>Mon–Sat 9am–5:30pm</p></div>
  </div>
  <div class="footer-bottom">© 2026 The Corner Gift Shop · Rotherham · All rights reserved</div>
</div></footer>
</body></html>`;
}

function buildPlumberLocalServiceDemo(templateId: string, templateName: string): string {
  // ── Hub-level demo: "emergency plumber Sheffield" ──────────────────────────
  // Business profile tokens shown as {{VARIABLE}} where live data replaces them
  // H1 = service keyword + location — NOT a brand headline
  const pri  = "#0F2D4A";
  const acc  = "#E5380D";
  const kw   = "emergency plumber Sheffield";
  const svc  = "emergency plumbing";
  const loc  = "Sheffield";
  const biz  = "Peak Plumbing Services";          // {{BUSINESS_NAME}}
  const tel  = "0114 000 0000";                   // {{BUSINESS_PHONE}}
  const email= "hello@peakplumbing.co.uk";        // {{BUSINESS_EMAIL}}
  const addr = "Kelham Island Business Quarter, Sheffield, S3 8RW"; // {{BUSINESS_ADDRESS}}
  const clusterAreas = [
    ["Crookes","/emergency-plumber-crookes/"],
    ["Hillsborough","/emergency-plumber-hillsborough/"],
    ["Ecclesall","/emergency-plumber-ecclesall/"],
    ["Walkley","/emergency-plumber-walkley/"],
    ["Nether Edge","/emergency-plumber-nether-edge/"],
    ["Woodseats","/emergency-plumber-woodseats/"],
    ["Chapeltown","/emergency-plumber-chapeltown/"],
    ["Mosborough","/emergency-plumber-mosborough/"],
    ["Stocksbridge","/emergency-plumber-stocksbridge/"],
    ["Gleadless","/emergency-plumber-gleadless/"],
    ["Norton","/emergency-plumber-norton/"],
    ["Beighton","/emergency-plumber-beighton/"],
    ["Handsworth","/emergency-plumber-handsworth/"],
    ["Meersbrook","/emergency-plumber-meersbrook/"],
    ["Broomhill","/emergency-plumber-broomhill/"],
    ["Millhouses","/emergency-plumber-millhouses/"],
  ];

  const schemaLD = JSON.stringify([
    {
      "@context":"https://schema.org","@type":"WebPage",
      "name": kw, "url": `https://peakplumbing.co.uk/${kw.replace(/ /g,'-')}/`,
      "breadcrumb": {"@type":"BreadcrumbList","itemListElement":[
        {"@type":"ListItem","position":1,"name":"Home","item":"https://peakplumbing.co.uk/"},
        {"@type":"ListItem","position":2,"name":`Plumber ${loc}`,"item":`https://peakplumbing.co.uk/plumber-${loc.toLowerCase()}/`},
        {"@type":"ListItem","position":3,"name":kw,"item":`https://peakplumbing.co.uk/${kw.replace(/ /g,'-')}/`}
      ]}
    },
    {
      "@context":"https://schema.org","@type":"LocalBusiness",
      "name": biz, "telephone": tel, "email": email,
      "address": {"@type":"PostalAddress","streetAddress":"Kelham Island Business Quarter","addressLocality":"Sheffield","postalCode":"S3 8RW","addressCountry":"GB"},
      "geo": {"@type":"GeoCoordinates","latitude":53.3811,"longitude":-1.4701},
      "openingHoursSpecification": [{"@type":"OpeningHoursSpecification","dayOfWeek":["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],"opens":"00:00","closes":"23:59"}],
      "priceRange":"££", "areaServed": {"@type":"City","name":"Sheffield"}
    },
    {
      "@context":"https://schema.org","@type":"Service",
      "name": `Emergency Plumber ${loc}`, "serviceType":"Emergency Plumbing",
      "provider": {"@type":"LocalBusiness","name":biz},
      "areaServed": {"@type":"City","name":loc},
      "description": `24/7 ${kw} from ${biz}. Gas Safe registered, 60-minute response, fixed-price quotes. Covering ${loc} and surrounding areas.`
    },
    {
      "@context":"https://schema.org","@type":"FAQPage",
      "mainEntity": [
        {"@type":"Question","name":`Do you offer ${svc} in ${loc}?`,"acceptedAnswer":{"@type":"Answer","text":`Yes — ${biz} provides 24/7 ${svc} across ${loc} including all S-postcode areas. We aim to arrive within 60 minutes of your call.`}},
        {"@type":"Question","name":"How quickly can you attend?","acceptedAnswer":{"@type":"Answer","text":`We target a 60-minute response time to any ${loc} address. For planned work we typically offer same-day or next-day appointments.`}},
        {"@type":"Question","name":"Do you repair leaks and burst pipes?","acceptedAnswer":{"@type":"Answer","text":`Yes. Leak detection, burst pipe repair, and stopcock replacement are among our most common ${loc} call-outs. We carry parts on the van to complete most jobs on the first visit.`}},
        {"@type":"Question","name":"Can I get a quote before work starts?","acceptedAnswer":{"@type":"Answer","text":"Yes. We give you a fixed-price quote before any work begins. You'll know the total cost before we pick up a tool. No surprises on the invoice."}},
        {"@type":"Question","name":"Are you Gas Safe registered?","acceptedAnswer":{"@type":"Answer","text":`Yes. All our engineers hold current Gas Safe registration — a legal requirement for gas work in the UK. You can verify us on the Gas Safe Register website.`}},
        {"@type":"Question","name":"Are you insured?","acceptedAnswer":{"@type":"Answer","text":`Yes. ${biz} carries full public liability insurance and all work comes with a 12-month labour guarantee in addition to parts warranties.`}}
      ]
    }
  ]);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${kw} | ${biz}</title>
<meta name="description" content="${kw} — ${biz}. Gas Safe registered, 60-min response, fixed-price quotes. Serving all of ${loc} 24/7. Call ${tel}." />
<link rel="canonical" href="/emergency-plumber-sheffield/" />
<script type="application/ld+json">${schemaLD}</script>
<style>
${demoCSS(pri, acc)}
/* ── Plumber template extras ─────────────────────────────────────── */
.hero-plumber { background:${pri}; padding:56px 0; }
.hero-plumber h1 { color:#fff; }
.hero-plumber .intro { color:rgba(255,255,255,.88); margin-bottom:24px; }
.hero-plumber .section-label { color:${acc}; }
.trust-inline { display:flex; flex-wrap:wrap; gap:10px; margin-top:20px; }
.trust-inline-item { display:flex; align-items:center; gap:6px; font-size:.82rem; color:rgba(255,255,255,.8); font-weight:600; }
.trust-inline-item .dot { width:6px; height:6px; background:${acc}; border-radius:50%; flex-shrink:0; }
.cta-group { display:flex; gap:12px; flex-wrap:wrap; }
.btn-call { display:inline-flex; align-items:center; gap:8px; background:${acc}; color:#fff; padding:15px 28px; border-radius:4px; font-size:1.05rem; font-weight:700; }
.btn-callback { display:inline-flex; align-items:center; gap:8px; background:transparent; color:#fff; border:2px solid rgba(255,255,255,.6); padding:14px 24px; border-radius:4px; font-size:.95rem; font-weight:600; }
.btn-call:hover { background:#c92b00; text-decoration:none; }
.btn-callback:hover { border-color:#fff; text-decoration:none; }
.problems-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:14px; margin-top:24px; }
.problem-card { background:#fff; border:1px solid #D9E2EC; border-radius:6px; padding:16px 18px; transition:border-color .2s; }
.problem-card:hover { border-color:${pri}; }
.problem-card .icon { font-size:1.5rem; margin-bottom:8px; }
.problem-card h3 { font-size:.88rem; color:${pri}; margin:0 0 4px; font-weight:700; }
.problem-card p  { font-size:.78rem; color:#64748b; margin:0; line-height:1.4; }
.image-slots { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-top:24px; }
.image-slot { background:#F4F6F8; border:2px dashed #CBD5E1; border-radius:8px; min-height:180px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:#94a3b8; font-size:.78rem; text-align:center; padding:16px; }
.image-slot .slot-icon { font-size:2rem; }
.image-slot .slot-label { font-weight:700; color:#64748b; font-size:.8rem; }
.image-slot .slot-hint  { color:#94a3b8; font-size:.72rem; }
.token-badge { display:inline-block; font-family:monospace; font-size:.65rem; background:#EFF6FF; border:1px solid #BFDBFE; color:#1d4ed8; padding:1px 6px; border-radius:3px; margin-left:4px; vertical-align:middle; }
.section-note { font-size:.75rem; color:#94a3b8; font-style:italic; margin-bottom:4px; }
@media(max-width:720px){ .image-slots { grid-template-columns:1fr 1fr; } .problems-grid { grid-template-columns:1fr 1fr; } }
</style>
</head>
<body>

${demoBanner(templateId, templateName, pri)}

<!-- ═══ HEADER — uses {{BUSINESS_NAME}} + {{BUSINESS_PHONE}} ═══ -->
<header class="site-header"><div class="container">
  <div style="font-weight:800;font-size:1.1rem;color:${pri}">${biz} <span class="token-badge">{{BUSINESS_NAME}}</span></div>
  <nav>
    <a href="/">Home</a>
    <a href="/services/">Services</a>
    <a href="/areas/">Areas</a>
    <a href="tel:${tel}" style="background:${acc};color:#fff;padding:9px 18px;border-radius:4px;font-weight:700">📞 ${tel} <span class="token-badge">{{BUSINESS_PHONE}}</span></a>
  </nav>
</div></header>

<!-- ① HERO — H1 = service + location keyword ════════════════════ -->
<section id="hero-section" class="hero-plumber">
  <div class="wrap"><div class="hero-inner">
    <div class="hero-text">
      <p class="section-label">📍 Serving ${loc} & Surrounding Areas — 24/7</p>
      <h1>${kw}</h1>
      <p class="intro">Need an ${kw} fast? ${biz} provides 24/7 emergency plumbing across ${loc} with a 60-minute response guarantee. Gas Safe engineers. Fixed-price quotes. No call-out fee. We're local — and we'll be there when you need us most.</p>
      <div class="cta-group">
        <a href="tel:${tel}" class="btn-call">📞 Call ${tel}</a>
        <a href="/callback/" class="btn-callback">Request a Callback →</a>
      </div>
      <div class="trust-inline">
        <div class="trust-inline-item"><div class="dot"></div>Local ${loc} plumber</div>
        <div class="trust-inline-item"><div class="dot"></div>60-min fast response</div>
        <div class="trust-inline-item"><div class="dot"></div>Fully insured</div>
        <div class="trust-inline-item"><div class="dot"></div>No-obligation quote</div>
        <div class="trust-inline-item"><div class="dot"></div>Gas Safe registered</div>
      </div>
    </div>
    <div class="hero-media"><img src="https://local.inboxingproweb.com/assets/rotherham-proof/emergencyplumber/hero.jpg" alt="Emergency plumber Sheffield — van outside home" style="width:100%;border-radius:6px;display:block;"></div>
  </div></div>
</section>

<!-- ② TRUST SIGNALS ════════════════════════════════════════════ -->
<section class="trust-strip">
  <div class="container"><div class="trust-items">
    <div class="trust-item"><span class="trust-icon">🛡</span> Gas Safe Registered</div>
    <div class="trust-item"><span class="trust-icon">⏱</span> 60-Min Response</div>
    <div class="trust-item"><span class="trust-icon">📅</span> 24/7 Any Day</div>
    <div class="trust-item"><span class="trust-icon">💬</span> Fixed-Price Quotes</div>
    <div class="trust-item"><span class="trust-icon">🏅</span> 12-Month Guarantee</div>
    <div class="trust-item"><span class="trust-icon">📍</span> Local ${loc} Engineers</div>
  </div></div>
</section>

<!-- ③ SERVICES GRID — what ${svc} in ${loc} covers ═════════════ -->
<section class="section-band"><div class="wrap">
  <p class="section-label" style="text-align:center">${kw}</p>
  <h2>${svc.charAt(0).toUpperCase()+svc.slice(1)} services in ${loc} <span class="token-badge">{{SERVICE}} {{LOCATION}}</span></h2>
  <div class="services-grid">
    <div class="service-card"><div class="icon">💧</div><h3>Burst & Leaking Pipes</h3><p>Emergency isolation and repair of burst pipes in ${loc} properties. Most repairs completed on first visit.</p></div>
    <div class="service-card"><div class="icon">🔥</div><h3>Boiler Breakdown</h3><p>Gas Safe boiler fault diagnosis and repair. All makes and models. Same-day attendance across ${loc}.</p></div>
    <div class="service-card"><div class="icon">🚽</div><h3>Blocked Toilets & Drains</h3><p>Manual clearance and high-pressure jetting for blocked toilets, sinks, and external drains in ${loc}.</p></div>
    <div class="service-card"><div class="icon">🌡</div><h3>No Heating or Hot Water</h3><p>Central heating breakdowns fixed fast. Radiators, pumps, thermostats, and cylinder repairs.</p></div>
    <div class="service-card"><div class="icon">🔍</div><h3>Leak Detection</h3><p>Thermal imaging to find hidden leaks in ${loc} homes without unnecessary damage.</p></div>
    <div class="service-card"><div class="icon">🪠</div><h3>Overflow & Cistern Issues</h3><p>Overflowing cisterns and toilet fill valves fixed quickly — before water damage sets in.</p></div>
  </div>
</div></section>

<!-- ④ WHY THIS LOCAL PLUMBER ════════════════════════════════════ -->
<section class="section-band section-band--alt"><div class="wrap">
  <h2>Why choose a local ${svc} specialist in ${loc}?</h2>
  <div class="section-2col">
    <p>National directories and call centres add delay when you need help right now. A genuine local plumber based in ${loc} arrives faster, understands the local housing stock, and takes direct responsibility for their work — without layers of subcontracting.</p>
    <p>${biz} engineers live and work in ${loc}. They know the difference between an S10 Victorian terrace with lead pipework and a Gleadless Valley semi with push-fit plastic. That local knowledge means faster diagnosis and fewer return visits.</p>
    <p>Clear pricing protects you from surprise charges. We quote a fixed price before we start. Our engineers never begin work without your agreement — so you stay in control from the moment you call to the moment we leave.</p>
    <p>Every job comes with a 12-month labour guarantee and full public liability cover. Landlords can set up priority accounts for rapid response across their managed portfolios in ${loc} and surrounding areas.</p>
  </div>
</div></section>

<!-- ⑤ LOCAL AREA COVERAGE ════════════════════════════════════════ -->
<section class="section-band"><div class="wrap">
  <p class="section-label" style="text-align:center">Local Coverage</p>
  <h2>Emergency plumber areas — ${loc} & nearby <span class="token-badge">{{SERVICE_AREAS}}</span></h2>
  <p style="text-align:center;color:#64748b;max-width:680px;margin:0 auto 4px">Each area below has a dedicated local page with specific response times, coverage details, and area-specific content. <span class="section-note">These pages form the cluster layer under this hub page.</span></p>
  <div class="areas-grid" style="margin-top:20px">
    ${clusterAreas.map(([area,url])=>`<a href="${url}" class="area-link">emergency plumber ${area}</a>`).join("")}
  </div>
</div></section>

<!-- ⑥ COMMON PROBLEMS WE FIX ════════════════════════════════════ -->
<section class="section-band section-band--alt"><div class="wrap">
  <p class="section-label" style="text-align:center">Common Problems</p>
  <h2>Plumbing problems we fix in ${loc}</h2>
  <div class="problems-grid">
    <div class="problem-card"><div class="icon">💧</div><h3>Leaking pipes</h3><p>Under sinks, behind walls, or at joints — we find and fix it.</p></div>
    <div class="problem-card"><div class="icon">💥</div><h3>Burst pipes</h3><p>Emergency isolation and repair before water damage spreads.</p></div>
    <div class="problem-card"><div class="icon">🚰</div><h3>Dripping taps</h3><p>Worn washers, cartridges, and valve replacements.</p></div>
    <div class="problem-card"><div class="icon">🚽</div><h3>Running toilets</h3><p>Faulty fill valves, flappers, and overflow pipes.</p></div>
    <div class="problem-card"><div class="icon">🪠</div><h3>Blocked drains</h3><p>Kitchen, bathroom, and external drain clearance.</p></div>
    <div class="problem-card"><div class="icon">🔥</div><h3>Boiler faults</h3><p>Loss of pressure, no hot water, error codes diagnosed.</p></div>
    <div class="problem-card"><div class="icon">🌡</div><h3>Cold radiators</h3><p>Bleeding, balancing, TRV replacement, and powerflush.</p></div>
    <div class="problem-card"><div class="icon">🚿</div><h3>Shower faults</h3><p>Low pressure, temperature issues, valve and pump repairs.</p></div>
    <div class="problem-card"><div class="icon">🏡</div><h3>Outdoor taps</h3><p>Installation, isolation valves, and winterisation.</p></div>
  </div>
</div></section>

<!-- ⑦ PROCESS — how to book ════════════════════════════════════ -->
<section class="section-band"><div class="wrap">
  <p class="section-label" style="text-align:center">How to Book</p>
  <h2>Getting your ${kw} — 5 simple steps</h2>
  <div class="process-steps">
    <div class="step"><div class="step-num" style="background:${acc}">1</div><h3>Call or Request a Callback</h3><p>Ring <a href="tel:${tel}">${tel}</a> or submit a callback request. We answer 24 hours a day.</p></div>
    <div class="step"><div class="step-num" style="background:${acc}">2</div><h3>Describe the Problem</h3><p>Tell us what's happening. The more detail you give, the better-prepared your engineer arrives.</p></div>
    <div class="step"><div class="step-num" style="background:${acc}">3</div><h3>Receive a Clear Estimate</h3><p>We give you a fixed-price estimate over the phone before dispatching. No surprises.</p></div>
    <div class="step"><div class="step-num" style="background:${acc}">4</div><h3>Engineer Visits</h3><p>A local Gas Safe engineer arrives within 60 minutes. They'll confirm the fix before starting any work.</p></div>
    <div class="step"><div class="step-num" style="background:${acc}">5</div><h3>Work Completed & Guaranteed</h3><p>Job done, area cleaned up, 12-month guarantee issued. We leave as if we were never there.</p></div>
  </div>
</div></section>

<!-- ⑧ TESTIMONIALS — ${loc} customers ═════════════════════════ -->
<section class="section-band section-band--alt"><div class="wrap">
  <p class="section-label" style="text-align:center">Verified Reviews <span class="token-badge">{{REVIEWS_SOURCE}}</span></p>
  <h2>What ${loc} homeowners say about ${biz}</h2>
  <div class="testimonials-grid">
    <div class="testimonial"><div class="stars">★★★★★</div><p>"Pipe burst in my kitchen at 6am. Had a plumber at the door by 6:50. Problem fixed in under an hour, price matched the quote exactly. Cannot fault them."</p><div class="reviewer"><div class="reviewer-avatar" style="background:${acc}">PB</div><div><div class="reviewer-name">P. Bailey</div><div class="reviewer-loc">Crookes, Sheffield S10</div></div></div></div>
    <div class="testimonial"><div class="stars">★★★★★</div><p>"As a landlord with 12 properties in Sheffield, I need a plumber I can trust to respond fast and be professional. Peak Plumbing are on my speed dial. Reliable every time."</p><div class="reviewer"><div class="reviewer-avatar" style="background:${acc}">KS</div><div><div class="reviewer-name">K. Singh</div><div class="reviewer-loc">Landlord, ${loc}</div></div></div></div>
    <div class="testimonial"><div class="stars">★★★★★</div><p>"No heating in January with a toddler in the house. They had someone here within the hour, fixed the pump, and gave us a gas safety cert. Heroes."</p><div class="reviewer"><div class="reviewer-avatar" style="background:${acc}">LM</div><div><div class="reviewer-name">L. Morrison</div><div class="reviewer-loc">Hillsborough, ${loc}</div></div></div></div>
  </div>
</div></section>

<!-- ⑨ IMAGE SLOTS — work examples ══════════════════════════════ -->
<section class="section-band"><div class="wrap">
  <p class="section-label" style="text-align:center">Work Examples</p>
  <h2>${svc.charAt(0).toUpperCase()+svc.slice(1)} jobs completed in ${loc}</h2>
  <p class="section-note" style="text-align:center;margin-bottom:4px">Image slots: uploaded → AI-generated → library fallback → gracefully hidden if missing. No forced placeholders.</p>
  <div class="image-slots">
    <div class="image-slot" style="padding:0;overflow:hidden;border:none"><img src="https://local.inboxingproweb.com/assets/rotherham-proof/emergencyplumber/support.jpg" alt="Plumber fixing under-sink leak" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:8px;"></div>
    <div class="image-slot" style="padding:0;overflow:hidden;border:none"><img src="https://local.inboxingproweb.com/assets/rotherham-proof/emergencyplumber/conversion.jpg" alt="Completed plumbing repair" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:8px;"></div>
    <div class="image-slot" style="padding:0;overflow:hidden;border:none"><img src="/assets/image-packs/plumber/03.jpg" alt="Plumbing engineer on site" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:8px;"></div>
  </div>
</div></section>

<!-- ⑩ MAP ════════════════════════════════════════════════════════ -->
<section class="map-section"><div class="wrap">
  <h2>${kw.charAt(0).toUpperCase()+kw.slice(1)} — covering all of ${loc}</h2>
  <iframe class="map-embed" src="https://maps.google.com/maps?q=Sheffield+City+Centre&t=&z=12&ie=UTF8&iwloc=&output=embed" title="${loc} coverage map" loading="lazy"></iframe>
  <div class="map-address">
    <strong>${biz} <span class="token-badge">{{BUSINESS_NAME}}</span></strong>
    ${addr} <span class="token-badge">{{BUSINESS_ADDRESS}}</span><br>
    📞 <a href="tel:${tel}">${tel}</a> <span class="token-badge">{{BUSINESS_PHONE}}</span> &nbsp;·&nbsp;
    ✉ <a href="mailto:${email}">${email}</a> <span class="token-badge">{{BUSINESS_EMAIL}}</span><br>
    <a href="https://maps.google.com/?q=${loc}" target="_blank" style="margin-top:6px;display:inline-block">View on Google Maps ↗</a>
  </div>
</div></section>

<!-- ⑪ CTA BAND ════════════════════════════════════════════════ -->
<section class="cta-band"><div class="container">
  <h2>Need an ${kw} right now?</h2>
  <p class="cta-close">Don't let a plumbing emergency get worse. ${biz} is available 24/7 across ${loc}. Fixed price. Gas Safe. 60-minute response. No call-out fee.</p>
  <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap">
    <a href="tel:${tel}" class="btn btn-white">📞 Call ${tel}</a>
    <a href="/callback/" class="btn" style="border:2px solid rgba(255,255,255,.4)">Request a Callback</a>
  </div>
  <p style="margin-top:16px;font-size:.85rem;opacity:.7">Gas Safe Reg. No. {{GAS_SAFE_NUMBER}} · Fully insured · 12-month workmanship guarantee</p>
</div></section>

<!-- ⑫ FAQ — long-tail SEO ════════════════════════════════════════ -->
<section class="section-band"><div class="wrap" style="max-width:860px">
  <h2>Frequently asked questions — ${kw}</h2>
  <div class="faq-list">
    <div class="faq-card"><p class="faq-q">Do you offer ${svc} in ${loc}?</p><p class="faq-a">Yes — ${biz} provides 24/7 ${svc} across all of ${loc} including every S-postcode area. We aim to arrive within 60 minutes of your call.</p></div>
    <div class="faq-card"><p class="faq-q">How quickly can you attend an ${svc} in ${loc}?</p><p class="faq-a">Our target is 60 minutes to any ${loc} address. In most cases we're with you faster. For planned (non-emergency) plumbing work we offer same-day and next-day appointments.</p></div>
    <div class="faq-card"><p class="faq-q">Do you repair leaks and burst pipes in ${loc}?</p><p class="faq-a">Yes. Burst pipe repair, leak detection, and stopcock replacement are among our most common ${loc} jobs. Our vans carry replacement pipe and fittings to complete most repairs on the first visit.</p></div>
    <div class="faq-card"><p class="faq-q">Can I get a quote before work starts?</p><p class="faq-a">Yes. We provide a fixed-price quote before any work begins — either over the phone or once the engineer has assessed the problem on site. No work starts without your agreement.</p></div>
    <div class="faq-card"><p class="faq-q">Do you cover areas near ${loc}?</p><p class="faq-a">Yes — we serve the whole of the ${loc} area including Crookes, Hillsborough, Ecclesall, Walkley, Nether Edge, Chapeltown, Mosborough, and more. See our <a href="/areas/">areas page</a> for the full list with individual coverage pages for each neighbourhood.</p></div>
    <div class="faq-card"><p class="faq-q">Are you insured and Gas Safe registered?</p><p class="faq-a">Yes. All engineers hold current Gas Safe registration (required by law for gas work) and ${biz} carries full public liability insurance. All work is backed by a 12-month labour guarantee.</p></div>
  </div>
</div></section>

<!-- FOOTER — business profile data ════════════════════════════════ -->
<footer class="site-footer"><div class="container">
  <div class="footer-grid">
    <div>
      <h4>${biz} <span class="token-badge">{{BUSINESS_NAME}}</span></h4>
      <p>Local ${svc} specialists serving ${loc} and surrounding areas. Gas Safe registered, fully insured, 24/7.</p>
      <p style="margin-top:10px">📞 <a href="tel:${tel}">${tel}</a> <span class="token-badge">{{BUSINESS_PHONE}}</span></p>
      <p>✉ <a href="mailto:${email}">${email}</a> <span class="token-badge">{{BUSINESS_EMAIL}}</span></p>
      <p style="margin-top:4px;font-size:.8rem;color:#64748b">${addr} <span class="token-badge">{{BUSINESS_ADDRESS}}</span></p>
    </div>
    <div><h4>${svc.charAt(0).toUpperCase()+svc.slice(1)}</h4><p><a href="#">Burst Pipe Repair</a></p><p><a href="#">Boiler Breakdown</a></p><p><a href="#">Blocked Drains</a></p><p><a href="#">No Heating</a></p><p><a href="#">Leak Detection</a></p></div>
    <div><h4>${loc} Areas <span class="token-badge">{{SERVICE_AREAS}}</span></h4>${clusterAreas.slice(0,6).map(([a,u])=>`<p><a href="${u}">emergency plumber ${a}</a></p>`).join("")}</div>
    <div><h4>Company</h4><p><a href="/about/">About Us</a></p><p><a href="/gas-safe/">Gas Safe Certificate</a></p><p><a href="/landlords/">Landlord Services</a></p><p><a href="/privacy/">Privacy Policy</a></p><p><a href="/terms/">Terms & Conditions</a></p></div>
  </div>
  <div class="footer-bottom">© 2026 ${biz} <span class="token-badge">{{BUSINESS_NAME}}</span> · Gas Safe Reg. {{GAS_SAFE_NUMBER}} · Registered in England & Wales · All rights reserved</div>
</div></footer>

</body>
</html>`;
}

function buildFallbackDemo(templateId: string, templateName: string, pri: string, acc: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Demo — ${templateName}</title>
  <style>${demoCSS(pri, acc)}</style></head><body>
  ${demoBanner(templateId, templateName, pri)}
  <div style="padding:60px;text-align:center;color:#64748b">
    <h2 style="color:${pri}">Demo content coming soon for ${templateName}</h2>
    <p>Check back shortly — this template demo is being populated with industry-specific content.</p>
  </div></body></html>`;
}

// ── Old wireframe placeholder (kept for reference, not used in route below) ──
function renderBlockWireframe(block: any, index: number, style: any): string {
  const pri  = style?.primaryColor  || "#003A6D";
  const acc  = style?.accentColor   || "#1CA9C9";
  const id   = block.blockId as string;
  const lbl  = block.label as string;
  const req  = block.required as boolean;
  const hints: string[] = block.contentHints || [];
  const n = index + 1;

  const badge = req
    ? `<span style="background:${acc};color:#fff;font-size:.65rem;font-weight:700;padding:2px 8px;border-radius:3px;letter-spacing:.05em">REQUIRED</span>`
    : `<span style="background:#e2e8f0;color:#64748b;font-size:.65rem;font-weight:700;padding:2px 8px;border-radius:3px;letter-spacing:.05em">OPTIONAL</span>`;

  const hintList = hints.map((h: string) =>
    `<li style="color:#64748b;font-size:.8rem;margin:2px 0">${h}</li>`
  ).join("");

  const meta = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">
      <span style="background:${pri};color:#fff;font-size:.7rem;font-weight:800;width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${n}</span>
      <span style="font-size:.75rem;font-weight:700;color:#475569;letter-spacing:.06em;text-transform:uppercase;font-family:monospace">${id}</span>
      ${badge}
    </div>
    <div style="font-size:.85rem;font-weight:600;color:#1e293b;margin-bottom:6px">${lbl}</div>
    ${hints.length ? `<ul style="margin:0;padding-left:16px">${hintList}</ul>` : ""}`;

  // Block-specific wireframe visuals
  if (id === "hero") {
    return `<section style="background:linear-gradient(135deg,${pri} 0%,${acc} 100%);padding:0;position:relative;overflow:hidden">
      <div style="position:absolute;inset:0;display:flex">
        <div style="flex:1;padding:60px 48px;display:flex;flex-direction:column;justify-content:center;gap:16px">
          <div style="height:14px;background:rgba(255,255,255,.3);border-radius:4px;width:70%"></div>
          <div style="height:10px;background:rgba(255,255,255,.2);border-radius:4px;width:90%"></div>
          <div style="height:10px;background:rgba(255,255,255,.2);border-radius:4px;width:80%"></div>
          <div style="height:40px;background:${acc};border-radius:6px;width:160px;border:2px solid rgba(255,255,255,.4)"></div>
        </div>
        <div style="flex:1;background:rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center">
          <span style="color:rgba(255,255,255,.4);font-size:3rem">🖼</span>
        </div>
      </div>
      <div style="min-height:280px"></div>
      <div style="position:absolute;bottom:8px;left:12px;background:rgba(0,0,0,.5);color:#fff;padding:6px 12px;border-radius:4px;font-size:.7rem">${meta}</div>
    </section>`;
  }

  if (id === "cta_band") {
    return `<section style="background:${acc};padding:48px 40px;text-align:center;position:relative">
      <div style="height:14px;background:rgba(255,255,255,.35);border-radius:4px;width:45%;margin:0 auto 12px"></div>
      <div style="height:10px;background:rgba(255,255,255,.2);border-radius:4px;width:30%;margin:0 auto 20px"></div>
      <div style="height:44px;background:#fff;border-radius:8px;width:180px;margin:0 auto;opacity:.5"></div>
      <div style="position:absolute;bottom:6px;left:10px;background:rgba(0,0,0,.5);color:#fff;padding:4px 10px;border-radius:4px;font-size:.7rem;text-align:left">${meta}</div>
    </section>`;
  }

  if (id === "map") {
    return `<section style="background:#f0fdf4;border-top:3px solid ${pri};padding:0;position:relative;overflow:hidden">
      <div style="display:flex">
        <div style="flex:1;background:#d1fae5;min-height:200px;display:flex;align-items:center;justify-content:center;font-size:2.5rem;opacity:.5">🗺</div>
        <div style="flex:1;padding:28px;display:flex;flex-direction:column;gap:8px">
          <div style="height:10px;background:#94a3b8;border-radius:3px;width:80%"></div>
          <div style="height:9px;background:#cbd5e1;border-radius:3px;width:65%"></div>
          <div style="height:9px;background:#cbd5e1;border-radius:3px;width:50%"></div>
          <div style="height:32px;background:${pri};border-radius:5px;width:140px;margin-top:8px;opacity:.6"></div>
        </div>
      </div>
      <div style="position:absolute;bottom:6px;left:10px;background:rgba(0,0,0,.5);color:#fff;padding:4px 10px;border-radius:4px;font-size:.7rem">${meta}</div>
    </section>`;
  }

  if (id === "services_grid") {
    const cards = [1,2,3,4].map(() =>
      `<div style="background:#fff;border-radius:8px;padding:18px;box-shadow:0 1px 4px rgba(0,0,0,.08)">
        <div style="height:28px;width:28px;background:${acc};border-radius:6px;margin-bottom:10px;opacity:.5"></div>
        <div style="height:9px;background:#94a3b8;border-radius:3px;width:70%;margin-bottom:6px"></div>
        <div style="height:8px;background:#e2e8f0;border-radius:3px;width:90%"></div>
        <div style="height:8px;background:#e2e8f0;border-radius:3px;width:75%;margin-top:4px"></div>
      </div>`
    ).join("");
    return `<section style="background:#f8fafc;padding:40px;position:relative">
      <div style="height:12px;background:#94a3b8;border-radius:4px;width:35%;margin:0 auto 24px"></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">${cards}</div>
      <div style="position:absolute;bottom:6px;left:10px;background:rgba(0,0,0,.5);color:#fff;padding:4px 10px;border-radius:4px;font-size:.7rem">${meta}</div>
    </section>`;
  }

  if (id === "trust_signals") {
    const badges = [1,2,3,4,5].map(() =>
      `<div style="background:#fff;border:1.5px solid #e2e8f0;border-radius:8px;padding:10px 18px;display:flex;align-items:center;gap:8px">
        <div style="width:28px;height:28px;background:${acc};border-radius:50%;opacity:.4"></div>
        <div style="height:8px;background:#94a3b8;border-radius:3px;width:60px"></div>
      </div>`
    ).join("");
    return `<section style="background:#fff;border-top:3px solid ${acc};border-bottom:3px solid ${acc};padding:24px 40px;position:relative">
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">${badges}</div>
      <div style="position:absolute;bottom:4px;left:10px;background:rgba(0,0,0,.5);color:#fff;padding:3px 8px;border-radius:4px;font-size:.7rem">${meta}</div>
    </section>`;
  }

  if (id === "process_steps") {
    const steps = [1,2,3,4].map((s) =>
      `<div style="flex:1;text-align:center">
        <div style="width:40px;height:40px;background:${pri};color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;margin:0 auto 10px;font-size:.9rem">${s}</div>
        <div style="height:8px;background:#94a3b8;border-radius:3px;width:70%;margin:0 auto 5px"></div>
        <div style="height:7px;background:#e2e8f0;border-radius:3px;width:85%;margin:0 auto"></div>
        <div style="height:7px;background:#e2e8f0;border-radius:3px;width:60%;margin:4px auto 0"></div>
      </div>`
    ).join("");
    return `<section style="background:#f8fafc;padding:44px 40px;position:relative">
      <div style="height:12px;background:#94a3b8;border-radius:4px;width:30%;margin:0 auto 28px"></div>
      <div style="display:flex;gap:20px;align-items:flex-start">${steps}</div>
      <div style="position:absolute;bottom:6px;left:10px;background:rgba(0,0,0,.5);color:#fff;padding:4px 10px;border-radius:4px;font-size:.7rem">${meta}</div>
    </section>`;
  }

  if (id === "testimonials") {
    const cards = [1,2,3].map(() =>
      `<div style="background:#fff;border-radius:10px;padding:20px;box-shadow:0 2px 6px rgba(0,0,0,.07)">
        <div style="color:${acc};font-size:1rem;margin-bottom:10px">★★★★★</div>
        <div style="height:8px;background:#e2e8f0;border-radius:3px;width:100%;margin-bottom:5px"></div>
        <div style="height:8px;background:#e2e8f0;border-radius:3px;width:85%;margin-bottom:5px"></div>
        <div style="height:8px;background:#e2e8f0;border-radius:3px;width:70%;margin-bottom:12px"></div>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:30px;height:30px;background:${pri};border-radius:50%;opacity:.4"></div>
          <div style="height:7px;background:#94a3b8;border-radius:3px;width:100px"></div>
        </div>
      </div>`
    ).join("");
    return `<section style="background:#f8fafc;padding:44px 40px;position:relative">
      <div style="height:12px;background:#94a3b8;border-radius:4px;width:35%;margin:0 auto 24px"></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">${cards}</div>
      <div style="position:absolute;bottom:6px;left:10px;background:rgba(0,0,0,.5);color:#fff;padding:4px 10px;border-radius:4px;font-size:.7rem">${meta}</div>
    </section>`;
  }

  if (id === "gallery") {
    const imgs = [1,2,3,4,5,6].map(() =>
      `<div style="background:#cbd5e1;border-radius:6px;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;font-size:1.5rem;opacity:.5">🖼</div>`
    ).join("");
    return `<section style="background:#fff;padding:40px;position:relative">
      <div style="height:12px;background:#94a3b8;border-radius:4px;width:30%;margin:0 auto 22px"></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">${imgs}</div>
      <div style="position:absolute;bottom:6px;left:10px;background:rgba(0,0,0,.5);color:#fff;padding:4px 10px;border-radius:4px;font-size:.7rem">${meta}</div>
    </section>`;
  }

  if (id === "faq") {
    const items = [1,2,3,4].map((i) =>
      `<div style="border-bottom:1px solid #e2e8f0;padding:14px 0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${i===1?'10px':'0'}">
          <div style="height:9px;background:${i===1?'#475569':'#94a3b8'};border-radius:3px;width:${55+i*8}%"></div>
          <div style="color:#94a3b8;font-size:1rem">${i===1?'▾':'›'}</div>
        </div>
        ${i===1?`<div style="height:7px;background:#e2e8f0;border-radius:3px;width:90%;margin-bottom:4px"></div><div style="height:7px;background:#e2e8f0;border-radius:3px;width:75%"></div>`:''}
      </div>`
    ).join("");
    return `<section style="background:#fff;padding:40px;position:relative">
      <div style="height:12px;background:#94a3b8;border-radius:4px;width:28%;margin:0 auto 22px"></div>
      <div style="max-width:700px;margin:0 auto">${items}</div>
      <div style="position:absolute;bottom:6px;left:10px;background:rgba(0,0,0,.5);color:#fff;padding:4px 10px;border-radius:4px;font-size:.7rem">${meta}</div>
    </section>`;
  }

  if (id === "pricing") {
    const tiers = ["Starter","Standard","Premium"].map((t,i) =>
      `<div style="border:${i===1?`2px solid ${acc}`:'1.5px solid #e2e8f0'};border-radius:10px;padding:24px;background:${i===1?`${acc}11`:'#fff'};text-align:center">
        <div style="height:9px;background:${i===1?acc:'#94a3b8'};border-radius:3px;width:50%;margin:0 auto 12px"></div>
        <div style="height:18px;background:${i===1?pri:'#94a3b8'};border-radius:3px;width:60%;margin:0 auto 14px;opacity:.5"></div>
        ${[1,2,3,4].map(()=>`<div style="height:7px;background:#e2e8f0;border-radius:3px;width:80%;margin:4px auto"></div>`).join("")}
        <div style="height:36px;background:${i===1?acc:pri};border-radius:6px;width:80%;margin:16px auto 0;opacity:${i===1?'.7':'.4'}"></div>
      </div>`
    ).join("");
    return `<section style="background:#f8fafc;padding:44px 40px;position:relative">
      <div style="height:12px;background:#94a3b8;border-radius:4px;width:28%;margin:0 auto 24px"></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;max-width:800px;margin:0 auto">${tiers}</div>
      <div style="position:absolute;bottom:6px;left:10px;background:rgba(0,0,0,.5);color:#fff;padding:4px 10px;border-radius:4px;font-size:.7rem">${meta}</div>
    </section>`;
  }

  if (id === "areas_cover" || id === "resource_cards") {
    const links = [1,2,3,4,5,6,7,8].map(() =>
      `<div style="background:#fff;border:1.5px solid #e2e8f0;border-radius:6px;padding:10px 14px;height:7px;background:#94a3b8;border-radius:3px"></div>`
    ).join("");
    return `<section style="background:#f1f5f9;padding:36px 40px;position:relative">
      <div style="height:11px;background:#94a3b8;border-radius:4px;width:32%;margin:0 auto 20px"></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">${links}</div>
      <div style="position:absolute;bottom:6px;left:10px;background:rgba(0,0,0,.5);color:#fff;padding:4px 10px;border-radius:4px;font-size:.7rem">${meta}</div>
    </section>`;
  }

  if (id === "conversion_image") {
    return `<section style="background:#1e293b;padding:0;position:relative;overflow:hidden">
      <div style="min-height:180px;display:flex;align-items:center;justify-content:center;opacity:.3;font-size:4rem">🖼</div>
      <div style="position:absolute;bottom:6px;left:10px;background:rgba(0,0,0,.5);color:#fff;padding:4px 10px;border-radius:4px;font-size:.7rem">${meta}</div>
    </section>`;
  }

  if (id === "ai_summary") {
    return `<section style="background:#eff6ff;border-left:4px solid #2563eb;padding:32px 40px;position:relative">
      <div style="height:10px;background:#93c5fd;border-radius:3px;width:40%;margin-bottom:14px"></div>
      ${[1,2,3].map(()=>`<div style="height:8px;background:#bfdbfe;border-radius:3px;width:${75+Math.floor(Math.random()*20)}%;margin-bottom:6px"></div>`).join("")}
      <div style="position:absolute;bottom:6px;left:10px;background:rgba(0,0,0,.5);color:#fff;padding:4px 10px;border-radius:4px;font-size:.7rem">${meta}</div>
    </section>`;
  }

  // Generic split-text block (why_it_matters, what_you_get, enquiry_split, competition, no_website, money_page_link)
  const isRight = (id === "what_you_get" || id === "enquiry_split");
  const imgSide = `<div style="flex:1;background:#e2e8f0;min-height:160px;display:flex;align-items:center;justify-content:center;font-size:2rem;opacity:.4">🖼</div>`;
  const txtSide = `<div style="flex:1;padding:32px;display:flex;flex-direction:column;justify-content:center;gap:10px">
    <div style="height:11px;background:${pri};border-radius:3px;width:65%;opacity:.5"></div>
    <div style="height:8px;background:#94a3b8;border-radius:3px;width:95%"></div>
    <div style="height:8px;background:#cbd5e1;border-radius:3px;width:80%"></div>
    <div style="height:8px;background:#cbd5e1;border-radius:3px;width:90%"></div>
    <div style="height:8px;background:#cbd5e1;border-radius:3px;width:70%"></div>
  </div>`;

  return `<section style="background:#fff;border-top:1px solid #f1f5f9;position:relative;overflow:hidden">
    <div style="display:flex">${isRight ? txtSide + imgSide : imgSide + txtSide}</div>
    <div style="position:absolute;bottom:6px;left:10px;background:rgba(0,0,0,.5);color:#fff;padding:4px 10px;border-radius:4px;font-size:.7rem">${meta}</div>
  </section>`;
}

router.get("/templates/:id/demo", async (req, res) => {
  try {
    const registry = await loadRegistry();
    const id = req.params.id;
    const template = typeof registry.getTemplate === "function"
      ? registry.getTemplate(id)
      : (registry.TEMPLATE_REGISTRY as any)[id];

    if (!template) {
      res.status(404).send(`<h1>Template "${id}" not found</h1>`);
      return;
    }

    let html: string;
    switch (id) {
      case "inboxingproweb_default":
        html = buildDefaultDemo(id, template.templateName);
        break;
      case "trades_home_services":
        html = buildTradesDemo(id, template.templateName);
        break;
      case "beauty_clinic":
        html = buildBeautyDemo(id, template.templateName);
        break;
      case "professional_services":
        html = buildProfessionalDemo(id, template.templateName);
        break;
      case "retail_local_shop":
        html = buildRetailDemo(id, template.templateName);
        break;
      case "plumber_local_service":
        html = buildPlumberLocalServiceDemo(id, template.templateName);
        break;
      default: {
        const s = template.defaultStyle || {};
        html = buildFallbackDemo(id, template.templateName, s.primaryColor || "#003A6D", s.accentColor || "#1CA9C9");
      }
    }

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (err: any) {
    res.status(500).send(`<h1>Error: ${err.message}</h1>`);
  }
});

export default router;
