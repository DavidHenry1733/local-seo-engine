# Wombwell v3 writing-path diagnostic export

Read-only snapshot for Product Owner review. Created 1 September 2026. No credentials, environment files, or HTTP headers. No existing attempt logs, packs, candidates, HTML, or approvals were overwritten or deleted.

Live Wombwell candidate, Darfield candidate, checkpoints, and Preview HTML are **unchanged** and are **not** the output of these four attempts (`writeRecord: false` on all four).

---

## Two-call limit — why a second draft/retry pair ran

The product brief was one draft plus one corrective retry (two provider calls). Four provider calls ran: 12:33 attempt 1, 12:33 attempt 2, 12:35 attempt 1, 12:35 attempt 2.

**Responsible function: `generateAiLocalCopyPilotV3`**  
File: `03-generation-retry-runner-and-ledger/pharmacyAiLocalNarrativeEngineV3.ts`

The two-call cap exists only as `maxAttempts` **inside a single invocation**:

```
const maxAttempts = Math.max(1, opts.maxAttempts ?? 2);
for (let attempt = 0; attempt < maxAttempts; attempt += 1) { ... }
```

That loop does not read prior attempt-log files, does not keep a durable session call budget, and does not refuse a later invocation after two calls have already been made. A second call to `generateAiLocalCopyPilotV3({ maxAttempts: 2 })` starts a **new** draft/retry pair.

`AI_LOCAL_PILOT_V3_MAX_SUCCESS` (value 3) is a **successful-generation** cap, not an attempt cap. All four of these calls failed validation, so it did not fire.

The cost precheck (`ledger.estimatedCostUsd + 0.04 >= maxCostUsd`) and `maxCostUsd: 0.20` also did not stop the second pair. After four calls the stored ledger is about **$0.053644**, remaining versus $0.20 about **$0.146**.

**Contributing function (not the cap itself): `resetAiPilotLedgerV3`** in the same file. It zeros `ledger.attempted`, `ledger.retried`, `ledger.successful` and `ledger.failed`. The outer caller used `resetAiPilotLedgerV3(0.026946)` before the 12:35 pair, which kept a cost seed but cleared the in-memory attempt counters.

**Outer caller (not product code):** `03-generation-retry-runner-and-ledger/outer-caller-wombwell-complete-from-saved-generate.ts` invoked `generateAiLocalCopyPilotV3` twice, each with `maxAttempts: 2`. That is how two pairs occurred. This export does not change that function.

This export does **not** fix the runner.

---

## Pipeline index

```
input → prompt → provider call → parsing → validation → rendering
```

### 1. Input

In-memory editorial facts passed as `opts.editorial` into `generateAiLocalCopyPilotV3`.

- Original pack on disk (three facts, not mutated): `04-source-extracts-supplied/original-editorial-pack-on-disk.json`  
  hash `9d7d4cf2cfa5841ffcb2587c1116bb16d4c91c7a8db67e5d3b34e0808c10f48d`
- Two extra accepted facts merged in memory from the complete-pilot research file: `04-source-extracts-supplied/extra-facts-from-complete-pilot.json`
- Exact object sent in the user prompt: `04-source-extracts-supplied/supplied-verified-editorial-facts.json` (identical on all four attempts)

Facts actually supplied:

1. Wombwell has a National Rail station.
2. Yorkshire Pharmacy & Health Clinic is 1.7 km from Wombwell, at 91 Snape Hill Rd, Darfield, Barnsley S73 9LR, UK.
3. NHS general practice services in Wombwell are provided from Wombwell Medical Centre.
4. Wombwell is in the Metropolitan Borough of Barnsley, South Yorkshire.
5. Wombwell has a public library.

**Not supplied:** 11,477 / 5% / 19.8% / 13.2% / semi-detached (no census year in the saved ward-profile body). See `04-source-extracts-supplied/omitted-undated-ward-statistics.json`.

Builder: `buildPharmacyAiLocalCopyInputV3` in the engine file.

### 2. Prompt

Current v3 prompt builder:

- `buildAiLocalNarrativeSystemPromptV3`
- `buildAiLocalNarrativeUserPromptV3`

File: `01-prompt-and-schema/pharmacyAiLocalNarrativePromptContractV1.ts`

Retry user suffix (attempts 2 only) is appended by `buildStructuredPilotChatRequestV3` in the engine: previous validation failures, temperature 0.3 instead of 0.4.

Exact sanitized requests are in the four files under `00-attempts/`.

### 3. Provider call

`requestStructuredPilotCopyV3` → OpenAI chat completions, model `gpt-4.1`, `response_format: json_object`. Client is `getOpenAiIntegrationClient()` (not copied; would pull unrelated generator code and env usage).

Raw responses are in each attempt log as `rawResponse`.

### 4. Parsing

`parseAiLocalCopyV3` in `01-prompt-and-schema/pharmacyAiLocalCopySchemaV1.ts`  
Schema version constant: `AI_LOCAL_COPY_SCHEMA_VERSION_V3` (`ai-local-copy-v3`).

