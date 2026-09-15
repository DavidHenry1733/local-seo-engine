# PharmaConnect Profile Dashboard Completion V1

## Purpose

The Profile Dashboard is the **single source of truth** for the entire PharmaConnect platform. Every generated asset — visual service pages, header and footer chrome, professional review trust blocks, authority audit signals, campaign context, and platform dashboards — reads from one pharmacy profile document.

When the pharmacy updates their profile and pages are rebuilt, branding, navigation, trust information, and reviewer details propagate automatically. No hardcoded pharmacy values remain outside the profile JSON.

## Sections Completed

### 1. Business Information

All core identity and contact fields are editable and persisted in `data/pharmacy-profiles/{slug}.json`:

- Pharmacy name, trading name, company name, company registration number
- GPhC premises number, NHS profile URL, website, email, telephone, emergency contact
- Full address (lines, town, county, postcode, country)
- Google Maps URL, latitude, longitude
- Opening hours (per-day fields + summary)
- Coverage areas (ranking and nearby areas)

### 2. Branding

Dedicated branding section with live colour controls:

| Category | Fields |
|----------|--------|
| Assets | Logo, favicon |
| Colours | Primary, secondary, CTA, accent, background, text, muted text |
| Typography | Heading/body font, weights, H1–H3 and body sizes |
| Layout | Button style/radius, card radius, image style, page style |

Each colour field provides a colour picker, HEX input, and live preview swatch. Values are stored on the profile and consumed by the theme engine after rebuild.

### 3. Header Settings

- Header logo (falls back to main logo)
- Header CTA text and URL
- Navigation editor: label, URL, order, visibility
- Default entries: Home, Services, NHS Services, Private Services, About, Contact

### 4. Footer Settings

- Footer links editor
- Copyright, company number
- GPhC and NHS profile links (from trust fields)
- Privacy, cookie, and terms policy URLs
- Social: Facebook, Instagram, LinkedIn, X, YouTube
- Footer logo and footer text

### 5. Professional Review

Expanded reviewer fields:

- Name, role, qualifications, professional registrations
- Years experience, special interests, clinical interests
- Biography, photograph, clinical review date, next review date
- Reviewer signature (future placeholder)

Guided biography examples (Community Pharmacy, NHS Services, Travel Health) support **Use**, **Copy**, and edit workflows. Examples are guidance only.

### 6. Professional Review Card

Shared component: `src/pharmacy/pharmacyProfileReviewCardHtml.ts`

Renders photo, name, role, qualifications, experience, review dates, and biography. Used in:

- Profile Dashboard live preview
- Generated visual service pages (via `pharmacyProfessionalReviewPanel.ts`)

### 7. Live Profile Preview

Right-column preview panel updates immediately as form values change (no rebuild required):

- Header preview with navigation and CTA
- Hero colour band and buttons
- Brand colour swatches
- Typography sample
- Professional review card
- Footer preview

Implementation: `src/pharmacy/pharmacyProfileDashboardPreview.ts` + client-side `updatePreview()` in the dashboard route.

### 8. Future Features (Document Only)

Disabled placeholder fields with **Coming Soon** labels:

- Website URL auto-detection
- Auto branding detection
- Logo extraction
- Colour detection
- Navigation detection

No backend logic is implemented for these fields in V1.

## Website Branding (Shared Engine)

PharmaConnect uses the **Local SEO Engine brand importer** as the single branding system (`src/generator/brandImporter.ts` + `src/generator/brandImportPanel.ts`).

### Profile Dashboard flow

1. Enter **Existing Website URL** in section 2 — Website Branding
2. Click **Import Website Branding** — calls `POST /api/brand-import/:slug`
3. Imported values auto-apply to the pharmacy profile (logo, favicon, colours, fonts, header/footer nav, contact)
4. Edit any value in the import panel or Header/Footer sections
5. **Save Profile** persists to `data/pharmacy-profiles/{slug}.json`

### API

