/**
 * Walk every FTP-accessible path from / and probe each one via HTTP to find
 * which FTP path actually maps to the web root of local.inboxingproweb.com
 */
import * as ftp from "basic-ftp";
import fs from "node:fs";
import https from "node:https";

const BASE_URL = "https://local.inboxingproweb.com";
const TOKEN    = `tok_${Date.now()}`;
const TMP      = `/tmp/probe_${TOKEN}.html`;

function httpGet(url: string, timeoutMs = 4000): Promise<{ status: number; body: string }> {
  return new Promise((resolve) => {
    const req = https.get(url, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on("error", () => resolve({ status: 0, body: "" }));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ status: 0, body: "" }); });
  });
}

async function tryPath(client: ftp.Client, ftpDir: string): Promise<boolean> {
  const probeName = `probe_${TOKEN}.html`;
  const ftpFile   = `${ftpDir}/${probeName}`;
  const httpUrl   = `${BASE_URL}/${probeName}`;

  try {
    await client.ensureDir(ftpDir);
    await client.uploadFrom(TMP, ftpFile);
  } catch { return false; }

  await new Promise((r) => setTimeout(r, 1500));
  const res = await httpGet(httpUrl);
  const hit = res.body.includes(TOKEN);

  if (hit) {
    console.log(`\n✅ FTP path "${ftpDir}" → web root confirmed!`);
    console.log(`   HTTP ${httpUrl} → ${res.status}, TOKEN FOUND`);
    console.log(`   ✅ Set DEPLOY_REMOTE_ROOT=${ftpDir}/local`);
  }

  // Clean up
  try { await client.remove(ftpFile); } catch {}
  return hit;
}

async function listRoot(client: ftp.Client): Promise<string[]> {
  const items = await client.list("/");
  return items.filter((f) => f.type === 2).map((f) => f.name);
}

async function main() {
  fs.writeFileSync(TMP, `<html><body>${TOKEN}</body></html>`);

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
  console.log("FTP PWD:", pwd);

  // List the entire FTP root tree (2 levels deep) to understand the structure
  console.log("\n=== FTP root structure ===");
  const roots = await client.list("/");
  for (const f of roots) {
    console.log(`  ${f.type === 2 ? "[DIR]" : "[FILE]"} /${f.name}`);
    if (f.type === 2) {
      try {
        const subs = await client.list(`/${f.name}`);
        for (const s of subs) {
          console.log(`    ${s.type === 2 ? "[DIR]" : "[FILE]"} /${f.name}/${s.name}  sz=${s.size}`);
        }
      } catch {}
    }
  }

  // Candidate FTP directories to probe as potential web root
  const candidates: string[] = [
    "/",
    "/public_html",
    "/public_html/local",
  ];

  // Also add any directories one level below known dirs
  const dirs = roots.filter((f) => f.type === 2).map((f) => `/${f.name}`);
  for (const d of dirs) {
    if (!candidates.includes(d)) candidates.push(d);
    try {
      const subs = await client.list(d);
      for (const s of subs.filter((f) => f.type === 2)) {
        const p = `${d}/${s.name}`;
        if (!candidates.includes(p)) candidates.push(p);
      }
    } catch {}
  }

  console.log("\n=== Probing candidates for web root ===");
  for (const dir of candidates) {
    process.stdout.write(`  Testing "${dir}"... `);
    const hit = await tryPath(client, dir);
    if (!hit) console.log("not web root");
    if (hit) break;
  }

  client.close();
}

main().catch(console.error);
