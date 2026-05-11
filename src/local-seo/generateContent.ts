import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { getVariationSet } from "./getVariationSet";

const client = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

function loadPrompt(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

function joinArray(value: unknown, fallback = ""): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "string") return value;
  return fallback;
}

function injectVariables(prompt: string, data: any, variation: ReturnType<typeof getVariationSet>): string {
  const nearbyAreas = joinArray(data.location.nearby_areas);
  const faqTopics   = variation.selectedFaqs.join(", ");

  return prompt
    // Core identifiers
    .replace(/{{service_name}}/g,        data.service.service_name)
    .replace(/{{area}}/g,                data.location.area)
    .replace(/{{city}}/g,                data.job.city)
    .replace(/{{nearby_areas}}/g,        nearbyAreas)
    .replace(/{{brand_name}}/g,          data.brand.name)
    .replace(/{{brand_tone}}/g,          data.brand.tone)
    // Variation controls
    .replace(/{{intro_style}}/g,         variation.introStyle)
    .replace(/{{cta_style}}/g,           variation.ctaStyle)
    .replace(/{{faq_topics}}/g,          faqTopics)
    // Rich area context
    .replace(/{{area_summary}}/g,        String(data.location.summary || ""))
    .replace(/{{area_landmarks}}/g,      joinArray(data.location.landmarks))
    .replace(/{{area_business_types}}/g, joinArray(data.location.business_types))
    .replace(/{{area_local_character}}/g,joinArray(data.location.local_character))
    // Rich service context
    .replace(/{{service_summary}}/g,     String(data.service.service_summary || ""))
    .replace(/{{service_pain_points}}/g, joinArray(data.service.pain_points))
    .replace(/{{service_ideal_for}}/g,   joinArray(data.service.ideal_for))
    // Brand context
    .replace(/{{brand_usp}}/g,           joinArray(data.brand.usp))
    .replace(/{{brand_cta}}/g,           String(data.brand.cta || "Get in touch"));
}

export async function generateContent(projectRoot: string, slug: string) {
  const pagePath    = path.join(projectRoot, "output", slug, "page-data.json");
  const promptPath  = path.join(projectRoot, "prompts", "local-seo-page.txt");

  const pageData    = JSON.parse(fs.readFileSync(pagePath, "utf-8"));
  const basePrompt  = loadPrompt(promptPath);

  const serviceSlug = slug.split("-").slice(0, -1).join("-");
  const variation   = getVariationSet(projectRoot, slug, serviceSlug);

  const finalPrompt = injectVariables(basePrompt, pageData, variation);

  const response = await client.responses.create({
    model: "gpt-5.2",
    input: finalPrompt
  });

  const outputText = response.output[0].content[0].text;

  const jsonMatch  = outputText.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonString = jsonMatch ? jsonMatch[1].trim() : outputText.trim();

  const content = JSON.parse(jsonString);

  const outputFile = path.join(projectRoot, "output", slug, "content.json");
  fs.writeFileSync(outputFile, JSON.stringify(content, null, 2), "utf-8");

  return content;
}