### 5. Post-process then validation

Post-processor (not a silent rewrite of location/clinical copy):

- `enforceEditorialDisciplineV3` (engine) — strips street address if present; maps `your gp` → `a GP`.

Validators called by `validateAiLocalCopyPilotV3`:

| Function | File |
|---|---|
| `groundAiLocalCopyClaimsV3` | `02-validators-and-postprocessors/pharmacyAiLocalCopyClaimGroundingV1.ts` |
| `evaluateAiLocalCopyQualityV3` | `02-validators-and-postprocessors/pharmacyAiLocalCopyQualityV1.ts` |
| `analyseRepetitionV3` | `02-validators-and-postprocessors/pharmacyAiLocalCopyEditorialReviewV2.ts` |
| unknown `editorialFactIdsUsed` check | engine |
| `stripIdentityTokens` + `copySimilarityScore` vs previous fingerprints | uniqueness helper copied; `copySimilarityScore` lives in `pharmacyLocalClusterVariantFamilies.ts` (not copied; large unrelated module) |
| `classifySentencePurposesV2` | editorial-review file (annotation; does not add failures) |

Inside `evaluateAiLocalCopyQualityV3` / V2 / Wombwell inspect:

- `evaluateAiLocalCopyQualityV2`
- `evaluateGrammarAndFragments` and `evaluateProhibitedCustomerLanguage` (`pharmacyLocalCandidateReadabilityV1.ts`)
- `inspectLocalLandmarkHelpfulnessV3`
- `inspectWombwellHeroCopyFix`
- `inspectWombwellLocalRecognitionV3`

Attempt persistence (always, including failures): `sanitizeAiLocalAttemptPayloadV3` then `persistAiLocalAttemptLogV3`. Candidate JSON is written only if `writeRecord !== false` **and** validation passes. These four runs used `writeRecord: false`.

### 6. Rendering

**Not invoked** for these four attempts (validation failed; no candidate write).

Renderer that would run after a passing generation: `assemblePharmacyAiLocalPagePilotsV3` in `05-rendering-not-invoked/pharmacyAiLocalPagePilotAssemblerV3.ts`. Preview reads HTML from disk; authenticated Preview still shows the earlier South Area Council candidate, not this copy.

---

## The four 12:33 / 12:35 attempts

| File | Pair | Result |
|---|---|---|
| `00-attempts/2026-09-01T12-33-31-060Z-attempt-1.json` | first draft | grammar false-positive on “sits” |
| `00-attempts/2026-09-01T12-33-35-374Z-attempt-2.json` | first retry | grammar on “benefits”; generic filler (`community resources`) |
| `00-attempts/2026-09-01T12-35-39-845Z-attempt-1.json` | second draft | generic filler |
| `00-attempts/2026-09-01T12-35-43-358Z-attempt-2.json` | second retry | ungrounded “another option for support with common health concerns” |

Each file contains `sanitizedRequest` and `rawResponse`. `candidateRecordWritten` is false on all four.

---

## Cost ledger

- Stored ledger for the complete-from-saved brief: `03-generation-retry-runner-and-ledger/2026-09-01-complete-from-saved-cost-ledger.json`
- Combined note: `03-generation-retry-runner-and-ledger/CUMULATIVE-COST.json`
- In-memory ledger implementation: `resetAiPilotLedgerV3` / `getAiPilotLedgerV3` / `recordUsage` in the engine

---

## Focused tests

`06-focused-tests/validatePharmacyAiLocalEditorialEvidencePilotV3.ts`

Relevant IDs for this writing path:

- `8b-prompt-hero-leads-with-pharmacy-first`
- `8b2-prompt-brief-corrections`
- `8m-prompt-does-not-force-local-introduction`
- `8x-library-features-sentence-is-not-a-grammar-failure`
- `8x2-sits-and-benefits-are-ordinary-verbs`
- `8x3-community-resources-filler-still-fails`
- `8y-civic-such-as-library-and-medical-centre-is-not-gp-alternative`
- `8z-natural-rounding-of-supplied-population-is-not-automatic-failure`
- `16-failed-ai-validation-writes-no-pilot`
- `16e-failed-attempts-persist-sanitized-request`
- `21-replay-saved-wombwell-attempt-without-editing-response`

Last known run of this suite: 93/93 PASS (before this export; tests were not re-run here).

---

## Intentionally excluded

- `.env`, `ecosystem.config.cjs`, API keys, Bearer tokens, request headers
- Live candidate JSON/HTML, Darfield records, checkpoints, rollbacks (preserved in place, not copied)
- Full research supplement page bodies and DataForSEO payloads
- `generateClusterContent.ts` (OpenAI client host; unrelated generator surface)
- `pharmacyLocalClusterVariantFamilies.ts` (only `copySimilarityScore` is used)

---

## Download

See `DOWNLOAD.txt` in this folder.
