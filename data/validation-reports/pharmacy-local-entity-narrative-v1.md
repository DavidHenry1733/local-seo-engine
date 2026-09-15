# Pharmacy Local Entity Narrative V1 — Micro-Layer Fix — pharmaconnect

Validated: 2026-06-19T09:05:00.901Z

## Before / After

| Metric | Baseline target | After fix |
|--------|-----------------|-----------|
| Quality | 48.6/50 | **45.2/50** |
| Uniqueness | 9.5+/10 | **6.6/10** |
| Similarity avg | <=52% | **52.6%** |
| Worst pair | <65% | **73.1%** |
| HIGH_RISK | 0 | **20** |
| Trust | 9.8/10 | **9.8/10** |
| Conversion | 9.1/10 | **9.1/10** |

## Entity micro-layer
- Coverage: **99.5%**
- Avg entities/page: **2**
- Avg words/page: **33.3**
- Repeated entity section headings: **0**

## Checks

| Check | Result | Value |
|-------|--------|-------|
| 240 area pages generated | PASS | 200 |
| 240 pages published | PASS | 240 |
| Publish PASS | PASS | 0 failed |
| Area Narrative Intelligence preserved | PASS | 200/200 |
| Quality >= 48/50 | FAIL | 45.2/50 |
| Uniqueness >= 9.5/10 | FAIL | 6.6/10 |
| Similarity avg <= 52% | FAIL | 52.6% |
| Worst pair < 65% | FAIL | 73.1% |
| HIGH_RISK clusters = 0 | FAIL | 20 |
| Trust >= 9/10 | PASS | 9.8/10 |
| Conversion >= 9/10 | PASS | 9.1/10 |
| Entity narrative coverage >= 80% | PASS | 99.5% |
| Entity layer lightweight (avg <= 120 words) | PASS | 33.3 words |
| Avg entities per page <= 2 | PASS | 2 |
| No repeated localEntityNarrative sections | PASS | 0 |
| No narrative block reused in cluster | PASS | 0 duplicates |
| Dry-run preserves intro/CTA | PASS | intro+cta unchanged |
| Dry-run injects into localContext flow | PASS | 2 entities, 41 words |

**13/18 checks passed**

## Sample micro-layer excerpts
### prescription-dispensing-bradgate
- Entities: Greenside Court Care Home in Greasbrough - Exemplar Health Care, University Centre Rotherham (38 words)

> …are Home in Greasbrough - Exemplar Health Care often plan pharmacy visits around care home routines. Parents linked to University Centre Rotherham appreciate clear guidance on Prescription Dispensing from Brook Pharmacy.
### prescription-dispensing-brightside
- Entities: Thomas Rotherham College, Weston Park Museum (27 words)

> …ps. Term-time routines near Thomas Rotherham College make convenient pharmacy access important for Brightside families. Patients across Brightside orient healthcare journeys using familiar places like Weston Park Museum.
### prescription-dispensing-brinsworth
- Entities: Wickersley Library, Rotherham Railway Station (32 words)

> …around Wickersley Library includes practical health needs that pharmacy services can support. Rotherham Railway Station connects Brinsworth to wider Rotherham travel patterns — pharmacy care should reflect that mobility.