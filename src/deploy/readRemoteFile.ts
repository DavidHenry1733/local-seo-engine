import * as ftp from "basic-ftp";
import fs from "node:fs";

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

  const remoteRoot = process.env.DEPLOY_REMOTE_ROOT ?? "/home/inboxing/public_html/local";
  const remotePath = `${remoteRoot}/web-design-sheffield/index.html`;
  const localPath  = "/tmp/remote-index.html";

  console.log(`Downloading: ${remotePath}`);
  await client.downloadTo(localPath, remotePath);
  client.close();

  const content = fs.readFileSync(localPath, "utf8");
  // Print first 500 chars of text content (strip tags)
  const text = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 600);
  console.log("\nContent preview:");
  console.log(text);

  // Check for new vs old indicator
  const isNew = content.includes("Most customers now look a business up online");
  const isOld = content.includes("font-family: Arial");
  console.log("\nNew content on server:", isNew);
  console.log("Old content on server:", isOld);
  console.log("File size:", content.length, "bytes");
}

main().catch(console.error);
