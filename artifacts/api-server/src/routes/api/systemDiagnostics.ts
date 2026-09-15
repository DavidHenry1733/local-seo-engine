import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();

const ROOT = process.env.WORKSPACE_ROOT ?? "/home/inboxingproweb/pharmaconnect-growth-engine";
const OUTPUT_DIR = path.join(ROOT, "output");
const PROJECT_DIR = path.join(OUTPUT_DIR, process.env.DEFAULT_PROJECT_SLUG ?? "pharmaconnect");

function exists(p: string) {
  return fs.existsSync(p);
}

function canWrite(dir: string) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const testFile = path.join(dir, ".diagnostics-write-test");
    fs.writeFileSync(testFile, String(Date.now()));
    fs.unlinkSync(testFile);
    return true;
  } catch {
    return false;
  }
}

function status(ok: boolean, label: string, detail?: string) {
  return {
    ok,
    status: ok ? "PASS" : "FAIL",
    label,
    detail: detail || "",
  };
}

router.get("/system-diagnostics", (_req, res) => {
  const checks = {
    openaiApiKey: status(
      !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      "OpenAI API key loaded",
      process.env.AI_INTEGRATIONS_OPENAI_API_KEY ? "configured" : "missing AI_INTEGRATIONS_OPENAI_API_KEY"
    ),

    openaiBaseUrl: status(
      !!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      "OpenAI base URL loaded",
      process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "missing AI_INTEGRATIONS_OPENAI_BASE_URL"
    ),

    gscClientId: status(
      !!process.env.GSC_OAUTH_CLIENT_ID,
      "GSC OAuth client ID loaded",
      process.env.GSC_OAUTH_CLIENT_ID ? "configured" : "missing GSC_OAUTH_CLIENT_ID"
    ),

    gscClientSecret: status(
      !!process.env.GSC_OAUTH_CLIENT_SECRET && process.env.GSC_OAUTH_CLIENT_SECRET !== "PASTE_SECRET_HERE",
      "GSC OAuth client secret loaded",
      process.env.GSC_OAUTH_CLIENT_SECRET && process.env.GSC_OAUTH_CLIENT_SECRET !== "PASTE_SECRET_HERE"
        ? "configured"
        : "missing or placeholder GSC_OAUTH_CLIENT_SECRET"
    ),

    outputDirExists: status(
      exists(OUTPUT_DIR),
      "Output directory exists",
      OUTPUT_DIR
    ),

    outputDirWritable: status(
      canWrite(OUTPUT_DIR),
      "Output directory writable",
      OUTPUT_DIR
    ),

    projectDirExists: status(
      exists(PROJECT_DIR),
      "Project output directory exists",
      PROJECT_DIR
    ),

    pageRegistry: status(
      exists(path.join(PROJECT_DIR, "page-registry.json")),
      "Page registry exists",
      path.join(PROJECT_DIR, "page-registry.json")
    ),

    gscImportedUrls: status(
      exists(path.join(PROJECT_DIR, "gsc-imported-urls.json")),
      "Imported GSC URL file exists",
      path.join(PROJECT_DIR, "gsc-imported-urls.json")
    ),

    gscStatusStore: status(
      exists(path.join(PROJECT_DIR, "gsc-url-status.json")),
      "Persistent GSC status store exists",
      path.join(PROJECT_DIR, "gsc-url-status.json")
    ),

    gscSnapshot: status(
      exists(path.join(PROJECT_DIR, "gsc-index-status.json")),
      "GSC snapshot exists",
      path.join(PROJECT_DIR, "gsc-index-status.json")
    ),
  };

  const values = Object.values(checks);
  const failCount = values.filter((c) => !c.ok).length;

  res.json({
    checkedAt: new Date().toISOString(),
    healthy: failCount === 0,
    failCount,
    checks,
  });
});

export default router;
