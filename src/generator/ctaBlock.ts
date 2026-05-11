/**
 * ctaBlock.ts — Dynamic CTA System
 *
 * Resolves the correct CTA variant based on service type and industry,
 * then builds HTML for the final CTA section and the optional mid-page
 * CTA strip.
 *
 * Categories
 * ─────────────────────────────────────────────────
 *   digital      – web design, SEO, GBP, email marketing
 *   trades       – plumber, electrician, roofer, builder, cleaner, gardener
 *   professional – accountant, solicitor, interior design, travel agent
 *   beauty       – beauty, hair, nails, pet grooming, personal trainer
 *   general      – fallback for uncategorised services
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export type CTACategory = "digital" | "trades" | "professional" | "beauty" | "general";

/** Optional per-project CTA URL overrides (set in project config). */
export interface CTAConfig {
  primaryUrl?:     string;  // main button (default: project.primaryCtaUrl)
  secondaryUrl?:   string;  // secondary button URL
  secondaryPhone?: string;  // if set, secondary button is a tel: link
  secondaryEmail?: string;  // if set, secondary button is a mailto: link
  auditFormUrl?:   string;  // digital: link to the audit/review form
  bookingUrl?:     string;  // beauty / professional: booking system URL
  callbackUrl?:    string;  // trades / digital: callback request form
}

interface CTACopy {
  heading:       string;
  body:          string;
  primaryText:   string;
  secondaryText: string;
}

// ── Keyword sets for category detection ───────────────────────────────────────

const DIGITAL_KEYWORDS = new Set([
  "web design", "web designer", "website design", "website designer",
  "web development", "web developer",
  "local seo", "seo", "search engine optimisation", "search engine optimization",
  "google business profile", "google my business", "gbp",
  "email marketing", "digital marketing", "online marketing",
  "ppc", "pay per click", "social media marketing", "social media management",
  "content marketing", "link building", "citation building",
]);

const TRADE_KEYWORDS = new Set([
  "plumber", "plumbing", "electrician", "electrical", "electric",
  "roofer", "roofing", "roof repair", "roof replacement",
  "builder", "building", "construction", "groundwork",
  "cleaner", "cleaning", "end of tenancy", "carpet cleaning",
  "gardener", "gardening", "garden maintenance", "landscaping", "landscape",
  "decorator", "decorating", "painter", "painting",
  "carpenter", "carpentry", "joiner", "joinery",
  "locksmith", "locksmithing",
  "plasterer", "plastering",
  "tiler", "tiling", "floor fitting", "flooring",
  "handyman", "property maintenance",
  "drainage", "drain", "boiler", "boiler repair", "heating engineer",
  "pest control", "removal", "removals", "man and van",
  "window cleaning", "gutter cleaning",
]);

const PROFESSIONAL_KEYWORDS = new Set([
  "accountant", "accounting", "bookkeeper", "bookkeeping", "tax advisor",
  "solicitor", "legal", "lawyer", "law", "conveyancing",
  "interior design", "interior designer", "interior decorator",
  "travel agent", "travel", "holiday planner",
  "financial advisor", "financial adviser", "mortgage broker", "mortgage advisor",
  "architect", "architecture", "surveyor", "surveying",
  "hr consultant", "hr advisor", "business consultant", "management consultant",
  "recruitment", "recruitment agency",
]);

const BEAUTY_KEYWORDS = new Set([
  "beauty", "beautician", "aesthetics", "aesthetic treatment",
  "hair", "hairdresser", "hairdressing", "hair salon",
  "barber", "barbershop", "men's grooming",
  "nails", "nail technician", "nail salon", "manicure", "pedicure", "gel nails",
  "pet grooming", "dog grooming", "grooming",
  "personal trainer", "personal training", "fitness coach", "fitness training",
  "gym", "yoga", "pilates", "spin class",
  "massage", "massage therapist", "spa", "wellbeing", "wellness",
  "tattoo", "tattoo artist", "piercing",
  "lashes", "eyelash extensions", "eyebrows", "microblading",
  "waxing", "threading", "tanning", "spray tan",
]);

// ── Keyword matching ───────────────────────────────────────────────────────────

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
}

function matchesSet(text: string, set: Set<string>): boolean {
  const n = normalise(text);
  for (const kw of set) {
    if (n.includes(kw)) return true;
  }
  return false;
}

