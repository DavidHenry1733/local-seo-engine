import { ProjectConfig, PagePayload, PagePlanItem } from "./types";
import { renderServiceLocationTemplate, RenderMode } from "../templates/service-location-v1";

export function renderPage(
  project: ProjectConfig,
  page: PagePlanItem,
  payload: PagePayload,
  mode: RenderMode = "static"
): string {
  if (page.template === "service-location-v1") {
    return renderServiceLocationTemplate(project, payload, mode);
  }

  throw new Error(`Unsupported template: ${page.template}`);
}
