import { buildHubPageData } from "./buildHubPageData";
import { generateHubContent } from "./generateHubContent";
import { buildHubHtml } from "./buildHubHtml";
import { exportToWordPress } from "./exportToWordPress";
import { generateSchema } from "./generateSchema";

async function run() {
  const projectRoot = process.cwd();
  const { pageData } = buildHubPageData(projectRoot, "input/job.batch.json");
  const slug = pageData.page.slug;

  await generateHubContent(projectRoot, slug);
  buildHubHtml(projectRoot, slug);
  generateSchema(projectRoot, slug);
  await exportToWordPress(projectRoot, slug);

  console.log("Hub page complete:", slug);
}

run().catch(console.error);
