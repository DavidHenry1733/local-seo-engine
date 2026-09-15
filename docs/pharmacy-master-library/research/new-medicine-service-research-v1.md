# New Medicine Service — Stage 1 Research Foundation (V1)

**Document type:** Research foundation only  
**Service ID:** `new-medicine-service`  
**Category:** `nhs-clinical`  
**Benchmark process:** Pharmacy First framework (`MASTER-SERVICE-CREATION-PROCESS.md` Stage 1)  
**Benchmark document:** `emergency-contraception-research-v1.md`  
**Status:** Draft for human clinical review  
**Created:** 2026-06-22  

**Purpose:** Comprehensive clinical and patient-intent research before any master library prose is written. This document is not publish content.

---

## Source Material (Evidence Base)

| Source | Reference | Use in this document |
|--------|-----------|----------------------|
| NHS England Advanced Service Specification | Community Pharmacy Advanced Service Specification: NHS New Medicine Service (NMS) — long-read updated 21 October 2025; PDF PRN02193 v2.0 (October 2021 base, current CPCF alignment) | Pathway, eligibility, three-stage process, timing windows, consent, referral, record-keeping |
| NHS England service overview | NHS New Medicine Service — primary care pharmacy services page | Patient groups, eligible conditions summary, service delivery modes |
| Community Pharmacy England (CPE) | NMS guidance, FAQs, interview schedule, GP feedback form, pharmacist self-assessment form, contractor declaration | Operational clarifications, timing exceptions, technician scope, remote delivery |
| NHS Business Services Authority (NHSBSA) | NMS Eligible Drug List (published list per condition) | Medicine-level eligibility — not reproduced in full; referenced for master accuracy |
| Centre for Postgraduate Pharmacy Education (CPPE) | NHS New Medicine Service (NMS) e-learning programme (NMS-E-01, ~2 hours); *Consulting with people with mental health problems* for depression pathway support | Competency preparation; self-assessment alignment |
| Internal intelligence | `data/pharmacy-service-intelligence/new-medicine-service.json` | Patient benefits, features, outcomes, FAQ topics |
| Internal blueprint | `data/pharmacy-service-blueprints/new-medicine-service.json` | Concerns, myths, process steps, patient questions, booking barriers |
| Internal authority | `data/pharmacy-service-authority/new-medicine-service.json` | Professional insights, patient mistakes, myth vs fact seeds |
| Internal expertise | `data/pharmacy-service-expertise/new-medicine-service.json` | Consultation topics, content do/avoid, terminology |
| Internal expansion | `data/pharmacy-service-expansion/new-medicine-service.json` | Timeline notes, deep-dive blocks, expanded FAQ seeds |
| Internal hub seeds | `data/pharmacy-service-hubs/pharmaconnect/new-medicine-service.json` | Patient-facing FAQ themes (invitation, mandatory, follow-up) |
| Internal blueprint seeds | `src/pharmacy/pharmacyServiceBlueprintSeeds.ts` (`new-medicine-service`) | Core myths, patient intent, appointment process, clinical facts |
| Internal enrichment | `src/pharmacy/pharmacyServiceBlueprintEnrichmentSeeds.ts` | No dedicated NMS enrichment block — generic blueprint enrichment only |

**Verification note:** Clinical thresholds mapped to NHS England NMS Advanced Service Specification (October 2025 long-read update). Intervention timing: 7–14 days after patient engagement; Follow-up timing: 14–21 days after Intervention consultation (not 14–28 days after medicine start — see Section 1.4 note on patient-facing simplification). Owner-specific commissioning status (`{{nhs_new_medicine_service}}`) must be confirmed locally before publish claims. England-only scope for NHS NMS pathway.

---

## 1. SERVICE DEFINITION

### 1.1 What the service is

- NHS Advanced Service under the Community Pharmacy Contractual Framework (CPCF) — commenced October 2011; expanded October 2021 to additional therapeutic areas per CPCF 2019–2024 commitment
- Structured medicines support for patients **newly prescribed eligible medicines** for **eligible long-term conditions** — not all new prescriptions
- Three-stage process: **(1) Patient engagement**, **(2) Intervention consultation**, **(3) Follow-up consultation**
- Delivered by **GPhC-registered pharmacists only** for Intervention and Follow-up stages (support staff may book appointments, prepare forms, transcribe — not conduct clinical consultations)
- Focus: improve adherence, identify side effects and usage problems early, supplement prescriber information, enable GP/prescriber referral when needed
- Voluntary for patients — informed verbal consent required; declining does **not** affect entitlement to prescribed medicines
- Delivery modes: in-person in private consultation room (`{{consultation_room}}`), remote via telephone/live audio/live video, or in patient's home (with safeguarding/DBS/indemnity requirements)
- Text-based communication may **support** but not **replace** live consultations
- GP/prescriber feedback when pharmacist judges prescriber or PCN clinical pharmacist intervention required — NMS GP Feedback form (CPE)
- NMS interview schedule guides Intervention and Follow-up consultations (CPE)
- Links with NHS Discharge Medicines Service — hospital may signpost/refer eligible patients
- Opportunistic healthy living advice may be offered during service
- **Not** a dose-change service — pharmacist cannot alter prescribed doses; refers concerns to prescriber
- **Not** an emergency service — red-flag symptoms require 999/GP/urgent care
- Private paid "NMS equivalent" is not a nationally defined NHS pathway; private medication counselling or structured reviews may exist separately at owner discretion — distinct from commissioned NHS NMS

### 1.2 NHS pathway — New Medicine Service (England)

**Service name (official):** NHS New Medicine Service (NMS)

**Commissioning:** Advanced Service under CPCF. Pharmacy contractor must notify local ICB via NMS Pharmacy Contractor Declaration Form (CPE). Not automatically active at every pharmacy — contractor must opt in and meet requirements.

**Primary purpose:**
- Support patients and carers managing newly prescribed medicines for eligible conditions
- Increase effective medicine-taking during critical early weeks (30–50% of prescribed medicines not taken as recommended nationally)
- Early identification of adverse reactions, adherence problems, and information gaps
- Reduce medicines wastage, avoidable hospital admissions, and early treatment discontinuation
- Promote multidisciplinary working with GP practice and PCN clinical pharmacists

**Inclusion criteria (NHS NMS):**
- Patient prescribed a **new medicine** on the NHSBSA NMS Eligible Drug List for a corresponding **eligible condition**
- Patient (or carer/parent/guardian where patient cannot consent) gives informed verbal consent
- Patient engagement occurs after prescribing/dispensing of eligible new medicine
- Depression pathway: patient must be **≥18 years** (only condition with age restriction)
- Multiple new eligible medicines prescribed at the same time: **one NMS episode covers all** — not separate episodes per medicine
- Valid NHS prescription from any prescriber in England (not limited to GP-only prescriptions per CPE FAQs)
- Patients not registered with a GP may receive NMS — pharmacist should encourage GP registration and feed back clinically relevant information to prescriber with consent

**Exclusion criteria / when NMS is generally not appropriate:**
- Medicine or condition **not** on NMS eligible lists
- **Formulation change only** (e.g. tablet to capsule of same medicine) — generally excluded unless pharmacist documents professional rationale that patient would benefit
- Patient declines consent
- Emergency or red-flag presentation requiring urgent medical care rather than structured medicines support
- Patient already received NMS for the same medicine episode recently (service rules on repeat episodes — confirm current NHSBSA/CPE guidance at publish)
- Distance selling pharmacy (from 1 October 2025): in-person face-to-face consultations at premises not permitted — remote/home delivery modes apply

