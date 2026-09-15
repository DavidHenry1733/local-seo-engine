/**
 * CPR-RB01-V1 / CORE-PAGE-STRUCTURED-DATA-SERVICE-IDENTITY-29A —
 * Enrich visual service page JSON-LD for Commercial Page Contract (renderer output only).
 * BreadcrumbList and page-identity URLs always follow the resolved current serviceId.
 */
import type { ServicePageFaqLike } from "./pharmacyFaqAlignment.ts";
import { syncSchemaFaqs } from "./pharmacyFaqAlignment.ts";

export interface VisualServicePageSchemaContext {
  serviceName: string;
  pharmacyName: string;
  town: string;
  pageUrl: string;
  metaDescription: string;
  website: string;
  /** Resolved current service page id — never inherit another service's path. */
  serviceId?: string;
  /** Locality slug for cluster pages — public path /{serviceId}/local/{locality}/ */
  localitySlug?: string;
  localityName?: string;
}

/** Canonical core-page service path segments used in structured-data URLs. */
const KNOWN_SERVICE_PATH_IDS = [
  "pharmacy-first",
  "blood-pressure-checks",
  "travel-vaccinations",
  "flu-vaccinations",
  "emergency-contraception",
  "prescription-dispensing",
  "repeat-prescriptions",
  "pharmacy-contraception-service",
  "new-medicine-service",
  "malaria-prevention",
  "medication-reviews",
] as const;

const SERVICE_PATH_RE = new RegExp(
  `/(?:${KNOWN_SERVICE_PATH_IDS.join("|")})/?`,
  "i",
);

function schemaGraphNodes(schema: Record<string, unknown>): Record<string, unknown>[] {
  const graph = schema["@graph"];
  if (Array.isArray(graph)) {
    return graph.filter((n) => n && typeof n === "object") as Record<string, unknown>[];
  }
  return [schema];
}

function nodeTypes(node: Record<string, unknown>): string[] {
  const t = node["@type"];
  if (typeof t === "string") return [t];
  if (Array.isArray(t)) return t.filter((x) => typeof x === "string") as string[];
  return [];
}

function graphHasType(nodes: Record<string, unknown>[], type: string): boolean {
  return nodes.some((n) => nodeTypes(n).includes(type));
}

function serviceUrlPath(serviceId: string): string {
  return `/${String(serviceId).replace(/^\/+|\/+$/g, "")}/`;
}

function stripServicePath(url: string): string {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  const withoutPath = trimmed.replace(SERVICE_PATH_RE, "/");
  return withoutPath.replace(/\/+$/, "");
}

function originFromUrl(url: string): string {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return stripServicePath(trimmed);
  }
}

