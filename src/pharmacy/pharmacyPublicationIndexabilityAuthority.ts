/**
 * Publication indexability authority — robots directives follow page-type contract
 * and publication role. Preview/draft/unapproved pages stay noindex.
 * Does not invent schema, change canonicals, or submit indexing.
 */
import fs from "node:fs";
import path from "node:path";
import {
  getTechnicalSeoContract,
  resolveTechnicalSeoPageType,
  type TechnicalSeoPageType,
} from "./pharmacyTechnicalSeoContract.ts";

export const INDEXABLE_ROBOTS_DIRECTIVE = "index, follow";
export const NONINDEXABLE_ROBOTS_DIRECTIVE = "noindex, nofollow";

export type PublicationIndexabilityRole =
  | "authoritative_indexable_publication"
  | "preview"
  | "draft"
  | "unapproved"
  | "rejected"
  | "non_selected";

export interface PublicationIndexabilityInput {
  pageType: string;
  publicationRole: PublicationIndexabilityRole;
  publicPath?: string | null;
  serviceId?: string | null;
}

export interface PublicationIndexabilityDecision {
  robots: typeof INDEXABLE_ROBOTS_DIRECTIVE | typeof NONINDEXABLE_ROBOTS_DIRECTIVE;
  indexable: boolean;
  pageType: TechnicalSeoPageType | "unregistered";
  publicationRole: PublicationIndexabilityRole;
  reason: string;
}

function str(value: unknown): string {
  return String(value || "").trim();
}

export function inferTechnicalSeoPageTypeFromPublicPath(publicPath: string, serviceId: string): string {
  const normalised = str(publicPath).replace(/\\/g, "/");
  const withSlash = normalised.startsWith("/") ? normalised : `/${normalised}`;
  const pathPart = withSlash.replace(/index\.html$/i, "");
  const finalPath = pathPart.endsWith("/") || pathPart === "" ? pathPart || "/" : `${pathPart}/`;
  if (finalPath === "/") return "homepage";
  const servicePath = `/${str(serviceId).replace(/^\/+|\/+$/g, "")}/`;
  if (serviceId && finalPath === servicePath) return "service";
  if (finalPath.startsWith("/local-")) return "locality";
  if (finalPath.includes("-faqs") || finalPath.endsWith("/faq/")) return "faq";
  if (finalPath.includes("-guide")) return "patient_guide";
  return "unregistered";
}

export function resolvePublicationRobotsDirective(
  input: PublicationIndexabilityInput,
): PublicationIndexabilityDecision {
  const inferred =
    resolveTechnicalSeoPageType(input.pageType) ||
    resolveTechnicalSeoPageType(
      inferTechnicalSeoPageTypeFromPublicPath(input.publicPath || "", input.serviceId || ""),
    );
  const role = input.publicationRole;
  const contract = inferred ? getTechnicalSeoContract(inferred) : null;

  if (role !== "authoritative_indexable_publication") {
    return {
      robots: NONINDEXABLE_ROBOTS_DIRECTIVE,
      indexable: false,
      pageType: inferred || "unregistered",
      publicationRole: role,
      reason: `Publication role '${role}' is not an authoritative indexable publication.`,
    };
  }

  if (!contract || !inferred) {
    return {
      robots: NONINDEXABLE_ROBOTS_DIRECTIVE,
      indexable: false,
      pageType: "unregistered",
      publicationRole: role,
      reason: `Unregistered page type '${input.pageType}' cannot receive indexable robots.`,
    };
  }

  if (!contract.indexableByDefault) {
    return {
      robots: NONINDEXABLE_ROBOTS_DIRECTIVE,
      indexable: false,
      pageType: inferred,
      publicationRole: role,
      reason: `Page type '${inferred}' is not indexable by the Technical SEO contract.`,
    };
  }

  return {
    robots: INDEXABLE_ROBOTS_DIRECTIVE,
    indexable: true,
    pageType: inferred,
    publicationRole: role,
    reason: `Approved published ${inferred} page follows the Technical SEO indexability contract.`,
  };
}

export function applyPublicationRobotsToHtml(html: string, robots: string): string {
  const source = String(html || "");
  if (!source) return source;
  const directive = str(robots) || NONINDEXABLE_ROBOTS_DIRECTIVE;
  const tag = `<meta name="robots" content="${directive}"/>`;
  if (/<meta\b[^>]*\bname=["']robots["'][^>]*>/i.test(source)) {
    return source.replace(/<meta\b[^>]*\bname=["']robots["'][^>]*>/i, tag);
  }
  if (/<\/head>/i.test(source)) {
    return source.replace(/<\/head>/i, `  ${tag}\n</head>`);
  }
  return `${tag}\n${source}`;
}

export function applyAuthoritativePublicationRobotsToHtml(
  html: string,
  input: PublicationIndexabilityInput,
): string {
  const decision = resolvePublicationRobotsDirective(input);
  return applyPublicationRobotsToHtml(html, decision.robots);
}

export function applyAuthoritativePublicationRobotsToHtmlTree(
  rootDir: string,
  serviceId: string,
): { filesUpdated: number; filesScanned: number } {
  if (!rootDir || !fs.existsSync(rootDir)) return { filesUpdated: 0, filesScanned: 0 };
  let filesUpdated = 0;
  let filesScanned = 0;
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "assets" || entry.name === "images" || entry.name === "revisions") continue;
        stack.push(full);
        continue;
      }
      if (!/\.html?$/i.test(entry.name)) continue;
      if (/^404\.html?$/i.test(entry.name)) continue;
      const rel = path.relative(rootDir, full).replace(/\\/g, "/");
      if (rel === "index.html") continue;
      filesScanned += 1;
      const publicPath =
        rel === "index.html" ? "/" : `/${path.posix.dirname(rel) === "." ? serviceId : path.posix.dirname(rel)}/`;
      const pageType = inferTechnicalSeoPageTypeFromPublicPath(publicPath, serviceId);
      const original = fs.readFileSync(full, "utf8");
      const next = applyAuthoritativePublicationRobotsToHtml(original, {
        pageType,
        publicationRole: "authoritative_indexable_publication",
        publicPath,
        serviceId,
      });
      if (next !== original) {
        fs.writeFileSync(full, next, "utf8");
        filesUpdated += 1;
      }
    }
  }
  return { filesUpdated, filesScanned };
}
