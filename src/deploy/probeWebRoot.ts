import * as ftp from "basic-ftp";
import https from "node:https";

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
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

  const token  = `PROBE_${Date.now()}`;
  const html   = `<html><body>${token}</body></html>`;
  const tmpFile = `/tmp/${token}.html`;
  const { writeFileSync } = await import("node:fs");
  writeFileSync(tmpFile, html);

  // Try uploading the probe to several candidate paths
  const candidates = [
    "/home/inboxing/public_html/local/probe.html",
    "/home/inboxing/public_html/probe.html",
  ];

  for (const remotePath of candidates) {
    try {
      await client.uploadFrom(tmpFile, remotePath);
      console.log(`Uploaded probe → ${remotePath}`);
    } catch (e) {
      console.log(`Could not upload to ${remotePath}:`, (e as Error).message);
    }
  }
  client.close();

  // Now try fetching via HTTP
  const urls = [
    `https://local.inboxingproweb.com/probe.html`,
    `https://inboxingproweb.com/probe.html`,
  ];

  for (const url of urls) {
    try {
      const body = await httpGet(url);
      const found = body.includes(token);
      console.log(`\nHTTP ${url}`);
      console.log(`  Token found: ${found}`);
      if (found) console.log(`  ✅ THIS is the correct web root for this URL`);
    } catch (e) {
      console.log(`\nHTTP ${url} → error: ${(e as Error).message}`);
    }
  }
}

main().catch(console.error);
