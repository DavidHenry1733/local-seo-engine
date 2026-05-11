import { InternalLink, PagePlanItem, ProjectConfig } from "../generator/types";
import { selectInternalLinks } from "./selectInternalLinks";

export function buildInternalLinks(
  currentPage: PagePlanItem,
  allPages: PagePlanItem[],
  project?: ProjectConfig,
): InternalLink[] {
  // ── Config-based path (preferred) ───────────────────────────────────────────
  // When the project has an internalLinks pool, use the selection engine which
  // applies the full priority/anchor rules and caps at 3–6 links.
  if (project?.internalLinks) {
    return selectInternalLinks(
      project.internalLinks,
      {
        service:    currentPage.serviceKey,
        location:   currentPage.location,
        tier:       currentPage.pageRole,
        remotePath: `/${currentPage.slug}/`,
      },
      5, // target: 5 links max
    );
  }

  // ── Legacy slug-based path (fallback when no config) ─────────────────────
  const bySlug = new Map(allPages.map((p) => [p.slug, p]));

  if (currentPage.pageRole === "hub") {
    // Hub → all area pages for this service cluster
    return (currentPage.allAreaSlugs ?? [])
      .map((slug) => bySlug.get(slug))
      .filter((p): p is PagePlanItem => !!p)
      .map((p) => ({
        href:  `/${p.slug}/`,
        label: `${p.serviceLabel} ${p.location}`,
      }));
  }

  // Area page → hub first, then sibling areas
  const links: InternalLink[] = [];

  if (currentPage.hubSlug) {
    const hub = bySlug.get(currentPage.hubSlug);
    if (hub) {
      links.push({
        href:  `/${hub.slug}/`,
        label: `${hub.serviceLabel} ${hub.location}`,
      });
    }
  }

  for (const slug of currentPage.siblingAreaSlugs ?? []) {
    const p = bySlug.get(slug);
    if (p) {
      links.push({
        href:  `/${p.slug}/`,
        label: `${p.serviceLabel} ${p.location}`,
      });
    }
  }

  // Fallback for pages without area relationships
  if (links.length === 0) {
    return allPages
      .filter((p) => p.slug !== currentPage.slug && p.serviceKey === currentPage.serviceKey)
      .slice(0, 3)
      .map((p) => ({
        href:  `/${p.slug}/`,
        label: `${p.serviceLabel} ${p.location}`,
      }));
  }

  return links;
}