export function resolveCurrentLocalityPageUrl(ctx: VisualServicePageSchemaContext): string {
  const serviceId = String(ctx.serviceId || "").trim();
  const locality = String(ctx.localitySlug || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
  if (!serviceId || !locality) return resolveCurrentServicePageUrl(ctx);
  const path = `/${serviceId}/local/${locality}/`;
  const origin = originFromUrl(ctx.website || ctx.pageUrl);
  if (origin && /^https?:\/\//i.test(origin)) return `${origin.replace(/\/+$/, "")}${path}`;
  return path;
}

export function resolvePageIdentityUrl(ctx: VisualServicePageSchemaContext): string {
  return String(ctx.localitySlug || "").trim()
    ? resolveCurrentLocalityPageUrl(ctx)
    : resolveCurrentServicePageUrl(ctx);
}

export function resolveCurrentServicePageUrl(ctx: VisualServicePageSchemaContext): string {
  const serviceId = String(ctx.serviceId || "").trim();
  const pageUrl = String(ctx.pageUrl || "").trim();
  const website = String(ctx.website || "").trim();
  if (!serviceId) return pageUrl;

  const path = serviceUrlPath(serviceId);
  if (pageUrl.includes(path)) {
    return pageUrl.endsWith("/") ? pageUrl : `${pageUrl}/`;
  }

  const origin = originFromUrl(website || pageUrl);
  if (origin) {
    if (/^https?:\/\//i.test(origin)) return `${origin}${path}`;
    return `${origin}${path}`;
  }

  if (pageUrl && SERVICE_PATH_RE.test(pageUrl)) {
    return pageUrl.replace(SERVICE_PATH_RE, path);
  }

  return path;
}

function resolveHomeUrl(ctx: VisualServicePageSchemaContext, servicePageUrl: string): string {
  const website = String(ctx.website || "").trim();
  const origin = originFromUrl(website || servicePageUrl || ctx.pageUrl);
  if (origin) return origin.endsWith("/") ? origin : `${origin}/`;
  return "/";
}

function isBusinessEntityNode(node: Record<string, unknown>): boolean {
  return nodeTypes(node).some((t) =>
    /Pharmacy|MedicalBusiness|LocalBusiness|MedicalClinic|Organization/i.test(t),
  );
}

function rewriteUrlString(value: string, currentPath: string, homeUrl: string, asBusinessUrl: boolean): string {
  if (!SERVICE_PATH_RE.test(value)) return value;
  if (asBusinessUrl) {
    const origin = originFromUrl(value) || stripServicePath(homeUrl);
    if (!origin) return homeUrl;
    return origin.endsWith("/") ? origin : `${origin}/`;
  }
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      return `${parsed.protocol}//${parsed.host}${currentPath}`;
    } catch {
      return value.replace(SERVICE_PATH_RE, currentPath);
    }
  }
  return value.replace(SERVICE_PATH_RE, currentPath);
}

function rewriteStructuredDataUrls(
  value: unknown,
  currentPath: string,
  homeUrl: string,
  asBusinessUrl = false,
): unknown {
  if (typeof value === "string") {
    return rewriteUrlString(value, currentPath, homeUrl, asBusinessUrl);
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewriteStructuredDataUrls(item, currentPath, homeUrl, asBusinessUrl));
  }
  if (!value || typeof value !== "object") return value;

  const node = value as Record<string, unknown>;
  const business = asBusinessUrl || isBusinessEntityNode(node);
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(node)) {
    if (key === "itemListElement") {
      out[key] = rewriteStructuredDataUrls(child, currentPath, homeUrl, false);
      continue;
    }
    if (key === "provider" || key === "parentOrganization") {
      out[key] = rewriteStructuredDataUrls(child, currentPath, homeUrl, true);
      continue;
    }
    out[key] = rewriteStructuredDataUrls(child, currentPath, homeUrl, business);
  }
  return out;
}

function breadcrumbList(
  homeUrl: string,
  pharmacyName: string,
  serviceName: string,
  servicePageUrl: string,
  localityName?: string,
  localityPageUrl?: string,
): Record<string, unknown> {
  const itemListElement: Record<string, unknown>[] = [
    { "@type": "ListItem", position: 1, name: pharmacyName, item: homeUrl },
    { "@type": "ListItem", position: 2, name: serviceName, item: servicePageUrl },
  ];
  if (localityName && localityPageUrl) {
    itemListElement.push({
      "@type": "ListItem",
      position: 3,
      name: localityName,
      item: localityPageUrl,
    });
  }
  return {
    "@type": "BreadcrumbList",
    itemListElement,
  };
}

function webPageNode(
  name: string,
  pageUrl: string,
  description: string,
): Record<string, unknown> {
  return {
    "@type": "WebPage",
    name,
    url: pageUrl,
    description,
  };
}

