import * as ftp from "basic-ftp";
import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import type { ProjectConfig, DeployConfig } from "../generator/types";

/** Join a remote root with a subpath, normalising double slashes. */
function remotePath(root: string, ...parts: string[]): string {
  const joined = [root, ...parts].join("/").replace(/\/+/g, "/");
  return joined.startsWith("/") ? joined : `/${joined}`;
}

const DEBUG_SLUG = "web-design-sheffield";

// All deploy settings can be overridden by environment variables.
// Env vars take precedence over project config file values.
function resolveDeploySettings(deploy: DeployConfig): {
  user:       string;
  password:   string;
  host:       string;
  port:       number;
  protocol:   string;
  remoteRoot: string;
} {
  const user     = process.env.DEPLOY_USERNAME;
  const password = process.env.DEPLOY_PASSWORD;
  if (!user || !password) {
    throw new Error(
      "Missing FTP credentials. Set DEPLOY_USERNAME and DEPLOY_PASSWORD environment variables."
    );
  }
  return {
    user,
    password,
    host:       process.env.DEPLOY_HOST       ?? deploy.host,
    port:       process.env.DEPLOY_PORT       ? Number(process.env.DEPLOY_PORT)  : deploy.port,
    protocol:   process.env.DEPLOY_PROTOCOL   ?? deploy.protocol,
    remoteRoot: process.env.DEPLOY_REMOTE_ROOT ?? deploy.remoteRoot,
  };
}

function maskUser(u: string): string {
  if (u.length <= 3) return "***";
  return u.slice(0, 3) + "*".repeat(Math.min(u.length - 3, 6));
}

function httpGet(url: string): Promise<{ status: number; length: number; body: string }> {
  return new Promise((resolve) => {
    const req = https.get(url, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () =>
        resolve({ status: res.statusCode ?? 0, length: body.length, body })
      );
    });
    req.on("error", () => resolve({ status: 0, length: 0, body: "" }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ status: 0, length: 0, body: "" }); });
  });
}