**Pharmacy cannot (under NMS specification):**
- Change prescribed doses or stop/start medicines without prescriber involvement
- Replace GP or specialist for diagnosis, long-term condition management, or dose titration
- Conduct Intervention/Follow-up consultations via text-only questionnaire
- Delegate clinical consultations to pharmacy technicians or non-pharmacist staff
- Guarantee adherence or clinical outcome — support service only
- Provide NMS for ineligible medicines/conditions even if patient requests it
- Sub-contract NMS delivery to third parties outside employment/group rules

**Eligible conditions (18 — NHS England Section 5.7):**

1. Acute coronary syndromes  
2. Asthma  
3. Atrial fibrillation  
4. Chronic obstructive pulmonary disease (COPD)  
5. Coronary heart disease  
6. Depression (≥18 years only)  
7. Diabetes (Type 2)  
8. Epilepsy  
9. Glaucoma  
10. Gout  
11. Heart failure  
12. Hypercholesterolaemia  
13. Hypertension  
14. Long-term risks of venous thromboembolism/embolism  
15. Osteoporosis  
16. Parkinson's disease  
17. Stroke/transient ischaemic attack  
18. Urinary incontinence/retention  

**Eligible medicines:** Published per condition on NHSBSA website (NMS Eligible Drug List). Internal seeds commonly reference: asthma/COPD inhalers, antihypertensives, type 2 diabetes medicines, anticoagulants/antiplatelets, heart failure medicines, mental health medicines — master content must reference national list, not invent local formularies.

### 1.3 Private service variants (typical UK pharmacy)

- **No national "private NMS" advanced service** equivalent to NHS NMS
- Pharmacies may offer **private medication counselling**, **structured medicine reviews**, or **adherence support** for fee — outside NHS claiming
- Private reviews may cover broader medicine types but lack NHS NMS governance, claiming, and specification compliance
- Owner may offer enhanced follow-up for private patients — document separately from NHS NMS claims
- Fee-based support (`{{private_medicines_counselling_fee}}`) where owner chooses — must not be marketed as NHS NMS unless commissioned pathway followed
- NHS NMS remains **free to eligible patients** where pharmacy delivers commissioned service

### 1.4 Typical appointment structure

**Stage 1 — Patient engagement (at or around first supply):**
1. Eligible new prescription identified at dispensing (or referral/signpost from GP, hospital, Discharge Medicines Service)
2. Initial medicine counselling as part of **Dispensing Essential Service**
3. Patient given NMS information (verbal, leaflet, or web link)
4. Informed verbal consent sought and recorded
5. Consent covers service delivery and information sharing (GP if needed; NHS England monitoring; NHSBSA post-payment verification)
6. Agree method and time for Intervention consultation — **7 to 14 days after patient engagement**

**Stage 2 — Intervention consultation (~7–14 days after engagement):**
1. Pharmacist reconfirms patient understands service and wishes to continue
2. Consultation in consultation room, remotely (phone/live audio/video), or patient home
3. Assess adherence, identify problems, determine information/support needs — **NMS interview schedule**
4. Provide advice and agree next step:
   - **No problems / adhering:** schedule Follow-up **14–21 days after this Intervention**
   - **Problems, no prescriber intervention needed:** agree remedial steps; schedule Follow-up **14–21 days after Intervention**
   - **Problems, prescriber/PCN clinical pharmacist intervention needed:** explain, refer via local pathway/NMS GP Feedback form; service may complete at Intervention if single medicine; multi-medicine episodes may continue Follow-up for non-referred medicines
5. If missed Intervention: at least one recontact attempt; if still no contact — record incomplete, patient exits, no Intervention payment claim

**Stage 3 — Follow-up consultation (14–21 days after Intervention):**
1. Reassess adherence and problems using NMS interview schedule
2. Provide further advice; agree completion step:
   - **No problems:** service complete, patient exits
   - **Problems, remedial steps sufficient:** service complete
   - **Prescriber intervention needed:** refer with GP Feedback form; service complete
3. If missed Follow-up: at least one additional recontact attempt; if still no contact — record incomplete, no Follow-up payment claim

**Timing note for master authors:** Internal expansion seeds simplify as "Day 7–14: initial discussion; Day 14–28: follow-up review" from medicine start. **Specification-accurate framing:** Intervention 7–14 days after **engagement**; Follow-up 14–21 days after **Intervention** (total window from engagement approximately 21–35 days). Patient-facing copy may use rounded language if specification caveat is preserved in clinical review.

**Typical consultation duration:** ~10–30 minutes per Intervention or Follow-up (internal hub seeds); complexity varies by condition, device technique, and problems identified

**Staff:** GPhC-registered pharmacist with completed NMS self-assessment form (CPE) — CPPE NMS e-learning (NMS-E-01) recommended preparation

---

## 2. PATIENT INTENT

### 2.1 Why patients encounter NMS

- Pharmacy identifies eligible new prescription at dispensing and offers structured follow-up
- GP or hospital signposts/referrals after new prescription (including post-discharge)
- Patient receives invitation call, text, or leaflet in prescription bag
- Carer/parent contacted for child or patient unable to consent independently
- Patient proactively asks pharmacy about support after starting difficult new medicine
- Repeat pharmacy relationship — patient trusts pharmacist for medicines questions
- GP appointment pressure — patient prefers pharmacy follow-up for early medicines issues
- Uncertainty about inhaler, device, or complex dosing schedule after first collection
- Side effects emerge in first 1–2 weeks — patient returns or responds to follow-up contact
- Mental health medicine initiation — patient wants confidential medicines support

### 2.2 Common triggers

- First collection of new asthma inhaler, blood pressure tablet, diabetes medicine, anticoagulant, or antidepressant (≥18)
- Hospital discharge with new long-term medicine — Discharge Medicines Service handover to community pharmacy
- Prescription bag leaflet: "You may be contacted about the New Medicine Service"
- Pharmacy phone call 7–14 days after starting medicine
- Mild side effects (nausea, cough with inhaler, dizziness on antihypertensive) prompting patient to ask pharmacist
- Confusion about whether to take medicine with food, morning/evening timing, or missed doses
- Family member or carer notices patient not taking medicine as intended
- Work schedule conflict — patient wants to reschedule follow-up to phone slot
- Online search: "Why is my pharmacy calling about my new medicine?"

### 2.3 Common concerns (intent-level)

- "Why am I being contacted — is something wrong with my prescription?"
- "Do I have to take part — will it affect my medicine if I say no?"
- "Is this a sales call or NHS service?"
- "Will the pharmacist tell my GP I'm not taking my antidepressant?"
- "I feel fine — why do I need a follow-up?"
- "I don't have time for pharmacy appointments"
- "Can the pharmacist change my dose if I'm getting side effects?"
- "Is this free — I don't want unexpected charges"
- "Which medicines qualify — mine is new but is it included?"
- "Embarrassment discussing mental health medicines with pharmacy staff"
- "Privacy — will other customers hear the conversation?"
- "I'm stopping the medicine anyway — do I still need NMS?"
- "Confusion between NMS, MUR (Medicines Use Review), and medication review"

### 2.4 Typical motivations

- Understand new treatment clearly — what it does, when benefit expected, common side effects
- Get inhaler or device technique checked early
- Resolve mild side effects without waiting weeks for GP appointment
- Free NHS support where pharmacy delivers commissioned NMS (`{{nhs_new_medicine_service}}`)
- Convenient phone follow-up fitting work/life (`{{opening_hours}}`, `{{phone}}`)
- Avoid medicines waste and early discontinuation
- Honest conversation about adherence barriers without judgment
- Early GP referral if pharmacist identifies serious concern
- Carer support — parent managing child's new epilepsy or asthma medicine
- Confidence to continue long-term treatment successfully

---

## 3. PATIENT QUESTIONS (Raw Research List)

**Format note:** Questions only. Not written as publish FAQs. **Count: 58**.

### 3.1 Eligibility and invitation

