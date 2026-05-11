import path from "path";
import { buildPageData } from "./buildPageData";

const projectRoot = process.cwd();

try {
  const result = buildPageData(projectRoot, "input/job.json");
  console.log("Page data built successfully");
  console.log("Slug:", result.pageData.page.slug);
  console.log("Primary keyword:", result.pageData.page.primary_keyword);
  console.log("Output directory:", path.relative(projectRoot, result.outputDir));
} catch (error) {
  console.error("Error building page data");
  console.error(error);
}
