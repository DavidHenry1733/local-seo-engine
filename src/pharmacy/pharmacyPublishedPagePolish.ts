/**
 * Pharmacy Published Page Polish V1 — layout normalisation for final HTML output.
 */
export const PUBLISHED_SITE_BASE = "https://pharmacy.inboxingproweb.com";

export function publishedPageUrl(pageSlug: string): string {
  const slug = String(pageSlug || "").trim().replace(/^\/+|\/+$/g, "");
  return `${PUBLISHED_SITE_BASE}/${slug}/`;
}

export function slugifyArea(area: string): string {
  return String(area || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function areaPageSlug(serviceId: string, area: string): string {
  return `${serviceId}-${slugifyArea(area)}`;
}

/** Related service cards: 2, 4, or 6 only. */
export function normalizePublishedRelatedCount(count: number): number {
  if (count <= 2) return count <= 0 ? 0 : 2;
  if (count === 3) return 2;
  if (count === 5) return 4;
  if (count >= 6) return 6;
  return 4;
}

/** Coverage / local area badges: 2, 4, 6, 8, 10, or 12. */
export function normalizePublishedCoverageCount(count: number): number {
  const allowed = [2, 4, 6, 8, 10, 12];
  if (count <= 0) return 2;
  for (const n of allowed) {
    if (count <= n) return n;
  }
  return 12;
}

export function trimToEvenRelatedCount<T>(items: T[]): T[] {
  const target = normalizePublishedRelatedCount(items.length);
  return items.slice(0, target);
}

export function trimToPublishedCoverageCount<T>(items: T[], maxCount = 12): T[] {
  const capped = items.slice(0, maxCount);
  const target = normalizePublishedCoverageCount(capped.length);
  return capped.slice(0, target);
}

const MYTH_FACT_FILLERS: Record<string, string[]> = {
  "travel-vaccinations": [
    "Myth: One vaccination appointment covers every future trip. Fact: Destination, season and medical history can change what is recommended for each journey.",
  ],
  "blood-pressure-checks": [
    "Myth: A single normal reading means blood pressure is no longer a concern. Fact: Ongoing monitoring helps identify patterns and supports timely GP follow-up when needed.",
  ],
  default: [
    "Myth: Pharmacy services replace GP care for every condition. Fact: Pharmacists assess suitability, provide treatment where appropriate, and refer clearly when GP or urgent care is needed.",
  ],
};

export function normalizeMythFactBullets(bullets: string[], serviceId: string): string[] {
  const list = bullets.filter(Boolean).slice();
  const fillers = MYTH_FACT_FILLERS[serviceId] || MYTH_FACT_FILLERS.default;
  let i = 0;
  while (list.length < 4 && i < fillers.length) {
    if (!list.some((b) => b.toLowerCase().includes(fillers[i].toLowerCase().slice(0, 30)))) {
      list.push(fillers[i]);
    }
    i++;
  }
  while (list.length < 4) {
    list.push(
      "Myth: Pharmacy advice is only useful after symptoms appear. Fact: Early assessment helps you understand options and plan safe next steps.",
    );
  }
  return list.slice(0, 4);
}

export function dedupeCtaLabels(primary: string, secondary?: string): string[] {
  const labels = [primary, secondary].map((v) => String(v || "").trim()).filter(Boolean);
  return labels.filter((v, i) => labels.indexOf(v) === i);
}

export function isPublishedInternalUrl(href: string): boolean {
  return href.startsWith(PUBLISHED_SITE_BASE) || href.startsWith("#") || href.startsWith("tel:");
}

export function stripUnpublishedHubLinks(html: string, publishedSlugs: Set<string>): string {
  return html.replace(/<a\b([^>]*?)href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/gi, (match, pre, href, post, label) => {
    const text = String(label).toLowerCase();
    if (!/main hub|hub page|service hub/.test(text)) return match;
    const slugMatch = href.match(/\/([a-z0-9-]+)\/?$/i);
    const slug = slugMatch?.[1];
    if (slug && !publishedSlugs.has(slug)) return "";
    return match;
  });
}
