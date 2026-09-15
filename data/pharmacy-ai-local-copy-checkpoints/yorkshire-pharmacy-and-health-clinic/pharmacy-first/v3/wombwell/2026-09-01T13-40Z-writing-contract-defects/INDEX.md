# Wombwell v3 writing-contract checkpoint — validator correction

**Status:** candidate implementation. **Not approved. Not ready. Not published.**  
Updated 1 September 2026 after leftover-token matching was removed as a factual FAIL.

Live Wombwell and Darfield pages, candidates, evidence packs, campaign builder, Review Centre and approvals were **not** changed.

Checkpoint path:

`data/pharmacy-ai-local-copy-checkpoints/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v3/wombwell/2026-09-01T13-40Z-writing-contract-defects/`

---

## Validator correction (this update)

Unmatched leftover tokens no longer establish factual FAIL.

- **FAIL:** contradiction, unsupported assertion, clinical broadening, empty local claim, malformed output, genuine duplication.
- **REVIEW REQUIRED:** uncertain paraphrase or unmatched wording after a covering fact. Blocks `validateAiLocalCopyPilotV3` (`ok` requires zero reviews).
- **PASS:** covering fact or locked clinical text established, with no extra assertion.

Synonym allow-lists were not expanded to make paraphrases pass.

Fixture results: `replay/validator-correction-cases.json`

---

## Focused tests

`npx tsx src/pharmacy/contentEngine/validatePharmacyAiLocalEditorialEvidencePilotV3.ts`

**FOCUSED TESTS PASS 104/104**

API build: PASS. `git diff --check`: PASS.

New IDs: `27`–`32` (two-area fixtures). Saved 12:33/12:35 drafts remain `ok=false`.

---

## Writing engine ready?

**No.** Validators now separate FAIL / REVIEW / PASS on fixtures. No new generation was run. Do not promote or publish.
