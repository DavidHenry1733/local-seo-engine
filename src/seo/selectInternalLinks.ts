/**
 * selectInternalLinks / selectRelatedServiceCards
 *
 * Two exports for two purposes:
 *
 *   selectInternalLinks()         — 3–5 text links for inline body linking
 *   selectRelatedServiceCards()   — exactly 4 designed service cards for the
 *                                   "Related Services" section before the CTA
 *
 * Both draw from the project's `internalLinks` config pool.
 */

import type { InternalLink } from "../generator/types";
import type { InternalLinksConfig, InternalLinkConfig } from "../generator/types";

// ─── Service metadata ─────────────────────────────────────────────────────────

/**
 * Only these four services belong to InboxingProWeb.
 * Any other service key (roofing, landscaping, etc.) is excluded from
 * the Related Services section regardless of what exists in the pool.
 */
export const CORE_SERVICE_KEYS = new Set([
  "web_design",
  "local_seo",
  "website_hosting",
  "email_marketing",
]);

const SERVICE_LABELS: Record<string, string> = {
  web_design:         "Web Design",
  local_seo:          "Local SEO",
  website_hosting:    "Website Hosting",
  email_marketing:    "Email Marketing",
  emergency_plumber:  "Emergency Plumber",
  landscape_gardener: "Landscape Gardener",
  roofing_services:   "Roofing Services",
};

const SERVICE_CTA_LABELS: Record<string, string> = {
  web_design:         "View web design services",
  local_seo:          "View local SEO services",
  website_hosting:    "View website hosting",
  email_marketing:    "View email marketing services",
  emergency_plumber:  "View emergency plumbing",
  landscape_gardener: "View landscaping services",
  roofing_services:   "View roofing services",
};

const SERVICE_DESCRIPTIONS: Record<string, (location: string) => string> = {
  web_design:         (loc) => `Professional websites built to generate real enquiries for ${loc} businesses. Designed to load fast, rank well, and convert visitors into customers.`,
  local_seo:          (loc) => `Improve your visibility in ${loc} search results with a targeted local SEO strategy that puts your business in front of customers ready to buy.`,
  website_hosting:    (loc) => `Reliable, managed hosting for ${loc} businesses. Fast load speeds, daily backups, security monitoring, and full support included.`,
  email_marketing:    (loc) => `Targeted email campaigns that keep ${loc} customers engaged, drive repeat business, and complement your wider marketing strategy.`,
  emergency_plumber:  (loc) => `Fast-response emergency plumbing for ${loc} properties. Available around the clock when leaks, blockages, or boiler faults can't wait.`,
  landscape_gardener: (loc) => `Professional garden design, landscaping, and maintenance for homes and businesses across ${loc} and surrounding areas.`,
  roofing_services:   (loc) => `Trusted roofing repairs, replacements, and maintenance for properties across ${loc}. Fully insured, quality guaranteed.`,
};

// ─── Natural anchor phrase bank (for inline text links) ──────────────────────

const ANCHOR_VARIANTS: Record<string, string[]> = {
  web_design: [
    "professional web design services",
    "custom website design",
    "bespoke website design",
    "small business web design",
    "web design for local businesses",
    "website design and development",
  ],
  local_seo: [
    "local SEO support",
    "search engine optimisation services",
    "local search visibility",
    "SEO for small businesses",
    "improve your local rankings",
    "local SEO and Google visibility",
  ],
  website_hosting: [
    "reliable website hosting",
    "managed web hosting",
    "website hosting for small businesses",
    "fast and secure web hosting",
    "local web hosting services",
    "affordable managed hosting",
  ],
  email_marketing: [
    "email marketing services",
    "targeted email campaigns",
    "email newsletter management",
    "email marketing for small businesses",
    "local email marketing support",
  ],
  emergency_plumber: [
    "emergency plumbing services",
    "local emergency plumber",
    "24-hour plumbing callout",
    "fast-response plumber",
  ],
  landscape_gardener: [
    "professional landscaping services",
    "local landscape gardener",
    "garden design and landscaping",
    "garden maintenance and landscaping",
  ],
  roofing_services: [
    "professional roofing services",
    "local roofing contractor",
    "roof repair and replacement",
    "trusted roofing company",
  ],
};

