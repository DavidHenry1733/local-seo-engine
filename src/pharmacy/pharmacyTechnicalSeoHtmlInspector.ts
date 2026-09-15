/**
 * Inspects FINAL HTML that would be indexed. Does not read generator inputs.
 */
export interface InspectedHeading {
  tag: "h1" | "h2" | "h3";
  text: string;
}

export interface InspectedImage {
  src: string;
  alt: string | null;
  hasAltAttribute: boolean;
}

export interface InspectedLink {
  href: string;
  text: string;
}

export interface InspectedJsonLdBlock {
  raw: string;
  parsed: unknown | null;
  parseError: string | null;
  types: string[];
  urls: string[];
}

export interface InspectedTechnicalSeoHtml {
  title: string;
  metaDescription: string;
  canonical: string;
  robots: string;
  headings: InspectedHeading[];
  h1: string[];
  h2: string[];
  h3: string[];
  images: InspectedImage[];
  links: InspectedLink[];
  jsonLd: InspectedJsonLdBlock[];
  hasMetaRefresh: boolean;
  metaRefreshTarget: string;
  text: string;
}

function str(value: unknown): string {
  return String(value || "").trim();
}

function decode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(html: string): string {
  return decode(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim();
}

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  if (!match) return null;
  return decode(match[2] ?? match[3] ?? "");
}

function collectTypes(node: unknown, into: Set<string>): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectTypes(item, into);
    return;
  }
  const record = node as Record<string, unknown>;
  const type = record["@type"];
  if (typeof type === "string") into.add(type);
  else if (Array.isArray(type)) for (const item of type) if (typeof item === "string") into.add(item);
  for (const value of Object.values(record)) collectTypes(value, into);
}

function collectUrls(node: unknown, into: Set<string>): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectUrls(item, into);
    return;
  }
  const record = node as Record<string, unknown>;
  for (const key of ["url", "item", "@id"]) {
    const value = record[key];
    if (typeof value === "string" && /^https?:\/\//i.test(value)) into.add(value);
  }
  for (const value of Object.values(record)) collectUrls(value, into);
}

function collectPageEntityUrls(node: unknown, into: string[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collectPageEntityUrls(item, into);
    return;
  }
  const record = node as Record<string, unknown>;
  const types = ([] as string[]).concat((record["@type"] as string | string[]) || []);
  if (types.some((type) => /^(WebPage|Service|FAQPage|Article|ItemList)$/i.test(String(type)))) {
    const url = typeof record.url === "string" ? record.url : "";
    if (url) into.push(url);
  }
  if (Array.isArray(record["@graph"])) collectPageEntityUrls(record["@graph"], into);
  for (const value of Object.values(record)) {
    if (value && typeof value === "object") collectPageEntityUrls(value, into);
  }
}

export function inspectTechnicalSeoHtml(html: string): InspectedTechnicalSeoHtml {
  const source = String(html || "");
  const title = str(source.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]).replace(/\s+/g, " ");
  const metaDescription = str(
    source.match(/<meta[^>]+name=["']description["'][^>]*>/i)?.[0]
      ? attr(source.match(/<meta[^>]+name=["']description["'][^>]*>/i)![0], "content")
      : "",
  );
  const canonicalTag = source.match(/<link\b[^>]*\brel=["']canonical["'][^>]*>/i)?.[0] || "";
  const canonical = canonicalTag ? str(attr(canonicalTag, "href")) : "";
  const robotsTag = source.match(/<meta[^>]+name=["']robots["'][^>]*>/i)?.[0] || "";
  const robots = robotsTag ? str(attr(robotsTag, "content")).toLowerCase() : "";
  const refreshTag = source.match(/<meta[^>]+http-equiv=["']refresh["'][^>]*>/i)?.[0] || "";
  const refreshContent = refreshTag ? str(attr(refreshTag, "content")) : "";
  const metaRefreshTarget = str(refreshContent.split(/url=/i)[1] || "");

  const headings: InspectedHeading[] = [];
  for (const tag of ["h1", "h2", "h3"] as const) {
    const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
    let match: RegExpExecArray | null;
    while ((match = re.exec(source))) {
      headings.push({ tag, text: stripTags(match[1] || "") });
    }
  }

  const images: InspectedImage[] = [];
  for (const match of source.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    images.push({
      src: str(attr(tag, "src")),
      alt: /\balt\s*=/i.test(tag) ? str(attr(tag, "alt")) : null,
      hasAltAttribute: /\balt\s*=/i.test(tag),
    });
  }

  const links: InspectedLink[] = [];
  for (const match of source.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = str(attr(`<a ${match[1]}>`, "href"));
    if (!href) continue;
    links.push({ href, text: stripTags(match[2] || "") });
  }

  const jsonLd: InspectedJsonLdBlock[] = [];
  for (const match of source.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = str(match[1]);
    const types = new Set<string>();
    const urls = new Set<string>();
    try {
      const parsed = JSON.parse(raw) as unknown;
      collectTypes(parsed, types);
      collectUrls(parsed, urls);
      jsonLd.push({ raw, parsed, parseError: null, types: [...types], urls: [...urls] });
    } catch (err) {
      jsonLd.push({
        raw,
        parsed: null,
        parseError: err instanceof Error ? err.message : String(err),
        types: [],
        urls: [],
      });
    }
  }

  return {
    title: stripTags(title),
    metaDescription,
    canonical,
    robots,
    headings,
    h1: headings.filter((item) => item.tag === "h1").map((item) => item.text),
    h2: headings.filter((item) => item.tag === "h2").map((item) => item.text),
    h3: headings.filter((item) => item.tag === "h3").map((item) => item.text),
    images,
    links,
    jsonLd,
    hasMetaRefresh: Boolean(refreshTag),
    metaRefreshTarget,
    text: stripTags(source.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")),
  };
}

export function jsonLdPageEntityUrls(inspected: InspectedTechnicalSeoHtml): string[] {
  const urls: string[] = [];
  for (const block of inspected.jsonLd) {
    if (block.parsed) collectPageEntityUrls(block.parsed, urls);
  }
  return [...new Set(urls)];
}

export function jsonLdHasType(inspected: InspectedTechnicalSeoHtml, type: string): boolean {
  const expected = type.toLowerCase();
  return inspected.jsonLd.some((block) => block.types.some((item) => item.toLowerCase() === expected));
}

export function jsonLdFaqQuestions(inspected: InspectedTechnicalSeoHtml): string[] {
  const names: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    const record = node as Record<string, unknown>;
    if (String(record["@type"] || "") === "Question" && typeof record.name === "string") {
      names.push(record.name);
    }
    for (const value of Object.values(record)) walk(value);
  };
  for (const block of inspected.jsonLd) walk(block.parsed);
  return names;
}

export function jsonLdPersonNames(inspected: InspectedTechnicalSeoHtml): string[] {
  const names: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    const record = node as Record<string, unknown>;
    const types = ([] as string[]).concat((record["@type"] as string | string[]) || []);
    if (types.map(String).includes("Person") && typeof record.name === "string") names.push(record.name);
    for (const value of Object.values(record)) walk(value);
  };
  for (const block of inspected.jsonLd) walk(block.parsed);
  return names;
}
