import fs from "fs";
import path from "path";

type WordPressConfig = {
  siteUrl: string;
  username: string;
  applicationPassword: string;
};

export type ImageUploadResult = {
  mediaId: number;
  sourceUrl: string;
  altText: string;
};

type UploadLog = {
  uploadedAt: string;
  mediaId: number;
  sourceUrl: string;
  altText: string;
  filename: string;
  endpoint: string;
};

function buildBasicAuth(username: string, applicationPassword: string): string {
  const token = Buffer.from(`${username}:${applicationPassword}`).toString("base64");
  return `Basic ${token}`;
}

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}

export async function uploadImageToWordPress(
  projectRoot: string,
  slug: string,
  imagePath: string,
  altText: string,
  scene?: string,
  uploadFilename?: string
): Promise<ImageUploadResult> {
  const wpConfigPath = path.join(projectRoot, "input", "wordpress.json");
  const wpConfig = JSON.parse(fs.readFileSync(wpConfigPath, "utf-8")) as WordPressConfig;

  const baseUrl = wpConfig.siteUrl.replace(/\/+$/, "");
  const authHeader = buildBasicAuth(wpConfig.username, wpConfig.applicationPassword);
  const mediaEndpoint = `${baseUrl}/wp-json/wp/v2/media`;

  const filename = uploadFilename ?? path.basename(imagePath);
  const mimeType = getMimeType(filename);
  const imageBuffer = fs.readFileSync(imagePath);

  console.log(`    Uploading image to WordPress media library...`);

  const uploadController = new AbortController();
  const uploadTimeout = setTimeout(() => uploadController.abort(), 55_000);

  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(mediaEndpoint, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
      body: imageBuffer,
      signal: uploadController.signal,
    });
  } finally {
    clearTimeout(uploadTimeout);
  }

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text();
    throw new Error(
      `WordPress media upload failed: ${uploadResponse.status} ${uploadResponse.statusText}\n${text}`
    );
  }

  const uploadResult = await uploadResponse.json() as {
    id: number;
    source_url: string;
  };

  const mediaId = uploadResult.id;
  const sourceUrl = uploadResult.source_url;

  const patchResponse = await fetch(`${mediaEndpoint}/${mediaId}`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ alt_text: altText }),
  });

  if (!patchResponse.ok) {
    const text = await patchResponse.text();
    console.warn(`    Warning: could not set alt_text on media ${mediaId}: ${text}`);
  } else {
    console.log(`    Alt text set on media ID ${mediaId}`);
  }

  const log: UploadLog = {
    uploadedAt: new Date().toISOString(),
    mediaId,
    sourceUrl,
    altText,
    filename,
    endpoint: `${mediaEndpoint}/${mediaId}`,
  };

  const logFilename = scene
    ? `image-upload-${scene}.json`
    : "image-upload.json";

  fs.writeFileSync(
    path.join(projectRoot, "output", slug, logFilename),
    JSON.stringify(log, null, 2),
    "utf-8"
  );

  console.log(`    Uploaded → Media ID: ${mediaId} | ${sourceUrl}`);

  return { mediaId, sourceUrl, altText };
}
