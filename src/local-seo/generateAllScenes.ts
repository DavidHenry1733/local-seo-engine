import { generateImagePrompt, SceneType } from "./generateImagePrompt";
import { generateIdeogramImage } from "./generateIdeogramImage";
import { uploadImageToWordPress } from "./uploadImageToWordPress";
import fs from "fs";
import path from "path";

const SCENES: SceneType[] = ["hero", "rankings", "gmb", "conversion"];
const SLUG = "local-seo-sheffield";

async function run() {
  const projectRoot = process.cwd();
  const imageConfig = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "input", "image-config.json"), "utf-8")
  );

  fs.mkdirSync(path.join(projectRoot, "output", SLUG), { recursive: true });

  const results: Record<string, unknown>[] = [];

  for (const scene of SCENES) {
    console.log(`\n${"─".repeat(50)}`);
    console.log(`Scene: ${scene.toUpperCase()}`);

    const asset = generateImagePrompt({
      pageType: "area",
      brand: "InboxingProWeb",
      service: "Local SEO",
      city: "Sheffield",
      imageConfig,
      section: scene,
      sceneType: scene,
    });

    console.log(`  fileName:  ${asset.fileName}`);
    console.log(`  altText:   ${asset.altText}`);
    console.log(`  caption:   ${asset.caption}`);
    console.log(`  placement: ${asset.placement}`);
    console.log(`  prompt:    ${asset.prompt.slice(0, 120)}...`);

    console.log(`\n  [1] Generating image via Ideogram...`);
    const img = await generateIdeogramImage(
      projectRoot,
      SLUG,
      asset.prompt,
      asset.altText,
      asset.fileName,
      imageConfig
    );
    console.log(`  Saved: ${img.imagePath}`);

    console.log(`  [2] Uploading to WordPress...`);
    const upload = await uploadImageToWordPress(
      projectRoot,
      SLUG,
      img.imagePath,
      asset.altText
    );
    console.log(`  Media ID:   ${upload.mediaId}`);
    console.log(`  Source URL: ${upload.sourceUrl}`);

    results.push({
      scene,
      fileName: asset.fileName,
      altText: asset.altText,
      caption: asset.caption,
      placement: asset.placement,
      mediaId: upload.mediaId,
      sourceUrl: upload.sourceUrl,
    });
  }

  console.log(`\n${"═".repeat(50)}`);
  console.log(`ALL SCENES COMPLETE`);
  console.log(`${"═".repeat(50)}\n`);
  console.log(JSON.stringify(results, null, 2));

  const outPath = path.join(projectRoot, "output", SLUG, "image-assets.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nAssets saved to: ${outPath}`);
}

run().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
