/**
 * HTML diagnostics for local area pages (local-area-v1).
 */
export function detectEmptyLocalClusterSections(html: string): string[] {
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const main = mainMatch?.[1] || html;
  const empty: string[] = [];
  const checks: Array<{ label: string; pattern: RegExp; minChars: number }> = [
    { label: "FAQ", pattern: /data-template-block="faq"[\s\S]*?<\/section>/i, minChars: 120 },
    { label: "Local Access Map", pattern: /id="local-access"[\s\S]*?<\/section>/i, minChars: 60 },
    { label: "CTA", pattern: /data-template-block="final-cta"[\s\S]*?<\/section>/i, minChars: 40 },
  ];
  for (const check of checks) {
    const block = main.match(check.pattern)?.[0] || "";
    const text = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (block && text.length < check.minChars) empty.push(check.label);
  }
  return empty;
}

export function localClusterPageHasImage(html: string): boolean {
  return /<img[^>]+data-image-slot/i.test(html) || /<img[^>]+alt="[^"]+"/i.test(html);
}

export function localClusterPageHasIrrelevantHeartSection(html: string): boolean {
  return /Accessible Heart Health Checks/i.test(html);
}

export function countLocalClusterImages(html: string): number {
  return (html.match(/<img[^>]+alt="[^"]+"/gi) || []).length;
}

export function countNearbyAreaLinks(html: string): number {
  if (/data-local-page-kind=["']location-area["']/i.test(html) || /data-publish-source=["']local-area-v1["']/i.test(html)) {
    const access = html.match(/id="local-access"[\s\S]*?<\/section>/i)?.[0] || "";
    return (access.match(/class="coverage-tag"[^>]*href=/gi) || []).length;
  }
  return (html.match(/class="area-card"/g) || []).length;
}

export function localPageWordCount(html: string): number {
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
  return main.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;
}

export function extractLocalAreaMainSectionBlocks(html: string): string[] {
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] || "";
  return [...main.matchAll(/data-template-block="([^"]+)"/gi)].map((m) => m[1]);
}