export function enrichVisualServicePageSchemaDocument(
  schema: Record<string, unknown>,
  ctx: VisualServicePageSchemaContext,
  faqs: ServicePageFaqLike[],
): Record<string, unknown> {
  const servicePageUrl = resolveCurrentServicePageUrl(ctx);
  const pageUrl = resolvePageIdentityUrl(ctx);
  const homeUrl = resolveHomeUrl(ctx, servicePageUrl);
  const localitySlug = String(ctx.localitySlug || "").trim();
  const localityName = String(ctx.localityName || "").trim();
  const currentPath = String(ctx.serviceId || "").trim()
    ? serviceUrlPath(ctx.serviceId as string)
    : "";
  const webPageName = localityName
    ? `${ctx.serviceName} ${localityName}`
    : `${ctx.serviceName} ${ctx.town}`.trim();

  const normalized: Record<string, unknown> = Array.isArray(schema["@graph"])
    ? { ...schema }
    : {
        "@context": schema["@context"] || "https://schema.org",
        "@graph": schema && Object.keys(schema).length ? [schema] : [],
      };

  let graph = [...schemaGraphNodes(normalized)].filter((node) => Object.keys(node).length > 0);

  if (currentPath) {
    graph = graph.map(
      (node) => rewriteStructuredDataUrls(node, currentPath, homeUrl) as Record<string, unknown>,
    );
  }

  graph = graph.filter((node) => !nodeTypes(node).includes("BreadcrumbList"));
  graph.push(
    breadcrumbList(
      homeUrl,
      ctx.pharmacyName,
      ctx.serviceName,
      servicePageUrl,
      localitySlug ? localityName || localitySlug : undefined,
      localitySlug ? pageUrl : undefined,
    ),
  );

  const serviceName = localityName ? `${ctx.serviceName} ${localityName}` : ctx.serviceName;
  const areaServed = localityName || ctx.town;
  if (!graphHasType(graph, "Service")) {
    graph.push({
      "@type": "Service",
      name: serviceName,
      serviceType: ctx.serviceName,
      url: pageUrl,
      description: ctx.metaDescription,
      areaServed: { "@type": "Place", name: areaServed },
      provider: {
        "@type": "MedicalBusiness",
        name: ctx.pharmacyName,
        url: homeUrl,
      },
    });
  } else {
    graph = graph.map((node) => {
      if (!nodeTypes(node).includes("Service")) return node;
      return {
        ...node,
        url: pageUrl,
      };
    });
  }

  if (!graphHasType(graph, "WebPage")) {
    graph.push(webPageNode(webPageName, pageUrl, ctx.metaDescription));
  } else {
    graph = graph.map((node) => {
      if (!nodeTypes(node).includes("WebPage")) return node;
      return {
        ...node,
        url: pageUrl,
      };
    });
  }

  if (faqs.length) {
    if (!graphHasType(graph, "FAQPage")) {
      graph.push({ "@type": "FAQPage", mainEntity: [] });
    }
  } else {
    graph = graph.filter((node) => !nodeTypes(node).includes("FAQPage"));
  }

  normalized["@graph"] = graph;
  normalized["@context"] = "https://schema.org";

  if (!faqs.length) return normalized;
  return (syncSchemaFaqs(normalized, faqs) as Record<string, unknown>) || normalized;
}

export function parseFirstJsonLdScript(schemaScriptsHtml: string): Record<string, unknown> | null {
  const match = schemaScriptsHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function serializeJsonLdScript(doc: Record<string, unknown>): string {
  const json = JSON.stringify(doc).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

const JSON_LD_SCRIPT_RE = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi;

export function extractRenderedFaqsFromHtml(html: string): ServicePageFaqLike[] {
  const faqs: ServicePageFaqLike[] = [];
  const pattern = /class="faq-q">([^<]+)<\/h3><p class="faq-a">([^<]+)<\/p>/g;
  for (const match of String(html || "").matchAll(pattern)) {
    const question = decodeJsonLdText(match[1]?.trim() || "");
    const answer = decodeJsonLdText(match[2]?.trim() || "");
    if (question && answer) faqs.push({ question, answer });
  }
  return faqs;
}

function decodeJsonLdText(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function applyApprovedCorePageJsonLd(
  html: string,
  ctx: VisualServicePageSchemaContext,
  faqs: ServicePageFaqLike[] = [],
): string {
  const source = String(html || "");
  const doc = enrichVisualServicePageSchemaDocument(
    { "@context": "https://schema.org", "@graph": [] },
    ctx,
    faqs,
  );
  const script = serializeJsonLdScript(doc);
  const withoutJsonLd = source.replace(JSON_LD_SCRIPT_RE, "");
  if (/<\/head>/i.test(withoutJsonLd)) {
    return withoutJsonLd.replace(/<\/head>/i, `${script}\n</head>`);
  }
  return `${script}\n${withoutJsonLd}`;
}