export async function deployProject(
  project: ProjectConfig,
  outputDir: string,
  projectRoot: string
): Promise<void> {
  const deploy = project.deploy as DeployConfig;

  if (!deploy.enabled) {
    console.log("\nDeploy skipped (deploy.enabled = false)");
    return;
  }

  const { user, host, port, protocol, remoteRoot, password } = resolveDeploySettings(deploy);
  const client = new ftp.Client();
  client.ftp.verbose = false;

  // ── Connect ────────────────────────────────────────────────────────────────
  console.log(`\nConnecting to ${host}:${port} via ${protocol.toUpperCase()}...`);
  await client.access({ host, port, user, password, secure: false });

  // ── Debug: connection identity ─────────────────────────────────────────────
  const ftpPwd = await client.pwd();
  console.log(`Connected.`);
  console.log(`\n┌─ DEPLOY DEBUG ──────────────────────────────────────────────┐`);
  console.log(`│  FTP user      : ${maskUser(user).padEnd(44)}│`);
  console.log(`│  FTP PWD       : ${ftpPwd.padEnd(44)}│`);
  console.log(`│  Remote root   : ${remoteRoot.padEnd(44)}│`);
  console.log(`└────────────────────────────────────────────────────────────────┘`);

  const uploadedAssets: string[] = [];
  const uploadedPages:  string[] = [];
  const baseDomain = project.domain.replace(/\/$/, "");

  try {
    // ── 0. Server config (.htaccess) ──────────────────────────────────────────
    const htaccessLocal = path.join(projectRoot, "assets", "server", ".htaccess");
    if (fs.existsSync(htaccessLocal)) {
      const rHtaccess = remotePath(remoteRoot, ".htaccess");
      await client.ensureDir(remotePath(remoteRoot));
      await client.uploadFrom(htaccessLocal, rHtaccess);
      console.log(`  Uploaded: .htaccess → ${rHtaccess}`);
    }

    // ── 1. Image asset packs ──────────────────────────────────────────────────
    const assetPacks = ["web-design", "seo"];
    for (const pack of assetPacks) {
      const localPackDir = path.join(projectRoot, "assets", pack);
      if (!fs.existsSync(localPackDir)) continue;

      const remotePackDir = remotePath(remoteRoot, "assets", pack);
      await client.ensureDir(remotePackDir);

      const files = fs.readdirSync(localPackDir).filter((f) =>
        /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(f)
      );

      for (const file of files) {
        const localFile   = path.join(localPackDir, file);
        const rFilePath   = remotePath(remotePackDir, file);
        const localSize   = fs.statSync(localFile).size;

        await client.uploadFrom(localFile, rFilePath);
        uploadedAssets.push(`/assets/${pack}/${file}`);

        // Debug output for hero-v1.png in web-design pack
        if (pack === "web-design" && file === "hero-v1.png") {
          console.log(`\n  [DEBUG] hero-v1.png`);
          console.log(`    Local path   : ${localFile}`);
          console.log(`    Remote path  : ${rFilePath}`);
          console.log(`    Local size   : ${localSize.toLocaleString()} bytes`);
        }
      }
    }

    // ── 2. Generated pages ────────────────────────────────────────────────────
    if (!fs.existsSync(outputDir)) {
      console.log(`\nNo output directory at ${outputDir} — skipping pages.`);
      return;
    }

    for (const slug of fs.readdirSync(outputDir)) {
      const htmlPath = path.join(outputDir, slug, "index.html");
      if (!fs.existsSync(htmlPath)) continue;

      const remotePageDir  = remotePath(remoteRoot, slug);
      const remoteHtmlPath = remotePath(remotePageDir, "index.html");
      const localSize      = fs.statSync(htmlPath).size;

      await client.ensureDir(remotePageDir);
      await client.uploadFrom(htmlPath, remoteHtmlPath);
      uploadedPages.push(slug);

      // Debug output for Sheffield only
      if (slug === DEBUG_SLUG) {
        console.log(`\n  [DEBUG] ${DEBUG_SLUG}`);
        console.log(`    FTP user     : ${maskUser(user)}`);
        console.log(`    Remote root  : ${remoteRoot}`);
        console.log(`    Remote path  : ${remoteHtmlPath}`);
        console.log(`    Local size   : ${localSize.toLocaleString()} bytes`);
      }
    }
  } finally {
    client.close();
  }

  // ── Deploy summary ─────────────────────────────────────────────────────────
  const w = 58;
  const line = (s: string) => `║  ${s.padEnd(w - 4)}║`;
  console.log(`
╔${"═".repeat(w - 2)}╗
║${"  DEPLOY SUMMARY".padEnd(w - 2)}║
╠${"═".repeat(w - 2)}╣
${line(`Host        ${host}:${port}`)}
${line(`Protocol    ${protocol.toUpperCase()}`)}
${line(`Remote root ${remoteRoot}`)}
╠${"═".repeat(w - 2)}╣
${line(`Assets uploaded (${uploadedAssets.length})`)}`);
  for (const a of uploadedAssets) console.log(line(`  ${a}`));
  console.log(`╠${"═".repeat(w - 2)}╣`);
  console.log(line(`Pages uploaded (${uploadedPages.length})`));
  for (const slug of uploadedPages) {
    console.log(line(`  ${baseDomain}/${slug}/`));
  }
  console.log(`╚${"═".repeat(w - 2)}╝`);

  // ── Post-deploy validation: Sheffield ─────────────────────────────────────
  const sheffieldUrl = `${baseDomain}/${DEBUG_SLUG}/`;
  console.log(`\n  Validating live page: ${sheffieldUrl}`);
  await new Promise((r) => setTimeout(r, 2000));
  const res = await httpGet(sheffieldUrl);
  const isNew = res.body.includes("BlinkMacSystemFont");
  const isOld = res.body.includes("font-family: Arial") && !isNew;
  console.log(`  HTTP status  : ${res.status}`);
  console.log(`  Body length  : ${res.length.toLocaleString()} bytes`);
  console.log(`  Content      : ${isNew ? "✅ NEW (BlinkMacSystemFont found)" : isOld ? "❌ OLD (Arial only)" : "⚠️  UNKNOWN"}`);
  if (!isNew) {
    console.log(`\n  ⚠️  Page is not yet showing new content.`);
    console.log(`     File is uploaded correctly but web server may be caching.`);
    console.log(`     Try: curl -sI "${sheffieldUrl}" to inspect cache headers.`);
  }
}
