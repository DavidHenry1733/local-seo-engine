import fs from "node:fs";
import path from "node:path";
import { ProjectConfig } from "./types";
import { buildProjectPlan } from "./buildProjectPlan";
import { buildPagePayload } from "./buildPagePayload";
import { renderPage } from "./renderPage";
import { exportPage } from "./exportProject";
import { exportPageToWordPress } from "./exportToWordPress";
import { deployProject } from "../deploy/deployProject";

function loadProjectConfig(configPath: string): ProjectConfig {
  const raw = fs.readFileSync(configPath, "utf8");
  return JSON.parse(raw) as ProjectConfig;
}

async function main() {
  const args         = process.argv.slice(2);
  const configPath   = args.find((a) => !a.startsWith("--"));
  const toWordPress  = args.includes("--wordpress");
  const toDeploy     = args.includes("--deploy");

  if (!configPath) {
    throw new Error(
      "Usage: pnpm exec tsx src/generator/runProject.ts config/projects/<config>.json [--wordpress] [--deploy]"
    );
  }

  const projectRoot = process.cwd();
  const project     = loadProjectConfig(configPath);
  const plan        = buildProjectPlan(project);
  const outputDir   = path.join("output", project.clientSlug);

  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`Project:   ${project.businessName}`);
  console.log(`Pages:     ${plan.length}`);

  if (toWordPress) {
    console.log(`Target:    WordPress (${project.domain})\n`);
  } else if (toDeploy) {
    const host = project.deploy?.host ?? "?";
    console.log(`Target:    FTP deploy → ${host}\n`);
  } else {
    console.log(`Target:    local output (${outputDir})\n`);
  }

  for (let i = 0; i < plan.length; i++) {
    const page = plan[i];

    if (toWordPress) {
      // Pre-create page dir so upload log writer has somewhere to write
      fs.mkdirSync(path.join(outputDir, page.slug), { recursive: true });

      // Full WP flow: build payload → upload images → render → publish
      const outputSubdir = path.join(project.clientSlug, page.slug);
      const { result, html, payload } = await exportPageToWordPress(
        projectRoot,
        project,
        page,
        plan,
        i === 0,
        outputSubdir
      );
      exportPage(outputDir, page.slug, html, payload);
      const tag = result.action === "created" ? "CREATED" : "UPDATED";
      console.log(`  ${tag}  ${page.slug}  →  Page ID ${result.pageId}  |  ${result.link}`);
    } else {
      // Static mode — render with absolute local asset paths (/assets/...)
      const payload = buildPagePayload(project, page, plan);
      const html    = renderPage(project, page, payload, "static");
      exportPage(outputDir, page.slug, html, payload);
      console.log(`  Generated: ${page.slug}`);
    }
  }

  console.log(`\nDone. Output written to ${outputDir}`);

  // ── SFTP deploy (optional) ────────────────────────────────────────────────
  if (toDeploy) {
    if (!project.deploy) {
      throw new Error(
        `No "deploy" section found in ${configPath}. Add deploy config to enable SFTP deployment.`
      );
    }
    await deployProject(project, outputDir, projectRoot);
  }
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
