import { ProjectConfig, PagePlanItem } from "../generator/types";

export function buildSchema(
  project: ProjectConfig,
  page: PagePlanItem,
  meta: { canonicalUrl: string }
): Record<string, unknown>[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: `${page.serviceLabel} ${page.location}`,
      url: meta.canonicalUrl
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: `${page.serviceLabel} ${page.location}`,
      areaServed: page.location,
      provider: {
        "@type": "Organization",
        name: project.businessName
      }
    }
  ];
}
