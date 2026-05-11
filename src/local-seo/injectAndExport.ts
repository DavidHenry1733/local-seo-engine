import fs from "fs";
import path from "path";
import { injectAllImages, MultiImageAsset } from "./injectAllImages";
import { exportToWordPress } from "./exportToWordPress";

const SLUG = "local-seo-sheffield";

async function run() {
  const projectRoot = process.cwd();
  const outputDir = path.join(projectRoot, "output", SLUG);

  console.log(`\nSlug: ${SLUG}`);
  console.log("═".repeat(50));

  const assets: MultiImageAsset[] = JSON.parse(
    fs.readFileSync(path.join(outputDir, "image-assets.json"), "utf-8")
  );

  console.log(`\n[1] Injecting ${assets.length} images into page.html...`);
  injectAllImages(projectRoot, SLUG, assets);

  const html = fs.readFileSync(path.join(outputDir, "page.html"), "utf-8");
  const injectedCount = (html.match(/generated-page-image--/g) || []).length;
  console.log(`    Verified: ${injectedCount} image blocks present in HTML`);

  console.log(`\n[2] Exporting to WordPress...`);
  const result = await exportToWordPress(projectRoot, SLUG, {
    wordpressStatus: "draft",
    wordpressMode: "update-existing",
  });

  console.log("\n" + "═".repeat(50));
  if (result.action === "skipped") {
    console.log(`WordPress: SKIPPED — ${result.reason}`);
  } else {
    console.log(`WordPress: ${result.action.toUpperCase()}`);
    console.log(`Page ID:   ${result.pageId}`);
    console.log(`Link:      ${result.link}`);
  }

  console.log(`\nDone.`);
}

run().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
