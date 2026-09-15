# PharmaConnect Core E2E V1 — Recovery Manifest

Checkpoint name: `PHARMACONNECT-CORE-E2E-V1`  
This file is completed after the checkpoint commit; the SHA, tag, timestamp, and branch below are the locked recovery coordinates.

## Coordinates

- Checkpoint / tag: `PHARMACONNECT-CORE-E2E-V1`
- Commit SHA: `REPLACE_AFTER_COMMIT`
- Branch: `fix/image-library-stabilisation-20260520-101828`
- Repository remote: `https://github.com/DavidHenry1733/local-seo-engine.git`
- Workspace: `/home/inboxingproweb/pharmaconnect-growth-engine`
- Timestamp (UTC): `REPLACE_AFTER_COMMIT`

Vision Pharmacy is a **TEST/DEMO tenant**. Its real Shopify domain `www.visionpharmacy.com` and DNS must not be touched.

## Required runtime

- Node.js 20.x (server currently runs Node 20)
- pnpm (workspace package manager; see root `package.json` `preinstall`)
- PM2 process manager
- Linux host with the managed publication document root available

## Application entry points

- PM2 app name: `pharmaconnect-growth-engine`
- PM2 config: `ecosystem.config.cjs` (loads secrets from `.env` / process env; no secret values in Git)
- Application script: `artifacts/api-server/dist/index.mjs`
- Source that must be rebuilt before dist is current: `artifacts/api-server/src/**` plus `src/**`
- Listen port (default): `3001`
- Public app host: `https://app.pharmaconnect.uk`

## Environment VARIABLE NAMES only

Never store values in Git. Required or commonly used names:

- `PORT`
- `NODE_ENV`
- `SESSION_SECRET`
- `WORKSPACE_ROOT`
- `APP_DOMAIN`
- `PUBLIC_APP_URL`
- `PUBLIC_SITE_DOMAIN`
- `STATIC_SITE_DOMAIN`
- `DEFAULT_PROJECT_SLUG`
- `REPLIT_DEV_DOMAIN`
- `GOOGLE_PLACES_API_KEY`
- `GEMINI_API_KEY`
- `IDEOGRAM_API_KEY`
- `DEPLOY_USERNAME`
- `DEPLOY_PASSWORD`
- `GSC_OAUTH_CLIENT_ID`
- `GSC_OAUTH_CLIENT_SECRET`
- `GSC_OAUTH_REFRESH_TOKEN` (optional; token file is preferred)
- `AI_INTEGRATIONS_OPENAI_API_KEY`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`
- `DATAFORSEO_LOGIN`
- `DATAFORSEO_PASSWORD`
- `PHARMACY_GSC_SITEMAP_SUBMIT_ENABLED` (must remain unset/false until an explicit later task)

Template: `.env.example`

## Persistent non-secret data locations (in workspace)

These JSON/HTML structures are part of recovering tenant/workflow state:

- `data/pharmacy-profiles/`
- `data/pharmacy-registry/`
- `data/pharmacy-indexing/`
- `data/pharmacy-technical-seo-audits/`
- `data/pharmacy-search-console-authority/`
- `data/pharmacy-master-admin/`
- `data/pharmacy-authority-readiness/`
- `data/pharmacy-publishing-settings/`
- `data/pharmacy-publish-status/`
- `data/growth-engine/`
- `config/projects/`
- `config/users.json` (password **hashes** only)
- `docs/pharmacy-master-library/`

## Secret-store locations (pathname only)

- Workspace dotenv: `/home/inboxingproweb/pharmaconnect-growth-engine/.env`
- Search Console OAuth token file: `/tmp/.gsc-oauth-tokens.json`
- Search Console disconnect marker: `/tmp/.gsc-oauth-disconnected`
- PM2 process environment (runtime): `pm2 jlist` → `pharmaconnect-growth-engine` → `pm2_env`

Do not copy these files into Git.

## Managed publication storage

- Live managed sites: `/var/www/pharmaconnect-sites/<slug>/current/`
- Vision live host: `https://vision-pharmacy.sites.pharmaconnect.uk/`
- This tree is **outside Git**. Restoring code does not by itself restore live HTML. Copy the document root from host backup if HTML must be recovered.

Local generation artefacts also exist at `output/` (not required in Git for source recovery; live HTML is the managed document root).

## How to restore this exact checkpoint

```bash
cd /home/inboxingproweb/pharmaconnect-growth-engine
git fetch --tags
git checkout PHARMACONNECT-CORE-E2E-V1
# restore secrets into .env from the secret store; never from Git
cp .env.example .env   # then fill values from the secret store
pnpm install
pnpm --dir artifacts/api-server run build
```

Restore `data/` from this commit if tenant JSON is required. Restore `/var/www/pharmaconnect-sites/` from host backup if live HTML is required. Restore `/tmp/.gsc-oauth-tokens.json` from the secret store if Search Console must remain connected.

