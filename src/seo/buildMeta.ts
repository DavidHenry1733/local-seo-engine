import { ProjectConfig, PagePlanItem } from "../generator/types";

export function buildMeta(project: ProjectConfig, page: PagePlanItem) {
  const title = `${page.serviceLabel} ${page.location} | ${project.businessName}`;
  const description = `${page.serviceLabel} in ${page.location} for local businesses that want stronger visibility, better trust and more enquiries.`;
  const canonicalUrl = `${project.domain.replace(/\/$/, "")}/${page.slug}/`;

  return {
    metaTitle: title,
    metaDescription: description,
    canonicalUrl
  };
}
