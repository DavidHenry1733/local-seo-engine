/**
 * RC1-I1 — Build canonical Design Intelligence manifest from raw browser capture.
 */
import type { DesignEvidenceNavigationItem } from "./growthEngineWebsiteDesignEvidenceModel.ts";
import {
  DESIGN_INTELLIGENCE_VERSION,
  type DesignIntelligenceColourRole,
  type DesignIntelligenceFooterGroup,
  type DesignIntelligenceFooterHierarchy,
  type DesignIntelligenceHeaderHierarchy,
  type DesignIntelligenceImageRecord,
  type DesignIntelligenceLinkNode,
  type DesignIntelligenceManifest,
  type DesignIntelligenceNavRole,
} from "./pharmacyDesignIntelligenceHierarchyModel.ts";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeHex(value: string): string {
  const v = str(value).toLowerCase();
  if (!v) return "";
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  const rgba = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
  if (rgba) {
    const alpha = rgba[4] !== undefined ? parseFloat(rgba[4]) : 1;
    if (alpha === 0) return "";
    const [r, g, b] = rgba.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, "0"));
    return `#${r}${g}${b}`;
  }
  return v;
}

type RawNavNode = {
  id: string;
  parentId: string | null;
  depth: number;
  role: string;
  order: number;
  selector: string;
  href: string;
  text: string;
  visibility: string;
  breakpointVisibility: { desktop: boolean; tablet: boolean; mobile: boolean };
};

type RawFooterLayer = {
  selector: string;
  backgroundColour: string;
  textColour: string;
  linkColour: string;
  paddingTop: string;
  paddingBottom: string;
};

type RawFooterGroup = {
  id: string;
  role: string;
  selector: string;
  heading: string;
  links: Array<{ text: string; href: string; selector: string }>;
  backgroundColour: string;
  textColour: string;
};

type RawImageIntel = {
  id: string;
  role: string;
  selector: string;
  asset: string;
  width: number;
  height: number;
  aspectRatio: string;
  alt: string;
  lazyLoad: boolean;
  backgroundImage: string;
  visibility: string;
};

export type RawHierarchyCapture = {
  url: string;
  navigationTree?: RawNavNode[];
  headerHierarchy?: Record<string, unknown>;
  footerLayers?: {
    upperLayer: RawFooterLayer;
    lowerLayer: RawFooterLayer;
    groups: RawFooterGroup[];
    mobileStackOrder: string[];
  };
  colourRoles?: Array<{ role: string; selector: string; computedColour: string; hex: string; layer: string }>;
  imageIntelligence?: RawImageIntel[];
  navLinks?: Array<{ label: string; href: string; level: number; isDropdown: boolean; children?: unknown[] }>;
};

function asNavRole(role: string): DesignIntelligenceNavRole {
  const allowed: DesignIntelligenceNavRole[] = [
    "header",
    "primary-navigation",
    "dropdown-parent",
    "dropdown-child",
    "utility-navigation",
    "cta",
    "footer-navigation",
    "legal-navigation",
    "social-navigation",
  ];
  return (allowed.includes(role as DesignIntelligenceNavRole) ? role : "primary-navigation") as DesignIntelligenceNavRole;
}

export function navigationTreeToNestedItems(tree: DesignIntelligenceLinkNode[]): DesignEvidenceNavigationItem[] {
  const headerRoles = new Set(["primary-navigation", "dropdown-parent", "dropdown-child", "utility-navigation", "cta"]);
  const topLevel = tree.filter(
    (n) => (n.parentId === "nav-root" || (!n.parentId && n.depth === 0)) && headerRoles.has(n.role),
  );
  const byParent = new Map<string, DesignIntelligenceLinkNode[]>();
  for (const node of tree) {
    if (!node.parentId) continue;
    const list = byParent.get(node.parentId) || [];
    list.push(node);
    byParent.set(node.parentId, list);
  }

  function toItem(node: DesignIntelligenceLinkNode): DesignEvidenceNavigationItem {
    const children = (byParent.get(node.id) || [])
      .sort((a, b) => a.order - b.order)
      .map(toItem);
    return {
      label: node.text,
      href: node.href,
      level: node.depth + 1,
      isDropdown: node.role === "dropdown-parent" || children.length > 0,
      children,
    };
  }

  return topLevel.sort((a, b) => a.order - b.order).map(toItem);
}