| Endpoint | Purpose |
|----------|---------|
| `POST /api/brand-import/:slug` | Fetch and extract brand from website |
| `PUT /api/brand-import/:slug` | Save edited brand profile |
| `POST /api/pharmacy/profile/:slug/apply-brand-import` | Map brand profile → pharmacy profile JSON |

### Mapping

`src/pharmacy/pharmacyBrandProfileMapper.ts` maps `BrandProfile` fields to pharmacy profile fields. The theme engine consumes profile JSON only — it does not distinguish import vs manual entry.

### Validation

```bash
npx tsx scripts/validate-pharmacy-shared-branding-engine-v1.ts
```

## Branding Model (legacy manual section removed)

Profile branding flows through:

1. **`pharmacyProfileSchema.ts`** — stores all branding fields (schema version 3)
2. **`pharmacyServicePageProfileContext.ts`** — maps profile → page presentation context
3. **`pharmacyThemeEngine.ts`** — resolves CSS custom properties (`--brand-primary`, `--brand-accent`, `--font-heading`, etc.)
4. **`pharmacyServicePageDesignSystem.ts`** — applies theme to header, footer, and layout

NHS blue (`#005eb8`) remains reserved for informational badges only, never page chrome.

## Professional Review

Reviewer data is validated for production safety via `pharmacyProfileProductionSafety.ts`. Demo or untrusted values are suppressed on live pages.

Authority Audit reads reviewer completeness and emits trust signals when a named reviewer and review dates are present.

## Profile Preview

Dashboard URL:

```
/api/pharmacy-profile-dashboard?slug=pharmaconnect
```

Save endpoint:

```
POST /api/pharmacy-profiles/{slug}
```

Body is normalized through `normalizeProfileData()` before persistence.

## Modules Consuming Profile

| Module | Consumption |
|--------|-------------|
| Visual Pages | Header, footer, theme CSS, review panel |
| Header / Footer | `headerNavLinks`, footer links, social, policies |
| Professional Review | Shared review card component |
| Authority Audit | Reviewer signals, GPhC, NHS profile |
| Enhancement Engine | Profile completeness, reviewer actions |
| Image Placeholder Service | Pharmacy name, service context |
| Campaign OS | Slug-scoped profile context |
| Publishing Settings | Profile-driven publish gates |
| Growth Dashboard | Profile slug routing |
| Platform Dashboard | Pharmacy name, logo, completeness |

## Future Roadmap

- Auto branding detection from pharmacy website
- Logo and colour extraction from live site
- Navigation import from existing website
- Reviewer digital signature capture

## Validation

Run:

```bash
npx tsx scripts/validate-pharmacy-profile-dashboard-completion-v1.ts pharmaconnect
```

Validates:

- Business, branding, header, footer, and reviewer fields normalize and save
- Colour picker + HEX synchronisation in dashboard UI
- Header and footer link persistence
- Reviewer guided examples available
- Professional review card renders on pages and preview
- Theme engine consumes extended branding
- Authority audit detects reviewer
- Service masters and clinical copy untouched
- Template lockdown (`lockdown-v1`) preserved

## Build & Deploy

```bash
pnpm --dir artifacts/api-server build
pm2 restart pharmaconnect-growth-engine --update-env
```

After deploy, rebuild visual pages so generated HTML reflects the latest profile branding.

## Key Files

| File | Role |
|------|------|
| `artifacts/api-server/src/routes/pharmacyProfileDashboardPage.ts` | Dashboard UI |
| `src/pharmacy/pharmacyProfileSchema.ts` | Profile schema v3 |
| `src/pharmacy/pharmacyProfileDashboardSections.ts` | Form section builders |
| `src/pharmacy/pharmacyProfileDashboardConfig.ts` | Defaults and bio examples |
| `src/pharmacy/pharmacyProfileDashboardPreview.ts` | Live preview panel |
| `src/pharmacy/pharmacyProfileReviewCardHtml.ts` | Shared review card |
| `src/pharmacy/pharmacyServicePageProfileContext.ts` | Page profile context |
| `src/pharmacy/pharmacyThemeEngine.ts` | Theme CSS variables |
| `src/pharmacy/pharmacyServicePageDesignSystem.ts` | Header/footer renderers |
