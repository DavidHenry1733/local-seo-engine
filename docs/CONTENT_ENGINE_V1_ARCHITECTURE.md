# Content Engine V1 Architecture

Design document for campaign-level supporting marketing content. **Planning only — not implemented.**

## Platform context (June 2026)

| Area | Status |
|------|--------|
| Hub/cluster templates | Web Design, Local SEO, Website Hosting, Email Marketing working |
| Rotherham Hosting + Email | Live, pane images correct |
| Registry / sitemap | 169 URLs, aligned |
| Existing blog pipeline | Hub-slug driven (`blog-v1`), 2 Sheffield articles + social sidecar `.txt` files |
| Campaign sessions | 13 session files under `output/inboxingproweb/sessions/` |
| Content Engine UI | Not built |

---

## 1. Current structure (inspected)

### Campaign session — `output/{clientSlug}/sessions/{campaignId}.json`

Authoritative campaign blueprint used by rollout:

- `campaignId`, `clientSlug`, `stage`
- `campaign`: `cityName`, `serviceName`, `serviceKey`, `focusKeyword`, `moneyPageUrl`, `hubUrl`
- `engineOutput`: ranked areas, `contentSignals` per area (keywords, local context, business type)
- `selectedAreaDefs[]`: hub + cluster defs with `remotePath`, `tier`, `area`, `primaryKeyword`
- Rollout log entries, image pane references

### Page metadata — `output/{clientSlug}/{areaDir}/page-data.json`

Written at rollout time:

- `campaignId`, `service`, `location`, `targetKeyword`, `remotePath`, `liveUrl`, `tier`, `isHubPage`
- `images` (hero/support/trust/conversion selections)
- `aiReadiness` (optional publish gate for hub/cluster HTML — separate from content assets)

### Campaign pane assets — `output/{campaignId}/assets/`

- `image-meta.json` + `{serviceKey}/{slot}.webp`
- Useful as image prompt / visual reference inputs

### Blog v1 (prototype, not campaign-native)

Path: `output/inboxingproweb/blog/{slug}/`

| File | Purpose |
|------|---------|
| `brief.json` | Inputs derived from hub `page-data.json` + HTML |
| `article.json` | Full blog + embedded social/GBP/YouTube drafts |
| `audit.json` | Quality gate |
| `index.html` | Rendered blog |
| `facebook-post.txt`, `linkedin-post.txt`, `gbp-post.txt`, `x-post.txt`, `youtube-script.txt` | Sidecar exports |

Registry entries use `source: "blog-v1"`, `type: "supporting"`.

**Gap:** Blog v1 is triggered by hub slug, stores drafts inside `article.json`, has no approval workflow, and is not keyed by `campaignId`.

---

## 2. Content Engine goal

For any campaign, generate a **complete marketing asset set** from the same blueprint used for hub/cluster pages:

```
Generate → Preview → Edit → Approve → Publish
```

V1 publishing = local output + status change. External platforms (WordPress, GBP API, social APIs) are later phases.

---

## 3. Recommended data model

### Root manifest — `campaignContent.json`

**Path:** `output/{clientSlug}/campaign-content/{campaignId}/campaignContent.json`

```json
{
  "schemaVersion": "1.0",
  "campaignId": "rotherham-webho-ting-5b9958",
  "clientSlug": "inboxingproweb",
  "service": "Web Hosting",
  "serviceKey": "web-hosting",
  "location": "Rotherham",
  "targetKeyword": "web hosting rotherham",
  "hubUrl": "https://local.inboxingproweb.com/web-hosting-rotherham/",
  "moneyPageUrl": "https://inboxingproweb.com/uk-website-hosting/",
  "clusterUrls": ["https://local.inboxingproweb.com/web-hosting-wickersley/"],
  "internalLinkMap": [],
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "generationRunId": "uuid",
  "assetIndex": ["asset-blog-001", "asset-fb-001"],
  "summary": {
    "total": 8,
    "byStatus": { "draft": 0, "generated": 8, "reviewed": 0, "approved": 0, "published": 0, "rejected": 0 },
    "byType": { "blog_post": 1, "facebook_post": 1 }
  }
}
```

### Per-asset file — `assets/{assetId}.json`

Each asset is a first-class document with shared envelope + type-specific payload.

#### Shared envelope (all asset types)