1. Why have I been invited to the New Medicine Service?
2. Is NMS mandatory — do I have to take part?
3. Which medicines qualify for NMS?
4. Does my new prescription qualify for NMS?
5. I was prescribed more than one new medicine — do I get multiple NMS episodes?
6. Is NMS only for GP prescriptions or any NHS prescription?
7. Can I get NMS if I'm not registered with a GP?
8. Does NMS apply to hospital discharge medicines?
9. I'm under 18 and started an antidepressant — am I eligible?
10. My medicine is a different brand but same drug — does NMS still apply?
11. Can I get NMS if I had this medicine before but stopped it?
12. Is NMS available at every pharmacy?
13. Who decides if my medicine is on the eligible list?

### 3.2 Appointments and timing

14. When will the pharmacy contact me after I start my medicine?
15. What happens at the first NMS conversation?
16. What happens at the follow-up call or appointment?
17. How long does each NMS consultation take?
18. Do I need an appointment or will the pharmacy call me?
19. Can NMS be done over the phone?
20. Can I have a video consultation for NMS?
21. Can the pharmacist visit me at home for NMS?
22. What if I'm on holiday when the follow-up is due?
23. What if I miss the pharmacy's call?
24. Can I reschedule NMS to a time that suits me?
25. Why is follow-up 7–14 days after starting — why not immediately?
26. How many conversations are there in total?

### 3.3 What happens during NMS

27. What questions will the pharmacist ask?
28. Will the pharmacist check my inhaler technique?
29. Can the pharmacist change my dose if I'm getting side effects?
30. Will the pharmacist stop my medicine if it's not working?
31. What if I haven't started taking the medicine yet?
32. What if I've already stopped because of side effects?
33. Will my GP be told about the NMS conversation?
34. Is NMS confidential?
35. Can someone attend with me — carer or family member?
36. Can I request a private consultation room?

### 3.4 Side effects and adherence

37. What side effects should I expect with my new medicine?
38. When should I worry about side effects and call my GP?
39. What if the medicine makes me feel worse?
40. Is it normal to want to stop a new medicine in the first week?
41. What if I forget doses — should I double up?
42. How long before my new medicine starts working?
43. What if I can't afford to collect repeat prescriptions?

### 3.5 NHS, cost, and access

44. Is the New Medicine Service free on the NHS?
45. What's the difference between NMS and a private medication review?
46. Does NMS count toward my prescription charges?
47. Will declining NMS affect my future prescriptions?
48. Is NMS the same as a Medicines Use Review (MUR)?
49. Do I need to register with the pharmacy for NMS?

### 3.6 Conditions and medicine-specific

50. Does NMS cover my new blood pressure medicine?
51. Does NMS cover warfarin or DOAC anticoagulants?
52. Does NMS cover insulin for type 2 diabetes?
53. Does NMS cover my new inhaler for asthma or COPD?
54. Does NMS cover epilepsy medicines?
55. What support is available for new antidepressants?

### 3.7 Safety and scope

56. What symptoms mean I need urgent help instead of waiting for NMS?
57. Should I go to A&E for side effects from a new medicine?
58. What if the pharmacist can't help — what happens next?

---

## 4. PATIENT CONCERNS (Raw Research List)

**Count: 24**

1. Unsolicited pharmacy contact feels intrusive or alarming — "Is something wrong?"
2. Fear that declining NMS will affect prescription supply or GP relationship
3. Belief NMS is mandatory NHS requirement
4. Time burden — inconvenient follow-up calls during work hours
5. Embarrassment discussing mental health medicines (depression, anxiety) at pharmacy
6. Worry pharmacist will report non-adherence to GP without warning
7. Privacy concern — consultation overheard on pharmacy floor or phone in public space
8. Uncertainty whether service is genuinely NHS or commercial upselling
9. "I feel fine" — belief follow-up is unnecessary if no obvious symptoms
10. Confusion about inhaler technique — shame admitting incorrect use
11. Side effects causing desire to stop medicine silently without telling anyone
12. Anxiety that pharmacist will pressure continued use despite intolerable side effects
13. Confusion between NMS, MUR, Pharmacy First, and GP medication review
14. Concern service not available at local pharmacy (`{{nhs_new_medicine_service}}`)
15. Language or health literacy barriers understanding medicines information
16. Carer burden — coordinating NMS for elderly parent with hearing impairment
17. Remote consultation discomfort — prefer face-to-face but pharmacy pushes phone
18. Distrust after previous bad pharmacy experience
19. Worry about data sharing with NHS England/NHSBSA monitoring
20. Multiple new medicines overwhelming — fear of confusing advice
21. Belief GP should handle all new medicine questions — pharmacy feels "not proper"
22. Missing calls and fear of being removed from treatment pathway
23. Home delivery pharmacy — uncertainty how NMS works without visiting premises
24. Condition stigma (incontinence, mental health) — reluctance to engage openly

---

## 5. CLINICAL FACTS

### 5.1 Evidence base and service impact

- 30–50% of prescribed medicines not taken as recommended — significant adherence gap across long-term conditions (NHS England service background)
- NMS is evidence-based — pharmacist intervention at medicine initiation with short-term follow-up increases adherence vs normal practice, with health gain and cost benefits (NHS England Section 1.6)
- Non-adherence often hidden — patients decide early whether to continue new medicines
- Service expanded October 2021 beyond original four condition areas (asthma/COPD, type 2 diabetes, antihypertension, antiplatelet/anticoagulant) to 18 conditions

### 5.2 Three-stage pathway summary

| Stage | Timing | Who delivers | Purpose |
|-------|--------|--------------|---------|
| Patient engagement | At/around first supply | Pharmacy staff (recruitment/consent) | Information, consent, schedule Intervention |
| Intervention consultation | 7–14 days after engagement | Pharmacist only | Adherence assessment, problem identification, advice, schedule Follow-up or refer |
| Follow-up consultation | 14–21 days after Intervention | Pharmacist only | Reassessment, completion, remedial advice, or prescriber referral |

**Exceptional timing:** Outside stated windows only for documented exceptional circumstances (e.g. patient holiday) with pharmacist professional judgment — must be recorded in clinical record (CPE FAQs)

### 5.3 Consent and information governance

- Informed **verbal consent** required before service — recorded in pharmacy clinical record
- Patient advised of GP information sharing if clinically needed; NHS England monitoring; NHSBSA post-payment verification
- Carer/parent/guardian consent where patient cannot consent (children, incapacity)
- National care record / local clinical records may be checked with consent where appropriate
- Records retained per Records Management Code; PPV records minimum 3 years from episode closure

### 5.4 Consultation delivery requirements

- Face-to-face in consultation room with IT for contemporaneous records (standard premises)
- Remote: telephone, live audio link, or live video — pharmacist may deliver from pharmacy or other location (e.g. home working) per CPE FAQs
- Text messaging/questionnaires **cannot replace** live consultations
- From 1 October 2025: distance selling pharmacies cannot provide in-person face-to-face consultations at premises
- Home visits permitted with DBS, safeguarding, indemnity, and commissioner evidence on request

### 5.5 Pharmacist competency and training

- Pharmacist must complete **NMS self-assessment form** (CPE) declaring competence — copy retained by contractor (not sent to ICB)
- CPPE **NMS e-learning (NMS-E-01)** — ~2 hours, supports competence gaps
- For depression pathway: CPPE *Consulting with people with mental health problems* recommended additional preparation
- SOP required covering eligibility, escalation, record-keeping, staff training
- Consultations **pharmacist-only** — technicians may support admin/booking/transcription

### 5.6 Intervention outcomes and GP referral

