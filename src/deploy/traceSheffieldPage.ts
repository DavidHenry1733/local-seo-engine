import fs from "node:fs";
import path from "node:path";
import { buildProjectPlan } from "../generator/buildProjectPlan";
import { buildPagePayload } from "../generator/buildPagePayload";
import { renderPage } from "../generator/renderPage";
import { ProjectConfig } from "../generator/types";

const configPath = "config/projects/inboxingproweb-local.json";
const project: ProjectConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
const plan = buildProjectPlan(project);
const page = plan.find((p) => p.slug === "web-design-sheffield");
if (!page) throw new Error("web-design-sheffield page not found in plan");

const payload = buildPagePayload(project, page, plan);
const html    = renderPage(project, page, payload, "static");

const outputDir   = path.join("output", project.clientSlug);
const localPath   = path.join(outputDir, page.slug, "index.html");
const remoteRoot  = process.env.DEPLOY_REMOTE_ROOT ?? (project.deploy as any).remoteRoot;
const remotePath  = `${remoteRoot}/${page.slug}/index.html`;

console.log("=== TRACE: web-design-sheffield ===\n");
console.log("Local file path  :", localPath);
console.log("Remote upload path:", remotePath);

console.log("\n--- First 500 chars of generated HTML ---");
console.log(html.slice(0, 500));

console.log("\n--- H1 ---");
const h1m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
console.log(h1m ? h1m[1].trim() : "NOT FOUND");

console.log("\n--- Intro paragraph (first <p> in body) ---");
const introM = html.match(/<!-- intro -->[\s\S]*?<p>([\s\S]*?)<\/p>/) ??
               html.match(/<p class="intro">([\s\S]*?)<\/p>/) ??
               html.match(/<section[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/);
if (introM) {
  console.log(introM[1].trim().slice(0, 400));
} else {
  const allP = [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)];
  if (allP.length > 0) console.log("(first <p> found):", allP[0][1].slice(0, 400));
}

console.log("\n--- CTA ---");
const ctaM = html.match(/Ready to improve[\s\S]*?<\/section>/i);
console.log(ctaM ? ctaM[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 300).trim() : "NOT FOUND");

console.log("\n--- Map embed src/query ---");
const mapM = html.match(/src="(https:\/\/[^"]*maps[^"]*)"/) ??
             html.match(/maps\.googleapis\.com[^\s"'<]*/i) ??
             html.match(/google\.com\/maps[^\s"'<]*/i);
console.log(mapM ? mapM[1] ?? mapM[0] : "NOT FOUND");

console.log("\n--- Font stack ---");
const fontM = html.match(/font-family:\s*([^;}"]{0,120})/i);
console.log(fontM ? fontM[0].trim() : "NOT FOUND");

const isNew = html.includes("BlinkMacSystemFont");
const isOld = html.includes("font-family: Arial") && !isNew;
console.log("\nContent verdict :", isNew ? "✅ NEW (BlinkMacSystemFont present)" : isOld ? "❌ OLD (Arial only)" : "⚠️  UNKNOWN");
console.log("HTML length      :", html.length, "chars");

// Show first section heading to confirm rich content
const secM = html.match(/<h2>([\s\S]*?)<\/h2>/);
console.log("\n--- First <h2> ---");
console.log(secM ? secM[1].trim() : "NOT FOUND");

// Show FAQ first question
const faqM = html.match(/<dt[^>]*>([\s\S]*?)<\/dt>/);
console.log("\n--- First FAQ question ---");
console.log(faqM ? faqM[1].replace(/<[^>]+>/g, "").trim() : "NOT FOUND");
