# PharmaConnect Brand Import & Theme Application V1

Repairs brand import workflow and ensures imported Brook Pharmacy branding is applied to generated service pages without layout or master changes.

## Root cause

Two failures prevented Brook branding from appearing on service pages:

1. **Colour extraction** — `brandImporter.ts` parsed generic WordPress/Divi theme CSS (`#2ea3f2`) instead of the Brook inline HTML palette (`#005EB8`, `#F59E0B`, `#007A7A`, `#1F2933`, `#5F6C7B`).
2. **Theme remapping** — `pharmacyThemeEngine.ts` treated `#005EB8` as an LSE default and remapped page chrome to pharmacy green (`#1a5c42`), ignoring imported profile colours.

Secondary issues:

- `pharmacyBrandProfileMapper.ts` mapped `bodyTextColour` to both text and muted; `headingColour` was ignored.
- CTA text/URL from the source site were not mapped to `headerCtaText` / `preferredCta`.
- Nav link and tag CSS used hardcoded colours instead of CSS variables.

## Import failure point

| Step | Before fix | After fix |
|------|------------|-----------|
| POST `/api/brand-import/pharmaconnect` | 200 but wrong colours | 200 with Brook palette |
| `apply-brand-import` | Partial mapping | Full explicit mapping + `brand-profile.json` save |
| Profile JSON | Manual `#005eb8` overwritten on theme build | Preserved through theme engine |
| Service pages | Green chrome, hardcoded nav/tag colours | Brook NHS blue + amber CTA |

## SEO Engine comparison

| Aspect | LSE | PharmaConnect (fixed) |
|--------|-----|------------------------|
| Import route | `POST /api/brand-import/:slug` | Same (shared) |
| Importer | `importBrandFromUrl()` | Same |
| Storage | `config/projects/{slug}/brand-profile.json` | Same + profile JSON |
| Apply | `POST /api/brand-import/:slug/apply` → project config | `POST /api/pharmacy/profile/:slug/apply-brand-import` → pharmacy profile |
| UI panel | `brandImportPanel.ts` | Same module, pharmacy mode |
| Colour mapping | Direct BrandProfile fields | Explicit `mapBrandProfileToPharmacyData()` |

## Profile field mapping

| BrandProfile | Pharmacy profile |
|--------------|------------------|
| `logoUrl` | `logoUrl`, `headerLogoUrl`, `footerLogoUrl` |
| `faviconUrl` | `faviconUrl` |
| `primaryColour` | `brandPrimaryColor` |
| `secondaryColour` | `brandSecondaryColor` |
| `buttonColour` | `brandCtaColor` |
| `accentColour` | `brandAccentColor` |
| `backgroundColour` | `brandBackgroundColor` |
| `headingColour` | `brandTextColor` |
| `bodyTextColour` | `brandMutedTextColor` |
| `headingFont` / `bodyFont` | `fontHeading` / `fontBody` |
| `navigationLinks` | `headerNavLinks` |
| `footerLinks` | `footerLinks` |
| `ctaText` / `ctaUrl` | `headerCtaText`, `preferredCta`, `headerCtaUrl` |

## Theme CSS variables

Service pages emit:

```css
--brand-primary, --brand-secondary, --brand-cta, --brand-accent,
--brand-background, --brand-text, --brand-muted, --brand-heading,
--heading-font, --body-font
```

Applied to headings, tags, nav links, buttons, CTA panels, coverage tags, and footer links.

## Brook import result

From `https://pharmacy.inboxingproweb.com`:

| Field | Value |
|-------|-------|
| Primary | `#005EB8` |
| CTA | `#F59E0B` |
| Accent | `#007A7A` |
| Heading text | `#1F2933` |
| Muted text | `#5F6C7B` |
| Fonts | Open Sans |
| Nav | Home, Services, Prescriptions, About, Contact |
| CTA text | Order Prescription |

## Validation

```bash
npx tsx scripts/validate-pharmacy-brand-import-theme-application-v1.ts pharmaconnect
# Result: 58/58 PASS
```

## Test URLs

- Profile Dashboard: `/api/pharmacy-profile-dashboard?slug=pharmaconnect`
- Pharmacy First: `/api/pharmacy-visual-experience/pharmacy-first/?slug=pharmaconnect`
- Blood Pressure: `/api/pharmacy-visual-experience/blood-pressure-checks/?slug=pharmaconnect`
- Travel Vaccinations: `/api/pharmacy-visual-experience/travel-vaccinations/?slug=pharmaconnect`
- Emergency Contraception: `/api/pharmacy-visual-experience/emergency-contraception/?slug=pharmaconnect`