**At Intervention, pharmacist agrees one of:**
1. Adhering, no problems → schedule Follow-up (14–21 days post-Intervention)
2. Problems, no prescriber intervention needed → remedial steps + schedule Follow-up
3. Problems, prescriber/PCN clinical pharmacist intervention needed → explain, refer (NMS GP Feedback form); episode may complete if single medicine

**At Follow-up, pharmacist agrees one of:**
1. Adhering, no problems → complete service
2. Problems, remedial steps agreed → complete service
3. Prescriber intervention needed → refer and complete service

### 5.7 Common clinical focus areas by condition group

| Condition group | Typical NMS focus |
|-----------------|-------------------|
| Asthma/COPD inhalers | Device technique, actuation, spacer use, mouth rinsing, cough, when to seek review |
| Hypertension | Timing, dizziness, ankle swelling, persistence despite side effects, home BP if relevant |
| Type 2 diabetes (non-insulin and insulin) | Hypoglycaemia awareness, timing with meals, sick-day rules signposting, GI side effects (metformin) |
| Anticoagulants/antiplatelets | Bleeding signs, interactions, adherence importance, missed dose rules per product |
| Heart failure | Weight monitoring signposting, diuretic effects, fatigue vs deterioration |
| Depression (≥18) | Onset delay (2–4+ weeks), withdrawal/not stopping abruptly, mood worsening, suicidal ideation red flags |
| Epilepsy | Adherence critical, seizure frequency changes, alcohol/interaction signposting |
| Hypercholesterolaemia | Muscle pain (statin), when to report, lifestyle linkage |
| Osteoporosis | Administration instructions (bisphosphonates), GI irritation, calcium/vitamin D signposting |

### 5.8 Formulation changes and repeat episodes

- Formulation change alone generally **not** appropriate for NMS — low clinical value
- Pharmacist may document professional rationale if patient would benefit despite formulation change
- If multiple medicines started simultaneously — **one NMS episode** for all eligible medicines

### 5.9 Relationship to other pharmacy services

| Service | Relationship to NMS |
|---------|---------------------|
| Dispensing Essential Service | Initial counselling at supply; NMS builds on this |
| Discharge Medicines Service | Hospital may refer into NMS for eligible discharge medicines |
| MUR / Structured Medication Review | Different service — NMS is time-limited new-medicine support |
| Pharmacy First | Acute conditions — not substitute for NMS adherence pathway |
| Medication Reviews (owner content) | May complement after NMS episode completes |

---

## 6. RED FLAGS

### 6.1 Urgent medical review required (999 / same day)

**999 / A&E:**
- Anaphylaxis or severe allergic reaction to new medicine — swelling, breathing difficulty, collapse
- Severe asthma/COPD exacerbation — unable to speak sentences, blue lips, no relief from rescue inhaler
- Suspected stroke — FAST symptoms
- Chest pain suggestive of ACS
- Severe bleeding on anticoagulants — vomiting blood, melaena, haematuria, uncontrolled epistaxis
- Suicidal ideation with plan/intent (mental health medicines) — crisis pathway
- Status epilepticus or prolonged seizure
- Diabetic emergency — confused, unable to wake, suspected DKA or severe hypoglycaemia unresponsive to treatment
- Severe angioedema (ACE inhibitor)

**Same-day GP / urgent care:**
- Moderate side effects requiring prescriber review — severe rash, significant GI intolerance, mood deterioration on antidepressants
- No clinical improvement where urgent review indicated per condition pathway
- Patient stopped medicine due to perceived serious reaction — needs prescriber assessment
- Worsening heart failure symptoms — increasing breathlessness, rapid weight gain
- New neurological symptoms on medicines (e.g. statin myopathy with functional limitation)

### 6.2 Referral required (non-emergency but mandatory within NMS)

- Pharmacist judges **prescriber or PCN clinical pharmacist intervention required** — NMS GP Feedback form / local pathway
- Problems outside pharmacist remedial scope — dose adjustment, medicine switch, diagnostic uncertainty
- Suspected medicine not tolerated — patient wants to stop — GP/prescriber review needed (pharmacist supports but does not unilaterally stop)
- Adherence barriers requiring prescriber-led simplification of regimen
- Patient not registered with GP — encourage registration; feed back clinically relevant information to prescriber

### 6.3 When pharmacy NHS NMS is NOT appropriate

- Medicine/condition not on eligible lists
- Patient declines consent
- Formulation-only change without documented pharmacist rationale
- Red-flag symptoms requiring emergency/urgent care take priority over scheduled NMS
- Patient unable to participate and no carer consent available
- Incomplete contact after missed Intervention/Follow-up — episode ends incomplete (may re-engage on future eligible prescription per rules)

### 6.4 When private medication support may proceed but with limits

- Owner offers fee-based medicines counselling (`{{private_medicines_counselling_fee}}`) outside NHS NMS
- Same professional standards expected — cannot claim NHS NMS payment without specification compliance
- Broader medicine types possible privately but must not mislabel as NHS NMS
- GP referral and safety-netting still required for clinical concerns

---

## 7. MYTHS (Real Misconceptions Only)

**Count: 24**

| # | Misconception | Research correction (not publish prose) |
|---|---------------|----------------------------------------|
| 1 | NMS is mandatory — declining affects my prescription | NMS is voluntary; declining does not affect entitlement to prescribed medicines (authority seeds, CPE) |
| 2 | NMS applies to every new prescription | Only eligible medicines for 18 listed conditions on NHSBSA list |
| 3 | The pharmacist can change my dose during NMS | Dose changes require prescriber; pharmacist advises and refers |
| 4 | NMS replaces my GP for this condition | NMS supports early weeks; ongoing management remains with GP/prescriber |
| 5 | If I feel fine, I can skip follow-up | Problems like poor inhaler technique may be silent; follow-up catches early failure |
| 6 | Every pharmacy automatically offers NMS | Contractor must declare and deliver commissioned advanced service |
| 7 | NMS is the same as a Medicines Use Review (MUR) | Different NHS services — NMS is time-limited new-medicine support |
| 8 | Pharmacy technicians conduct NMS clinical consultations | Intervention and Follow-up are pharmacist-only (CPE FAQs) |
| 9 | NMS can be completed by text questionnaire | Live face-to-face or remote audio/video required — text supports only |
| 10 | Multiple new medicines mean multiple NMS episodes | One episode covers all eligible medicines prescribed together |
| 11 | Brand change or formulation switch always triggers NMS | Formulation changes generally excluded unless documented pharmacist rationale |
| 12 | Only GP prescriptions qualify | Any valid NHS prescription for eligible medicine (CPE FAQs) |
| 13 | NMS is a private paid service | NHS NMS is free to eligible patients at participating pharmacies |
| 14 | Stopping my new medicine without telling anyone is fine | Stopping without advice risks harm; discuss with pharmacist or GP first |
| 15 | Side effects always mean the medicine is wrong — stop immediately | Many side effects settle; prescriber review needed before stopping some medicines |
| 16 | Inhaler technique doesn't matter if I feel okay | Poor technique common cause of perceived treatment failure |
| 17 | NMS is only for elderly patients | Any eligible patient starting eligible new medicine — including working-age adults |
| 18 | GP will automatically be told everything without my consent | Consent process explains GP sharing when clinically needed |
| 19 | Reading the leaflet means I don't need NMS | Personalised assessment identifies individual adherence and technique issues |
| 20 | Hospital never refers to NMS | Discharge Medicines Service and secondary care signposting are recognised pathways |
| 21 | NMS happens in one visit | Three stages over weeks — engagement, Intervention, Follow-up |
| 22 | NMS guarantees I will keep taking my medicine | Support service — improves odds but cannot guarantee adherence |
| 23 | Private medication chat is the same as NHS NMS | Private counselling lacks NHS NMS specification, claiming, and national eligibility rules |
| 24 | If I miss the call, I lose my prescription | Missed contact may end incomplete NMS episode — does not remove prescription entitlement |

