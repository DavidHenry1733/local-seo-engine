import { generateImagePrompt, SceneType } from "./generateImagePrompt";
import { generateIdeogramImage } from "./generateIdeogramImage";
import { uploadImageToWordPress } from "./uploadImageToWordPress";
import fs from "fs";
import path from "path";

const SLUG = "local-seo-sheffield";

async function uploadScene(
  projectRoot: string,
  imageConfig: unknown,
  scene: SceneType,
  skipGenerate = false
) {
  console.log(`\n${"─".repeat(50)}`);
  console.log(`Scene: ${scene.toUpperCase()}`);

  const asset = generateImagePrompt({
    pageType: "area",
    brand: "InboxingProWeb",
    service: "Local SEO",
    city: "Sheffield",
    imageConfig: imageConfig as any,
    section: scene,
    sceneType: scene,
  });

  let imagePath = path.join(projectRoot, "output", SLUG, asset.fileName);

  if (skipGenerate && fs.existsSync(imagePath)) {
    console.log(`  [1] Image already on disk — skipping generation`);
    console.log(`  File: ${imagePath}`);
  } else {
    console.log(`  [1] Generating image via Ideogram...`);
    const img = await generateIdeogramImage(
      projectRoot,
      SLUG,
      asset.prompt,
      asset.altText,
      asset.fileName,
      imageConfig as any
    );
    imagePath = img.imagePath;
    console.log(`  Saved: ${imagePath}`);
  }

  console.log(`  [2] Uploading to WordPress...`);
  const upload = await uploadImageToWordPress(projectRoot, SLUG, imagePath, asset.altText);
  console.log(`  Media ID:   ${upload.mediaId}`);
  console.log(`  Source URL: ${upload.sourceUrl}`);

  return {
    scene,
    fileName: asset.fileName,
    altText: asset.altText,
    caption: asset.caption,
    placement: asset.placement,
    mediaId: upload.mediaId,
    sourceUrl: upload.sourceUrl,
  };
}

async function run() {
  const projectRoot = process.cwd();
  const imageConfig = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "input", "image-config.json"), "utf-8")
  );

  const gmbResult = await uploadScene(projectRoot, imageConfig, "gmb", true);
  const conversionResult = await uploadScene(projectRoot, imageConfig, "conversion", false);

  console.log(`\n${"═".repeat(50)}`);
  console.log(`GMB + CONVERSION COMPLETE`);
  console.log(`${"═".repeat(50)}\n`);

  const newResults = [gmbResult, conversionResult];
  console.log(JSON.stringify(newResults, null, 2));

  const assetsPath = path.join(projectRoot, "output", SLUG, "image-assets.json");
  const existing = fs.existsSync(assetsPath)
    ? JSON.parse(fs.readFileSync(assetsPath, "utf-8"))
    : [];

  const merged = [...existing, ...newResults];
  fs.writeFileSync(assetsPath, JSON.stringify(merged, null, 2));
  console.log(`\nMerged assets saved to: ${assetsPath}`);
}

run().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
