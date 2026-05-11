import fs from "fs";
import path from "path";
import { generateImagePrompt } from "./generateImagePrompt";
import { generateIdeogramImage } from "./generateIdeogramImage";
import { uploadImageToWordPress } from "./uploadImageToWordPress";
import { injectImageIntoHtml } from "./injectImageIntoHtml";
import { exportToWordPress } from "./exportToWordPress";

const slug = "web-design-ecclesall";

async function run() {
  const projectRoot = process.cwd();

  const imageConfigPath = path.join(projectRoot, "input", "image-config.json");
  const imageConfig = JSON.parse(fs.readFileSync(imageConfigPath, "utf-8"));

  const pageDataPath = path.join(projectRoot, "output", slug, "page-data.json");
  const pageData = JSON.parse(fs.readFileSync(pageDataPath, "utf-8"));

  const brand = pageData.brand?.name || pageData.job?.brand || "Unknown";
  const service = pageData.service?.service_name || pageData.job?.service || "Service";
  const city = pageData.location?.city || pageData.job?.city || "";
  const area = pageData.location?.area || pageData.job?.area || "";
  const isHub = Array.isArray(pageData.location?.child_areas);
  const pageType = isHub ? "hub" : "area";

  console.log(`Image pipeline test`);
  console.log(`Slug:      ${slug}`);
  console.log(`PageType:  ${pageType}`);
  console.log(`Brand:     ${brand}`);
  console.log(`Service:   ${service}`);
  console.log(`City:      ${city}`);
  console.log(`Area:      ${area || "(hub)"}`);
  console.log("─".repeat(50));

  console.log(`\n1. Generating image prompt...`);
  const asset = generateImagePrompt({
    pageType: pageType as "hub" | "area",
    brand,
    service,
    city,
    area: area || undefined,
    imageConfig,
  });
  console.log(`   Scene:    ${asset.sceneType}`);
  console.log(`   Filename: ${asset.fileName}`);
  console.log(`   Alt text: ${asset.altText}`);
  console.log(`   Caption:  ${asset.caption}`);
  console.log(`   Placement:${asset.placement}`);
  console.log(`   Prompt:   ${asset.prompt.slice(0, 100)}...`);

  console.log(`\n2. Generating image via Ideogram...`);
  const imageResult = await generateIdeogramImage(
    projectRoot,
    slug,
    asset.prompt,
    asset.altText,
    asset.fileName,
    imageConfig
  );
  console.log(`   Saved: ${imageResult.imagePath}`);

  console.log(`\n3. Uploading image to WordPress...`);
  const uploadResult = await uploadImageToWordPress(
    projectRoot,
    slug,
    imageResult.imagePath,
    asset.altText
  );
  console.log(`   Media ID:   ${uploadResult.mediaId}`);
  console.log(`   Source URL: ${uploadResult.sourceUrl}`);

  console.log(`\n4. Injecting image into page HTML...`);
  injectImageIntoHtml(
    projectRoot,
    slug,
    uploadResult.sourceUrl,
    asset.altText,
    asset.placement,
    asset.titleText,
    asset.caption
  );

  console.log(`\n5. Exporting updated page to WordPress...`);
  const wpResult = await exportToWordPress(projectRoot, slug, {
    wordpressStatus: "draft",
    wordpressMode: "update-existing",
  });

  console.log("\n" + "─".repeat(50));
  if (wpResult.action === "skipped") {
    console.log(`WordPress: SKIPPED — ${wpResult.reason}`);
  } else {
    console.log(`WordPress: ${wpResult.action.toUpperCase()} → Page ID ${wpResult.pageId}`);
    console.log(`Link:      ${wpResult.link}`);
  }
  console.log(`\nImage pipeline complete for: ${slug}`);
}

run().catch((err) => {
  console.error("Image pipeline failed:", err.message);
  process.exit(1);
});
