/**
 * RC1-I1 — Canonical hierarchical Design Intelligence model.
 */
export const DESIGN_INTELLIGENCE_VERSION = "design-intelligence-v1";

export type DesignIntelligenceNavRole =
  | "header"
  | "primary-navigation"
  | "dropdown-parent"
  | "dropdown-child"
  | "utility-navigation"
  | "cta"
  | "footer-navigation"
  | "legal-navigation"
  | "social-navigation";

export interface DesignIntelligenceBreakpointVisibility {
  desktop: boolean;
  tablet: boolean;
  mobile: boolean;
}

export interface DesignIntelligenceLinkNode {
  id: string;
  parentId: string | null;
  depth: number;
  role: DesignIntelligenceNavRole;
  order: number;
  selector: string;
  href: string;
  text: string;
  visibility: "visible" | "hidden" | "collapsed";
  breakpointVisibility: DesignIntelligenceBreakpointVisibility;
}

export interface DesignIntelligenceHeaderBlock {
  selector: string;
  backgroundColour: string;
  textColour: string;
  paddingTop: string;
  paddingBottom: string;
  paddingLeft: string;
  paddingRight: string;
  alignment: string;
  sticky: boolean;
}

export interface DesignIntelligenceHeaderHierarchy {
  rowCount: number;
  announcementBar: DesignIntelligenceHeaderBlock | null;
  logoBlock: DesignIntelligenceHeaderBlock & { logoUrl: string; logoMaxHeight: string; logoPosition: string };
  navigationBlock: DesignIntelligenceHeaderBlock & { navPlacement: string; mobileMenuBehaviour: string };
  ctaBlock: DesignIntelligenceHeaderBlock & { labels: string[]; hrefs: string[] };
  spacing: { paddingY: string; paddingX: string; gap: string };
  alignment: { logo: string; nav: string; cta: string };
  sticky: boolean;
  responsive: { desktopBreakpoint: string; mobileMenuBehaviour: string };
}

export interface DesignIntelligenceFooterLayer {
  selector: string;
  backgroundColour: string;
  textColour: string;
  linkColour: string;
  paddingTop: string;
  paddingBottom: string;
}

export interface DesignIntelligenceFooterGroup {
  id: string;
  role: "logo" | "company" | "customerCare" | "legal" | "social" | "copyright" | "hours" | "contact";
  selector: string;
  heading: string;
  links: Array<{ text: string; href: string; selector: string }>;
  backgroundColour: string;
  textColour: string;
}

export interface DesignIntelligenceFooterHierarchy {
  upperLayer: DesignIntelligenceFooterLayer;
  lowerLayer: DesignIntelligenceFooterLayer;
  groups: DesignIntelligenceFooterGroup[];
  mobileStackOrder: string[];
}

export interface DesignIntelligenceColourRole {
  role: string;
  selector: string;
  computedColour: string;
  hex: string;
  layer: "header" | "footer-upper" | "footer-lower" | "navigation" | "cta" | "body" | "button";
}

export type DesignIntelligenceImageRoleName =
  | "hero"
  | "supporting"
  | "trust"
  | "conversion"
  | "team"
  | "location"
  | "editorial"
  | "gallery"
  | "logo"
  | "header"
  | "footer"
  | "background"
  | "decorative";

export interface DesignIntelligenceImageRecord {
  id: string;
  role: DesignIntelligenceImageRoleName;
  selector: string;
  asset: string;
  width: number;
  height: number;
  aspectRatio: string;
  alt: string;
  lazyLoad: boolean;
  backgroundImage: string;
  visibility: "visible" | "hidden";
}

export interface DesignIntelligenceManifest {
  version: typeof DESIGN_INTELLIGENCE_VERSION;
  tenant: string;
  sourceRevision: string;
  capturedAt: string;
  primaryUrl: string;
  navigation: {
    tree: DesignIntelligenceLinkNode[];
    hierarchyDepth: number;
    rootId: string;
  };
  header: DesignIntelligenceHeaderHierarchy;
  footer: DesignIntelligenceFooterHierarchy;
  colours: DesignIntelligenceColourRole[];
  images: DesignIntelligenceImageRecord[];
  validation: {
    navigationTreeComplete: boolean;
    headerHierarchyComplete: boolean;
    footerHierarchyComplete: boolean;
    colourRolesComplete: boolean;
    imageRolesComplete: boolean;
    navigationFlatteningRemoved: boolean;
    footerLayerMergeRemoved: boolean;
  };
}
