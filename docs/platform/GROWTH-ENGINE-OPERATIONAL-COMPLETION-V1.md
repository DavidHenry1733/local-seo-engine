# Growth Engine — Operational Completion Report V1

**Sprint:** Operational Completion V1  
**Feature freeze:** Active — no new platform features  
**Test tenants:** `dhmdigital` (primary), `pharmaconnect` (secondary)  
**Date:** June 2026

---

## Executive summary

The Growth Engine **7-step workflow shell is complete** and validation passes across all locked modules. This sprint focused on **operational wiring, navigation fixes, customer language, and dashboard usability** — not feature expansion.

**Operational completion status:** Partially complete. Foundation → recommendation → content creation → review → approval paths work via existing pages. Publishing, Search Console, and rank monitoring require the **legacy growth dashboard** or direct API calls — now linked from the operational dashboard.

---

## End-to-end walkthrough (dhmdigital)

| Stage | Status | Notes |
|-------|--------|-------|
| Create profile | ✅ Works | Business Intelligence + wizard at `/api/growth-engine/business-intelligence` |
| Analyse local market | ✅ Works | Google Places discovery via Local Healthcare Intelligence |
| Analyse website | ⚠️ Partial | Step exists; tenant may not have run analysis — blocks richer evidence |
| Growth Intelligence | ✅ Works | Opportunities from profile, Places, content gaps |
| Growth Plan | ✅ Works | One evidence-backed recommendation (Pharmacy First) |
| Create content | ✅ Works | Links to `/api/pharmacy-content-package` |
| Review content | ✅ Works | `/api/pharmacy-asset-review` |
| Approve content | ✅ Works | Asset review approval gates (unchanged) |
| Publish content | ⚠️ External | `/api/pharmacy-publishing-settings` — linked from dashboard tasks |
| Submit sitemap / URLs | ⚠️ External | `/api/pharmacy-indexing/:slug/register` + `/submit` — dashboard actions added |
| Monitor indexing | ⚠️ Partial | Refresh via API; simulated status when GSC not connected |
| Monitor rankings | ⚠️ Partial | Visibility refresh via API; simulated when no rank file |
| Complete Growth Cycle | ⚠️ Auto | Auto-completes when ≥3 pages indexed — no manual UI |
| Next recommendation | ✅ Works | Learning engine skips completed services |

---

## Fixes applied this sprint

### Critical / High

1. **Dashboard operational home** — “What should I do today?” with current stage, tasks, milestone, indexing/visibility summary, and API actions for register/submit/refresh.
2. **Local Market navigation** — CTA now goes to **Website Intelligence** (was skipping Step 3).
3. **Growth Intelligence website section** — Shows real Website Intelligence data when Step 3 complete; placeholders only when not run.
4. **Cycle recommendation actions** — Accept/Postpone buttons wired to existing API on dashboard.
5. **Generate step** — Customer language; review/approval status; removed raw `serviceId` from UI.
6. **Developer terminology** — “Generator available” → “Content creation ready”; removed “bridges” from dashboard; plan page copy updated.

### Medium

7. **Progress bar** — “Step X of **7**” (was 6).
8. **Growth Intelligence CTA** — “Review Growth Plan” (was misleading “Generate Campaign”).
9. **Local Market future grid** — Website Intelligence removed from “future” list.
10. **Indexing/visibility labels** — Dashboard notes when data is not yet tracked vs live tracker.

---

## Findings by severity

### Critical (require platform work outside feature freeze)

| ID | Finding | Recommendation |
|----|---------|----------------|
| C1 | **Search Console URL submission** updates local JSON status only — not live GSC Indexing API from Growth Engine | Connect existing GSC OAuth flow to dashboard submit action; label clearly when GSC not authenticated |
| C2 | **Simulated indexing/visibility** may present synthetic counts when GSC/rank data missing | Show “Estimated” badge or hide metrics until `totalRegistered > 0` / rank file exists |
| C3 | **Publishing not in Growth Engine namespace** — users must leave workflow for publish settings | Keep dashboard deep-links (done); consider unified “Publish now” when publishing module is next allowed change |

### High

| ID | Finding | Recommendation |
|----|---------|----------------|
| H1 | **Dual dashboards** — Step 7 journey vs legacy growth dashboard | Journey dashboard is now operational home; legacy linked for full analytics |
| H2 | **Generate step completion = content exists**, not reviewed/approved/published | Extend framework completion criteria when module unlock allows |
| H3 | **pharmaconnect** has insufficient profile evidence — no active Growth Cycle | Expected for empty tenant; complete profile + run intelligence steps |
| H4 | **Launch plan is advisory text** — no automated publish scheduling | Accept for V1; dashboard tasks link to publish/index actions |
| H5 | **Content package page** shows “Technical details (admin)” JSON | Hide for non-admin users in content package page (outside Growth Engine) |

### Medium

| ID | Finding | Recommendation |
|----|---------|----------------|
| M1 | **Acknowledge POST** only for steps 4, 5, 7 | Add acknowledge for steps 1–3, 6 when workflow module unlocked |
| M2 | **Dashboard `?section=` query ignored** | Remove param from router or restore section nav |
| M3 | **Auto “approved” cycle stage** without explicit user cycle approval | Distinguish plan acknowledgement from cycle acceptance (accept button added) |
| M4 | **Hardcoded plan fallback “Pharmacy First”** in legacy `buildGrowthPlanRecommendation` | Used only by opportunity engine fallback; plan page uses intelligence engine |
| M5 | **Default base URL** when profile has no website affects indexing URLs | Ensure profile website field completed in BI |

### Low

| ID | Finding | Recommendation |
|----|---------|----------------|
| L1 | Local Market “Future analysis” still shows 4 future placeholders | Accept for V1 healthcare module lock |
| L2 | Step 7 nav has no forward link | Accept — terminal step |
| L3 | Growth Intelligence missing content note still says “website not inspected” | Update copy when website complete (page-level follow-up) |

---

## Validation

```bash
npx tsx scripts/validate-growth-engine-operational-completion-v1.ts
npx tsx scripts/validate-growth-engine-framework-v1.ts
npx tsx scripts/validate-growth-engine-cycle-manager-v1.ts
npx tsx scripts/validate-growth-engine-growth-plan-v1.ts
```

All regression suites must pass after operational changes.

---

## Locked modules (unchanged)

- Business Profile Intelligence / Wizard  
- Generators / Content Engine  
- Growth Intelligence **engine**  
- Growth Plan **engine**  
- Growth Cycle Manager **core**  
- Approval gates, deployment, registry lifecycle internals  
- Dashboard analytics internals  

---

## Expected result assessment

The Growth Engine now operates as a **coherent commercial workflow** from profile through recommendation and content creation, with the dashboard answering **“What should I do today?”** and linking to existing publish/index/visibility tools.

Full end-to-end automation through Search Console and publishing **depends on existing platform modules** outside the Growth Engine HTML workflow. Those integrations are **linked but not embedded** — appropriate under Feature Freeze V1.

**Operational excellence:** Improved. **Fully autonomous end-to-end:** Blocked on C1–C3 above.
