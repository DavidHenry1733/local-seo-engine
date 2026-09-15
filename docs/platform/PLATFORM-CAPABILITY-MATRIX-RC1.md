# Platform Capability Matrix — RC1

**Audit ID:** `CPR-RC1-PLATFORM-AUDIT-01`  
**Architecture version:** RC1  
**Audit date:** 2026-08-07  
**Scope:** Shared platform capabilities only — not a per-service content audit  
**Lock reference:** `docs/platform/RC1-PLATFORM-LOCK.md`  
**Registration reference:** `docs/platform/SERVICE-REGISTRATION-FRAMEWORK.md`

---

## 1. Audit rule

Every capability below must be:

| Attribute | Meaning |
| --- | --- |
| Implemented | Shared code path exists |
| Shared | Same path for every registered service |
| Locked | Named in RC1 platform lock / must not be redesigned during onboarding |
| Operational | Usable in Product Owner Master Admin today |
| Tested | Proven on RC1 validation tenant through the locked Product Owner workflow |
| Outstanding work | Shared platform gap remaining before commercial release (not polish) |

Do not treat service-specific content gaps as platform gaps. Incomplete services fail **registration**, not shared capability ownership.

---

## 2. RC1 accepted service coverage

Capability coverage below is confirmed for these RC1-accepted services as a **shared-path set** (not re-validated service-by-service in this audit):

| Service | Service ID | RC1 |
| --- | --- | --- |
| Pharmacy First | `pharmacy-first` | ACCEPTED |
| Travel Vaccinations | `travel-vaccinations` | ACCEPTED |
| Blood Pressure Checks | `blood-pressure-checks` | ACCEPTED |
| Flu Vaccinations | `flu-vaccinations` | ACCEPTED |

**Coverage meaning:** each listed capability is available to these services through the shared implementation. Service content completeness remains gated by the Service Registration Framework.

---

## 3. Capability matrix

Legend for status columns: `Y` = yes, `P` = partial, `N` = no.

| # | Capability | Shared implementation | Impl | Shared | Locked | Operational | Tested | Outstanding work |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Service Registration | `masterAdminServiceRegistrationFramework.ts` (`evaluateServiceRegistration`) | Y | Y | Y | Y | Y | None |
| 2 | Readiness validation | `masterAdminServiceGenerationReadinessService.ts` → Create Campaign selector + create API gate | Y | Y | Y | Y | Y | None |
| 3 | Create Campaign | `pharmacyCampaignService.createPharmacyCampaign` + Master Admin create endpoint | Y | Y | Y | Y | Y | None |
| 4 | Business Profile inheritance | Campaign create inherits approved Business Profile / CPR evidence inheritance | Y | Y | Y | Y | Y | None |
| 5 | Evidence Review | Service Page Evidence Review (`buildServicePageEvidenceReview` / SPE UI) | Y | Y | Y | Y | Y | None |
| 6 | Evidence Approval | Evidence approve path (`approveServicePageEvidenceReview`) | Y | Y | Y | Y | Y | None |
| 7 | Generate Service Page | Canonical confirm → `confirmProductOwnerServicePageGeneration` → `generate_service_page` job | Y | Y | Y | Y | Y | None |
| 8 | Review Service Page | Service Page Review workspace (`buildServicePageReview`) | Y | Y | Y | Y | Y | None |
| 9 | Regenerate Service Page | Same confirm endpoint with `regenerate:true` + revision snapshot | Y | Y | Y | Y | Y | None |
| 10 | Generate Locality Pages | `queueProductOwnerLocalityGeneration` / local cluster job | Y | Y | Y | Y | Y | None |
| 11 | Review Locality Pages | Cluster / locality review (`buildCprClusterReviewDashboard`) | Y | Y | Y | Y | Y | None |
| 12 | Regenerate Locality Page | Shared locality regen one / all Product Owner controls | Y | Y | Y | Y | Y | None |
| 13 | Approve | Service page approve + locality/cluster approve (manual gates) | Y | Y | Y | Y | P | End-to-end approve→publish chain not exercised in RC1 UAT freeze |
| 14 | Publish | Commercial Publish Review + publish execution services | Y | Y | Y | Y | P | Commercial publish path not product-owner-validated as release gate |
| 15 | Static deployment | Commercial deployment / managed publishing / platform publishing infrastructure | Y | Y | Y | Y | P | Deployment destination configuration remains tenant-operational work |
| 16 | Registry update | Service/locality generation stages write ecosystem registry artefacts | Y | Y | Y | Y | Y | None for generation registry; publish-time registry sync needs release validation |
| 17 | Sitemap update | Publish / package assemblers produce sitemap artefacts | Y | Y | Y | Y | P | Sitemap publish verification outstanding for commercial release |
| 18 | Internal links | Shared internal-link map / service↔locality linking in generation path | Y | Y | Y | Y | Y | Polish only (link presentation), not architecture |
| 19 | Image Platform | Shared image platform + production assignment + fallback resolver | Y | Y | Y | Y | Y | Content library expansion (polish backlog), not platform redesign |
| 20 | Structured Data | Shared schema emission on service/locality presentation path | Y | Y | Y | Y | Y | None for shared implementation |
| 21 | Indexing request | Commercial Indexing Review dashboard + indexing bridge | Y | Y | Y | Y | P | Live indexing submission not RC1-accepted as commercial release proof |
| 22 | Search Console | Indexing / performance dashboards depend on Search Console connectivity | Y | Y | Y | P | P | Shared Search Console connection/readiness incomplete for commercial release |
| 23 | Index status | Indexing coverage / status surfaces in indexing dashboard | Y | Y | Y | P | P | Requires Search Console connectivity to be commercially operational |
| 24 | Ranking | Rank-tracking initialise / performance dashboard path | Y | Y | Y | P | P | Ranking initialisation not proven as commercial release gate |
| 25 | Dashboard reporting | Master Admin dashboard + performance / health panels | Y | Y | Y | Y | P | Commercial performance reporting incomplete until index/rank feeds are live |

