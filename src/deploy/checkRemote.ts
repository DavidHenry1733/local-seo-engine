import * as ftp from "basic-ftp";
import fs from "node:fs";
import https from "node:https";

function httpGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    }).on("error", () => resolve({ status: 0, body: "" }));
  });
}

async function listDir(client: ftp.Client, dir: string): Promise<void> {
  try {
    const items = await client.list(dir);
    console.log(`\n=== FTP ${dir} (${items.length} entries) ===`);
    for (const f of items) {
      const tag = f.type === 2 ? "[DIR]" : "[FILE]";
      console.log(`  ${tag} ${f.name.padEnd(40)} sz=${String(f.size ?? "").padStart(8)}`);
    }
  } catch (e) {
    console.log(`\n=== FTP ${dir} === ERROR: ${(e as Error).message}`);
  }
}

async function main() {
  const client = new ftp.Client();
  client.ftp.verbose = false;
  await client.access({
    host:     process.env.DEPLOY_HOST     ?? "ftp.inboxingproweb.com",
    port:     21,
    user:     process.env.DEPLOY_USERNAME!,
    password: process.env.DEPLOY_PASSWORD!,
    secure:   false,
  });

  const pwd = await client.pwd();
  console.log("FTP PWD on connect:", pwd);

  // Map the FTP root-level structure
  await listDir(client, "/");
  await listDir(client, "/public_html");
  await listDir(client, "/public_html/local");

  // Check if the old served files are here (under /public_html/local)
  await listDir(client, "/public_html/local/web-design-sheffield");
  await listDir(client, "/public_html/local/assets/web-design");

  // Download what's at /public_html/local/web-design-sheffield/index.html
  console.log("\n=== Downloading /public_html/local/web-design-sheffield/index.html ===");
  try {
    await client.downloadTo("/tmp/check_correct_path.html", "/public_html/local/web-design-sheffield/index.html");
    const content = fs.readFileSync("/tmp/check_correct_path.html", "utf8");
    const size = fs.statSync("/tmp/check_correct_path.html").size;
    const isNew = content.includes("BlinkMacSystemFont");
    const isOld = content.includes("font-family: Arial");
    console.log(`  size=${size}, new=${isNew}, old=${isOld}`);
    console.log(`  first 100 chars: ${content.slice(0, 100).replace(/\n/g, " ")}`);
  } catch (e) {
    console.log(`  FAILED: ${(e as Error).message}`);
  }

  // Upload a probe to /public_html/local/ and test via HTTP
  const token = `verify_${Date.now()}`;
  const tmp = `/tmp/probe_${token}.html`;
  fs.writeFileSync(tmp, `<html><body>TOKEN:${token}</body></html>`);
  await client.ensureDir("/public_html/local");
  await client.uploadFrom(tmp, `/public_html/local/probe-${token}.html`);
  console.log(`\nUploaded probe to FTP: /public_html/local/probe-${token}.html`);

  await new Promise((r) => setTimeout(r, 2000));

  const url = `https://local.inboxingproweb.com/probe-${token}.html`;
  const res = await httpGet(url);
  const hit = res.body.includes(`TOKEN:${token}`);
  console.log(`HTTP ${url} → status=${res.status}, TOKEN_FOUND=${hit}`);
  if (hit) {
    console.log("\n✅✅ CONFIRMED: correct FTP path is /public_html/local");
    console.log("✅✅ DEPLOY_REMOTE_ROOT should be set to: /public_html/local");
  } else {
    console.log("\n❌ Probe not found via HTTP at /public_html/local/");
  }

  client.close();
}

main().catch(console.error);