// ── Category resolution ────────────────────────────────────────────────────────

/** Resolve CTA category from service name and optional project industryType. */
export function resolveCTACategory(
  serviceName:   string,
  industryType?: string,
): CTACategory {
  const combined = `${serviceName} ${industryType ?? ""}`;
  if (matchesSet(combined, DIGITAL_KEYWORDS))      return "digital";
  if (matchesSet(combined, TRADE_KEYWORDS))         return "trades";
  if (matchesSet(combined, BEAUTY_KEYWORDS))        return "beauty";
  if (matchesSet(combined, PROFESSIONAL_KEYWORDS))  return "professional";
  return "general";
}

// ── Deterministic A/B alternation ─────────────────────────────────────────────

/** Picks option A or B deterministically using a hash of the seed string. */
function variant(seed: string, optionA: string, optionB: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % 2 === 0 ? optionA : optionB;
}

// ── Copy generation ────────────────────────────────────────────────────────────

function buildCTACopy(
  category: CTACategory,
  service:  string,
  location: string,
  seed:     string,
): CTACopy {
  const svc = service.toLowerCase();
  const loc = location;

  switch (category) {
    case "digital": {
      const primaryText = variant(seed,
        "Request a Free Review",
        "Request a Free Site Audit",
      );
      return {
        primaryText,
        secondaryText: "Request a Callback",
        heading: variant(seed,
          `Ready to Improve Your ${service} Performance in ${loc}?`,
          `See How Your ${service} Presence Stacks Up in ${loc}`,
        ),
        body: variant(seed,
          `If you want to see how your ${svc} presence could perform better in ${loc}, request a free review and we'll show you what's working, what needs improving, and where the biggest opportunities are.`,
          `A free ${svc} audit gives you a clear picture of where you stand in ${loc} — what's already working, what your competitors are doing differently, and what to fix first. No commitment, just clarity.`,
        ),
      };
    }

    case "trades": {
      const primaryText = variant(seed, "Request a Quote", "Request a Callback");
      return {
        primaryText,
        secondaryText: "Call Us Today",
        heading: variant(seed,
          `Need a Trusted ${service} in ${loc}?`,
          `Get a Fast ${service} Quote in ${loc}`,
        ),
        body: variant(seed,
          `We cover ${loc} and the surrounding areas. Get in touch today for a fast, no-obligation quote from a local ${svc} you can trust.`,
          `Reliable, local, and experienced — request a callback and we'll get back to you quickly with everything you need to know.`,
        ),
      };
    }

    case "professional": {
      return {
        primaryText:   "Book a Consultation",
        secondaryText: "Send an Enquiry",
        heading: variant(seed,
          `Ready to Talk to a ${service} Professional in ${loc}?`,
          `Book Your ${service} Consultation in ${loc}`,
        ),
        body: variant(seed,
          `Book a no-obligation consultation and get clear, professional advice tailored to your situation in ${loc}. We'll answer your questions and help you understand exactly what to do next.`,
          `Getting the right professional advice early saves time and money. Book a consultation today and speak to someone who understands ${svc} in ${loc}.`,
        ),
      };
    }

    case "beauty": {
      const primaryText = variant(seed, "Book an Appointment", "Request a Callback");
      return {
        primaryText,
        secondaryText: "Send an Enquiry",
        heading: variant(seed,
          `Ready to Book Your ${service} in ${loc}?`,
          `Book Your Next ${service} Appointment in ${loc}`,
        ),
        body: variant(seed,
          `We're based locally and take bookings for ${svc} in and around ${loc}. Book your appointment today — availability fills up fast.`,
          `Whether it's your first visit or a regular booking, we make it easy. Request a callback and we'll find a time that works for you.`,
        ),
      };
    }

    default: {
      return {
        primaryText:   "Get in Touch",
        secondaryText: "Send an Enquiry",
        heading: `Ready to Get Started in ${loc}?`,
        body: `Contact us today to find out how we can help with ${svc} in ${loc}. We'll respond quickly and without obligation.`,
      };
    }
  }
}

// ── Secondary button resolution ────────────────────────────────────────────────