---

## 4. Capability chain (locked Product Owner → commercial)

```
Service Registration
↓
Readiness validation
↓
Create Campaign
↓
Business Profile inheritance
↓
Evidence Review
↓
Evidence Approval
↓
Generate Service Page
↓
Review Service Page
↓
Regenerate Service Page
↓
Generate Locality Pages
↓
Review Locality Pages
↓
Regenerate Locality Page
↓
Approve
↓
Publish
↓
Static deployment
↓
Registry update
↓
Sitemap update
↓
Internal links
↓
Image Platform
↓
Structured Data
↓
Indexing request
↓
Search Console
↓
Index status
↓
Ranking
↓
Dashboard reporting
```

**RC1 Product Owner core (registration → locality review/regeneration):** OPERATIONAL and TESTED on the shared path.  
**Commercial release tail (approve → publish → deploy → index → rank → report):** IMPLEMENTED / SHARED / LOCKED, with outstanding **operational proof** before commercial release.

---

## 5. Outstanding shared capabilities (before commercial release)

These are shared platform operations still required. They are **not** permission to reopen Content Engine, Locality Engine, Design System, Image Platform architecture, Campaign Manager, or Workflow redesign.

| Priority | Shared capability | Required outcome |
| --- | --- | --- |
| 1 | Approve → Publish gate | Shared approve-then-publish path proven as commercial release gate |
| 2 | Static deployment | Shared deployment destination + publish execution proven for a live release |
| 3 | Sitemap + registry at publish | Publish-time sitemap/registry update verified on shared path |
| 4 | Search Console connectivity | Shared Search Console connection operational for indexing/status |
| 5 | Indexing request + index status | Shared indexing submission and status readback proven |
| 6 | Ranking + dashboard reporting | Shared rank initialisation and commercial reporting fed by live signals |

Onboarding of new **Ready** services may continue under RC1 using the locked Product Owner core. Commercial release of those services still depends on the shared publish/index/report tail above.

---

## 6. Known polish backlog (not platform blockers)

Recorded only — do not repair under this audit:

| Backlog item |
| --- |
| Nearby areas beside maps |
| Minor alignment polish |
| Minor spacing polish |
| Image library expansion |
| Mobile polish |
| CTA refinement |

---

## 7. Next platform milestone after RC1

**Milestone name:** `RC1 Commercial Release Operations`

**Scope (shared capabilities only):**

1. Prove Approve → Publish → Static deployment on the shared path  
2. Prove publish-time registry + sitemap update  
3. Prove Search Console connectivity  
4. Prove Indexing request → Index status  
5. Prove Ranking initialise → Dashboard reporting  

**Out of scope for that milestone:**

- Service content onboarding (uses Service Registration Framework)
- Content Engine / Locality Engine / Design System / Image Platform redesign
- Campaign / workflow redesign
- Feature ideation outside the commercial release capability chain

---

## 8. Audit conclusion

| Question | Result |
| --- | --- |
| Shared Product Owner core operational? | YES |
| RC1 accepted services covered by shared path? | YES |
| Further architecture work required before service onboarding? | NONE |
| Shared commercial-release operations still outstanding? | YES — publish/deploy/index/rank/report proof |

**Status:** READY FOR RC1 PLATFORM OPERATIONS
