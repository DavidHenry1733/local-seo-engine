# Growth Engine — Live Publishing Connection V1

**Sprint:** Live Publishing Connection V1  
**Feature freeze:** Active — publishing connection only  
**Test tenant:** `dhmdigital` / `blood-pressure-checks`

---

## Summary

Connects the existing pharmacy publishing pipeline to static output preparation and FTP live deploy. No new product features, no generator changes.

---

## What was connected

| Component | Implementation |
|-----------|----------------|
| Deploy config | `config/projects/dhmdigital.json` — `deploy` block + `domain: https://dhmdigital.net` |
| Static output prep | `preparePharmacyPublishOutput()` — copies content ecosystem HTML to `output/pharmacy-publish/{slug}/` |
| Publish index + sitemap | `_publish-index.json` + `sitemap.xml` per tenant |
| Safe FTP test | `safeFtpConnectionTest()` — write, read-back verify, delete |
| Explicit publish | `deployPharmacyPublishOutput({ confirm: true })` — never auto-publishes |
| Publish status | `data/pharmacy-publish-status/{slug}.json` |
| API routes | `POST /api/pharmacy-publishing/:slug/prepare`, `/ftp-test`, `/publish` |
| Dashboard | Publishing Settings page — Live publishing panel |
| Integration proof | Static + FTP probes updated |

---

## API endpoints

```
GET  /api/pharmacy-publishing/:slug/live-status
POST /api/pharmacy-publishing/:slug/prepare     { serviceId }
POST /api/pharmacy-publishing/:slug/ftp-test
POST /api/pharmacy-publishing/:slug/publish     { serviceId, confirm: true }
```

---

## Credentials

Set in environment (not in project JSON):

- `DEPLOY_USERNAME`
- `DEPLOY_PASSWORD`
- Optional overrides: `DEPLOY_HOST`, `DEPLOY_PORT`, `DEPLOY_REMOTE_ROOT`

---

## Validation

```bash
npx tsx scripts/validate-growth-engine-live-publishing-v1.ts
npx tsx scripts/validate-growth-engine-live-integration-proof-v1.ts
npx tsx scripts/validate-growth-engine-operational-completion-v1.ts
npx tsx scripts/validate-growth-engine-framework-v1.ts
```

---

## User flow

1. Open **Publishing Settings** from Growth Dashboard task
2. **Prepare publish output** — builds static HTML index from content ecosystem
3. **Test FTP connection** — safe write/read/delete probe
4. **Publish content live** — explicit confirmation required
