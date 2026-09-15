# Business Profile Wizard V2 — V1 Audit Summary

## Duplicated / redundant in V1

| Issue | V1 location | V2 action |
|-------|-------------|-----------|
| Business + address + hours split across step 2 only but brand import repeats contact | Steps 2 + 3 | Step 1 imports; step 2 shows **only unconfirmed/missing** |
| Header/footer/CTA repeated | Steps 3 + 9 | Step 3 brand; step 8 marketing (CTA/tone only) |
| Local areas + landmarks + GP/hospitals split | Steps 4 + partial tags | Single **Local Intelligence** step (5) |
| Team vs Trust overlap | Steps 6 + 8 | **Team merged into Trust & Proof** (step 7) |
| Website import buried in brand step | Step 3 | **Import & Confirm** is step 1 |
| Professional review separate from trust | Step 6 | Shown inside Trust & Proof |

## Already in profile / website import

Populated by `analyzeWebsiteForPharmacy` + `mapBrandProfileToPharmacyData`:

- pharmacyName, tradingName, website, phone, businessEmail
- addressLine1, townCity, postcode, county (HTML hints)
- logoUrl, faviconUrl, brand colours, header/footer colours
- headerNavLinks, footerLinks, headerCtaText/Url
- social links, googleMapsEmbedUrl
- detectedWebsiteServices (metadata)
- buttonStyle, fonts

## Should be checkbox/dropdown (not free text)

- selectedServices, fundingModel (NHS/private/mixed)
- appointmentRequired, walkInAvailable
- consultation length (preset dropdown)
- equipmentUsed, preparationRequired, aftercare (checklists)
- targetPatientGroups (preset checkboxes)
- accreditations, nhsServicesAvailable, consultationRoom, independentPrescriber
- local entity selection (GP, hospital, landmark, competitor)
- contentIntelligence tone, reading level, preferred length

## Auto-populate from Google Places / local API

- gpSurgeries, hospitals, healthCentres, landmarks, transportLinks
- profileCompetitors (competitor pharmacies)
- googlePlaceId, rating/review count when place resolved
- Area discovery remains `discoverPharmacyAreas` (static engine)

## Advanced / legacy form only

- Header nav row editor, footer policy URLs, reviewer bio examples grid
- Content intelligence FAQ max count fine-tuning
- V2 intelligence style fields (heroStyle, photographyStyle) — optional chips

## V2 flow (8 steps)

1. Import & Confirm
2. Business Basics (gaps only)
3. Brand & Website Style
4. Services (detected + structured delivery)
5. Local Intelligence (Google/local + competitors + areas)
6. Patient Groups (checkboxes)
7. Trust & Proof (includes team/reviewer)
8. Marketing & Generate Readiness
