# Pharmacy Local Intelligence Remove Employers V1

Validated: 2026-06-19T08:03:41.606Z

| Check | Result | Value |
|-------|--------|-------|
| LOCAL_INTEL_GROUPS has no majorEmployers | PASS | setup UI clean |
| ENTITY_GROUP_KEYS excludes majorEmployers | PASS | gpSurgeries, hospitals, healthCentres, careHomes, schools, landmarks, communityFacilities, transportLinks, retailCentres, residentialAreas |
| Generation excludes employer Google query | PASS | query removed |
| Generation excludes employer categorization | PASS | categorizer removed |
| Demo fallback excludes localEmployers | PASS | demo mapping removed |
| Generated groups have no majorEmployers key | PASS | gpSurgeries, hospitals, healthCentres, careHomes, schools, landmarks, communityFacilities, transportLinks, retailCentres, residentialAreas |
| Active groups still generate entities | PASS | 10 total |
| Saved profile majorEmployers preserved if present | PASS | none saved |

**8/8 checks passed**