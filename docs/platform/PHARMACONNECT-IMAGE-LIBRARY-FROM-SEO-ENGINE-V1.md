# PharmaConnect Image Library from SEO Engine V1

Adaptation of the Local SEO Engine image library workflow for PharmaConnect campaign image selection.

## SEO Engine files reused (patterns)

| LSE source | Pattern reused |
|------------|----------------|
| `artifacts/api-server/src/routes/api/images.ts` | Unified assign/upload/AI/status API shape |
| `src/generator/imageLibrary.ts` | `KNOWN_SLOTS` (hero/support/trust/conversion), service-scoped library |
| LSE dashboard `cpLoadImageLibrary` | Slot cards, library grid, assign-to-slot, filter by service |
| LSE dashboard `imgLibLoad` | Manifest-style library browse with category filter |
| `config/imagePromptBlueprints.json` | Prompt structure for AI preview (slot + service + location) |

## PharmaConnect files created / modified

| File | Change |
|------|--------|
| `src/pharmacy/pharmacyImageOperatingSystem.ts` | Extended assignment schema, page slot grid, library filters, campaign key resolution |
| `artifacts/api-server/src/routes/pharmacyImageLibraryPage.ts` | Full workflow dashboard UI |
| `artifacts/api-server/src/routes/api/pharmacyImageLibrary.ts` | Library filter, preview-prompt, extended assign responses |
| `src/pharmacy/pharmacyCampaignImageStatusService.ts` | Real assignment data + source breakdown |
| `src/pharmacy/pharmacyCampaignControlCentreService.ts` | Image library links on asset checklist |
| `artifacts/api-server/src/routes/pharmacyCampaignsPage.ts` | Campaign image section with Change image links |
| `scripts/validate-pharmacy-image-library-workflow-v1.ts` | End-to-end workflow validation |

**Not modified:** service masters, clinical content, `pharmacyVisualExperienceLayoutV3.ts` template structure.

## UI workflow

1. Open `/pharmacy-image-library?slug=pharmaconnect&service=travel-vaccinations`
2. Select service (Pharmacy First, Blood Pressure Checks, Travel Vaccinations, etc.)
3. Review 4 slot cards: hero, support, trust, conversion
4. For each slot: **Use Library Image** · **Upload Own Image** · **Generate With AI**
5. Preview selected image in slot card
6. Save assignment — confirmation: *Image assigned successfully.*
7. Visual page and Campaign OS readiness update from assignment JSON

## API routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/pharmacy-image-library?slug=&service=&slot=&campaignId=` | Dashboard HTML |
| GET | `/api/pharmacy-image-library?slug=…` | Dashboard alias |
| GET | `/api/pharmacy/image-library/:slug/data` | Dashboard JSON |
| GET | `/api/pharmacy/image-library/:slug/library?service=&slot=` | Filtered library picker |
| GET | `/api/pharmacy/image-library/:slug/assignments` | Raw assignments doc |
| POST | `/api/pharmacy/image-library/:slug/assign` | Assign library/upload/AI |
| POST | `/api/pharmacy/image-library/:slug/upload` | Upload + optional assign |
| POST | `/api/pharmacy/image-library/:slug/ai-request` | Create AI request (pending) |
| POST | `/api/pharmacy/image-library/:slug/preview-prompt` | AI prompt preview |
| PATCH | `/api/pharmacy/image-library/:slug/ai-request/:id` | Update AI status |

## Storage format

```
assets/pharmacy-image-library/          # Shared library SVG/WebP assets
assets/pharmacy-uploads/{slug}/         # Per-pharmacy uploads
data/pharmacy-image-assignments/{slug}.json
```

Assignment fields (extended, backward compatible):

```json
{
  "serviceId": "travel-vaccinations",
  "slot": "hero",
  "sourceType": "library",
  "campaignId": "optional",
  "assetType": "hero",
  "filePath": "assets/pharmacy-image-library/...",
  "previewUrl": "/assets/...",
  "libraryRef": "travel-health-services/travel-vaccination",
  "status": "assigned",
  "createdAt": "ISO",
  "updatedAt": "ISO"
}
```

## Campaign integration

- Campaign OS shows **4/4 assigned**, source breakdown (library / upload / AI / pending / missing)
- Missing slots listed per campaign
- **Change image** links to image library filtered by service + slot
- Asset checklist **Image library (4 slots)** links to image library dashboard
- Health score and launch readiness use `getCampaignImageSummary()` from assignment data

## Visual page integration

Resolution order in `resolvePharmacyImageForSlot()`:

1. Campaign-specific assignment (`campaignId:serviceId:slot`)
2. Service assignment (`serviceId:slot`)
3. Uploaded image (assigned or auto-match)
4. Completed AI image
5. Library fallback via `resolvePharmacySlotImage()`
6. Generic fallback (empty — no visible placeholder div when asset resolves)

## Validation

```bash
pnpm run pharmacy:visual:validate:image-library
# or
tsx scripts/validate-pharmacy-image-library-workflow-v1.ts pharmaconnect travel-vaccinations
```

Test sequence: library hero → upload support → AI trust request → library conversion → rebuild visual page.

Report: `data/validation-reports/pharmacy-image-library-workflow-v1.json`

## Preview URLs

| Resource | URL |
|----------|-----|
| Image library | `/pharmacy-image-library?slug=pharmaconnect&service=travel-vaccinations` |
| Visual page | `/api/pharmacy-visual-experience/travel-vaccinations/?slug=pharmaconnect&rebuild=1` |
| Campaign OS | `/api/pharmacy-campaigns?slug=pharmaconnect` |
| Image matrix | `/pharmacy-image-library?slug=pharmaconnect#matrix` |

## Confirmation

- Restored visual page template layout unchanged
- Service master files unchanged
- Clinical content unchanged
- Existing assignment data preserved and migrated (adds `sourceType`, timestamps, paths)
