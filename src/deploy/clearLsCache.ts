import * as ftp from "basic-ftp";

async function listRecursive(client: ftp.Client, dir: string, depth = 0): Promise<void> {
  try {
    const list = await client.list(dir);
    const pad  = "  ".repeat(depth);
    for (const f of list) {
      const size = f.size ? ` (${f.size}b)` : "";
      console.log(`${pad}${f.type === 2 ? "[DIR]" : "[FILE]"} ${f.name}${size}`);
      if (f.type === 2 && depth < 4) {
        await listRecursive(client, `${dir}/${f.name}`, depth + 1);
      }
    }
  } catch {
    console.log("  (could not list)");
  }
}

async function deleteRecursive(client: ftp.Client, dir: string): Promise<number> {
  let count = 0;
  try {
    const list = await client.list(dir);
    for (const f of list) {
      const fullPath = `${dir}/${f.name}`;
      if (f.type === 2) {
        count += await deleteRecursive(client, fullPath);
        try { await client.removeDir(fullPath); count++; } catch {}
      } else {
        try { await client.remove(fullPath); count++; } catch {}
      }
    }
  } catch {}
  return count;
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

  // Check where the actual cached content lives
  console.log("\n=== /home/inboxing/.litespeed ===");
  await listRecursive(client, "/home/inboxing/.litespeed");

  console.log("\n=== /tmp/lshttpd ===");
  await listRecursive(client, "/tmp/lshttpd");

  // Now delete everything we can find in .litespeed
  console.log("\nClearing /home/inboxing/.litespeed...");
  const d1 = await deleteRecursive(client, "/home/inboxing/.litespeed");
  console.log(`  Deleted ${d1} items`);

  console.log("Clearing /tmp/lshttpd...");
  const d2 = await deleteRecursive(client, "/tmp/lshttpd");
  console.log(`  Deleted ${d2} items`);

  client.close();
  console.log("\nDone — reload the page now.");
}

main().catch(console.error);
