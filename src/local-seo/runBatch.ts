import fs from "fs";
import path from "path";
import { buildPageData } from "./buildPageData";
import { generateContent } from "./generateContent";
import { buildHtml } from "./buildHtml";
import { generateSchema } from "./generateSchema";
import { exportToWordPress } from "./exportToWordPress";
import type { ExportOptions } from "./exportToWordPress";
import { generateImagePrompt, SceneType } from "./generateImagePrompt";
import { generateIdeogramImage } from "./generateIdeogramImage";
import { uploadImageToWordPress } from "./uploadImageToWordPress";
import { injectAllImages, MultiImageAsset } from "./injectAllImages";

// ─── Types ────────────────────────────────────────────────────────────────────

type BatchJob = {
  brand: string;
  service: string;
  city: string;
  areas: string[];
  exportToWordPress: boolean;
  wordpressStatus?: "draft" | "publish" | "private" | "pending";
  wordpressMode?: "update-existing" | "create-only" | "update-only";
  images?: {
    enabled: boolean;
    scenes?: SceneType[];
  };
};

type ImageConfig = {
  stylePreset: string;
  renderingSpeed: string;
  scenes?: SceneType[];
  brandStyles?: Record<string, {
    visualStyle?: string;
    colourTone?: string;
    backgroundStyle?: string;
  }>;
};

type ImageAssetRecord = MultiImageAsset & {
  scene: string;
  fileName: string;
  titleText?: string;
  mediaId: number;
  sourceUrl: string;
};