---

## 8. TRUST FACTORS

- GPhC-registered premises and regulated pharmacists
- NHS commissioned Advanced Service with national specification compliance
- Pharmacist NMS self-assessment and CPPE-supported competence
- Private consultation room or confidential remote consultation (`{{consultation_room}}`)
- Structured NMS interview schedule — consistent clinical approach
- Voluntary service — patient choice respected without penalty
- Clear consent process including information sharing transparency
- GP/prescriber feedback pathway when clinical concerns identified — NMS GP Feedback form
- Evidence-based service with demonstrated adherence benefits
- Non-judgmental exploration of adherence problems and side effects
- Device technique demonstration for inhalers and complex medicines
- Integration with Discharge Medicines Service and wider NHS pathways
- SOP, clinical governance, and patient safety incident reporting
- Professional indemnity cover
- Flexible contact methods — phone, video, in-person (`{{phone}}`, `{{booking_link}}`)
- Free NHS service where eligible (`{{nhs_new_medicine_service}}`)
- Documented clinical records for continuity of care

---

## 9. LOCAL PHARMACY ADVANTAGES

- Same pharmacy that dispensed medicine provides structured follow-up — continuity
- High street access — no GP appointment needed for early medicines support
- Phone follow-up often available — fits working hours better than surgery visits
- Extended pharmacy opening hours vs GP (`{{opening_hours}}`)
- Medicines specialist expertise — pharmacists focus on practical adherence and technique
- Early problem detection before treatment failure or hospital admission
- Free NHS NMS where commissioned (`{{nhs_new_medicine_service}}`)
- Inhaler technique checks with physical demonstration in consultation room
- Carer-friendly — parent/guardian involvement where consent requires
- Links to related services — prescription dispensing, repeat prescriptions, medication reviews, blood pressure checks
- Local familiarity — trusted community healthcare setting
- Opportunistic healthy lifestyle signposting during NMS contacts

**Caveats:** Not every pharmacy delivers NHS NMS; eligible medicine list is national not pharmacy-defined; pharmacist cannot change doses; remote-only limitations at distance selling pharmacies from October 2025.

---

## 10. OWNER VARIABLES

| Variable | Purpose |
|----------|---------|
| `{{phone}}` | Follow-up scheduling, rescheduling, medicines questions between contacts |
| `{{opening_hours}}` | When in-person NMS consultations available |
| `{{booking_link}}` | Online booking for in-pharmacy Intervention/Follow-up if offered |
| `{{consultation_room}}` | Private confidential consultation facility |
| `{{nhs_new_medicine_service}}` | NHS NMS actively delivered at this pharmacy (yes/no) |
| `{{nms_medicine_groups}}` | Owner confirmation of active NMS delivery — not a substitute for national eligible list |
| `{{private_medicines_counselling_fee}}` | Private non-NHS medicines support fee if offered |

**Additional owner fields for Stage 2:** NMS contractor declaration status, remote vs face-to-face preference, home visit availability, languages, GP notification practice, Discharge Medicines Service integration, pharmacy delivery patient NMS workflow.

---

## 11. PATIENT EMOTIONS (Stage 1 Enhancement)

**Format:** Research notes only. Not publish copy.

### 11.1 Surprise at unsolicited contact

| Field | Research note |
|-------|---------------|
| **Trigger** | Unexpected pharmacy call 7–10 days after starting medicine |
| **Patient concern** | "Is there a problem with my prescription?" |
| **Typical behaviour** | Cautious response; may ignore call; asks if something is wrong before engaging |
| **Common questions** | Why are you calling? / Did the doctor tell you something? / Is my medicine wrong? |

### 11.2 Annoyance at time burden

| Field | Research note |
|-------|---------------|
| **Trigger** | Work hours clash; repeated scheduling attempts |
| **Patient concern** | "I don't have time for another appointment" |
| **Typical behaviour** | Short answers; requests to defer; may decline service |
| **Common questions** | How long will this take? / Can we do this quickly by phone? / Do I really need this? |

### 11.3 Anxiety about side effects

| Field | Research note |
|-------|---------------|
| **Trigger** | Nausea, dizziness, cough, fatigue after starting medicine |
| **Patient concern** | "Is this normal or dangerous?" |
| **Typical behaviour** | Seeks reassurance; may have already stopped medicine; worried about calling GP |
| **Common questions** | Should I stop taking it? / Will this go away? / When should I worry? |

### 11.4 Embarrassment about mental health medicines

| Field | Research note |
|-------|---------------|
| **Trigger** | New antidepressant or mental health medicine; pharmacy follow-up |
| **Patient concern** | Stigma; fear of being overheard; GP finding out about non-adherence |
| **Typical behaviour** | Minimises problems; prefers phone; reluctant to admit missed doses |
| **Common questions** | Is this confidential? / Will you tell my GP I'm not taking it? / Can I speak privately? |

### 11.5 Overwhelm with multiple new medicines

| Field | Research note |
|-------|---------------|
| **Trigger** | Post-discharge or complex regimen — several new tablets |
| **Patient concern** | Cannot track timing; fear of interactions |
| **Typical behaviour** | Confused answers; carer intervenes; requests written schedule |
| **Common questions** | Which order do I take them? / Can I take them all together? / What if I forget one? |

### 11.6 Shame about incorrect inhaler technique

| Field | Research note |
|-------|---------------|
| **Trigger** | Pharmacist asks to demonstrate inhaler use |
| **Patient concern** | "I should know this already" — embarrassment |
| **Typical behaviour** | Avoids demonstration; insists they know how; may have poor technique silently |
| **Common questions** | Does technique really matter? / I've used inhalers for years — why check now? |

### 11.7 Distrust of commercial motive

| Field | Research note |
|-------|---------------|
| **Trigger** | Belief pharmacy wants to sell products or keep patient dependent |
| **Patient concern** | NMS is upselling not clinical care |
| **Typical behaviour** | Hostile or dismissive; compares unfavourably to GP |
| **Common questions** | Is this free? / Are you trying to sell me something? / Why doesn't my doctor do this? |

### 11.8 Relief when problems resolved early

| Field | Research note |
|-------|---------------|
| **Trigger** | Technique corrected or side effect normalised with clear plan |
| **Patient concern** | Converts from scepticism to appreciation |
| **Typical behaviour** | Engaged; asks further questions; completes Follow-up willingly |
| **Common questions** | So I should keep taking it? / When will I feel better? / Can I call you if it gets worse? |

### 11.9 Fear of GP notification

| Field | Research note |
|-------|---------------|
| **Trigger** | Consent information mentions GP sharing |
| **Patient concern** | GP will think patient is non-compliant or difficult |
| **Typical behaviour** | Withholds non-adherence information; asks what gets reported |
| **Common questions** | Will my GP be told? / What exactly do you send them? / Can I say no to GP contact? |

### 11.10 Reluctance to admit non-adherence

| Field | Research note |
|-------|---------------|
| **Trigger** | Pharmacist asks if medicine taken as directed |
| **Patient concern** | Judgment; fear of consequences |
| **Typical behaviour** | Says "yes" when missing doses; minimises reasons (cost, forgetfulness, side effects) |
| **Common questions** | Does it matter if I miss a few days? / Will you tell my doctor if I haven't started? |

---

## 12. NMS ELIGIBLE CONDITIONS & MEDICINE GROUPS KNOWLEDGE (Stage 1 Enhancement)

**Format:** Evidence-based research notes. Not advice copywriting. Section maps 18 eligible conditions, representative medicine groups, and NMS stage timing per NHS England specification and NHSBSA eligible drug list.

### 12.1 Respiratory — asthma and COPD

