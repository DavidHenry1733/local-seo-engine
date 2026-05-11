/**
 * addScene.ts
 *
 * Adds a single image scene to an already-generated page.
 * Skips content/HTML/schema generation — assumes the page already exists.
 * Generates the image, uploads it, injects it, and re-exports to WordPress.
 *
 * Usage:
 *   pnpm exec tsx src/local-seo/addScene.ts --slug web-design-ecclesall --scene trust
 *   pnpm exec tsx src/local-seo/addScene.ts --slug web-design-ecclesall --scene conversion
 */

import fs from "fs";
import path from "path";
import { generateImagePrompt, SceneType } from "./generateImagePrompt";
import { generateIdeogramImage } from "./generateIdeogramImage";
import { resolveStaticPack, buildStaticImageAsset } from "./staticImageAssets";
import { uploadImageToWordPress } from "./uploadImageToWordPress";
import { injectAllImages, MultiImageAsset } from "./injectAllImages";
import { exportToWordPress } from "./exportToWordPress";

type ImageConfig = {
  stylePreset: string;
  renderingSpeed: string;
  scenes?: SceneType[];
  brandStyles?: Record<string, unknown>;
};

type PageData = {
  page: { slug: string };
  job: { brand: string; service: string; city: string; area?: string };
};

function parseArgs(): { slug: string; scene: SceneType; export: boolean; skipGenerate: boolean } {
  const args = process.argv.slice(2);
  let slug = "";
  let scene: SceneType = "hero";
  let doExport = true;
  let skipGenerate = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--slug" && args[i + 1]) slug = args[++i];
    if (args[i] === "--scene" && args[i + 1]) scene = args[++i] as SceneType;
    if (args[i] === "--no-export") doExport = false;
    if (args[i] === "--skip-generate") skipGenerate = true;
  }

  if (!slug) throw new Error("--slug is required. Example: --slug web-design-ecclesall");

  return { slug, scene, export: doExport, skipGenerate };
}

