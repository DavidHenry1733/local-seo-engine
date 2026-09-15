const ftp = require("basic-ftp");
const path = require("path");

async function main() {
  const client = new ftp.Client();
  client.ftp.verbose = false;

  await client.access({
    host: process.env.DEPLOY_HOST || "ftp.inboxingproweb.com",
    user: process.env.DEPLOY_USERNAME,
    password: process.env.DEPLOY_PASSWORD,
    secure: false
  });

  const localDir = "/home/inboxingproweb/local-seo-engine/output/inboxingproweb/assets/web-design";
  const remoteDir = "/public_html/local/assets/web-design";

  await client.ensureDir(remoteDir);

  for (const file of ["hero.jpg", "support.jpg", "conversion.jpg", "trust.jpg"]) {
    await client.uploadFrom(path.join(localDir, file), `${remoteDir}/${file}`);
    console.log("uploaded", file);
  }

  client.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
