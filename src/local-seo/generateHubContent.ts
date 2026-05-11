import fs from "fs";
import path from "path";
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

function loadPrompt(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

function injectVariables(prompt: string, data: any): string {
  return prompt
    .replace(/{{service_name}}/g, data.service.service_name)
    .replace(/{{city}}/g, data.location.city)
    .replace(/{{brand_name}}/g, data.brand.name)
    .replace(/{{brand_tone}}/g, data.brand.tone)
    .replace(/{{child_areas}}/g, (data.location.child_areas || []).join(", "));
}

export async function generateHubContent(projectRoot: string, slug: string) {
  const pagePath = path.join(projectRoot, "output", slug, "page-data.json");
  const promptPath = path.join(projectRoot, "prompts", "local-seo-hub-page.txt");

  const pageData = JSON.parse(fs.readFileSync(pagePath, "utf-8"));
  const basePrompt = loadPrompt(promptPath);
  const finalPrompt = injectVariables(basePrompt, pageData);

  const response = await client.responses.create({
    model: "gpt-5.2",
    input: finalPrompt
  });

  const outputText =
    (response as any).output_text ||
    (response as any).output?.[0]?.content?.[0]?.text ||
    "";

  const content = JSON.parse(outputText);

  const outputFile = path.join(projectRoot, "output", slug, "content.json");

  fs.writeFileSync(outputFile, JSON.stringify(content, null, 2), "utf-8");

  return content;
}
