/**
 * serviceIntent.ts
 *
 * Service Intent Lock — single source of truth for resolving a page's
 * service identity, primary keyword, and expected H1.
 */

export interface ServiceSlotEntry {
  prefix: string;
  name: string;
  kwFragment: string;
  key: string;
}

export const SERVICE_SLOT_MAP: ServiceSlotEntry[] = [
  { prefix: "affordable-web-design-", name: "Web Design", kwFragment: "web design", key: "web-design" },
  { prefix: "email-marketing-", name: "Email Marketing", kwFragment: "email marketing", key: "email-marketing" },
  { prefix: "local-business-visibility-", name: "Local Business Visibility", kwFragment: "local business visibility", key: "local-business-visibility" },
  { prefix: "local-seo-", name: "Local SEO", kwFragment: "local seo", key: "local-seo" },
  { prefix: "web-design-", name: "Web Design", kwFragment: "web design", key: "web-design" },
  { prefix: "web-hosting-", name: "Web Hosting", kwFragment: "web hosting", key: "web-hosting" },
];

export function inferSlotFromSlug(pageSlug: string): ServiceSlotEntry | undefined {
  const s = pageSlug.toLowerCase();
  for (const entry of SERVICE_SLOT_MAP) {
    if (s.startsWith(entry.prefix)) return entry;
  }
  return undefined;
}

export function areaFromSlug(pageSlug: string): string {
  let s = pageSlug;
  for (const entry of SERVICE_SLOT_MAP) {
    if (s.toLowerCase().startsWith(entry.prefix)) {
      s = s.slice(entry.prefix.length);
      break;
    }
  }

  return s
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || pageSlug;
}

export function keywordMatchesSlot(
  kw: string,
  slot: ServiceSlotEntry | undefined,
): boolean {
  if (!slot) return true;
  return kw.toLowerCase().includes(slot.kwFragment.toLowerCase());
}

export function buildIntentHash(serviceKey: string, location: string): string {
  const locationSlug = location.toLowerCase().trim().replace(/\s+/g, "-");
  return `${serviceKey}|${locationSlug}`;
}

export interface ServiceIntent {
  serviceKey: string;
  serviceName: string;
  location: string;
  primaryKeyword: string;
  expectedH1: string;
  pageSlug: string;
  source: "page-data" | "def" | "slug" | "h1";
  conflictsResolved: string[];
  intentHash: string;
}

export interface ResolveServiceIntentOpts {
  pageSlug: string;
  pageData?: {
    targetKeyword?: string;
    primaryKeyword?: string;
    service?: string;
    location?: string;
    [k: string]: unknown;
  } | null;
  def?: {
    primaryKeyword?: string;
    area?: string;
    service?: string;
    [k: string]: unknown;
  } | null;
  html?: string;
  fallbackService?: string;
}

export function resolveServiceIntent(opts: ResolveServiceIntentOpts): ServiceIntent {
  const { pageSlug, pageData, def, html, fallbackService = "Service" } = opts;

  const slot = inferSlotFromSlug(pageSlug);
  const slugArea = areaFromSlug(pageSlug);
  const conflicts: string[] = [];

  const pdService = String(pageData?.service ?? "");
  const pdLocation = String(pageData?.location ?? "");
  const defArea = String(def?.area ?? "");

  const resolvedService = pdService || slot?.name || fallbackService;
  const resolvedLocation = pdLocation || defArea || slugArea;
  const resolvedKey = slot?.key || resolvedService.toLowerCase().replace(/\s+/g, "-");

  const pdKw = String(pageData?.targetKeyword ?? pageData?.primaryKeyword ?? "");
  if (pdKw) {
    if (keywordMatchesSlot(pdKw, slot)) {
      return makeIntent(resolvedKey, resolvedService, resolvedLocation, pdKw, pageSlug, "page-data", conflicts);
    }

    conflicts.push(
      `page-data keyword "${pdKw}" discarded — does not match slug service "${slot?.name ?? "unknown"}"`,
    );
  }

  const defKw = String(def?.primaryKeyword ?? "");
  if (defKw) {
    if (keywordMatchesSlot(defKw, slot)) {
      return makeIntent(resolvedKey, resolvedService, resolvedLocation, defKw, pageSlug, "def", conflicts);
    }

    conflicts.push(
      `def keyword "${defKw}" discarded — does not match slug service "${slot?.name ?? "unknown"}"`,
    );
  }

  if (slot) {
    return makeIntent(
      resolvedKey,
      resolvedService,
      resolvedLocation,
      `${resolvedService} ${resolvedLocation}`,
      pageSlug,
      "slug",
      conflicts,
    );
  }

  if (html) {
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) {
      const h1Text = h1Match[1].replace(/<[^>]+>/g, "").trim();
      if (h1Text) {
        return makeIntent(resolvedKey, resolvedService, resolvedLocation, h1Text, pageSlug, "h1", conflicts);
      }
    }
  }

  return makeIntent(
    resolvedKey,
    resolvedService,
    resolvedLocation,
    `${resolvedService} ${resolvedLocation}`,
    pageSlug,
    "slug",
    conflicts,
  );
}

