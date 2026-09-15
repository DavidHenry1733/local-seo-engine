# Pharmacy Visual Pipeline Consolidation V1

## Goal

One production rendering pipeline for all benchmark pharmacy visual service pages. Pharmacy Profile is the single source of truth for branding (colours, logo, contact). No visible LSE/InboxingProWeb/cluster theme except NHS informational badges.

## Architecture (after consolidation)

| Layer | Module | Shared? |
|-------|--------|---------|
| Build entry | `pharmacyVisualExperience.ts` | Yes — all services |
| Main HTML | `pharmacyVisualServicePageRenderer.ts` → `pharmacyVisualExperienceLayoutV3.ts` | Yes — **including pharmacy-first** |
| Theme | `pharmacyThemeEngine.ts` (`buildPharmacyTheme`) | Yes — profile-driven |
| CSS | `pharmacyServicePageDesignSystem.ts` | Yes — no `cluster.html` import |
| Profile | `pharmacyServicePageProfileContext.ts` | Yes |
| Trust / localisation / balance | Layout V3 + trust injection + body localisation | Yes |

## Removed / deprecated

- **Pharmacy First fork** in `pharmacyVisualExperience.ts` — pharmacy-first now uses the same renderer as other services.
- **`extractClusterTemplateCss()`** — no longer loads LSE `cluster.html` (eliminates `#0969ff` leak).
- **Per-service `accentColor`** in `pharmacyVisualExperienceConfig.ts` — colours come from profile brand fields.

`pharmacyFirstPageRecovery.ts` remains in the repo for reference but is **not wired** into the build path.

## Profile brand fields

From `data/pharmacy-profiles/{slug}.json`:

- `brandPrimaryColor`
- `brandSecondaryColor`
- `brandCtaColor`

Mapped to CSS variables `--blue`, `--navy`, `--pharmacy-cta` via `buildPharmacyTheme(profile)`.

NHS blue (`#005eb8`) is reserved for `--nhs` badge/kicker contexts only.

## Pipeline metadata

Generated pages include:

- `<body data-pipeline-version="consolidated-v1" …>`
- `<meta name="pharmacy-pipeline-version" content="consolidated-v1"/>`

## Commands

```bash
# Build all four benchmark pages
npx tsx scripts/build-pharmacy-visual-experience-v1.ts pharmaconnect

# Validate unified pipeline + branding regression
npx tsx scripts/validate-pharmacy-visual-template-regression-v2.ts pharmaconnect
```

## Benchmark services

1. `pharmacy-first`
2. `blood-pressure-checks`
3. `travel-vaccinations`
4. `emergency-contraception`

## Success criteria

- Same renderer, theme, profile localisation, trust injection, and card balance on all four pages
- Brook Pharmacy name and profile colours in header, hero, CTA, footer, body
- No `#0969ff`, no `cluster.html`, no Montserrat/Raleway LSE fonts in page chrome
- Google map iframe, local access section, CTA band present on every page
- Validation script exits 0 before any new platform features ship

## Preview

```
/api/pharmacy-visual-experience/pharmacy-first/?slug=pharmaconnect
```

Public route (no login). Optional query params:

- `slug=pharmaconnect` — pharmacy tenant slug (default: pharmaconnect)
- `rebuild=1` — force rebuild of the requested page before serving

Response header: `X-Pharmacy-Pipeline-Version: consolidated-v1`

Auto-rebuild: if a page file is missing, the preview route runs `ensureVisualExperiencePages()` before serving.

## npm scripts

```bash
pnpm run pharmacy:visual:pipeline   # build + validate
pnpm run pharmacy:visual:build
pnpm run pharmacy:visual:validate
```

```bash
pnpm --dir artifacts/api-server build
```