| Field | Type | Description |
|-------|------|-------------|
| `assetId` | string | Stable ID, e.g. `asset-blog-rotherham-hosting-001` |
| `assetType` | enum | See §4 |
| `status` | enum | `draft` \| `generated` \| `reviewed` \| `approved` \| `published` \| `rejected` |
| `campaignId` | string | Parent campaign |
| `parentAssetId` | string? | e.g. blog → social derivatives |
| `service` | string | Display service name |
| `location` | string | City / campaign location |
| `targetKeyword` | string | Primary keyword |
| `relatedHubUrl` | string | Canonical hub URL |
| `relatedClusterUrls` | string[] | Cluster URLs for linking |
| `internalLinkTargets` | `{ label, href, anchorText? }[]` | Approved link map |
| `schemaPayloads` | object[] | JSON-LD blocks when applicable |
| `publishTarget` | enum | `local_json` \| `local_html` \| `local_markdown` \| `wordpress` \| `gbp` \| `facebook` \| `linkedin` \| `reddit` \| `youtube` \| `email_platform` |
| `publishUrl` | string? | Public URL after publish (blog only in V1) |
| `sourceGeneration` | `{ runId, model, promptVersion, generatedAt }` | Provenance |
| `editHistory` | `{ at, by, fieldsChanged }[]` | Manual edit audit trail |
| `approvedAt` | string? | Approval timestamp |
| `approvedBy` | string? | User / system |
| `publishedAt` | string? | Publish timestamp |
| `rejectionReason` | string? | If rejected |

#### Status lifecycle

```
draft → generated → reviewed → approved → published
                      ↓           ↓
                   rejected    rejected
```

- **draft** — placeholder before generation
- **generated** — AI output written, not human-reviewed
- **reviewed** — human opened/edited in preview UI
- **approved** — explicit approval; required before publish
- **published** — exported to final output path; blog may enter registry
- **rejected** — discarded from publish queue; retained in history

---

## 4. V1 asset types

| assetType | V1 | Notes |
|-----------|----|-------|
| `blog_post` | Yes | Primary long-form asset; drives many derivatives |
| `facebook_post` | Yes | |
| `linkedin_post` | Yes | |
| `gbp_post` | Yes | |
| `reddit_post` | Yes | Never auto-published |
| `youtube_script` | Yes | |
| `youtube_metadata` | Yes | Title, description, tags (separate from script) |
| `email_sequence` | Yes | Multi-email bundle |
| `meta_pack` | Stretch | Campaign/hub meta title + description variants |
| `internal_link_suggestions` | Stretch | Anchor text map (can merge into blog_post in Phase 1) |
| `faq_schema_pack` | Stretch | Standalone FAQ + FAQPage schema (embedded in blog_post for V1) |
| `image_prompt` | Stretch | Per-slot or hero prompts referencing pane assets |

**V1 minimum set (8 types):** blog_post, facebook_post, linkedin_post, gbp_post, reddit_post, youtube_script, youtube_metadata, email_sequence.

---

## 5. Required fields per asset type

### `blog_post`

| Field | Required |
|-------|----------|
| `title` | Yes |
| `slug` | Yes |
| `metaTitle` | Yes |
| `metaDescription` | Yes |
| `h1` | Yes |
| `articleBody` | Yes (sections or HTML/markdown) |
| `aiSummary` | Yes |
| `internalLinks` | Yes `{ label, href }[]` |
| `anchorTextSuggestions` | Yes `{ targetUrl, suggestedAnchors[] }[]` |
| `faq` | Yes `{ question, answer }[]` |
| `articleSchema` | Yes JSON-LD BlogPosting |
| `faqSchema` | Yes JSON-LD FAQPage |
| `suggestedImagePrompt` | Yes |
| `status` | Yes (envelope) |

### `facebook_post`

| Field | Required |
|-------|----------|
| `postText` | Yes |
| `cta` | Yes |
| `hashtags` | Yes |
| `suggestedImagePrompt` | Yes |
| `linkedUrl` | Yes |
| `status` | Yes |

### `linkedin_post`

| Field | Required |
|-------|----------|
| `postText` | Yes |
| `professionalAngle` | Yes |
| `cta` | Yes |
| `hashtags` | Yes |
| `linkedUrl` | Yes |
| `status` | Yes |

### `gbp_post`

| Field | Required |
|-------|----------|
| `postText` | Yes |
| `postType` | Yes (`update` \| `offer` \| `event`) |
| `cta` | Yes |
| `linkedUrl` | Yes |
| `status` | Yes |

