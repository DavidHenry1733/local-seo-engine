import fs from "fs";
import path from "path";

type ImageConfig = {
  stylePreset: string;
  renderingSpeed: string;
};

type IdeogramResponse = {
  data?: Array<{
    url?: string;
    prompt?: string;
    seed?: number;
    is_image_safe?: boolean;
  }>;
};

export type ImageGenerationResult = {
  imagePath: string;
  filename: string;
  prompt: string;
  altText: string;
  sourceUrl: string;
};

type GenerationLog = {
  generatedAt: string;
  prompt: string;
  altText: string;
  suggestedFilename: string;
  stylePreset: string;
  renderingSpeed: string;
  sourceUrl: string;
  imagePath: string;
};

export async function generateIdeogramImage(
  projectRoot: string,
  slug: string,
  prompt: string,
  altText: string,
  suggestedFilename: string,
  imageConfig: ImageConfig,
  scene?: string,
  negativePrompt?: string
): Promise<ImageGenerationResult> {
  const apiKey = process.env.IDEOGRAM_API_KEY;
  if (!apiKey) {
    throw new Error("IDEOGRAM_API_KEY environment variable is not set");
  }

  const outputDir = path.join(projectRoot, "output", slug);

  const requestBody: Record<string, unknown> = {
    prompt,
    rendering_speed: imageConfig.renderingSpeed,
    aspect_ratio: "16x9",
  };

  if (imageConfig.stylePreset) {
    requestBody.style_preset = imageConfig.stylePreset;
  }

  if (negativePrompt) {
    requestBody.negative_prompt = negativePrompt;
  }

  const presetLabel = imageConfig.stylePreset || "no preset";
  console.log(`    Calling Ideogram API (${presetLabel} / ${imageConfig.renderingSpeed})...`);

  const response = await fetch("https://api.ideogram.ai/v1/ideogram-v3/generate", {
    method: "POST",
    headers: {
      "Api-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ideogram API error: ${response.status} ${response.statusText}\n${text}`);
  }

  const result = await response.json() as IdeogramResponse;
  const firstImage = result.data?.[0];

  if (!firstImage?.url) {
    throw new Error(`Ideogram returned no image URL. Response: ${JSON.stringify(result)}`);
  }

  const imageUrl = firstImage.url;
  console.log(`    Image generated: ${imageUrl}`);

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image from Ideogram: ${imageResponse.status}`);
  }

  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  const imagePath = path.join(outputDir, suggestedFilename);
  fs.writeFileSync(imagePath, imageBuffer);
  console.log(`    Image saved: ${imagePath}`);

  const log: GenerationLog = {
    generatedAt: new Date().toISOString(),
    prompt,
    altText,
    suggestedFilename,
    stylePreset: imageConfig.stylePreset,
    renderingSpeed: imageConfig.renderingSpeed,
    sourceUrl: imageUrl,
    imagePath,
  };

  const logFilename = scene
    ? `image-generation-${scene}.json`
    : "image-generation.json";

  fs.writeFileSync(
    path.join(outputDir, logFilename),
    JSON.stringify(log, null, 2),
    "utf-8"
  );

  return {
    imagePath,
    filename: suggestedFilename,
    prompt,
    altText,
    sourceUrl: imageUrl,
  };
}