const CONTACT_ANCHORS = [
  "get in touch",
  "request a free quote",
  "book a free consultation",
  "speak to our team",
  "request a free website review",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function normaliseHref(href: string): string {
  return href.replace(/\/$/, "").toLowerCase();
}

function pickAnchor(
  service: string,
  usedAnchors: Set<string>,
  location?: string,
): string {
  const bank = ANCHOR_VARIANTS[service] ?? [`${service.replace(/_/g, " ")} services`];
  for (const phrase of bank) {
    const candidate = location ? `${phrase} in ${location}` : phrase;
    if (!usedAnchors.has(candidate.toLowerCase())) {
      usedAnchors.add(candidate.toLowerCase());
      return candidate;
    }
  }
  for (const phrase of bank) {
    if (!usedAnchors.has(phrase.toLowerCase())) {
      usedAnchors.add(phrase.toLowerCase());
      return phrase;
    }
  }
  return bank[0] ?? `${service} services`;
}

// ─── Context shared by both selectors ────────────────────────────────────────

export interface InternalLinkContext {
  /** Service key of the current page, e.g. "web_design" */
  service: string;
  /** City / area of the current page, e.g. "Rotherham" */
  location: string;
  /** "hub" or "area" */
  tier: "hub" | "area";
  /** Root-relative path of the current page, e.g. "/web-design-rotherham/" */
  remotePath: string;
}

// ─── 1. Inline text links ─────────────────────────────────────────────────────

export function selectInternalLinks(
  config: InternalLinksConfig,
  ctx: InternalLinkContext,
  max = 5,
): InternalLink[] {
  const selfNorm    = normaliseHref(ctx.remotePath);
  const usedAnchors = new Set<string>();
  const selected: InternalLink[] = [];

  const pool = config.links.filter(
    (l) => normaliseHref(l.href) !== selfNorm,
  );

  const isHub        = ctx.tier === "hub";
  const sameLocation = (l: InternalLinkConfig) =>
    (l.location ?? "").toLowerCase() === ctx.location.toLowerCase();
  const diffService  = (l: InternalLinkConfig) =>
    (l.service ?? "") !== ctx.service;
  const sameService  = (l: InternalLinkConfig) =>
    (l.service ?? "") === ctx.service;

  // P1: same-location, different-service HUB pages
  const p1 = pool.filter(
    (l) => l.tier === "hub" && sameLocation(l) && diffService(l),
  );
  for (const link of p1.slice(0, isHub ? 3 : 2)) {
    selected.push({
      href:  link.href,
      label: pickAnchor(link.service ?? "other", usedAnchors, ctx.location),
    });
  }

  // P2: same-service HUB (area pages only)
  if (!isHub) {
    const p2 = pool.filter(
      (l) => l.tier === "hub" && sameService(l),
    );
    for (const link of p2.slice(0, 1)) {
      selected.push({
        href:  link.href,
        label: pickAnchor(link.service ?? ctx.service, usedAnchors, link.location),
      });
    }
  }

  // P3: same-location AREA pages, different service (fill gaps)
  if (selected.length < max - 1) {
    const p3 = pool.filter(
      (l) => l.tier === "area" && sameLocation(l) && diffService(l),
    );
    for (const link of p3) {
      if (selected.length >= max - 1) break;
      if (selected.some((s) => normaliseHref(s.href) === normaliseHref(link.href))) continue;
      selected.push({
        href:  link.href,
        label: pickAnchor(link.service ?? "other", usedAnchors, ctx.location),
      });
    }
  }

  // P4: contact page (last slot)
  if (config.contactPage && selected.length < max) {
    const prefer = config.contactPage.anchor;
    const anchor = (() => {
      if (prefer && !usedAnchors.has(prefer.toLowerCase())) {
        usedAnchors.add(prefer.toLowerCase());
        return prefer;
      }
      for (const a of CONTACT_ANCHORS) {
        if (!usedAnchors.has(a)) { usedAnchors.add(a); return a; }
      }
      return "get in touch";
    })();
    selected.push({ href: config.contactPage.href, label: anchor });
  }

  return selected.slice(0, max);
}

// ─── 2. Related Services card section ────────────────────────────────────────

export interface RelatedServiceCard {
  href:        string;
  title:       string;
  description: string;
  ctaLabel:    string;
}

/**
 * Selects exactly 4 service cards for the "Related Services" designed section.
 *
 * For AREA pages:  same-service hub (P1) + 3 other-service hubs same location
 * For HUB pages:   4 other-service hubs for the same location (no self-link)
 *
 * Falls back to any available hubs if same-location pool is too small.
 * Only hub-tier pages are shown — never area/cluster pages.
 */
export function selectRelatedServiceCards(
  config: InternalLinksConfig,
  ctx: InternalLinkContext,
  max = 4,
): RelatedServiceCard[] {
  const selfNorm = normaliseHref(ctx.remotePath);
  const seen     = new Set<string>();
  const cards: RelatedServiceCard[] = [];

  const hubPool  = config.links.filter(
    (l) =>
      l.tier === "hub" &&
      normaliseHref(l.href) !== selfNorm &&
      CORE_SERVICE_KEYS.has(l.service ?? ""),
  );

  const isHub        = ctx.tier === "hub";
  const sameLocation = (l: InternalLinkConfig) =>
    (l.location ?? "").toLowerCase() === ctx.location.toLowerCase();

  // Normalise both sides to underscore-slug for comparison so display names
  // ("Email Marketing") match stored service keys ("email_marketing") correctly.
  const normSvc = (s: string) =>
    s.trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/^web_hosting$/, "website_hosting");
  const ctxSvcNorm  = normSvc(ctx.service ?? "");
  const diffService = (l: InternalLinkConfig) => normSvc(l.service ?? "") !== ctxSvcNorm;

  const makeCard = (link: InternalLinkConfig): RelatedServiceCard => {
    const svc   = link.service ?? "other";
    const loc   = link.location ?? ctx.location;
    const label = SERVICE_LABELS[svc] ?? svc.replace(/_/g, " ");
    const desc  = SERVICE_DESCRIPTIONS[svc]?.(loc)
      ?? `Professional ${label.toLowerCase()} services in ${loc}.`;
    return {
      href:        link.href,
      title:       `${label} ${loc}`.trim(),
      description: desc,
      ctaLabel:    SERVICE_CTA_LABELS[svc] ?? `View ${label.toLowerCase()} services`,
    };
  };

  const push = (link: InternalLinkConfig) => {
    const n = normaliseHref(link.href);
    if (!seen.has(n)) { seen.add(n); cards.push(makeCard(link)); }
  };

  // Track which services have already been added (one card per service)
  const usedServices = new Set<string>();
  const pushCard = (link: InternalLinkConfig) => {
    const n   = normaliseHref(link.href);
    const svc = link.service ?? "other";
    if (!seen.has(n) && !usedServices.has(svc)) {
      seen.add(n);
      usedServices.add(svc);
      cards.push(makeCard(link));
    }
  };

  // ── Same-location, different-service hubs (highest priority) ─────────────
  hubPool.filter((l) => sameLocation(l) && diffService(l)).forEach((l) => {
    if (cards.length < max) pushCard(l);
  });

  // ── Fallback: any other-service hubs, one per service ────────────────────
  if (cards.length < max) {
    hubPool.filter(diffService).forEach((l) => {
      if (cards.length < max) pushCard(l);
    });
  }

  return cards.slice(0, max);
}

