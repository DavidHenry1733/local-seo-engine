import fs from "fs";
import path from "path";
import { injectAllImages, MultiImageAsset } from "./injectAllImages";
import { exportToWordPress } from "./exportToWordPress";

function getSlugs(): string[] {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--slug");
  if (idx !== -1 && args[idx + 1]) return [args[idx + 1]];
  return ["web-design-ecclesall", "web-design-fulwood", "web-design-hillsborough", "web-design-crookes"];
}

async function run() {
  const projectRoot = process.cwd();
  const slugs = getSlugs();

  for (const slug of slugs) {
    console.log(`\n${"─".repeat(50)}`);
    console.log(`Slug: ${slug}`);

    const outputDir = path.join(projectRoot, "output", slug);
    const assetsPath = path.join(outputDir, "image-assets.json");

    if (!fs.existsSync(assetsPath)) {
      console.warn(`  No image-assets.json — skipping`);
      continue;
    }

    const assets: MultiImageAsset[] = JSON.parse(fs.readFileSync(assetsPath, "utf-8"));
    console.log(`  Injecting ${assets.length} image(s)...`);

    injectAllImages(projectRoot, slug, assets);

    const html = fs.readFileSync(path.join(outputDir, "page.html"), "utf-8");
    const count = (html.match(/generated-page-image--/g) || []).length;
    console.log(`  Verified: ${count} image block(s) in HTML`);

    console.log(`  Exporting to WordPress...`);
    const result = await exportToWordPress(projectRoot, slug, {
      wordpressStatus: "draft",
      wordpressMode: "update-existing",
    });

    if (result.action === "skipped") {
      console.log(`  Skipped → ${result.reason}`);
    } else {
      console.log(`  ${result.action.toUpperCase()} → Page ID ${result.pageId} | ${result.link}`);
    }
  }

  console.log(`\n${"═".repeat(50)}`);
  console.log(`Re-inject + export complete`);
}

run().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