## How to start the application

```bash
cd /home/inboxingproweb/pharmaconnect-growth-engine
pm2 start ecosystem.config.cjs
# or, if already configured:
pm2 restart pharmaconnect-growth-engine
pm2 status
```

Confirm listen on port 3001 and `https://app.pharmaconnect.uk`.

## Principal validation suites

From workspace root:

```bash
npx tsx scripts/validate-external-indexing-submission-preflight-v1.ts
npx tsx scripts/validate-search-console-write-authority-v1.ts
npx tsx scripts/validate-indexing-registry-authority-v1.ts
```

Do **not** run live sitemap or URL submission. Do **not** set `PHARMACY_GSC_SITEMAP_SUBMIT_ENABLED=true`.

## Generic architecture (principal services in this checkpoint)

1. Pharmacy onboarding/profile — `src/pharmacy/pharmacyProfileSchema.ts`, setup/profile dashboard services
2. Google/business import — Master Admin website/Google import services under `src/pharmacy/masterAdmin*`
3. Service selection — `src/pharmacy/masterAdminActiveServiceCampaignStore.ts`, campaign OS services
4. Locality selection — `src/pharmacy/masterAdminSavedLocalitySelectionService.ts`, growth-engine area ranking
5. Campaign creation — `src/pharmacy/growthEngineCampaignBuilderService.ts`, `pharmacyAuthoritativeCampaignProgrammeService.ts`
6. Evidence/relevance — `src/pharmacy/contentEngine/pharmacyVerifiedLocalityEvidenceV1.ts` and evidence gate services
7. Content generation — `src/pharmacy/contentEngine/*`, `pharmacyLocalClusterContentEngine.ts`
8. Review Centre — `src/pharmacy/growthEngineReviewCentreService.ts`
9. Approvals — Master Admin approval stores under `data/pharmacy-master-admin/` plus approval services
10. Authority/readiness — `src/pharmacy/pharmacyAuthorityReadinessService.ts`
11. Growth Intelligence — `src/pharmacy/growthEngineFrameworkService.ts`, local search intelligence services
12. Growth Plan — `src/pharmacy/growthEngineGrowthPlanLifecycle.ts`, `growthEngineGrowthPlanPage.ts`
13. Campaign improvements — `src/pharmacy/pharmacyCampaignImprovementsServiceAuthority.ts`
14. Publishing preparation — `src/pharmacy/pharmacyPublishingSettingsService.ts`, launch queue
15. Managed publication — `src/pharmacy/pharmacyLivePublishService.ts`, `pharmacyManagedSftpClient.ts`
16. Canonical authority — `src/pharmacy/pharmacyPublicationCanonicalAuthority.ts`
17. Robots/indexability — `src/pharmacy/pharmacyPublicationIndexabilityAuthority.ts`
18. Metadata — Technical SEO inspector + publication overlay services
19. Structured data — `src/pharmacy/pharmacyTechnicalSeoContract.ts` and HTML inspector
20. Internal links — `src/pharmacy/pharmacyPublicationInternalLinkAuthority.ts`
21. Sitemap — managed publication sitemap + indexing bridge sitemap URL resolver
22. Technical SEO contract — `src/pharmacy/pharmacyTechnicalSeoAuditService.ts`, `pharmacyTechnicalSeoIndexGate.ts`
23. Indexing eligibility — Technical SEO index gate + `selectIndexingRegisterablePages`
24. Internal indexing registry — `src/pharmacy/pharmacyIndexingBridgeService.ts`
25. External indexing pre-flight — `src/pharmacy/pharmacyExternalIndexingSubmissionService.ts`
26. Search Console OAuth/property authority — `artifacts/api-server/src/routes/api/gscAuth.ts`, `src/pharmacy/pharmacySearchConsoleWriteAuthorityService.ts`

## Known deferred issues

- Search Console write consent is not yet granted (readonly scope proven). Product Owner reconnect is required.
- Search Console API is not enabled on the OAuth Google Cloud project; `sites.list` cannot complete until enabled.
- Managed URL-prefix property `https://vision-pharmacy.sites.pharmaconnect.uk/` is not verified.
- Live sitemap submit kill switch remains disabled (`PHARMACY_GSC_SITEMAP_SUBMIT_ENABLED` unset).
- Production domain mapping for Vision customer Shopify (`www.visionpharmacy.com`) must not be changed.
- One redundant extra hostname check for `www.visionpharmacy.com` exists in `evaluateRegisteredUrlForSubmission`; generic customer-website rejection already handles other tenants.
- Growth Journey Visibility card may still show stale non-current-service rows; left unchanged.
- Historical InboxingPro `output/` HTML and `_archive/` trees are local artefacts, not the live managed document root.

## Confirmation

This checkpoint is intended to recover the **current working PharmaConnect platform source and non-secret tenant JSON**. Live managed HTML, OAuth tokens, and `.env` values must be restored from their secret/host stores listed above.
