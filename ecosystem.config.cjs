const fs = require("node:fs");
const path = require("node:path");

function loadDotEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const projectRoot = __dirname;
const dotenv = loadDotEnv(path.join(projectRoot, ".env"));

function secret(name) {
  return dotenv[name] || process.env[name] || "";
}

module.exports = {
  apps: [{
    name: "pharmaconnect-growth-engine",
    script: path.join(projectRoot, "artifacts/api-server/dist/index.mjs"),
    cwd: projectRoot,
    env: {
      PORT: secret("PORT") || "3001",
      BASE_PATH: "/",
      NODE_ENV: secret("NODE_ENV") || "production",
      DEFAULT_PROJECT_SLUG: secret("DEFAULT_PROJECT_SLUG") || "pharmaconnect",
      APP_DOMAIN: secret("APP_DOMAIN") || "https://app.pharmaconnect.uk",
      PUBLIC_APP_URL: secret("PUBLIC_APP_URL") || "https://app.pharmaconnect.uk",
      PUBLIC_SITE_DOMAIN: secret("PUBLIC_SITE_DOMAIN") || "https://pharmaconnect.uk",
      STATIC_SITE_DOMAIN: secret("STATIC_SITE_DOMAIN") || "https://app.pharmaconnect.uk",
      WORKSPACE_ROOT: secret("WORKSPACE_ROOT") || projectRoot,
      REPLIT_DEV_DOMAIN: secret("REPLIT_DEV_DOMAIN") || "app.pharmaconnect.uk",
      GOOGLE_PLACES_API_KEY: secret("GOOGLE_PLACES_API_KEY"),
      GEMINI_API_KEY: secret("GEMINI_API_KEY"),
      SESSION_SECRET: secret("SESSION_SECRET"),
      IDEOGRAM_API_KEY: secret("IDEOGRAM_API_KEY"),
      DEPLOY_USERNAME: secret("DEPLOY_USERNAME"),
      DEPLOY_PASSWORD: secret("DEPLOY_PASSWORD"),
      GSC_OAUTH_CLIENT_ID: secret("GSC_OAUTH_CLIENT_ID"),
      GSC_OAUTH_CLIENT_SECRET: secret("GSC_OAUTH_CLIENT_SECRET"),
      AI_INTEGRATIONS_OPENAI_API_KEY: secret("AI_INTEGRATIONS_OPENAI_API_KEY"),
      AI_INTEGRATIONS_OPENAI_BASE_URL: secret("AI_INTEGRATIONS_OPENAI_BASE_URL"),
    }
  }]
};