function resolveSecondary(
  category: CTACategory,
  copy:     CTACopy,
  config:   CTAConfig,
  ctaUrl:   string,
  phone?:   string,
): { text: string; href: string } {
  // Explicit config overrides always win
  if (config.callbackUrl && (category === "trades" || category === "digital")) {
    return { text: copy.secondaryText, href: config.callbackUrl };
  }
  if (config.secondaryUrl)   return { text: copy.secondaryText, href: config.secondaryUrl };
  if (config.secondaryPhone) return { text: copy.secondaryText, href: `tel:${config.secondaryPhone.replace(/\s/g, "")}` };
  if (config.secondaryEmail) return { text: copy.secondaryText, href: `mailto:${config.secondaryEmail}` };
  // Trades: prefer phone link when a phone number is available
  if (category === "trades" && phone) {
    return { text: "Call Us Today", href: `tel:${phone.replace(/\s/g, "")}` };
  }
  // Everyone else falls back to the contact page
  return { text: copy.secondaryText, href: ctaUrl };
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface ResolvedCTA {
  category:      CTACategory;
  copy:          CTACopy;
  primaryUrl:    string;
  secondaryUrl:  string;
  secondaryText: string;
}

/**
 * Master resolver — returns all CTA data needed by the renderer.
 *
 * @param service       Service name from the cluster config (e.g. "Web Design")
 * @param location      Area name (e.g. "Barnsley")
 * @param industryType  Project-level industry (e.g. "web-design")
 * @param config        Per-project URL overrides (from project.ctaConfig)
 * @param primaryCtaUrl Fallback URL from project.primaryCtaUrl
 * @param phone         Project phone number (used for trades tel: links)
 */
export function resolveCTA(params: {
  service:       string;
  location:      string;
  industryType?: string;
  config:        CTAConfig;
  primaryCtaUrl: string;
  phone?:        string;
}): ResolvedCTA {
  const { service, location, industryType, config, primaryCtaUrl, phone } = params;
  const seed     = `${service}-${location}`;
  const category = resolveCTACategory(service, industryType);
  const copy     = buildCTACopy(category, service, location, seed);

  // Primary URL: category-specific override → generic override → project default
  const primaryUrl = (() => {
    if (category === "digital" && config.auditFormUrl)                      return config.auditFormUrl;
    if ((category === "professional" || category === "beauty") && config.bookingUrl) return config.bookingUrl;
    return config.primaryUrl ?? primaryCtaUrl;
  })();

  const sec = resolveSecondary(category, copy, config, primaryUrl, phone);

  return { category, copy, primaryUrl, secondaryUrl: sec.href, secondaryText: sec.text };
}

/**
 * Build the full-width final CTA section HTML.
 */
export function buildCTASection(resolved: ResolvedCTA): string {
  const { copy, primaryUrl, secondaryUrl, secondaryText } = resolved;
  return `<section id="cta-section" class="cta-band">
  <div class="wrap">
    <h2>${copy.heading}</h2>
    <p class="cta-close">${copy.body}</p>
    <div class="cta-actions">
      <a class="btn-white" href="${primaryUrl}">${copy.primaryText}</a>
      <a class="btn-white-outline" href="${secondaryUrl}">${secondaryText}</a>
    </div>
  </div>
</section>`;
}

/**
 * Build the compact mid-page CTA strip HTML.
 * Placed mid-page to capture intent before the reader reaches the footer CTA.
 */
export function buildMidPageCTA(resolved: ResolvedCTA, service: string, location: string): string {
  const { category, copy, primaryUrl } = resolved;
  const svc = service.toLowerCase();
  const loc = location;

  const labels: Record<CTACategory, string> = {
    digital:      `Interested in improving your ${svc} performance in ${loc}?`,
    trades:       `Looking for a reliable ${svc} in ${loc}?`,
    professional: `Need professional ${svc} advice in ${loc}?`,
    beauty:       `Ready to book your ${svc} in ${loc}?`,
    general:      `Want to find out more about ${svc} in ${loc}?`,
  };

  return `<section class="mid-page-cta">
  <div class="wrap mid-page-cta-inner">
    <p class="mid-page-cta-text">${labels[category]}</p>
    <a class="btn mid-page-cta-btn" href="${primaryUrl}">${copy.primaryText}</a>
  </div>
</section>`;
}