| Field | Research note |
|-------|---------------|
| **Eligible conditions** | Asthma; COPD |
| **Representative medicines** | SABA, SAMA, ICS, ICS/LABA, LAMA, LABA (per NHSBSA list) |
| **NMS focus** | Inhaler/device technique; spacer use; rinsing mouth after ICS; distinguishing rescue vs preventer; when to seek urgent review |
| **Common early problems** | Incorrect actuation; no symptom relief due to technique not drug failure; oral candidiasis; cough |
| **Referral triggers** | Frequent rescue use; no improvement; breathing deterioration |
| **Stage timing** | Engagement at supply; Intervention day 7–14; Follow-up 14–21 days post-Intervention |

### 12.2 Cardiovascular — hypertension, heart failure, ACS, CHD, AF, stroke/TIA, VTE risk

| Field | Research note |
|-------|---------------|
| **Eligible conditions** | Hypertension; heart failure; acute coronary syndromes; coronary heart disease; atrial fibrillation; stroke/TIA; long-term VTE/embolism risk |
| **Representative medicines** | ACE inhibitors, ARBs, beta-blockers, calcium channel blockers, diuretics, antiplatelets, anticoagulants (per NHSBSA list) |
| **NMS focus** | Timing; dizziness; cough (ACEi); bleeding awareness (anticoagulants); ankle swelling; adherence importance post-event |
| **Common early problems** | Dizziness leading to missed doses; perceived lack of benefit (asymptomatic hypertension); GI upset |
| **Referral triggers** | Symptomatic hypotension; significant bleeding; worsening angina/breathlessness |
| **Pharmacy role** | Support adherence early; cannot adjust doses — refer |

### 12.3 Metabolic — type 2 diabetes

| Field | Research note |
|-------|---------------|
| **Eligible condition** | Type 2 diabetes only (not type 1 as separate condition label) |
| **Representative medicines** | Metformin, SGLT2 inhibitors, GLP-1 agonists, sulfonylureas, insulin (per NHSBSA list) |
| **NMS focus** | GI side effects; hypoglycaemia awareness (SU/insulin); sick-day rules signposting; injection technique if insulin |
| **Common early problems** | Metformin GI intolerance; fear of injections; confusion about monitoring |
| **Referral triggers** | Recurrent hypoglycaemia; suspected DKA symptoms — urgent |

### 12.4 Mental health — depression (≥18)

| Field | Research note |
|-------|---------------|
| **Eligible condition** | Depression — **≥18 years only** |
| **Representative medicines** | SSRIs, SNRIs, other antidepressants on NHSBSA list |
| **NMS focus** | Delayed onset; do not stop abruptly; mood monitoring; suicidal ideation safety-netting; CPPE mental health consultation skills |
| **Common early problems** | Initial anxiety/restlessness; GI upset; wanting to stop before therapeutic effect |
| **Referral triggers** | Worsening mood; suicidal thoughts; severe side effects — urgent pathways |
| **Sensitivity** | Confidentiality; non-judgmental adherence discussion |

### 12.5 Neurological — epilepsy and Parkinson's disease

| Field | Research note |
|-------|---------------|
| **Eligible conditions** | Epilepsy; Parkinson's disease |
| **Representative medicines** | Antiepileptic drugs; levodopa and adjuncts (per NHSBSA list) |
| **NMS focus** | Strict adherence importance; timing; what to do if dose missed; when to report seizure change |
| **Common early problems** | Sedation; GI effects; complex timing schedules |
| **Referral triggers** | Increased seizure frequency; significant adverse effects |

### 12.6 Other eligible conditions

| Condition | NMS focus summary |
|-----------|-------------------|
| **Glaucoma** | Drop administration technique; systemic absorption effects; adherence |
| **Gout** | Flare prophylaxis understanding; hydration; when to report rash (allopurinol) |
| **Hypercholesterolaemia** | Statin muscle symptoms; adherence; lifestyle linkage |
| **Osteoporosis** | Bisphosphonate administration rules; GI irritation; calcium/vitamin D |
| **Urinary incontinence/retention** | Expectation setting; anticholinergic side effects; fluid timing |

### 12.7 NMS stage timing — decision reference

| Milestone | Minimum | Maximum | Measured from |
|-----------|---------|---------|---------------|
| Intervention consultation | 7 days | 14 days | Patient engagement |
| Follow-up consultation | 14 days | 21 days | Intervention consultation |
| Approximate total (engagement → Follow-up) | ~21 days | ~35 days | Patient engagement |

**Patient-facing simplification (internal seeds):** "Day 7–14 initial discussion; day 14–28 follow-up" from medicine start — acceptable in lay copy only with clinical review confirming specification alignment in master footnotes or QA.

### 12.8 Eligibility decision factors

| Factor | Eligible | Not eligible |
|--------|----------|--------------|
| Medicine on NHSBSA list for listed condition | Yes | No |
| New medicine for condition management | Yes | Formulation-only switch (usually) |
| Depression medicine, patient 17 | No | Age restriction |
| Depression medicine, patient 18+ | Yes | — |
| Three new eligible medicines same prescription | One NMS episode | Three separate episodes |
| Patient verbal consent | Required | No consent = no service |
| Pharmacy contractor declared NMS | Required | Undeclared pharmacy |

---

## 13. CLINICAL DECISION FRAMEWORK (Stage 1 Enhancement)

**Format:** Clinical reference for master content accuracy. Not patient-facing copy.

### 13.1 New eligible medicine, patient consents, no early problems reported

| Field | Detail |
|-------|--------|
| **Presentation** | Day 7–14 post-engagement; patient started medicine; no major concerns |
| **Intervention action** | NMS interview schedule; technique check if device; schedule Follow-up 14–21 days |
| **Follow-up action** | Reassess; complete if adhering |
| **Urgency** | **Routine** within specification windows |

### 13.2 Adherence problems, remediable without prescriber

| Field | Detail |
|-------|--------|
| **Presentation** | Forgotten doses, timing confusion, mild manageable side effects, technique errors |
| **Intervention action** | Remedial counselling; action plan; schedule Follow-up |
| **Follow-up action** | Verify improvement; complete or escalate |
| **Urgency** | **Routine** — resolve before treatment failure |

### 13.3 Problems requiring prescriber/PCN clinical pharmacist intervention

| Field | Detail |
|-------|--------|
| **Presentation** | Intolerable side effects; no benefit; possible medicine switch needed; dose adjustment required |
| **Intervention action** | Explain referral; NMS GP Feedback form; may complete episode if single medicine |
| **Follow-up action** | N/A if episode closed at Intervention — or continue for other medicines in multi-medicine episode |
| **Urgency** | **Prompt GP referral** — timeliness per clinical severity |

### 13.4 Patient has not started medicine at Intervention

| Field | Detail |
|-------|--------|
| **Presentation** | Fear, side effect anticipation, cost, confusion |
| **Intervention action** | Explore barriers; counsel on importance; agree plan to start or refer if prescriber discussion needed |
| **Follow-up action** | Reassess adherence at Follow-up |
| **Urgency** | **Routine** — early engagement prevents long-term non-adherence |

### 13.5 Patient already stopped medicine due to side effects

| Field | Detail |
|-------|--------|
| **Presentation** | Self-discontinued before Intervention contact |
| **Intervention action** | Safety-netting; do not advise restart without prescriber; refer promptly |
| **Follow-up action** | Confirm prescriber contact made; complete episode |
| **Urgency** | **Same-day to urgent GP** depending on medicine and symptoms |

### 13.6 Red-flag symptoms identified during NMS contact

| Field | Detail |
|-------|--------|
| **Presentation** | Breathing crisis, bleeding, suicidal ideation, allergic reaction, chest pain |
| **Intervention action** | Stop NMS routine — emergency/urgent pathway; 999 or same-day GP |
| **Follow-up action** | NMS may be incomplete — patient safety takes priority |
| **Urgency** | **Emergency / same day** |

