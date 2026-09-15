/**
 * RC1-R1 — Generic tenant-aware Design Intelligence resolver for canonical renderer consumption.
 */
import fs from "node:fs";
import type { NavLink } from "../generator/brandImporter.ts";
import type {
  DesignIntelligenceFooterGroup,
  DesignIntelligenceImageRecord,
  DesignIntelligenceLinkNode,
  DesignIntelligenceManifest,
} from "./pharmacyDesignIntelligenceHierarchyModel.ts";
import { validateDesignIntelligenceManifest } from "./pharmacyDesignIntelligenceHierarchyBuilder.ts";
import {
  getWebsiteDesignIntelligencePath,
  loadWebsiteDesignEvidence,
  loadWebsiteDesignIntelligence,
} from "./pharmacyWebsiteDesignCaptureService.ts";
import { loadImportedDesignAssets } from "./pharmacyWebsiteDesignAssetImporter.ts";
import { isUiIconAssetPath } from "./pharmacyBusinessFieldSanitizer.ts";
import { hasActivatedTenantDesignDna, recordRenderFallback } from "./pharmacyTenantDnaRenderActivation.ts";
import type {
  ClassifiedNavLink,
  NavigationLinkRole,
  SiteChromeNavigationModel,
} from "./pharmacySiteChromeNavigationService.ts";
import type { SiteChromeColourRole, SiteChromeColourTokens } from "./pharmacySiteChromeColourService.ts";
import type { PharmacyImageSlot } from "./templates/pharmacyImageLibrary.ts";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeHex(value: string): string {
  const v = str(value).toLowerCase();
  if (!v) return "";
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  const rgba = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
  if (rgba) {
    const alpha = rgba[4] !== undefined ? Number(rgba[4]) : 1;
    if (alpha === 0) return "transparent";
    const [r, g, b] = rgba.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, "0"));
    return `#${r}${g}${b}`;
  }
  return v;
}

function isValidUrl(url: string): boolean {
  const normalized = str(url);
  if (!normalized || normalized === "#") return false;
  if (/^javascript:/i.test(normalized)) return false;
  if (/localhost|127\.0\.0\.1/i.test(normalized)) return false;
  return true;
}

function normLabel(label: string): string {
  return str(label).toLowerCase().replace(/\s+/g, " ");
}