function makeIntent(
  serviceKey: string,
  serviceName: string,
  location: string,
  primaryKeyword: string,
  pageSlug: string,
  source: ServiceIntent["source"],
  conflictsResolved: string[],
): ServiceIntent {
  return {
    serviceKey,
    serviceName,
    location,
    primaryKeyword,
    expectedH1: `${serviceName} ${location}`,
    pageSlug,
    source,
    conflictsResolved,
    intentHash: buildIntentHash(serviceKey, location),
  };
}

export interface PageIntentValidationResult {
  corrected: boolean;
  html: string;
  corrections: string[];
}

export function validateAndCorrectPageIntent(
  html: string,
  intent: ServiceIntent,
): PageIntentValidationResult {
  const corrections: string[] = [];
  let out = html;

  const { serviceName, location, primaryKeyword, expectedH1 } = intent;
  const serviceLC = serviceName.toLowerCase();
  const locationLC = location.toLowerCase();

  const h1Re = /<h1([^>]*)>([\s\S]*?)<\/h1>/i;
  const h1Match = out.match(h1Re);

  if (h1Match) {
    const h1Text = h1Match[2].replace(/<[^>]+>/g, "").trim();
    const h1HasService = h1Text.toLowerCase().includes(serviceLC);
    const h1HasLocation = h1Text.toLowerCase().includes(locationLC);

    if (!h1HasService || !h1HasLocation) {
      out = out.replace(h1Match[0], `<h1${h1Match[1]}>${expectedH1}</h1>`);
      corrections.push(
        `H1 corrected: "${h1Text}" → "${expectedH1}"` +
        (!h1HasService ? " (missing service)" : "") +
        (!h1HasLocation ? " (missing location)" : ""),
      );
    }
  }

  const titleRe = /<title>([\s\S]*?)<\/title>/i;
  const titleMatch = out.match(titleRe);

  if (titleMatch) {
    const t = titleMatch[1].toLowerCase();
    if (!t.includes(serviceLC) || !t.includes(locationLC)) {
      out = out.replace(titleMatch[0], `<title>${primaryKeyword} | ${location}</title>`);
      corrections.push(`Meta title corrected: "${titleMatch[1]}" → "${primaryKeyword} | ${location}"`);
    }
  }

  const metaRe1 = /(<meta\s+name=["']description["']\s+content=["'])([^"']*)(['"][^>]*>)/i;
  const metaRe2 = /(<meta\s+content=["'])([^"']*)(['"][^\s][^>]*name=["']description["'][^>]*>)/i;

  for (const re of [metaRe1, metaRe2]) {
    const m = out.match(re);
    if (m) {
      const d = m[2].toLowerCase();
      if (!d.includes(serviceLC) || !d.includes(locationLC)) {
        out = out.replace(
          m[0],
          `${m[1]}${primaryKeyword} services in ${location} — professional, reliable, and locally focused.${m[3]}`,
        );
        corrections.push("Meta description corrected — missing service/location reference");
      }
      break;
    }
  }

  return { corrected: corrections.length > 0, html: out, corrections };
}