### `reddit_post`

| Field | Required |
|-------|----------|
| `title` | Yes |
| `body` | Yes |
| `communitySafeTone` | Yes (boolean + notes) |
| `disclosureNote` | Yes |
| `linkedUrl` | Optional |
| `status` | Yes |

### `youtube_script`

| Field | Required |
|-------|----------|
| `title` | Yes |
| `hook` | Yes |
| `script` | Yes |
| `chapters` | Yes `{ time, title }[]` |
| `cta` | Yes |
| `description` | Yes |
| `tags` | Yes |
| `linkedUrl` | Yes |
| `status` | Yes |

### `youtube_metadata`

| Field | Required |
|-------|----------|
| `title` | Yes |
| `description` | Yes |
| `tags` | Yes |
| `linkedUrl` | Yes |
| `status` | Yes |

### `email_sequence`

| Field | Required |
|-------|----------|
| `sequenceName` | Yes |
| `emailCount` | Yes |
| `emails` | Yes `{ subject, body, cta, linkedUrl }[]` |
| `status` | Yes |

---

## 6. Generation inputs

Content Engine reads a **Campaign Content Blueprint** assembled from existing artifacts:

| Input source | Data used |
|--------------|-----------|
| Session file | service, location, focusKeyword, selectedAreaDefs, contentSignals |
| Hub `page-data.json` + `index.html` | H1, FAQs, meta, CTA, schema, body excerpts |
| Cluster pages | Related URLs, area keywords, local signals |
| `config/projects/{slug}.json` | businessName, domain, USPs, tone, money pages |
| `config/campaigns/{slug}.json` | campaign status, stage |
| Campaign pane `image-meta.json` | assignedFrom IDs, alt templates → image prompts |
| Service template blueprint | Section IDs, narrative profile (hosting vs email vs web design) |
| Internal link map | hub → clusters → money page → related services |

**Generator contract (Phase 1):**

```
buildCampaignContentBlueprint(campaignId) → CampaignContentBlueprint
generateCampaignAssets(blueprint, selectedTypes[]) → asset files + manifest update
```

No changes to hub/cluster **page** generation logic — Content Engine consumes their output as read-only inputs.

---

## 7. Dashboard workflow (future — Phase 2)

New tab/section: **Campaign Content** (alongside Campaigns, Rollout, SEO Health).

### UI capabilities

| Action | Description |
|--------|-------------|
| Campaign picker | Select campaign from session list |
| Asset type checkboxes | Choose which types to generate |
| **Generate selected** | POST generate job; show progress |
| **Preview asset** | Render blog HTML, social text, email preview |
| **Edit asset** | JSON/form editor; writes `editHistory` |
| **Approve asset** | Sets `approved`; requires reviewed or generated |
| **Publish selected** | Approved assets only; export + status → published |
| Status badges | Colour by status |
| Filters | By assetType, status |

Wire into existing auth (`requireAuth`) and campaign panel (`openCampaignPanel`).

---

## 8. Publishing workflow (V1)

**Publishing definition (V1):**

1. Asset must be `approved`
2. Export final artifact to disk:
   - Blog → `output/{clientSlug}/blog/{slug}/index.html` + `article.json`
   - Social → `.txt` or `.json` in `campaign-content/{campaignId}/exports/`
   - Email → `exports/{sequenceName}.json`
3. Set `status: published`, `publishedAt`
4. **Registry:** call `upsertPage` **only** when asset has a public URL (blog_post with `/blog/{slug}/`)
5. **No FTP / external API** in V1 unless user explicitly triggers existing deploy flow separately

| publishTarget | V1 behaviour |
|---------------|--------------|
| `local_json` | Write asset JSON to exports |
| `local_html` | Blog HTML only |
| `local_markdown` | Optional `.md` export |
| `wordpress`, `gbp`, `facebook`, `linkedin`, `reddit`, `youtube`, `email_platform` | Stub only; export file for manual copy |

---

## 9. Safety rules

| Rule | Enforcement |
|------|-------------|
| Never auto-publish externally | No API calls to social/GBP/Reddit in V1 |
| Never auto-publish Reddit | `reddit_post` export-only; `publishTarget` cannot auto-set to `reddit` |
| Approval required before publish | API rejects publish if status ≠ approved |
| Draft history preserved | Never overwrite; append `editHistory`; keep rejected assets |
| Provenance tracked | `sourceGeneration` on every asset |
| Manual edits preserved | Merge edits into payload; do not re-generate without explicit regen |
| Hub/cluster publish gates unchanged | `aiReadiness` on page-data.json remains separate |