function dedupeLinks(items: NavLink[]): NavLink[] {
  const seen = new Set<string>();
  const out: NavLink[] = [];
  for (const item of items) {
    const label = str(item.label);
    const href = str(item.href);
    if (!label || !isValidUrl(href)) continue;
    const key = `${normLabel(label)}|${href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, href });
  }
  return out;
}

function nodeToLink(node: DesignIntelligenceLinkNode, role: NavigationLinkRole): ClassifiedNavLink {
  return { label: str(node.text), href: str(node.href), role };
}

export interface DesignIntelligenceNavTreeItem {
  id: string;
  label: string;
  href: string;
  role: NavigationLinkRole;
  depth: number;
  order: number;
  children: DesignIntelligenceNavTreeItem[];
}

export interface DesignIntelligenceRuntimeSummary {
  filePath: string;
  schemaVersion: string;
  tenantSlug: string;
  navigationNodeCount: number;
  maxNavigationDepth: number;
  dropdownParents: number;
  dropdownChildren: number;
  headerRows: number;
  footerLayers: number;
  footerGroups: number;
  colourRoleCount: number;
  imageRoleCount: number;
  revision: string;
}

export interface DesignIntelligenceImageSlotRecord {
  slot: PharmacyImageSlot;
  requiredRole: string;
  selected: DesignIntelligenceImageRecord | null;
  sourceUrl: string;
  localPath: string;
  width: number;
  height: number;
  aspectRatio: string;
  renderedUrl: string;
  blocked: boolean;
  blockReason?: string;
}

const SLOT_ROLE_CANDIDATES: Record<PharmacyImageSlot, string[]> = {
  hero: ["hero"],
  support: ["supporting", "editorial", "gallery"],
  trust: ["trust", "gallery"],
  conversion: ["conversion", "gallery", "editorial"],
};

const PRIMARY_HEADER_ROLES = new Set(["primary-navigation", "dropdown-parent"]);

export function designIntelligenceRequiredForTenant(slug: string): boolean {
  return hasActivatedTenantDesignDna(slug);
}

export function requireDesignIntelligence(slug: string): DesignIntelligenceManifest {
  const filePath = getWebsiteDesignIntelligencePath(slug);
  if (!fs.existsSync(filePath)) {
    recordRenderFallback("design-intelligence", "design-intelligence-missing", true);
    throw new Error(`Design Intelligence missing for ${slug}: ${filePath}`);
  }

  const manifest = loadWebsiteDesignIntelligence(slug);
  if (!manifest) {
    recordRenderFallback("design-intelligence", "design-intelligence-invalid-json", true);
    throw new Error(`Design Intelligence invalid for ${slug}: ${filePath}`);
  }

  const validation = validateDesignIntelligenceManifest(manifest);
  if (!validation.pass) {
    recordRenderFallback("design-intelligence", validation.failures.join(","), true);
    throw new Error(`Design Intelligence validation failed for ${slug}: ${validation.failures.join("; ")}`);
  }

  const evidence = loadWebsiteDesignEvidence(slug);
  if (evidence?.sourceRevision && manifest.sourceRevision !== evidence.sourceRevision) {
    recordRenderFallback("design-intelligence", "design-intelligence-stale-revision", true);
    throw new Error(
      `Design Intelligence stale for ${slug}: di=${manifest.sourceRevision} evidence=${evidence.sourceRevision}`,
    );
  }

  return manifest;
}

export function tryLoadDesignIntelligence(slug: string): DesignIntelligenceManifest | null {
  if (!designIntelligenceRequiredForTenant(slug)) return null;
  try {
    return requireDesignIntelligence(slug);
  } catch {
    return null;
  }
}

export function summarizeDesignIntelligence(manifest: DesignIntelligenceManifest): DesignIntelligenceRuntimeSummary {
  const tree = manifest.navigation.tree;
  const dropdownParents = tree.filter((n) => n.role === "dropdown-parent").length;
  const dropdownChildren = tree.filter((n) => n.role === "dropdown-child").length;
  return {
    filePath: getWebsiteDesignIntelligencePath(manifest.tenant),
    schemaVersion: manifest.version,
    tenantSlug: manifest.tenant,
    navigationNodeCount: tree.length,
    maxNavigationDepth: manifest.navigation.hierarchyDepth,
    dropdownParents,
    dropdownChildren,
    headerRows: manifest.header.rowCount,
    footerLayers: 2,
    footerGroups: manifest.footer.groups.length,
    colourRoleCount: manifest.colours.length,
    imageRoleCount: manifest.images.length,
    revision: manifest.sourceRevision,
  };
}

export function printDesignIntelligenceSummary(manifest: DesignIntelligenceManifest): DesignIntelligenceRuntimeSummary {
  const summary = summarizeDesignIntelligence(manifest);
  console.log("Design Intelligence resolver");
  console.log(`  file path: ${summary.filePath}`);
  console.log(`  schema version: ${summary.schemaVersion}`);
  console.log(`  tenant slug: ${summary.tenantSlug}`);
  console.log(`  navigation node count: ${summary.navigationNodeCount}`);
  console.log(`  maximum navigation depth: ${summary.maxNavigationDepth}`);
  console.log(`  dropdown parents: ${summary.dropdownParents}`);
  console.log(`  dropdown children: ${summary.dropdownChildren}`);
  console.log(`  header rows: ${summary.headerRows}`);
  console.log(`  footer layers: ${summary.footerLayers}`);
  console.log(`  footer groups: ${summary.footerGroups}`);
  console.log(`  colour-role count: ${summary.colourRoleCount}`);
  console.log(`  image-role count: ${summary.imageRoleCount}`);
  console.log(`  revision: ${summary.revision}`);
  return summary;
}

function buildOrderedPrimaryTree(manifest: DesignIntelligenceManifest): DesignIntelligenceNavTreeItem[] {
  const rootId = manifest.navigation.rootId;
  const topLevel = manifest.navigation.tree
    .filter((n) => n.parentId === rootId && PRIMARY_HEADER_ROLES.has(n.role))
    .sort((a, b) => a.order - b.order);

  return topLevel.map((node) => {
    const children =
      node.role === "dropdown-parent"
        ? manifest.navigation.tree
            .filter((n) => n.parentId === node.id && n.role === "dropdown-child")
            .sort((a, b) => a.order - b.order)
            .map((child) => ({
              id: child.id,
              label: str(child.text),
              href: str(child.href),
              role: "dropdown-child" as const,
              depth: child.depth,
              order: child.order,
              children: [],
            }))
        : [];

    return {
      id: node.id,
      label: str(node.text),
      href: str(node.href),
      role: node.role === "dropdown-parent" ? "primary-navigation" : "primary-navigation",
      depth: node.depth,
      order: node.order,
      children,
    };
  });
}

function footerLinksFromTree(manifest: DesignIntelligenceManifest, role: DesignIntelligenceLinkNode["role"]): NavLink[] {
  return dedupeLinks(
    manifest.navigation.tree
      .filter((n) => n.role === role)
      .sort((a, b) => a.order - b.order)
      .map((n) => ({ label: str(n.text), href: str(n.href) })),
  );
}

function groupLinks(group: DesignIntelligenceFooterGroup, manifest: DesignIntelligenceManifest): NavLink[] {
  if (group.links.length) {
    return dedupeLinks(group.links.map((l) => ({ label: str(l.text), href: str(l.href) })));
  }
  if (group.role === "company") return footerLinksFromTree(manifest, "footer-navigation");
  if (group.role === "customerCare" || group.role === "legal") return footerLinksFromTree(manifest, "legal-navigation");
  if (group.role === "social") return footerLinksFromTree(manifest, "social-navigation");
  return [];
}

export function buildSiteChromeNavigationFromDesignIntelligence(
  manifest: DesignIntelligenceManifest,
): SiteChromeNavigationModel & { orderedPrimaryTree: DesignIntelligenceNavTreeItem[] } {
  const orderedPrimaryTree = buildOrderedPrimaryTree(manifest);
  const dropdownParentNode = manifest.navigation.tree.find((n) => n.role === "dropdown-parent") || null;
  const dropdownParent = dropdownParentNode ? nodeToLink(dropdownParentNode, "primary-navigation") : null;
  const dropdownChildren = manifest.navigation.tree
    .filter((n) => n.role === "dropdown-child")
    .sort((a, b) => a.order - b.order)
    .map((n) => nodeToLink(n, "dropdown-child"));

  const primaryNavigation = orderedPrimaryTree
    .filter((n) => !n.children.length)
    .map((n) => ({ label: n.label, href: n.href, role: "primary-navigation" as const }));

  const companyGroup = manifest.footer.groups.find((g) => g.role === "company");
  const customerGroup = manifest.footer.groups.find((g) => g.role === "customerCare" || g.role === "legal");
  const socialGroup = manifest.footer.groups.find((g) => g.role === "social");

  const footerCompanyLinks = dedupeLinks(
    companyGroup ? groupLinks(companyGroup, manifest) : footerLinksFromTree(manifest, "footer-navigation"),
  ).map((l) => ({ ...l, role: "footer-company-link" as const }));

  const footerLegalLinks = dedupeLinks(
    customerGroup ? groupLinks(customerGroup, manifest) : footerLinksFromTree(manifest, "legal-navigation"),
  ).map((l) => ({ ...l, role: "footer-legal-link" as const }));

  const socialLinks = dedupeLinks(socialGroup ? groupLinks(socialGroup, manifest) : footerLinksFromTree(manifest, "social-navigation")).map(
    (l) => ({ ...l, role: "social-link" as const }),
  );

  return {
    primaryNavigation,
    dropdownChildren,
    dropdownParent,
    utilityNavigation: [],
    footerCompanyLinks,
    footerLegalLinks,
    socialLinks,
    unclassified: [],
    headerRowCount: manifest.header.rowCount,
    orderedPrimaryTree,
  };
}

function pickColourHex(
  manifest: DesignIntelligenceManifest,
  roles: string[],
  fallback = "",
  mode: "text" | "background" = "background",
): SiteChromeColourRole {
  for (const roleName of roles) {
    const roleCandidates =
      mode === "text"
        ? [`${roleName}-text`, roleName]
        : [roleName];
    for (const candidateRole of roleCandidates) {
      const match = manifest.colours.find((c) => c.role === candidateRole && normalizeHex(c.hex));
      if (match) {
        return {
          role: roleName,
          hex: normalizeHex(match.hex),
          selector: match.selector,
          source: "design-intelligence",
        };
      }
    }
  }
  if (fallback) {
    return { role: roles[0] || "unknown", hex: normalizeHex(fallback), selector: "", source: "design-intelligence-layer" };
  }
  return { role: roles[0] || "unknown", hex: "", selector: "", source: "design-intelligence-missing" };
}

export function buildSiteChromeColourTokensFromDesignIntelligence(
  manifest: DesignIntelligenceManifest,
): SiteChromeColourTokens {
  const headerBg = pickColourHex(
    manifest,
    ["header-background"],
    manifest.header.logoBlock.backgroundColour || "#ffffff",
    "background",
  );
  const headerText = pickColourHex(
    manifest,
    ["header-text", "navigation-text"],
    manifest.header.navigationBlock.textColour || manifest.header.logoBlock.textColour,
    "text",
  );
  const navText = pickColourHex(manifest, ["navigation-text"], headerText.hex, "text");
  const ctaBg = pickColourHex(manifest, ["cta-background", "button-background"], "#015e69", "background");
  const ctaText = pickColourHex(manifest, ["cta-text", "button-text"], "#ffffff", "text");
  const heading = pickColourHex(manifest, ["heading-text"], "#327c86", "text");
  const body = pickColourHex(manifest, ["body-text"], "#767676", "text");
  const link = pickColourHex(manifest, ["link-colour", "footer-link"], manifest.footer.upperLayer.linkColour, "text");
  const border = pickColourHex(manifest, ["border-colour"], "#e5e7eb", "background");
  const upperFooter = pickColourHex(
    manifest,
    ["upper-footer-background"],
    manifest.footer.upperLayer.backgroundColour || "#ffffff",
    "background",
  );
  const lowerFooter = pickColourHex(
    manifest,
    ["lower-footer-background"],
    manifest.footer.lowerLayer.backgroundColour || upperFooter.hex,
    "background",
  );
  const footerHeading = pickColourHex(manifest, ["footer-heading", "footer-text"], manifest.footer.upperLayer.textColour, "text");
  const footerText = pickColourHex(manifest, ["footer-text"], footerHeading.hex, "text");
  const footerLink = pickColourHex(manifest, ["footer-link"], manifest.footer.upperLayer.linkColour || link.hex, "text");
  const socialGroup = manifest.footer.groups.find((g) => g.role === "social");
  const socialIcon = pickColourHex(
    manifest,
    ["social-icon", "social-colour"],
    socialGroup?.textColour || footerText.hex,
    "text",
  );

  const roles = [
    headerBg,
    headerText,
    navText,
    ctaBg,
    ctaText,
    heading,
    body,
    link,
    border,
    upperFooter,
    lowerFooter,
    footerHeading,
    footerText,
    footerLink,
    socialIcon,
  ];

  return {
    headerBackground: headerBg.hex,
    headerText: headerText.hex,
    primaryNavigationText: navText.hex,
    ctaBackground: ctaBg.hex || "#015e69",
    ctaText: ctaText.hex,
    headingText: heading.hex,
    bodyText: body.hex,
    linkColour: link.hex,
    borderColour: border.hex,
    upperFooterBackground: upperFooter.hex,
    lowerFooterBackground: lowerFooter.hex,
    footerHeadingColour: footerHeading.hex,
    footerTextColour: footerText.hex,
    footerLinkColour: footerLink.hex,
    socialIconColour: socialIcon.hex,
    roles,
  };
}

function normalizeAssetUrl(url: string): string {
  return str(url).replace(/^http:\/\//i, "https://").split("?")[0] || "";
}

function assetBasename(url: string): string {
  const normalized = normalizeAssetUrl(url);
  return normalized.split("/").pop() || normalized;
}

function resolveLocalAssetPath(slug: string, assetUrl: string): string {
  const normalized = normalizeAssetUrl(assetUrl);
  const basename = assetBasename(assetUrl);
  const imported = loadImportedDesignAssets(slug);
  const exact = imported.find((a) => a.importStatus === "imported" && normalizeAssetUrl(a.originalUrl) === normalized);
  if (exact?.localPath) return exact.localPath;

  const basenameMatch = imported.find(
    (a) => a.importStatus === "imported" && assetBasename(a.originalUrl) === basename,
  );
  if (basenameMatch?.localPath) return basenameMatch.localPath;

  const stem = basename.replace(/-\d+x\d+(?=\.[a-z]+$)/i, "").replace(/\.[a-z]+$/i, "");
  const stemMatch = imported.find(
    (a) =>
      a.importStatus === "imported" &&
      assetBasename(a.originalUrl).replace(/-\d+x\d+(?=\.[a-z]+$)/i, "").replace(/\.[a-z]+$/i, "") === stem,
  );
  return stemMatch?.localPath || "";
}

function isAvatarOrLogo(record: DesignIntelligenceImageRecord): boolean {
  const asset = str(record.asset).toLowerCase();
  if (record.role === "logo" || record.role === "header" || record.role === "footer") return true;
  if (/googleusercontent|gmblogo|gravatar|avatar|profile picture/i.test(asset)) return true;
  if (/logo/.test(asset)) return true;
  if (isUiIconAssetPath(asset, asset)) return true;
  return false;
}

function imageArea(record: DesignIntelligenceImageRecord): number {
  return Math.max(record.width, 0) * Math.max(record.height, 0);
}

function pickImageForRole(
  manifest: DesignIntelligenceManifest,
  role: string,
  usedIds: Set<string>,
  preferLarge = false,
): DesignIntelligenceImageRecord | null {
  const candidates = manifest.images
    .filter((img) => img.role === role && img.visibility === "visible" && !isAvatarOrLogo(img) && !usedIds.has(img.id))
    .sort((a, b) => (preferLarge ? imageArea(b) - imageArea(a) : 0));
  const picked = candidates[0] || null;
  if (picked) usedIds.add(picked.id);
  return picked;
}

export function resolveDesignIntelligenceImageSlots(
  slug: string,
  manifest: DesignIntelligenceManifest,
): DesignIntelligenceImageSlotRecord[] {
  const usedIds = new Set<string>();
  const slots: PharmacyImageSlot[] = ["hero", "support", "trust", "conversion"];

  return slots.map((slot) => {
    const roleCandidates = SLOT_ROLE_CANDIDATES[slot];
    let selected: DesignIntelligenceImageRecord | null = null;
    let requiredRole = roleCandidates[0] || slot;

    for (const role of roleCandidates) {
      selected = pickImageForRole(manifest, role, usedIds, slot === "hero" || slot === "support");
      if (selected) {
        requiredRole = role;
        break;
      }
    }

    const sourceUrl = selected ? str(selected.asset) : "";
    const localPath = selected ? resolveLocalAssetPath(slug, selected.asset) : "";
    const renderedUrl = localPath
      ? localPath.startsWith("assets/")
        ? `/${localPath}`
        : `/assets/website-import/${slug}/${localPath.split("/").pop()}`
      : "";

    const blocked = !selected || !localPath;
    if (blocked) {
      recordRenderFallback(`image-${slot}`, `design-intelligence-image-missing-${slot}`, true);
    }

    return {
      slot,
      requiredRole,
      selected,
      sourceUrl,
      localPath,
      width: selected?.width || 0,
      height: selected?.height || 0,
      aspectRatio: selected?.aspectRatio || "",
      renderedUrl,
      blocked,
      blockReason: blocked ? `missing-${requiredRole}-asset` : undefined,
    };
  });
}

export function getDesignIntelligenceManifestSources() {
  return {
    navigationSource: "design-intelligence.navigation.tree",
    headerSource: "design-intelligence.header",
    footerSource: "design-intelligence.footer",
    colourSource: "design-intelligence.colours",
    imageRoleSource: "design-intelligence.images",
  };
}