### 13.7 Patient declines NMS at engagement

| Field | Detail |
|-------|--------|
| **Presentation** | Patient refuses consent |
| **Action** | Record decline; no NMS episode; dispensing continues unaffected |
| **Urgency** | **N/A** — respect choice |

### 13.8 Missed Intervention or Follow-up contact

| Field | Detail |
|-------|--------|
| **Presentation** | Patient not reachable at agreed time |
| **Action** | One recontact attempt (Intervention) or one additional attempt (Follow-up); record incomplete if still unreachable |
| **Payment** | Cannot claim for stage not completed |
| **Urgency** | **Administrative** — document and close episode |

---

## 14. PATIENT JOURNEY RESEARCH (Stage 1 Enhancement)

**Format:** Journey map for master content structure. Not publish copy.

### 14.1 Awareness (prescription issued)

| Field | Research note |
|-------|---------------|
| **Patient goals** | Collect medicine; understand basic use |
| **Patient concerns** | Cost; side effects; what medicine is for |
| **Information needs** | How to take; when it works; when to worry |
| **Common misunderstandings** | Pharmacist follow-up means prescription error |

### 14.2 First supply and patient engagement

| Field | Research note |
|-------|---------------|
| **Patient goals** | Get medicine home; start treatment |
| **Patient concerns** | Leaflet overload; consent confusion |
| **Information needs** | What NMS is; that it's voluntary; when pharmacy will contact |
| **Common misunderstandings** | NMS mandatory; must pay |

### 14.3 Early days (days 1–7)

| Field | Research note |
|-------|---------------|
| **Patient goals** | Establish routine; manage mild side effects |
| **Patient concerns** | "Is this normal?" — nausea, dizziness, cough |
| **Information needs** | When to persist vs call someone |
| **Common misunderstandings** | Stop medicine at first side effect without advice |

### 14.4 Intervention consultation (days 7–14)

| Field | Research note |
|-------|---------------|
| **Patient goals** | Quick resolution; reassurance or practical fix |
| **Patient concerns** | Time; privacy; GP notification |
| **Information needs** | What questions asked; technique demo for devices |
| **Common misunderstandings** | Pharmacist will change dose |

### 14.5 Between Intervention and Follow-up (days 14–28 approx.)

| Field | Research note |
|-------|---------------|
| **Patient goals** | Continue medicine; implement remedial advice |
| **Patient concerns** | Side effects persisting; forgotten Follow-up appointment |
| **Information needs** | Who to call if problems worsen before Follow-up |
| **Common misunderstandings** | Intervention was enough — skip Follow-up |

### 14.6 Follow-up consultation (14–21 days post-Intervention)

| Field | Research note |
|-------|---------------|
| **Patient goals** | Confirm on track; close loop |
| **Patient concerns** | Another time commitment |
| **Information needs** | What completion means; ongoing GP role |
| **Common misunderstandings** | NMS continues indefinitely |

### 14.7 Post-NMS ongoing care

| Field | Research note |
|-------|---------------|
| **Patient goals** | Stable long-term treatment; repeat prescriptions |
| **Patient concerns** | New problems months later — is that NMS? |
| **Information needs** | GP for dose changes; pharmacy for dispensing questions; MUR/SMR if offered |
| **Common misunderstandings** | NMS replaces all future medicines support |

---

## 15. CONTENT OPPORTUNITY RESEARCH (Stage 1 Enhancement)

**Format:** Ranked opportunities for future master content. Not content itself.

### 15.1 Strongest patient questions — ranked

| Rank | Question theme | Priority | Rationale |
|------|----------------|----------|-----------|
| 1 | Why have I been invited / is something wrong? | **HIGH** | Primary emotional blocker — unsolicited contact |
| 2 | Is NMS mandatory? | **HIGH** | Major myth — affects uptake |
| 3 | Which medicines qualify? | **HIGH** | Eligibility core |
| 4 | Is NMS free on the NHS? | **HIGH** | Access trust |
| 5 | What happens at follow-up? | **HIGH** | Process anxiety |
| 6 | Can pharmacist change my dose? | **HIGH** | Scope boundary |
| 7 | Will GP be told? | **HIGH** | Confidentiality trust |
| 8 | Can I do NMS by phone? | **HIGH** | Practical access |
| 9 | What if I get side effects? | **HIGH** | Clinical safety-netting |
| 10 | What if I miss the call? | **MEDIUM** | Operational |
| 11 | Inhaler technique check | **MEDIUM** | Condition-specific value |
| 12 | NMS vs MUR difference | **MEDIUM** | Service clarity |
| 13 | Hospital discharge eligibility | **MEDIUM** | Pathway completeness |
| 14 | Depression age limit | **MEDIUM** | Accurate eligibility |
| 15 | Multiple new medicines — one or several NMS? | **MEDIUM** | FAQ from CPE |

### 15.2 Strongest myths — ranked

| Rank | Myth | Priority | Rationale |
|------|------|----------|-----------|
| 1 | NMS mandatory / affects prescription | **HIGH** | Consent barrier |
| 2 | Applies to every new prescription | **HIGH** | Eligibility accuracy |
| 3 | Pharmacist changes dose | **HIGH** | Scope safety |
| 4 | Skipping follow-up is fine | **HIGH** | Service value |
| 5 | NMS replaces GP | **HIGH** | Multidisciplinary accuracy |
| 6 | Every pharmacy offers NMS | **HIGH** | Owner variable |
| 7 | NMS same as MUR | **MEDIUM** | Service distinction |
| 8 | Text questionnaire sufficient | **MEDIUM** | Delivery standards |
| 9 | Multiple medicines = multiple NMS | **MEDIUM** | CPE FAQ |
| 10 | Formulation change triggers NMS | **LOW** | Edge case |

### 15.3 Strongest concerns — ranked

| Rank | Concern | Priority | Rationale |
|------|---------|----------|-----------|
| 1 | Unsolicited contact — something wrong? | **HIGH** | Emotional entry |
| 2 | Time burden | **HIGH** | Decline driver |
| 3 | GP notification fear | **HIGH** | Honest adherence |
| 4 | Mental health stigma | **HIGH** | Sensitive pathway |
| 5 | Commercial distrust | **MEDIUM** | NHS positioning |
| 6 | Privacy in pharmacy | **MEDIUM** | Trust |
| 7 | Side effect anxiety | **HIGH** | Clinical safety |
| 8 | Inhaler technique shame | **MEDIUM** | Respiratory NMS value |
| 9 | Confusion with other services | **MEDIUM** | Clarity |
| 10 | Missing call consequences | **MEDIUM** | Reassurance |

### 15.4 Strongest trust factors — ranked

| Rank | Trust factor | Priority | Rationale |
|------|--------------|----------|-----------|
| 1 | Voluntary free NHS service | **HIGH** | Myth correction |
| 2 | Pharmacist medicines expertise | **HIGH** | Differentiator vs generic GP wait |
| 3 | Confidential consultation | **HIGH** | Sensitive conditions |
| 4 | Clear GP referral when needed | **HIGH** | Safety |
| 5 | Structured national programme | **MEDIUM** | Credibility |
| 6 | Device technique demonstration | **HIGH** | Tangible benefit |
| 7 | Flexible phone/video follow-up | **MEDIUM** | Access |
| 8 | Same pharmacy continuity | **MEDIUM** | Relationship |
| 9 | CPPE-trained pharmacist competence | **LOW** | Professional trust |
| 10 | Integration with discharge pathway | **MEDIUM** | Hospital handover patients |

---

## 16. KNOWLEDGE GAPS — REVIEW AND RECOMMENDATIONS (Stage 1 Enhancement)

### 16.1 Gaps addressed in v1

