/**
 * staticImageAssets.ts
 *
 * Resolves local static image packs for services that use fixed assets
 * instead of AI-generated images (e.g. web_design).
 *
 * Adding a new service pack:
 *   1. Add an entry to input/image-packs.json keyed by normalised service name
 *      (lowercase, spaces/hyphens → underscores). E.g. "wordpress_care".
 *   2. Place the asset files under assets/<service>/.
 *   3. No code changes needed — the pack is resolved automatically.
 */

import fs from "fs";
import path from "path";
import { generateImagePrompt, SceneType, ImageAsset } from "./generateImagePrompt";

export type ImagePackScenes = Partial<Record<SceneType, string>>;

export type ImagePackConfig = {
  [serviceKey: string]: {
    scenes: ImagePackScenes;
  };
};

export type StaticImageAsset = ImageAsset & {
  staticFilePath: string;
  uploadFileName: string;
};

function normaliseServiceKey(service: string): string {
  return service.toLowerCase().trim().replace(/[\s-]+/g, "_");
}

function slugify(value: string): string {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolveStaticPack(
  service: string,
  projectRoot: string
): ImagePackConfig[string] | null {
  const packsPath = path.join(projectRoot, "input", "image-packs.json");
  if (!fs.existsSync(packsPath)) return null;

  const packs = JSON.parse(fs.readFileSync(packsPath, "utf-8")) as ImagePackConfig;
  const key = normaliseServiceKey(service);
  return packs[key] ?? null;
}

export function buildStaticImageAsset(input: {
  projectRoot: string;
  brand: string;
  service: string;
  city: string;
  area?: string;
  sceneType: SceneType;
}): StaticImageAsset {
  const { projectRoot, brand, service, city, area, sceneType } = input;

  const pack = resolveStaticPack(service, projectRoot);
  if (!pack) {
    throw new Error(`No static image pack found for service "${service}"`);
  }

  const rawRelativePath = pack.scenes[sceneType];
  if (!rawRelativePath) {
    throw new Error(
      `Scene "${sceneType}" not configured in image pack for service "${service}"`
    );
  }

  const absoluteFilePath = path.join(projectRoot, rawRelativePath);
  if (!fs.existsSync(absoluteFilePath)) {
    throw new Error(
      `Static image file not found on disk: ${absoluteFilePath}\n` +
      `Place the asset at: ${rawRelativePath}`
    );
  }

  const asset = generateImagePrompt({
    pageType: "area",
    brand,
    service,
    city,
    area,
    imageConfig: {},
    section: sceneType,
    sceneType,
  });

  const locationSlug = area ? slugify(area) : slugify(city);
  const uploadFileName = `${slugify(service)}-${locationSlug}-${sceneType}.png`;

  return {
    ...asset,
    staticFilePath: absoluteFilePath,
    uploadFileName,
  };
}
