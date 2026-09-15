# Archived legacy local-copy writers

**Status:** audit and rollback only. Not an active production writer.

**Archived:** 2026-09-09

These files preserve the original OpenAI and multi-field local-page writer implementations and prompt contracts. They must not be imported, registered, feature-flagged, or bundled by Campaign Builder, the candidate service, or the production API server.

## Provenance

| File | Original path | Role |
| --- | --- | --- |
| `pharmacyAiLocalNarrativeEngineV1.ts` | `src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV1.ts` | V1 OpenAI JSON local-copy engine (`generateAiLocalCopyForArea`) |
| `pharmacyAiLocalNarrativeEngineV2.ts` | `src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV2.ts` | V2 OpenAI multi-field editorial pilot (`generateAiLocalCopyPilotV2`) |
| `runPharmacyAiLocalNarrativeGenerationV1.ts` | `src/pharmacy/contentEngine/runPharmacyAiLocalNarrativeGenerationV1.ts` | V1 generation runner |
| `runPharmacyAiLocalNarrativePilotV2.ts` | `src/pharmacy/contentEngine/runPharmacyAiLocalNarrativePilotV2.ts` | V2 pilot runner |
| `pharmacyAiLocalNarrativePromptContractV1.ts` | `src/pharmacy/contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts` | Snapshot of OpenAI V1/V2/V3 JSON prompt contracts at archive time |
| `pharmacyAiLocalNarrativeEngineV3.openai-multifield-snapshot.ts` | `src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts` | Snapshot of V3 while it still contained the OpenAI structured-JSON adapter |

## Production writer

Campaign Builder calls Gemini directly:

saved verified area evidence → `requestUkLocalIntroductionProseV1` → validator → `generateOneLocalPageCandidate` → Review Centre → Preview.

Do not restore these files to the live import graph without an explicit rollback decision.