| Gap | Status in v1 |
|-----|--------------|
| Three-stage NMS pathway underdocumented | **Addressed** — Sections 1.4, 5.2, 12.7 |
| Eligible conditions list incomplete in internal seeds | **Addressed** — Section 1.2 (18 conditions), Section 12 |
| Follow-up timing confusion (7–14 / 14–21 vs 14–28) | **Addressed** — Section 1.4 timing note, 12.7 |
| NMS vs MUR distinction | **Addressed** — Sections 5.9, 7, 15 |
| Patient emotional drivers | **Addressed** — Section 11 (10 emotions) |
| Clinical decision framework | **Addressed** — Section 13 (8 bands) |
| Patient journey | **Addressed** — Section 14 (7 stages) |
| Content priorities | **Addressed** — Section 15 (ranked) |
| CPPE/CPE training requirements | **Addressed** — Sections 5.5, Source Material |

### 16.2 Remaining missing clinical information

| Gap | Recommendation |
|-----|----------------|
| Full NHSBSA eligible drug list (medicine-by-medicine) | Master references NHSBSA list — do not reproduce volatile formulary in master prose |
| Devolved nations pathways (Scotland/Wales/NI) | Document England-only in Master V1; flag UK owners for local appendix |
| Repeat NMS episode rules for same patient/medicine | Confirm current CPE/NHSBSA rules at Stage 2 clinical sign-off |
| Oct 2025 distance selling pharmacy restrictions | Note in master if owner is DSP — remote-only |
| Payment/claiming mechanics | Out of scope for patient master — contractor documentation only |

### 16.3 Remaining missing patient concerns

| Gap | Recommendation |
|-----|----------------|
| Digital exclusion — patients without phone for remote NMS | Owner variable — home visit or in-person option |
| Learning disability reasonable adjustments | Brief inclusive language in master; SOP-level detail |
| End-of-life or palliative new medicines | Usually outside standard NMS intent — clinical sign-off |
| Insulin-specific hypoglycaemia education depth | Master signposts GP/diabetes team for complex titration |

### 16.4 Remaining missing trust factors

| Gap | Recommendation |
|-----|----------------|
| Named pharmacist NMS accreditation | Owner variable at publish |
| Patient testimonials for NMS | Publish-stage owner content |
| Local GP practice integration stories | Owner confirmation |

### 16.5 Remaining missing pathway information

| Gap | Recommendation |
|-----|----------------|
| Owner NMS declaration status | Required before publish — `{{nhs_new_medicine_service}}` |
| Remote vs face-to-face preference | Owner policy Stage 2 |
| Prescription bag leaflet / recruitment method | Owner operational detail |
| GP Feedback form local pathway | Generic "pharmacist may contact GP" sufficient for master |

### 16.6 Recommendations before Master V1

1. **Human clinical sign-off** on Sections 5, 6, 12, 13 (eligible conditions, timing windows, red flags, referral triggers)
2. **Confirm England-only scope** for NHS NMS claims in master
3. **Resolve timing language** — specification-accurate Intervention/Follow-up vs simplified patient timeline in master Section 4
4. **Owner variables** remain placeholders until pharmacy onboarding
5. **Use Section 15 HIGH-priority items** to drive master emphasis
6. **Use Section 11 emotions** for tone guidance — not publish prose
7. **Use Section 14 journey** to structure patient-facing flow
8. **Replace generic blueprint placeholder myths** in any publish content with Section 7 NMS-specific myths

---

## RESEARCH COMPLETENESS SCORE (V1)

| Area | Weight | Score (0–10) | Notes |
|------|--------|--------------|-------|
| 1. Service definition | 8% | 9 | NHS Oct 2025 spec + 18 conditions; private variant clarified as non-NMS |
| 2. Patient intent | 7% | 9 | Emotions and triggers covered |
| 3. Patient questions (50+) | 10% | 10 | 58 questions |
| 4. Patient concerns (20+) | 7% | 10 | 24 concerns + ranked |
| 5. Clinical facts | 12% | 9 | NHS spec + NHSBSA reference; pending sign-off |
| 6. Red flags | 10% | 9 | Condition-specific + emergency bands |
| 7. Myths (20+) | 7% | 10 | 24 myths + ranked |
| 8. Trust factors | 5% | 9 | Ranked opportunities added |
| 9. Local advantages | 4% | 8 | Owner-dependent |
| 10. Owner variables | 4% | 9 | Seven core variables defined |
| 11. Patient emotions | 10% | 9 | 10 emotions mapped |
| 12. NMS conditions knowledge | 8% | 9 | 18 conditions, timing, medicine groups |
| 13. Clinical decision framework | 8% | 9 | 8 decision bands |
| 14. Patient journey | 5% | 9 | 7 stages mapped |
| 15. Content opportunities | 5% | 9 | Ranked HIGH/MEDIUM/LOW |

**Weighted completeness score: 9.1 / 10**

---

## REMAINING KNOWLEDGE GAPS (Summary)

1. Full NHSBSA eligible drug list — reference only, not reproduced
2. Devolved nations pathways — England-only recommended for Master V1
3. Owner confirmation — NMS declaration status, remote policy, delivery patient workflow
4. Human clinical sign-off — not yet recorded
5. Repeat episode rules — confirm at Stage 2 with current CPE guidance
6. Timing simplification vs specification — master author must choose patient-facing framing with QA

**Critical gaps blocking Master V1:** Items 3 and 4 only (owner vars can remain as placeholders per benchmark pattern).

---

## READINESS SCORE FOR MASTER V1

| Criterion | Score | Max | Notes |
|-----------|-------|-----|-------|
| Factual research completeness | 9.1 | 10 | v1 complete |
| Clinical pathway documented | 9 | 10 | Pending sign-off |
| Patient intent/emotion coverage | 9 | 10 | Section 11 complete |
| Question/concern inventory | 10 | 10 | Exceeds minimums |
| NMS conditions knowledge (Section 12) | 9 | 10 | Complete |
| Clinical decision framework | 9 | 10 | Section 13 complete |
| Journey mapping | 9 | 10 | Section 14 complete |
| Content priority guidance | 9 | 10 | Section 15 complete |
| Owner variables identified | 9 | 10 | Seven placeholders defined |
| Human clinical review | 0 | 10 | Not yet recorded |
| Publish scope decision (England) | 8 | 10 | Recommended not yet formalised |

**Readiness score: 8.2 / 10**

---

## RECOMMENDATION

### **READY FOR MASTER V1**

**Conditions:**

1. Master V1 author uses this document as sole research source — superseding generic placeholder content in existing `new-medicine-service-master-v1.md` where conflicts exist (especially timing windows and eligible conditions list)
2. Clinical reviewer signs off Sections 5, 6, 12, and 13 before QA checklist
3. Master treats owner variables as placeholders (same pattern as emergency-contraception-research-v1)
4. Master scope: England NHS NMS Advanced Service — no national private NMS equivalent claimed
5. Section 15 HIGH-priority items drive master emphasis; LOW-priority items may be brief or omitted
6. Intervention/Follow-up timing framed per NHS specification — if simplified "day 14–28" language used, clinical QA must approve
7. Pharmacist scope always framed as support and referral — never dose-change authority
8. Replace generic blueprint myths with Section 7 NMS-specific misconceptions

**Research foundation is comprehensive enough that Master V1 can be written without additional factual research**, provided the conditions above are met during drafting and review.

**Do not create:** publish content, service pages, variations, area pages, hub pages, or HTML as part of this research task.

---

## Document Control

| Version | Date | Change |
|---------|------|--------|
| v1.0 | 2026-06-22 | Initial Stage 1 research foundation — sections 1–16 |

**Next step:** Clinical sign-off → `new-medicine-service-master-v1.md` (Stage 2)
