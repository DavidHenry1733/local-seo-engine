/**
 * Checksum and perceptual-hash duplicate detection.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const requireCjs = createRequire(import.meta.url);
const sharp = requireCjs(
  "/home/inboxingproweb/pharmaconnect-growth-engine/artifacts/api-server/node_modules/sharp",
) as typeof import("sharp");

export function sha256Checksum(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export async function computePerceptualHash(filePath: string): Promise<string> {
  const { data } = await sharp(filePath)
    .resize(9, 8, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let bits = "";
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = data[y * 9 + x];
      const right = data[y * 9 + x + 1];
      bits += left < right ? "1" : "0";
    }
  }
  return BigInt("0b" + bits).toString(16).padStart(16, "0");
}

export function hammingDistanceHex(a: string, b: string): number {
  const ai = BigInt("0x" + a);
  const bi = BigInt("0x" + b);
  let x = ai ^ bi;
  let count = 0;
  while (x > 0n) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

export interface DuplicateScanResult {
  exactDuplicates: Array<{ assetId: string; duplicateOf: string; checksum: string }>;
  nearDuplicates: Array<{ assetId: string; similarTo: string; distance: number }>;
}

export async function scanDuplicates(
  entries: Array<{ assetId: string; filePath: string }>,
  nearThreshold = 8,
): Promise<DuplicateScanResult> {
  const exactDuplicates: DuplicateScanResult["exactDuplicates"] = [];
  const nearDuplicates: DuplicateScanResult["nearDuplicates"] = [];
  const checksumMap = new Map<string, string>();
  const phashList: Array<{ assetId: string; hash: string }> = [];

  for (const e of entries) {
    if (!fs.existsSync(e.filePath)) continue;
    const sum = sha256Checksum(e.filePath);
    const existing = checksumMap.get(sum);
    if (existing) {
      exactDuplicates.push({ assetId: e.assetId, duplicateOf: existing, checksum: sum });
    } else {
      checksumMap.set(sum, e.assetId);
    }
    phashList.push({ assetId: e.assetId, hash: await computePerceptualHash(e.filePath) });
  }

  for (let i = 0; i < phashList.length; i++) {
    for (let j = i + 1; j < phashList.length; j++) {
      const d = hammingDistanceHex(phashList[i].hash, phashList[j].hash);
      if (d > 0 && d <= nearThreshold) {
        nearDuplicates.push({
          assetId: phashList[j].assetId,
          similarTo: phashList[i].assetId,
          distance: d,
        });
      }
    }
  }

  return { exactDuplicates, nearDuplicates };
}

export async function readImageDimensions(
  filePath: string,
): Promise<{ width: number; height: number; mimeType: string; fileSize: number }> {
  const meta = await sharp(filePath).metadata();
  const stat = fs.statSync(filePath);
  const mimeType =
    meta.format === "webp"
      ? "image/webp"
      : meta.format === "jpeg"
        ? "image/jpeg"
        : meta.format === "png"
          ? "image/png"
          : "application/octet-stream";
  return {
    width: meta.width || 0,
    height: meta.height || 0,
    mimeType,
    fileSize: stat.size,
  };
}

export async function writeWebpVariants(
  masterPath: string,
  outDir: string,
  baseName: string,
  widths: number[],
): Promise<Array<{ suffix: string; path: string; width: number; height: number; bytes: number }>> {
  fs.mkdirSync(outDir, { recursive: true });
  const variants: Array<{ suffix: string; path: string; width: number; height: number; bytes: number }> = [];
  for (const w of widths) {
    const suffix = `w${w}`;
    const out = path.join(outDir, `${baseName}-${suffix}.webp`);
    await sharp(masterPath)
      .resize(w, null, { withoutEnlargement: true })
      .webp({ quality: 88 })
      .toFile(out);
    const dim = await readImageDimensions(out);
    variants.push({ suffix, path: out, width: dim.width, height: dim.height, bytes: dim.fileSize });
  }
  return variants;
}

export async function normalizeMasterWebp(
  inputPath: string,
  outputPath: string,
  minWidth: number,
  minHeight: number,
): Promise<void> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await sharp(inputPath)
    .resize(Math.max(minWidth, 1400), null, { withoutEnlargement: false, fit: "inside" })
    .webp({ quality: 90 })
    .toFile(outputPath);
  const dim = await readImageDimensions(outputPath);
  if (dim.width < minWidth || dim.height < minHeight) {
    await sharp(inputPath)
      .resize(minWidth, minHeight, { fit: "cover", position: "centre" })
      .webp({ quality: 90 })
      .toFile(outputPath);
  }
}
