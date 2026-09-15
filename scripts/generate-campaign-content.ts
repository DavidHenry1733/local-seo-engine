import fs from "node:fs";
import path from "node:path";

import { generateCampaignContentAssets } from "../src/content-engine/generateCampaignContentAssets";

const projectSlug = process.argv[2] ?? "inboxingproweb";
const campaignId = process.argv[3] ?? "rotherham-webho-ting-5b9958";

try {
  const result = generateCampaignContentAssets({ projectSlug, campaignId, outputDir: "output" });
  console.log("PASS: Campaign content generated");
  console.log(`Campaign: ${campaignId}`);
  console.log(`Manifest: ${result.manifestPath}`);
  console.log(`Assets: ${result.assetCount}`);
  console.log("By type:", JSON.stringify(result.byType));
} catch (err) {
  console.error("FAIL: Campaign content generation failed");
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
}