export function buildDesignIntelligenceManifest(
  slug: string,
  primaryUrl: string,
  sourceRevision: string,
  capturedAt: string,
  raw: RawHierarchyCapture,
): DesignIntelligenceManifest {
  const tree: DesignIntelligenceLinkNode[] = (raw.navigationTree || []).map((n) => ({
    id: n.id,
    parentId: n.parentId,
    depth: n.depth,
    role: asNavRole(n.role),
    order: n.order,
    selector: n.selector,
    href: n.href,
    text: n.text,
    visibility: n.visibility === "hidden" ? "hidden" : n.visibility === "collapsed" ? "collapsed" : "visible",
    breakpointVisibility: n.breakpointVisibility,
  }));

  const hierarchyDepth = tree.length ? Math.max(...tree.map((n) => n.depth)) + 1 : 0;
  const hh = raw.headerHierarchy || {};
  const header: DesignIntelligenceHeaderHierarchy = {
    rowCount: Number(hh.rowCount) || (hh.announcementBar ? 2 : 1),
    announcementBar: (hh.announcementBar as DesignIntelligenceHeaderHierarchy["announcementBar"]) || null,
    logoBlock: (hh.logoBlock as DesignIntelligenceHeaderHierarchy["logoBlock"]) || {
      selector: "",
      backgroundColour: "",
      textColour: "",
      paddingTop: "",
      paddingBottom: "",
      paddingLeft: "",
      paddingRight: "",
      alignment: "left",
      sticky: false,
      logoUrl: "",
      logoMaxHeight: "",
      logoPosition: "left",
    },
    navigationBlock: (hh.navigationBlock as DesignIntelligenceHeaderHierarchy["navigationBlock"]) || {
      selector: "",
      backgroundColour: "",
      textColour: "",
      paddingTop: "",
      paddingBottom: "",
      paddingLeft: "",
      paddingRight: "",
      alignment: "end",
      sticky: false,
      navPlacement: "inline",
      mobileMenuBehaviour: "stacked",
    },
    ctaBlock: (hh.ctaBlock as DesignIntelligenceHeaderHierarchy["ctaBlock"]) || {
      selector: "",
      backgroundColour: "",
      textColour: "",
      paddingTop: "",
      paddingBottom: "",
      paddingLeft: "",
      paddingRight: "",
      alignment: "right",
      sticky: false,
      labels: [],
      hrefs: [],
    },
    spacing: (hh.spacing as DesignIntelligenceHeaderHierarchy["spacing"]) || { paddingY: "", paddingX: "", gap: "" },
    alignment: (hh.alignment as DesignIntelligenceHeaderHierarchy["alignment"]) || { logo: "left", nav: "center", cta: "right" },
    sticky: Boolean(hh.sticky),
    responsive: (hh.responsive as DesignIntelligenceHeaderHierarchy["responsive"]) || {
      desktopBreakpoint: "980px",
      mobileMenuBehaviour: "stacked",
    },
  };

  const fl = raw.footerLayers;
  const footer: DesignIntelligenceFooterHierarchy = {
    upperLayer: fl?.upperLayer || {
      selector: "footer",
      backgroundColour: "",
      textColour: "",
      linkColour: "",
      paddingTop: "",
      paddingBottom: "",
    },
    lowerLayer: fl?.lowerLayer || {
      selector: ".footer-bottom, .copyright",
      backgroundColour: "",
      textColour: "",
      linkColour: "",
      paddingTop: "",
      paddingBottom: "",
    },
    groups: (fl?.groups || []) as DesignIntelligenceFooterGroup[],
    mobileStackOrder: fl?.mobileStackOrder || [],
  };

  const colours: DesignIntelligenceColourRole[] = (raw.colourRoles || []).map((c) => ({
    role: c.role,
    selector: c.selector,
    computedColour: c.computedColour,
    hex: normalizeHex(c.hex || c.computedColour),
    layer: c.layer as DesignIntelligenceColourRole["layer"],
  }));

  const images: DesignIntelligenceImageRecord[] = (raw.imageIntelligence || []).map((img) => ({
    id: img.id,
    role: img.role as DesignIntelligenceImageRecord["role"],
    selector: img.selector,
    asset: img.asset,
    width: img.width,
    height: img.height,
    aspectRatio: img.aspectRatio,
    alt: img.alt,
    lazyLoad: img.lazyLoad,
    backgroundImage: img.backgroundImage,
    visibility: img.visibility === "hidden" ? "hidden" : "visible",
  }));

  const hasDropdownChildren = tree.some((n) => n.role === "dropdown-child");
  const hasDropdownParent = tree.some((n) => n.role === "dropdown-parent");
  const flatSiblingServices =
    tree.filter((n) => n.role === "dropdown-child" && n.depth <= 1).length > 0 &&
    !tree.some((n) => n.role === "dropdown-parent");

  return {
    version: DESIGN_INTELLIGENCE_VERSION,
    tenant: slug,
    sourceRevision,
    capturedAt,
    primaryUrl,
    navigation: {
      tree,
      hierarchyDepth,
      rootId: "nav-root",
    },
    header,
    footer,
    colours,
    images,
    validation: {
      navigationTreeComplete: tree.length >= 3 && hasDropdownParent && hasDropdownChildren,
      headerHierarchyComplete: Boolean(header.logoBlock.logoUrl && header.navigationBlock.selector),
      footerHierarchyComplete: Boolean(footer.upperLayer.selector && footer.lowerLayer.selector && footer.groups.length >= 2),
      colourRolesComplete: colours.length >= 8,
      imageRolesComplete: images.filter((i) => ["hero", "supporting", "trust", "conversion"].includes(i.role)).length >= 2,
      navigationFlatteningRemoved: !flatSiblingServices,
      footerLayerMergeRemoved:
        footer.groups.length >= 2 &&
        Boolean(footer.upperLayer.selector) &&
        Boolean(footer.lowerLayer.selector) &&
        footer.upperLayer.selector !== footer.lowerLayer.selector,
    },
  };
}

export function validateDesignIntelligenceManifest(manifest: DesignIntelligenceManifest): {
  pass: boolean;
  failures: string[];
} {
  const failures: string[] = [];
  if (!manifest.validation.navigationTreeComplete) failures.push("navigation-tree-incomplete");
  if (!manifest.validation.headerHierarchyComplete) failures.push("header-hierarchy-incomplete");
  if (!manifest.validation.footerHierarchyComplete) failures.push("footer-hierarchy-incomplete");
  if (!manifest.validation.colourRolesComplete) failures.push("colour-roles-incomplete");
  if (!manifest.validation.imageRolesComplete) failures.push("image-roles-incomplete");
  if (!manifest.validation.navigationFlatteningRemoved) failures.push("navigation-still-flattened");
  if (!manifest.validation.footerLayerMergeRemoved) failures.push("footer-layers-still-merged");
  return { pass: failures.length === 0, failures };
}