---

## 10. Implementation phases

### Phase 1 — Data model + generator output only
- `campaignContent.json` schema + TypeScript types
- `buildCampaignContentBlueprint()`
- Generators per asset type (wrap/refactor `src/blog/*` for blog_post)
- CLI: `pnpm exec tsx src/content-engine/generateCampaignContent.ts {campaignId} --types=blog_post,facebook_post`
- Output under `output/{clientSlug}/campaign-content/{campaignId}/`
- Migrate existing Sheffield blog articles as reference implementations

### Phase 2 — Preview / review UI
- Dashboard tab + API routes (read/update status)
- Preview renderers reusing blog HTML renderer
- Approve / reject actions

### Phase 3 — Blog HTML export + registry
- Publish approved `blog_post` → `blog/{slug}/` + registry upsert
- Reuse `generateBlogFromPage` export paths

### Phase 4 — GBP export
- Structured GBP post JSON + copy-to-clipboard UI
- Optional manual upload checklist

### Phase 5 — Social platform exports
- Facebook, LinkedIn formatted exports
- Still no auto-post

### Phase 6 — Scheduling + recurring content
- Cron / campaign calendar
- Regenerate derivatives when hub content changes
- Version diff between generation runs

---

## 11. Proposed file layout

```
output/inboxingproweb/
  sessions/{campaignId}.json              # existing — read-only input
  {areaDir}/page-data.json                # existing — read-only input
  campaign-content/{campaignId}/
    campaignContent.json                  # manifest
    assets/
      asset-blog-001.json
      asset-fb-001.json
      ...
    exports/                              # published artifacts
      blog/my-slug/
      facebook-post-001.txt
    history/
      run-{uuid}.json                     # generation run snapshot
  blog/{slug}/                            # published blog (Phase 3)
```

---

## 12. API sketch (Phase 2+)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/campaign-content/:campaignId` | Manifest + asset list |
| POST | `/api/campaign-content/:campaignId/generate` | `{ types: string[] }` |
| GET | `/api/campaign-content/assets/:assetId` | Single asset |
| PATCH | `/api/campaign-content/assets/:assetId` | Edit payload |
| POST | `/api/campaign-content/assets/:assetId/approve` | Approve |
| POST | `/api/campaign-content/assets/:assetId/reject` | Reject |
| POST | `/api/campaign-content/:campaignId/publish` | `{ assetIds: string[] }` |

---

## 13. Risks and blockers

| Risk | Mitigation |
|------|------------|
| Blog v1 is hub-slug not campaign-id driven | Blueprint builder maps campaignId → hub areaDir |
| Inconsistent `serviceKey` in sessions (`web-ho-ting` vs `web-hosting`) | Normalize via `normaliseServiceKey()` at blueprint build |
| Duplicate registry entries on re-publish | Upsert by URL; version asset slug |
| Social drafts embedded in article.json today | Phase 1 splits into separate asset files |
| No user identity model for `approvedBy` | Use session userId from Express session |
| AI cost / rate limits for 8 types × N campaigns | Generate selected types only; batch by campaign |
| Reddit promotional content policy | Mandatory disclosure field + manual publish only |

---

## 14. Ready for build?

**Yes — Phase 1 is ready to build.**

Prerequisites met:

- Stable campaign session + page-data structure
- Working hub/cluster content for Hosting and Email
- Blog v1 proves end-to-end asset generation pattern
- Registry supports `supporting` content type
- Clear separation from rollout/deploy/registry pipelines

**Recommended first implementation target:** `rotherham-webho-ting-5b9958` (11 live pages, pane images, complete session).

---

## 15. Migration from blog-v1

| blog-v1 | Content Engine V1 |
|---------|-------------------|
| `brief.json` | Blueprint slice inside generation run |
| `article.json` | `assets/asset-blog-*.json` |
| Embedded social drafts | Separate asset files per type |
| CLI hub slug | CLI/API campaignId |
| Immediate registry upsert | Publish step after approval |

Existing Sheffield blog posts remain live; new campaigns use Content Engine paths without retroactive migration required in Phase 1.
