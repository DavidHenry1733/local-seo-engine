# Pharmacy Profile Local Intelligence Selection V1

Validated: 2026-06-19T08:04:31.573Z

## Route
- Profile UI: **/api/pharmacy-setup (Local Intelligence tab)**
- Generate API: **/api/pharmacy-local-intelligence/pharmaconnect/generate**

## Checks

| Check | Result | Detail |
|-------|--------|--------|
| Setup page contains Local Intelligence section | PASS | local-intelligence tab |
| Generate Local Intelligence button exists | PASS | button + handler |
| Checkbox entity groups exist | PASS | entity cards |
| Major Employers removed from setup UI | PASS | not in LOCAL_INTEL_GROUPS |
| Profile schema accepts selected entity fields | PASS | gpSurgeries, hospitals, healthCentres, careHomes, schools, landmarks, communityFacilities, transportLinks, retailCentres, residentialAreas |
| Save payload includes selected entities | PASS | captureLocalEntitySelections |
| Compatibility fields populated on normalize | PASS | localGpSurgeries=1 |
| Generate API route exists | PASS | /api/pharmacy-local-intelligence/:slug/generate |
| Demo generation excludes Major Employers | PASS | 10 entities |
| Pharmaconnect demo profile can store selected entities | PASS | 1 GP, 2 schools |
| Audit includes local intelligence checks | PASS | 3 checks |

**11/11 checks passed**

## Demo generation totals
- gpSurgeries: 1
- hospitals: 1
- healthCentres: 1
- careHomes: 1
- schools: 3
- landmarks: 1
- communityFacilities: 1
- transportLinks: 1
- retailCentres: 0
- residentialAreas: 0

## Sample saved profile fields
```json
{
  "gpSurgeries": [
    {
      "id": "gpsurgeries-kimberworth-park-medical-centre",
      "name": "Kimberworth Park Medical Centre",
      "address": "",
      "category": "GP Surgery",
      "entityType": "gpSurgeries",
      "distanceKm": null,
      "distanceLabel": "",
      "source": "demo pack",
      "types": [],
      "selected": false
    }
  ],
  "hospitals": [
    {
      "id": "hospitals-rotherham-hospital-urgent-care-center-aande",
      "name": "Rotherham Hospital Urgent Care Center/A&E",
      "address": "",
      "category": "Hospital",
      "entityType": "hospitals",
      "distanceKm": null,
      "distanceLabel": "",
      "source": "demo pack",
      "types": [],
      "selected": false
    }
  ],
  "localGpSurgeries": [
    "Kimberworth Park Medical Centre"
  ],
  "nearbyHospitals": [
    "Rotherham Hospital Urgent Care Center/A&E"
  ],
  "communityLinks": [
    "Kimberworth Library"
  ],
  "localIntelligenceGenerated": true
}
```