async function run() {
  const { slug, scene, export: doExport, skipGenerate } = parseArgs();
  const projectRoot = process.cwd();

  console.log(`\nSlug:  ${slug}`);
  console.log(`Scene: ${scene}`);
  console.log("─".repeat(50));

  const outputDir = path.join(projectRoot, "output", slug);

  if (!fs.existsSync(path.join(outputDir, "page.html"))) {
    throw new Error(`page.html not found for "${slug}" — run the batch first to generate the page`);
  }

  const imageConfig = JSON.parse(
    fs.readFileSync(path.join(projectRoot, "input", "image-config.json"), "utf-8")
  ) as ImageConfig;

  const pageData = JSON.parse(
    fs.readFileSync(path.join(outputDir, "page-data.json"), "utf-8")
  ) as PageData;

  const { brand, service, city, area = "" } = pageData.job;

  // ─── 1. Resolve asset (static pack or AI prompt) ───────────────────────────

  const staticPack = resolveStaticPack(service, projectRoot);
  const isStatic = staticPack !== null;

  let asset: ReturnType<typeof generateImagePrompt>;
  let imageSourcePath: string;
  let uploadFileName: string | undefined;

  if (isStatic) {
    console.log(`\n[1] Static image pack detected for "${service}" — skipping AI generation`);
    const staticAsset = buildStaticImageAsset({
      projectRoot,
      brand,
      service,
      city,
      area: area || undefined,
      sceneType: scene,
    });
    asset = staticAsset;
    imageSourcePath = staticAsset.staticFilePath;
    uploadFileName = staticAsset.uploadFileName;
    console.log(`    Source:    ${staticAsset.staticFilePath}`);
    console.log(`    Upload as: ${uploadFileName}`);
    console.log(`    placement: ${asset.placement}`);
    console.log(`    altText:   ${asset.altText}`);
  } else {
    console.log(`\n[1] Generating prompt...`);
    asset = generateImagePrompt({
      pageType: "area",
      brand,
      service,
      city,
      area: area || undefined,
      imageConfig,
      section: scene,
      sceneType: scene,
    });
    console.log(`    fileName:  ${asset.fileName}`);
    console.log(`    placement: ${asset.placement}`);
    console.log(`    altText:   ${asset.altText}`);

    // ─── 2. Generate image via AI ─────────────────────────────────────────

    const existingImagePath = path.join(outputDir, asset.fileName);
    const imageExists = fs.existsSync(existingImagePath);

    let imageResult: { imagePath: string };

    if (skipGenerate && imageExists) {
      console.log(`\n[2] Skipping image generation — using existing file on disk`);
      console.log(`    ${existingImagePath}`);
      imageResult = { imagePath: existingImagePath };
    } else {
      if (skipGenerate && !imageExists) {
        console.log(`\n[2] --skip-generate set but no file found — generating via Ideogram...`);
      } else {
        console.log(`\n[2] Generating image via Ideogram...`);
      }
      imageResult = await generateIdeogramImage(
        projectRoot,
        slug,
        asset.prompt,
        asset.altText,
        asset.fileName,
        imageConfig,
        scene,
        asset.negativePrompt
      );
    }
    imageSourcePath = imageResult.imagePath;
    console.log(`    Saved: ${imageSourcePath}`);
  }

  // ─── 3. Upload to WordPress ────────────────────────────────────────────────

  console.log(`\n[${isStatic ? "2" : "3"}] Uploading to WordPress...`);
  const upload = await uploadImageToWordPress(
    projectRoot,
    slug,
    imageSourcePath,
    asset.altText,
    scene,
    uploadFileName
  );
  console.log(`    Media ID:   ${upload.mediaId}`);
  console.log(`    Source URL: ${upload.sourceUrl}`);

  // ─── 4. Merge into image-assets.json ──────────────────────────────────────

  const assetsPath = path.join(outputDir, "image-assets.json");
  const existing: MultiImageAsset[] = fs.existsSync(assetsPath)
    ? JSON.parse(fs.readFileSync(assetsPath, "utf-8"))
    : [];

  const newAsset = {
    scene,
    fileName: asset.fileName,
    altText: asset.altText,
    titleText: asset.titleText,
    caption: asset.caption,
    placement: asset.placement,
    sourceUrl: upload.sourceUrl,
    mediaId: upload.mediaId,
  };

  const merged = [
    ...existing.filter((a: any) => a.scene !== scene),
    newAsset,
  ];

  fs.writeFileSync(assetsPath, JSON.stringify(merged, null, 2));
  console.log(`\n    image-assets.json updated (${merged.length} total scenes)`);

  // ─── 5. Inject ALL accumulated scenes into page HTML ──────────────────────

  console.log(`\n[4] Injecting all scenes into page.html...`);
  const allAssets: MultiImageAsset[] = JSON.parse(fs.readFileSync(assetsPath, "utf-8"));
  injectAllImages(projectRoot, slug, allAssets);

  const html = fs.readFileSync(path.join(outputDir, "page.html"), "utf-8");
  const total = (html.match(/generated-page-image--/g) || []).length;
  console.log(`    Total image blocks in HTML: ${total}/${allAssets.length}`);

  // ─── 6. Export to WordPress ────────────────────────────────────────────────

  if (doExport) {
    console.log(`\n[5] Exporting to WordPress...`);
    const result = await exportToWordPress(projectRoot, slug, {
      wordpressStatus: "draft",
      wordpressMode: "update-existing",
    });

    console.log(`\n${"═".repeat(50)}`);
    if (result.action === "skipped") {
      console.log(`WordPress: SKIPPED — ${result.reason}`);
    } else {
      console.log(`WordPress: ${result.action.toUpperCase()} → Page ID ${result.pageId}`);
      console.log(`Link:      ${result.link}`);
    }
  }

  console.log(`\nScene "${scene}" added to ${slug}`);
}

run().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
