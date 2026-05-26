module.exports = {
  apps: [{
    name: "local-seo-engine",
    script: "/home/inboxingproweb/local-seo-engine/artifacts/api-server/dist/index.mjs",
    cwd: "/home/inboxingproweb/local-seo-engine",
    env: {
      PORT: "3000",
      BASE_PATH: "/",
      NODE_ENV: "production",
      DEPLOY_USERNAME: "local@inboxingproweb.com",
      DEPLOY_PASSWORD: "XFumsvOxV_VcBYtk",
      AI_INTEGRATIONS_OPENAI_BASE_URL: "https://api.openai.com/v1",
      AI_INTEGRATIONS_OPENAI_API_KEY: "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",
      REPLIT_DEV_DOMAIN: "app.inboxingproweb.com",
      GSC_OAUTH_CLIENT_ID: "331789951258-4ik098mumv9vhpj47qp5ac3erscbnm78.apps.googleusercontent.com",
      GSC_OAUTH_CLIENT_SECRET: "PASTE_SECRET_HERE"
    }
  }]
}
