#!/usr/bin/env node
import ftp from "basic-ftp";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const localPath = path.join(ROOT, "output/inboxingproweb/sitemap.xml");

function pm2DeployEnv() {
  const r = spawnSync("pm2", ["jlist"], { encoding: "utf8" });
  if (r.status !== 0) throw new Error("pm2 jlist failed");
  const apps = JSON.parse(r.stdout);
  const app = apps.find((a) => a.name === "local-seo-engine");
  const env = app?.pm2_env ?? {};
  const user = env.DEPLOY_USERNAME;
  const password = env.DEPLOY_PASSWORD;
  if (!user || !password) throw new Error("DEPLOY_USERNAME/DEPLOY_PASSWORD not in PM2 env");
  return { user, password };
}

const { user, password } = pm2DeployEnv();
const client = new ftp.Client(30000);
try {
  await client.access({
    host: "ftp.inboxingproweb.com",
    port: 21,
    user,
    password,
    secure: true,
    secureOptions: { rejectUnauthorized: false },
  });
  await client.uploadFrom(localPath, "/sitemap.xml");
  console.log("UPLOAD_OK");
} finally {
  client.close();
}