/**
 * Builds the full "Related Services" section HTML from service cards.
 * Returns empty string when no cards are available.
 */
export function buildRelatedServicesSectionHtml(
  cards: RelatedServiceCard[],
  location: string,
  serviceIntro?: string,
): string {
  if (cards.length === 0) return "";

  const intro = serviceIntro
    ?? `You may also find these related services useful if you want to strengthen your online presence, improve visibility, and generate more enquiries in ${location}.`;

  const itemHtml = cards.map((card) => `
      <div class="rsl-item">
        <h3 class="rsl-title">${card.title}</h3>
        <p class="rsl-desc">${card.description}</p>
        <a class="rsl-cta" href="${card.href}">${card.ctaLabel}</a>
      </div>`).join("");

  return `
  <section id="related-services-section" class="section-band section-band--alt">
    <div class="wrap">
      <h2>Related Services</h2>
      <p class="related-services-intro">${intro}</p>
      <div class="rsl-grid">${itemHtml}
      </div>
    </div>
  </section>`;
}

// ─── Legacy: plain pill link section (kept for service-location-v1 path) ─────

/** @deprecated Use selectRelatedServiceCards + buildRelatedServicesSectionHtml */
export function buildRelatedServicesHtml(links: InternalLink[]): string {
  if (links.length === 0) return "";
  const items = links
    .map((l) => `          <a class="internal-link-card" href="${l.href}">${l.label}</a>`)
    .join("\n");
  return `
  <section id="related-services-section" class="section-band section-band--alt">
    <div class="wrap">
      <h2>Related Services</h2>
      <div class="internal-link-grid">
${items}
      </div>
    </div>
  </section>`;
}
