const ftp = require("basic-ftp");

async function main() {
  const client = new ftp.Client();
  client.ftp.verbose = false;

  await client.access({
    host: process.env.DEPLOY_HOST || "ftp.inboxingproweb.com",
    user: process.env.DEPLOY_USERNAME,
    password: process.env.DEPLOY_PASSWORD,
    secure: true,
    secureOptions: { rejectUnauthorized: false }
  });

  await client.ensureDir("/public_html/local/web-design-doncaster");

  await client.uploadFrom(
    "/home/inboxingproweb/local-seo-engine/output/inboxingproweb/v2-drafts/web-design-doncaster-v2.html",
    "/public_html/local/web-design-doncaster/v2.html"
  );

  client.close();
  console.log("Uploaded draft to /public_html/local/web-design-doncaster/v2.html");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