type BatchResult = {
  area: string;
  slug: string;
  status: string;
  pageId?: number;
  error?: string;
  schemaGenerated?: boolean;
  wordpressAction?: string;
  wordpressStatus?: string;
  skippedReason?: string;
  imagesGenerated?: number;
  imageErrors?: string[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(value: string): string {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveScenes(
  batch: BatchJob,
  imageConfig: ImageConfig
): SceneType[] {
  if (batch.images?.scenes && batch.images.scenes.length > 0) {
    return batch.images.scenes;
  }
  if (imageConfig.scenes && imageConfig.scenes.length > 0) {
    return imageConfig.scenes;
  }
  return ["hero"];
}

// ─── Multi-scene image pipeline ───────────────────────────────────────────────

async function runMultiImagePipeline(
  projectRoot: string,
  slug: string,
  brand: string,
  service: string,
  city: string,
  area: string,
  imageConfig: ImageConfig,
  scenes: SceneType[]
): Promise<{ generated: number; errors: string[] }> {
  const assets: ImageAssetRecord[] = [];
  const errors: string[] = [];

  for (const scene of scenes) {
    try {
      console.log(`    Scene: ${scene}`);

      const asset = generateImagePrompt({
        pageType: "area",
        brand,
        service,
        city,
        area,
        imageConfig,
        section: scene,
        sceneType: scene,
      });

      const imageResult = await generateIdeogramImage(
        projectRoot,
        slug,
        asset.prompt,
        asset.altText,
        asset.fileName,
        imageConfig,
        scene,
        asset.negativePrompt
      );

      const uploadResult = await uploadImageToWordPress(
        projectRoot,
        slug,
        imageResult.imagePath,
        asset.altText,
        scene
      );

      assets.push({
        scene,
        fileName: asset.fileName,
        altText: asset.altText,
        titleText: asset.titleText,
        caption: asset.caption,
        placement: asset.placement,
        sourceUrl: uploadResult.sourceUrl,
        mediaId: uploadResult.mediaId,
      });

      console.log(`    ✓ ${scene} → Media ID ${uploadResult.mediaId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`    ✗ ${scene} failed: ${msg}`);
      errors.push(`${scene}: ${msg}`);
    }
  }

  if (assets.length > 0) {
    const assetsPath = path.join(projectRoot, "output", slug, "image-assets.json");
    fs.writeFileSync(assetsPath, JSON.stringify(assets, null, 2));

    injectAllImages(projectRoot, slug, assets);
  }

  return { generated: assets.length, errors };
}

// ─── Main batch runner ────────────────────────────────────────────────────────

async function runBatch() {
  const projectRoot = process.cwd();
  const batchPath = path.join(projectRoot, "input", "job.batch.json");
  const batch = JSON.parse(fs.readFileSync(batchPath, "utf-8")) as BatchJob;

  const mode = batch.wordpressMode || "update-existing";
  const status = batch.wordpressStatus || "draft";
  const imagesEnabled = batch.images?.enabled === true;

  let imageConfig: ImageConfig | null = null;
  let scenes: SceneType[] = ["hero"];

  if (imagesEnabled) {
    const imageConfigPath = path.join(projectRoot, "input", "image-config.json");
    if (fs.existsSync(imageConfigPath)) {
      imageConfig = JSON.parse(fs.readFileSync(imageConfigPath, "utf-8")) as ImageConfig;
      scenes = resolveScenes(batch, imageConfig);
    }
  }

  console.log(`Batch: ${batch.service} | ${batch.city} | ${batch.areas.length} areas`);
  console.log(`WordPress export: ${batch.exportToWordPress}`);
  if (batch.exportToWordPress) {
    console.log(`WordPress mode:   ${mode}`);
    console.log(`WordPress status: ${status}`);
  }
  if (imagesEnabled) {
    console.log(`Images: enabled — scenes: [${scenes.join(", ")}]`);
  } else {
    console.log(`Images: disabled`);
  }
  console.log("─".repeat(50));

  const exportOptions: ExportOptions = {
    wordpressStatus: status,
    wordpressMode: mode,
  };

  const results: BatchResult[] = [];

  for (const area of batch.areas) {
    console.log(`\n▶ ${area}`);

    const tempJobPath = path.join(projectRoot, "input", `_tmp_job_${slugify(area)}.json`);
    let slug = slugify(area);

    try {
      const tempJob = { brand: batch.brand, service: batch.service, city: batch.city, area };
      fs.writeFileSync(tempJobPath, JSON.stringify(tempJob, null, 2), "utf-8");

      const { pageData } = buildPageData(projectRoot, `input/_tmp_job_${slugify(area)}.json`);
      slug = pageData.page.slug;
      console.log(`  Slug: ${slug}`);

      console.log(`  Generating content...`);
      await generateContent(projectRoot, slug);

      console.log(`  Building HTML...`);
      buildHtml(projectRoot, slug);

      console.log(`  Generating schema...`);
      generateSchema(projectRoot, slug);

      let imagesGenerated = 0;
      let imageErrors: string[] = [];

      if (imagesEnabled && imageConfig) {
        console.log(`  Images (${scenes.length} scene${scenes.length > 1 ? "s" : ""})...`);
        const imgResult = await runMultiImagePipeline(
          projectRoot,
          slug,
          batch.brand,
          batch.service,
          batch.city,
          area,
          imageConfig,
          scenes
        );
        imagesGenerated = imgResult.generated;
        imageErrors = imgResult.errors;

        if (imagesGenerated > 0) {
          console.log(`  ${imagesGenerated}/${scenes.length} image(s) injected into HTML`);
        }
        if (imageErrors.length > 0) {
          console.warn(`  ${imageErrors.length} image(s) failed`);
        }
      }

      if (batch.exportToWordPress) {
        console.log(`  Exporting to WordPress...`);
        const wpResult = await exportToWordPress(projectRoot, slug, exportOptions);

        if (wpResult.action === "skipped") {
          console.log(`  Skipped → ${wpResult.reason}`);
          results.push({
            area, slug, status: "skipped",
            schemaGenerated: true,
            wordpressAction: "skipped",
            wordpressStatus: wpResult.wordpressStatus,
            skippedReason: wpResult.reason,
            imagesGenerated,
            imageErrors: imageErrors.length ? imageErrors : undefined,
          });
        } else {
          console.log(`  Exported → Page ID: ${wpResult.pageId} | ${wpResult.link}`);
          results.push({
            area, slug, status: "exported",
            pageId: wpResult.pageId,
            schemaGenerated: true,
            wordpressAction: wpResult.action,
            wordpressStatus: wpResult.wordpressStatus,
            imagesGenerated,
            imageErrors: imageErrors.length ? imageErrors : undefined,
          });
        }
      } else {
        console.log(`  WordPress export skipped`);
        results.push({
          area, slug, status: "built", schemaGenerated: true,
          imagesGenerated: imagesEnabled ? imagesGenerated : undefined,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  Error: ${message}`);
      results.push({ area, slug, status: "error", error: message });
    } finally {
      if (fs.existsSync(tempJobPath)) fs.unlinkSync(tempJobPath);
    }
  }

  // ─── Summary ───────────────────────────────────────────────────────────────

  console.log("\n" + "─".repeat(50));
  console.log("Batch complete\n");

  for (const r of results) {
    const tag = r.status === "error" ? "✗" : "✓";
    const schema = r.schemaGenerated ? " | schema ✓" : "";

    let imageTag = "";
    if (r.imagesGenerated !== undefined) {
      imageTag = r.imagesGenerated > 0
        ? ` | images ${r.imagesGenerated}/${scenes.length} ✓`
        : ` | images ✗`;
    }

    let detail = "";
    if (r.status === "error") {
      detail = ` → ${r.error}`;
    } else if (r.status === "skipped") {
      detail = ` → skipped (${r.skippedReason})${schema}${imageTag}`;
    } else if (r.pageId) {
      detail = ` → WP ID ${r.pageId} | ${r.wordpressAction} | ${r.wordpressStatus}${schema}${imageTag}`;
    } else {
      detail = `${schema}${imageTag}`;
    }

    console.log(`  ${tag} ${r.area} (${r.slug})${detail}`);

    if (r.imageErrors?.length) {
      for (const e of r.imageErrors) console.warn(`      image error: ${e}`);
    }
  }
}

runBatch().catch((err) => {
  console.error("Batch failed:", err);
  process.exit(1);
});
