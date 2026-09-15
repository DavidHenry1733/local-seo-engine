# Medication Reviews — Stage 1 Research Foundation (V1)

**Document type:** Research foundation only  
**Service ID:** `medication-reviews`  
**Category:** `core-pharmacy` (NHS medicines optimisation pathways + private medication reviews)  
**Benchmark process:** Pharmacy First framework (`MASTER-SERVICE-CREATION-PROCESS.md` Stage 1)  
**Benchmark document:** `emergency-contraception-research-v1.md`, `prescription-dispensing-research-v1.md`  
**Status:** Draft for human clinical review  
**Created:** 2026-06-22  

**Purpose:** Comprehensive clinical and patient-intent research before any master library prose is written. This document is not publish content.

---

## Source Material (Evidence Base)

| Source | Reference | Use in this document |
|--------|-----------|----------------------|
| NHS England | Structured medication reviews and medicines optimisation guidance; Network Contract DES Section 8 (SMR requirements) | SMR definition, PCN pathway, priority cohorts, multidisciplinary model |
| NHS England | Network Contract DES Guidance 2024/25 and 2025/26 — medicines optimisation and SMR | High-risk cohort identification, polypharmacy thresholds, SNOMED coding |
| NICE | NG5 — Medicines optimisation; NG197 — Shared decision making; NG221 — Multimorbidity (polypharmacy sections) | Review principles, person-centred optimisation, deprescribing framework |
| Community Pharmacy England (CPE) | MUR archive statistics; CPCF summaries; medicines optimisation guidance | MUR decommissioning (31 March 2021); community pharmacy scope boundaries; NMS relationship |
| Centre for Postgraduate Pharmacy Education (CPPE) | Medicines optimisation, MUR legacy training modules, NMS programme materials | Competency expectations; structured consultation format; documentation standards |
| NHS Specialist Pharmacy Service (SPS) | Person-centred approach to polypharmacy and medication review (2025) | Seven-step SMR framework; invitation and shared decision-making process |
| Internal intelligence | `data/pharmacy-service-intelligence/medication-reviews.json` | Patient intent signals, question seeds |
| Internal expertise | `data/pharmacy-service-expertise/medication-reviews.json` | Concerns, risk factors, content boundaries |
| Internal expansion | `data/pharmacy-service-expansion/medication-reviews.json` | Preparation guide, deep-dive topics |
| Internal blueprint | `data/pharmacy-service-blueprints/medication-reviews.json` | Concerns, myths, process steps, unsuitability criteria |
| Internal authority | `data/pharmacy-service-authority/medication-reviews.json` | Professional insights, safety considerations |
| Internal blueprint seeds | `src/pharmacy/pharmacyServiceBlueprintSeeds.ts` (`medication-reviews`) | Core myths, patient questions, appointment process, related services |

**Verification note:** NHS SMR is primarily a PCN Network Contract DES requirement led by clinical pharmacists in general practice settings. Community pharmacy MUR Advanced Service was decommissioned in England on **31 March 2021**. Community pharmacies may deliver **private medication reviews**, **informal medicines optimisation consultations**, **NMS** (distinct Advanced Service), and **locally commissioned** review pathways where ICBs contract them (including IP Pathfinder pilots). Owner-specific NHS availability (`{{nhs_medication_review}}`) must be confirmed locally before publish claims. England-focused scope unless owner serves devolved nations.

---

## 1. SERVICE DEFINITION

### 1.1 What the service is

- Structured pharmacist-led consultation reviewing **all medicines** a patient uses — prescribed, hospital-supplied, over-the-counter (OTC), herbal, and supplement products
- **Medicines optimisation** focus: appropriateness, effectiveness, safety, adherence, duplication, interactions, and patient understanding
- **Person-centred shared decision-making** — patient's goals, preferences, and capacity to manage medicines discussed (NICE NG5 / SMR framework)
- **Action plan** agreed with patient — may include adherence support, inhaler/device technique correction, timing simplification, OTC disclosure, lifestyle factors, and **GP/prescriber liaison** where changes needed
- **Documentation** of review outcomes; **GP notification** where clinically appropriate for continuity
- **Private medication review** — fee-based structured review where NHS pathway not available or patient ineligible (`{{private_review_fee}}`)
- **Not diagnosis** — does not replace GP for new condition investigation, chronic disease management ownership, or specialist prescribing decisions
- Delivered in private consultation room (`{{consultation_room}}`) by GPhC-registered pharmacist; independent prescriber may implement certain changes within scope where locally commissioned
- Distinct from brief counter questions at prescription collection — requires dedicated booked time

### 1.2 NHS pathway — Structured Medication Review (SMR) (England)

**Service name (official):** Structured Medication Review (SMR) — Network Contract Directed Enhanced Service (PCN requirement)

**Commissioning model:** SMR is a **PCN service requirement** under the Network Contract DES, not a standard national community pharmacy Advanced Service. PCNs must implement medicines optimisation including SMR for high-risk cohorts per DES guidance.

**Primary delivery setting:** General practice / PCN — **clinical pharmacists in primary care** expected to lead SMR. Multidisciplinary support from GPs, social prescribing link workers, community teams, and specialists as needed.

**Primary purpose:**
- Comprehensive review of patient's medicines for effectiveness, safety, and appropriateness
- Reduce problematic polypharmacy and prescribing harm
- Support shared decision making aligned with patient goals
- Identify deprescribing opportunities where medicines no longer needed or causing harm
- Coordinate with wider medicines optimisation programmes (e.g. STOMP, AMR stewardship)

**Priority cohorts (PCN identification — illustrative per DES/SPS guidance):**
- Care home residents
- People with learning disabilities
- **Complex polypharmacy** — commonly prioritised at **10+ regular medicines** (local thresholds may vary)
- Patients on medicines associated with high error/harm risk (e.g. anticoagulants, opioids, gabapentinoids, hypoglycaemics)
- Severely frail, isolated, housebound patients
- Recent hospital admission, falls, or medication-related harm signals
- Potentially inappropriate polypharmacy in multimorbidity (NICE NG221 context)

**Community pharmacy NHS role in SMR ecosystem (England):**
- **Collaborative partner** — may receive referrals, support discharge medicines reconciliation, provide dispensing continuity data
- **NMS (New Medicine Service)** — separate Advanced Service for follow-up after starting specific new medicines (asthma/COPD, diabetes, hypertension, anticoagulants) — complements but **does not replace** full SMR
- **Not automatic SMR provider** at every community pharmacy unless **locally commissioned** by ICB or participating in approved pilots (e.g. Independent Prescribing Pathfinder deprescribing models)
- Patient invited to NHS SMR by **GP surgery / PCN** in most cases — not self-referral at pharmacy counter for standard DES SMR

**Inclusion criteria (NHS SMR — typical):**
- Patient identified by PCN as benefiting from structured review per local prioritisation tools
- Capacity to participate in shared decision-making conversation (with reasonable adjustments)
- Ability to provide medicines history — physically, via carer, or from records
- Medicines-related optimisation need — polypharmacy, adherence concerns, suspected interactions, post-discharge changes

**Exclusion / redirect (NHS SMR context):**
- **Acute red-flag symptoms** requiring urgent/emergency care — not routine SMR
- **New diagnosis needed** — GP/specialist assessment first
- **Mental health crisis** — crisis team / urgent GP, not routine medicines review
- **Exclusive specialist management** with recent comprehensive hospital review and no community optimisation role
- Patient unable to provide any medicines information and no carer/records access

**Pharmacy cannot (standard SMR governance):**
- Unilaterally stop or change prescribed medicines without prescriber authority (unless independent prescriber within commissioned scope)
- Diagnose new conditions during review
- Replace GP annual review for complex multimorbidity
- Guarantee medicines changes will be approved by GP
- Deliver NHS DES SMR at community pharmacy **unless locally commissioned** — must not claim universal NHS SMR availability

### 1.3 Legacy pathway — Medicines Use Review (MUR) (England — historical)

**Service name (historical):** Medicines Use Review (MUR) / Prescription Intervention Service

**Status:** **Decommissioned 31 March 2021** — no longer commissioned under Community Pharmacy Contractual Framework Advanced Services (CPE archive).

**Historical scope (research context only):**
- Planned or opportunistic structured review in community pharmacy
- Focus on adherence, understanding, and medicines optimisation for eligible patients
- Pharmacist accreditation and reporting requirements under Advanced Service Directions
- Phased reduction 2019/20–2020/21 before full decommission

**Patient-facing relevance:** Patients may still search "MUR" or remember previous pharmacy MUR appointments. Master content must clarify MUR ended nationally and explain current pathways (PCN SMR, NMS, private pharmacy review, GP review).

### 1.4 Private and locally commissioned community pharmacy reviews (typical UK)

- **Private structured medication review** — booked consultation for disclosed fee (`{{private_review_fee}}`)
- Broader access — self-referral often accepted; not limited to PCN priority cohorts
- Same clinical governance — structured assessment, documentation, GP liaison where needed
- Fee typically covers consultation time; may include written action plan; medicine supply not included unless separate prescribing/dispensing
- **Locally commissioned NHS reviews** — some ICBs contract community pharmacy for medicines optimisation, deprescribing support, or IP Pathfinder pathways — **highly variable**; owner must confirm (`{{nhs_medication_review}}`)
- May include inhaler technique assessment, adherence packaging advice, OTC interaction screening, hospital discharge follow-up
- Independent prescriber pharmacists may implement agreed changes within local formulary where commissioned

### 1.5 Related NHS community pharmacy services (not the same as full medication review)

| Service | Relationship to medication review |
|---------|--------------------------------|
| **NMS (New Medicine Service)** | Structured follow-up after starting specific new medicines — condition-limited, time-defined; complements optimisation |
| **Prescription dispensing clinical check** | Safety screening at supply — not substitute for dedicated review appointment |
| **Pharmacy First** | Acute condition management — different intent |
| **Discharge medicines reconciliation (local)** | Focus on transfer-of-care accuracy — may trigger full review need |
| **IP Pathfinder / local enhanced services** | May include antidepressant review, deprescribing — pilot/ICB-specific |

### 1.6 Typical appointment structure

**Private or locally commissioned community pharmacy medication review:**
1. Patient contact — phone triage or booked slot (`{{booking_link}}`, `{{phone}}`)
2. Eligibility and service type confirmed — NHS commissioned vs private; fee disclosed if private
3. Private consultation room — confidential assessment (`{{consultation_room}}`)
4. Consent and capacity assessment; carer involvement documented if applicable
5. Medicines reconciliation — all packs, devices, OTC, supplements; allergies and conditions
6. Structured review — indication appropriateness, duplication, interactions, adherence, side effects, device technique
7. Patient goals and preferences — shared decision making on identified issues
8. Action plan — self-care, adherence aids, GP referral for prescriber changes, follow-up booking
9. Written summary for patient; GP notification where appropriate
10. Safety-netting — when to return, red flags, emergency signposting

**Typical duration:** ~20–45 minutes (polypharmacy, multiple devices, or carer involvement may extend toward 45–60 minutes)

**Staff:** GPhC-registered pharmacist; pharmacy technician may support preparation but pharmacist leads clinical review

**PCN NHS SMR (for patient pathway clarity):**
- Usually **GP surgery invitation** — face-to-face, telephone, or video per local policy
- Longer appointments common (20–30+ minutes) for complex polypharmacy
- May involve clinical pharmacist, GP, or both; follow-up actions tracked in GP record

---

## 2. PATIENT INTENT

### 2.1 Why patients seek medication reviews

- Taking **multiple regular medicines** — confused about what each is for
- **GP or nurse invited** them to a structured medication review (SMR)
- **Pharmacist suggested** review during dispensing — adherence or interaction concerns
- Starting **new long-term treatment** — wants whole-regimen check beyond NMS scope
- **Suspected side effects** — unsure which medicine is causing symptoms
- **Poor adherence** — forgetting doses, stopping medicines, difficulty with timing
- **Hospital discharge** — medicines changed; needs community reconciliation
- **Carer** managing medicines for elderly parent or dependent
- **Inhaler or device problems** — technique never properly checked
- **Duplicate medicines** — same drug from GP and specialist, or brand/generic confusion
- **OTC and supplement use** — wants interaction check with prescribed medicines
- **Polypharmacy in elderly** — family worried about pill burden
- **Private review** — cannot wait for GP SMR invitation; wants pharmacist time
- **Cost/waste concern** — unused medicines at home; wants rationalisation discussion
- **Memory or cognition decline** — needs simplified regimen support

### 2.2 Common triggers

- GP letter or text invitation to structured medication review
- Community Pharmacy England / NHS campaign on medicines safety
- Fall, hospital admission, or medication error scare
- New diagnosis adding another medicine to an already long list
- Community pharmacist flags interaction at dispensing
- Adult social care or care home medication audit
- Family member insisting "you take too many tablets"
- Reading about deprescribing or polypharmacy in media
- Repeat prescription review due from GP practice
- Switching pharmacy — new team offers medicines review service

### 2.3 Common concerns (intent-level)

- "Is pharmacy review as good as GP review?"
- Confusion between **MUR, SMR, NMS**, and private review
- Whether NHS review is **free** and who qualifies
- **Will GP be told** — privacy and record-sharing
- Fear pharmacist will **change or stop medicines** without permission
- **Embarrassment** about not taking medicines correctly
- **Time burden** — how long appointment takes; work absence
- Whether to bring **every bottle** including old/unused packs
- **Cost** of private review (`{{private_review_fee}}`)
- Whether review will **reduce medicines** (deprescribing anxiety)
- **Carer attendance** — can family member speak on patient's behalf
- **Language and accessibility** — understanding complex medicine names

### 2.4 Typical motivations

- Safer medicines use — avoid interactions and errors
- Clarity — understand purpose of each medicine
- Convenience — pharmacy access without long GP wait (private/local pathways)
- Free NHS care where commissioned (`{{nhs_medication_review}}`)
- Trusted medicines expert — pharmacist specialism
- Extended hours / local high street (`{{opening_hours}}`)
- Reduce pill burden where clinically appropriate
- Better inhaler technique — improve symptom control
- Coordinated care — action plan shared with GP
- Peace of mind for carers managing complex regimens

---

## 3. PATIENT QUESTIONS (Raw Research List)

**Format note:** Questions only. Not written as publish FAQs. **Count: 58**.

### 3.1 Service definition and types

1. What is a medication review at a pharmacy?
2. What is the difference between a medication review and a medicines use review (MUR)?
3. What is a Structured Medication Review (SMR)?
4. Is a pharmacy medication review the same as the NHS SMR my GP offers?
5. What is the New Medicine Service — is that a medication review?
6. What happens during a structured medication review?
7. Is a quick chat when I collect my prescription a medication review?
8. Can a community pharmacist do a full medication review?
9. What is a private medication review?
10. Why did MUR stop — can I still get one at the pharmacy?

### 3.2 Eligibility and NHS access

11. Who is eligible for an NHS medication review?
12. Is a medicines review free on the NHS?
13. Do I need a GP referral for a pharmacy medication review?
14. Can I self-refer for a structured medication review at the pharmacy?
15. How do I know if this pharmacy offers NHS medication reviews?
16. Am I eligible if I take five regular medicines?
17. Am I eligible if I take ten or more medicines?
18. Can I get an NHS review if I'm not in a priority group?
19. Do care home residents get medication reviews differently?
20. Can I access a review without being registered with a GP?

### 3.3 Appointments and access

21. Do I need an appointment for a medication review?
22. How do I book a medication review at the pharmacy?
23. How long does a medication review take?
24. What are your opening hours for medication reviews?
25. Can I book online?
26. Can I get a same-day medication review?
27. Can my carer or family member attend with me?
28. Can a carer book a review on my behalf?
29. Can I request a home visit for a medication review?
30. Is a telephone or video medication review available?
31. How private is the consultation?
32. Can I request a female or male pharmacist?

### 3.4 Preparation and what to bring

33. Do I need to bring all my medicines to the review?
34. Should I bring medicines I have stopped taking?
35. Do I need to include over-the-counter medicines and supplements?
36. Should I bring hospital discharge letters?
37. What questions should I prepare before the review?
38. Do I need photo ID for an NHS medication review?
39. Should I stop taking my medicines before the appointment?
40. Can I eat and drink normally before the review?

### 3.5 Review content and outcomes

41. Will the pharmacist check my inhaler technique?
42. Will the pharmacist check for drug interactions?
43. Can the pharmacist stop my medicines?
44. Can the pharmacist change my prescription?
45. Will my GP be informed after the review?
46. Will this appear on my medical record?
47. What is an action plan after a medication review?
48. Can the pharmacist prescribe new medicines during the review?
49. What if the review finds a problem with my medicines?
50. How often should I have a medication review?

### 3.6 NHS vs private and cost

51. How much does a private medication review cost?
52. What is the difference between NHS and private medication reviews?
53. Is a private review worth it compared to waiting for GP SMR?
54. Can I claim a private review on health insurance?
55. What is included in the private review fee?

### 3.7 Aftercare, GP relationship, and safety

56. What should I do after my medication review?
57. What if I disagree with the pharmacist's recommendations?
58. When should I see my GP instead of booking a pharmacy review?

---

## 4. PATIENT CONCERNS (Raw Research List)

**Count: 24**

1. Uncertainty whether pharmacy review is as thorough as GP SMR
2. Confusion between MUR, SMR, NMS, and private review terminology
3. Worry NHS review is not available at local pharmacy (`{{nhs_medication_review}}`)
4. Fear pharmacist will change or stop medicines without GP approval
5. Embarrassment about poor adherence or not taking medicines as prescribed
6. Anxiety about deprescribing — "they want to take me off my tablets"
7. Concern GP will not be informed — or conversely, concern GP **will** be told without consent
8. Overwhelmed by bringing all medicines — mobility or organisational difficulty
9. Uncertainty about private review cost (`{{private_review_fee}}`) before booking
10. Belief brief counter chat equals full structured review — false reassurance
11. Fear of being judged for using OTC, herbal, or non-prescribed products
12. Worry review is sales tactic to sell more products
13. Language or health literacy barrier — cannot explain regimens clearly
14. Carer burden — coordinating review for someone with dementia or capacity issues
15. Distrust of generic substitution context during review
16. Concern review cannot address hospital-only or specialist medicines
17. Anxiety that interaction findings mean serious harm already occurring
18. Frustration at GP wait — unsure if private pharmacy review duplicates SMR
19. Privacy in busy pharmacy — overheard consultation concerns
20. Uncertainty whether inhaler/device check will actually happen
21. Fear of losing access to needed pain medicines if "opioid review" mentioned
22. Confusion about how often reviews can be repeated
23. Worry about work/time off for 45-minute appointment
24. Concern that pharmacist is not qualified compared to GP or clinical pharmacist

---

## 5. CLINICAL FACTS

### 5.1 Medicines optimisation principles (NICE NG5 / SMR framework)

- **Structured medication review** is a NICE-approved, person-centred intervention to optimise medicines and improve outcomes (NHS SPS / NHS England SMR guidance)
- Review considers **all medicines** — prescribed, OTC, supplements, and non-prescription products
- **Shared decision making** — patient goals, values, and preferences central (NICE NG197)
- **Seven-step framework** (SPS/BMJ-adapted polypharmacy guidance): identify need → define objectives → map medicines → assess each medicine → discuss proposals → agree plan → document and follow up
- Optimisation includes **starting appropriate medicines**, **stopping inappropriate medicines**, **dose adjustment recommendations**, and **adherence support** — prescriber authority required for prescription changes in most community pharmacy contexts

### 5.2 NHS SMR — PCN delivery model

| Element | Research note |
|---------|---------------|
| **Commissioning** | Network Contract DES — PCN requirement from 2020/21 |
| **Lead workforce** | Clinical pharmacists in primary care (PCN-employed) |
| **Identification** | Data-driven prioritisation — polypharmacy, frailty, care homes, high-risk medicines |
| **Setting** | GP practice predominant; telephone/video where appropriate |
| **Duration** | Typically 20–30+ minutes; complex cases longer |
| **Documentation** | GP record — SNOMED coded SMR procedure |
| **Community pharmacy link** | NMS follow-up; dispensing data; local collaboration; discharge reconciliation |

### 5.3 MUR legacy (England — decommissioned)

- **End date:** 31 March 2021 (CPE confirmed)
- **Replacement policy intent:** Enhanced SMR in PCNs deemed more clinically effective for target populations (2019 CPCF summary)
- **Patient search legacy:** "MUR", "medicines use review pharmacy" remain common search terms — require terminology redirection
- **No new NHS MUR claims** at community pharmacy in England post-decommission

### 5.4 Community pharmacy medication review scope

| In scope (typical) | Out of scope / GP-specialist |
|--------------------|------------------------------|
| Medicines reconciliation from patient/carer | New diagnosis of serious illness |
| Interaction and duplication screening | Acute red-flag symptoms |
| Adherence assessment and support | Mental health crisis management |
| Inhaler/device technique | Complex specialist-only prescribing decisions without liaison |
| Side effect exploration (medicines-related) | Cancer chemotherapy regimen changes without oncology |
| OTC/supplement interaction identification | Safeguarding without local protocol |
| Action plan with GP referral for changes | Emergency supply without separate assessment |
| Deprescribing **recommendations** (non-IP) | Unilateral cessation of prescribed medicines (non-IP) |
| Written patient summary | Guaranteed GP acceptance of recommendations |

### 5.5 NMS distinction (Advanced Service — England)

- **Purpose:** Support patients **newly prescribed** specific medicines for long-term conditions
- **Conditions (commissioned set):** Asthma/COPD, type 2 diabetes, hypertension, anticoagulants (NHS specification — verify current list)
- **Structure:** Intervention ~14 days after supply start; follow-up ~14 days later
- **Not a full polypharmacy SMR** — condition-specific new-medicine focus
- Community pharmacy **can** deliver NMS where registered — separate claim pathway from private/full review

### 5.6 Polypharmacy and high-risk medicines (SMR prioritisation context)

- **Problematic polypharmacy:** Multiple medicines where some may be inappropriate or harmful (NICE NG221 multimorbidity context)
- **Common prioritisation threshold:** 10+ regular medicines (local DES implementation — not universal patient-facing rule)
- **High-risk medicine classes:** Anticoagulants, insulin/hypoglycaemics, opioids, gabapentinoids, anticholinergics, NSAIDs in elderly, etc.
- **Anticholinergic burden** and **falls risk** — relevant review domains in elderly
- **STOMP/STAMP** contexts — learning disability and psychotropic medicines optimisation

### 5.7 Prescriber change authority

- **Standard community pharmacist (non-IP):** Recommends changes; **GP/specialist must prescribe** alterations
- **Independent prescriber pharmacist:** May prescribe changes within local formulary and commissioned scope
- **Patient must not stop** prescribed medicines abruptly without clinical advice — especially benzodiazepines, opioids, steroids, antiepileptics, cardiac medicines
- **Action plan** documents recommendations, patient agreement, and follow-up responsibilities

### 5.8 Documentation and GP liaison

- Review outcomes recorded in pharmacy PMR
- GP notification via agreed template (NHS Mail, paper, or local system) where appropriate
- Patient receives copy of action plan or summary where provided
- SNOMED SMR coding applies to PCN-delivered SMR in GP systems — community pharmacy local templates vary

### 5.9 Typical review domains checklist (research)

| Domain | Examples assessed |
|--------|-------------------|
| Indication | Is each medicine still needed for current conditions? |
| Effectiveness | Is medicine achieving intended outcome? |
| Safety | Side effects, monitoring, high-risk combinations |
| Adherence | Dose timing, missed doses, barriers |
| Duplication | Same class, brand/generic overlap |
| Interactions | Drug-drug, drug-disease, drug-OTC |
| Practicality | Swallowing, dexterity, packaging, cost |
| Device technique | Inhalers, pens, patches, eye drops |
| Monitoring | Blood tests, BP, blood glucose requirements |

---

## 6. RED FLAGS

### 6.1 Urgent medical review required (999 / same day)

**999 / A&E:**
- Chest pain, severe breathlessness, stroke symptoms (FAST), collapse
- Severe allergic reaction to medicine — anaphylaxis
- Suspected overdose (deliberate or accidental)
- Acute confusion with sudden onset — exclude serious cause
- Severe bleeding on anticoagulants
- Suicidal crisis with immediate risk

**Same-day GP / urgent care / NHS 111:**
- New severe medicine side effect (e.g. angioedema, severe rash, jaundice)
- Hypoglycaemia or hyperglycaemia symptoms in diabetes
- Acute kidney injury symptoms in patient on nephrotoxic medicines
- Severe withdrawal symptoms after abrupt medicine cessation
- Falls with head injury on anticoagulants
- Suspected adverse drug reaction requiring treatment change urgently

### 6.2 Referral required (non-emergency but mandatory)

- **New symptoms needing diagnosis** — not medicines optimisation alone
- **Complex multimorbidity** beyond pharmacy scope without GP co-ordination
- **Specialist-only medicines** — oncology, immunosuppression, biologics — specialist review needed
- **Mental health deterioration** — depression, psychosis, self-harm risk — GP/mental health team
- **Safeguarding concerns** — carer coercion, unexplained medicine discrepancies
- **Capacity concerns** — patient cannot consent; lasting power of attorney / best interest process
- **Suspected prescribing error** — immediate prescriber contact
- **Pregnancy/breastfeeding** medicine safety — specialist input where high-risk medicines

### 6.3 When pharmacy structured review is NOT appropriate (initial presentation)

- Patient presents primarily for **acute illness** — Pharmacy First or GP more appropriate
- **Cannot reconcile medicines** and no carer/records — defer until information available
- **Red-flag symptoms** dominate presentation — urgent care first
- Patient seeks **only emergency supply** without review intent — separate pathway
- **SMR already completed** recently by PCN with no new changes — duplication unless clinical need

### 6.4 When private review may proceed but with limits

- Private fee-based review where pharmacy offers structured consultation (`{{private_review_fee}}`)
- Same clinical governance — referral when scope exceeded
- NHS SMR claim not made unless locally commissioned (`{{nhs_medication_review}}`)
- GP liaison still recommended for identified prescribing changes

---

## 7. MYTHS (Real Misconceptions Only)

**Count: 24**

| # | Misconception | Research correction (not publish prose) |
|---|---------------|----------------------------------------|
| 1 | Medication review replaces my GP completely | Review optimises medicines use; GP retains diagnosis, chronic disease management, and prescribing authority unless IP within scope |
| 2 | MUR is still a free NHS service at every pharmacy | MUR decommissioned England 31 March 2021; current NHS pathway is PCN SMR plus local commissioning |
| 3 | Pharmacy NHS SMR is available at every community pharmacy | Standard DES SMR is PCN/GP-led; community pharmacy NHS reviews only where locally commissioned |
| 4 | A quick question at the counter is a structured medication review | Full review requires booked time, complete medicines reconciliation, and documented action plan |
| 5 | Pharmacist can stop my medicines on the spot | Non-IP pharmacists recommend changes; prescriber must approve; abrupt stop dangerous for many medicines |
| 6 | Medication review and New Medicine Service are the same | NMS is condition-specific follow-up for new medicines; full review addresses whole regimen |
| 7 | SMR and medication review are identical everywhere | SMR is defined DES pathway; "medication review" may mean private/local/pharmacy informal service |
| 8 | I only need to mention prescription medicines | OTC, herbal, and supplement products essential for interaction screening |
| 9 | If I feel fine, a review is pointless | Interactions, subclinical side effects, and adherence problems often asymptomatic until harm |
| 10 | Private review is always better than NHS SMR | NHS SMR integrates with GP record and PCN prioritisation; private adds access speed not necessarily greater scope |
| 11 | Medication review will always reduce my tablets | Optimisation may confirm medicines needed; deprescribing only where clinically appropriate and agreed |
| 12 | Pharmacist review is not qualified like a doctor | Pharmacists are medicines experts; scope differs from GP — complementary not inferior for medicines optimisation |
| 13 | GP will never know about pharmacy review | GP notification often clinically appropriate and explained at consultation |
| 14 | GP will automatically action all pharmacist recommendations | GP/clinician validates recommendations against full record — not automatic |
| 15 | One review per lifetime is enough | Repeat reviews needed when medicines change, adherence slips, or clinical status changes |
| 16 | I should stop medicines before bringing them to review | Continue as prescribed unless clinical advice to stop; pharmacist needs to see actual use |
| 17 | Medication review diagnoses new conditions | Identifies medicines-related problems; new diagnosis requires GP/specialist |
| 18 | All pharmacies offer identical medication review services | Commissioning, private fees, IP capability, and NHS availability vary (`{{nhs_medication_review}}`) |
| 19 | Medication review is always free | NHS free only where commissioned and eligible; private reviews carry fee (`{{private_review_fee}}`) |
| 20 | Online medicines list is enough — no need to bring packs | Physical packs reveal duplication, expired medicines, device types, and actual adherence |
| 21 | Medication review treats emergencies | Red flags need 999/urgent care — not scheduled review |
| 22 | Structured review guarantees fewer medicines | Outcome may be improved understanding, technique, or monitoring — not always deprescribing |
| 23 | Carers cannot contribute to the review | Carers often essential for accurate history — with consent/capacity governance |
| 24 | NHS stopped all pharmacy medicines reviews when MUR ended | NMS continues; private/local reviews available; PCN SMR is primary NHS structured pathway |

---

## 8. TRUST FACTORS

- GPhC-registered premises and regulated professionals
- Structured consultation following NHS/NICE medicines optimisation principles
- Private consultation room — confidential medicines discussion (`{{consultation_room}}`)
- Non-judgemental approach to adherence difficulties
- Complete medicines reconciliation — prescribed plus OTC/supplements
- Evidence-based interaction and duplication screening
- Honest scope boundaries — GP/specialist referral when needed
- NHS commissioned service where eligible (`{{nhs_medication_review}}`)
- Transparent private fee before appointment (`{{private_review_fee}}`)
- Written action plan and clear next steps
- GP liaison for continuity where appropriate
- Device technique demonstration (inhalers, etc.) where relevant
- Integration with dispensing PMR — medicines history continuity
- Professional indemnity and clinical governance
- CPPE-trained pharmacists on medicines optimisation
- Flexible booking — phone and online (`{{phone}}`, `{{booking_link}}`)
- Extended hours vs GP surgery for private/local reviews (`{{opening_hours}}`)

---

## 9. LOCAL PHARMACY ADVANTAGES

- High street access — medicines review without hospital visit
- Known medicines history if patient already uses pharmacy for dispensing
- Extended evening/weekend appointments for private reviews (`{{opening_hours}}`)
- Private consultation room (`{{consultation_room}}`)
- Phone triage before booking (`{{phone}}`)
- Online booking (`{{booking_link}}`)
- Carer-friendly appointments — support for housebound coordination
- Inhaler technique check with devices patient actually uses
- Immediate link to dispensing, repeat ordering, and adherence packaging
- NMS integration for new medicines alongside broader review offer
- Local ICB commissioned pathways where active (`{{nhs_medication_review}}`)
- One-stop — review plus prescription collection same visit
- Transparent private pricing (`{{private_review_fee}}`)

**Caveats:** Standard NHS DES SMR is GP/PCN-invited — community pharmacy cannot claim universal NHS SMR; MUR no longer commissioned; complex specialist care requires GP/hospital co-ordination.

---

## 10. OWNER VARIABLES

| Variable | Purpose |
|----------|---------|
| `{{phone}}` | Booking, triage, eligibility enquiries |
| `{{opening_hours}}` | Appointment availability — evenings/weekends |
| `{{booking_link}}` | Online booking URL if offered |
| `{{consultation_room}}` | Private confidential consultation facility |
| `{{nhs_medication_review}}` | NHS-funded structured review active at this pharmacy (yes/no; local commissioning) |
| `{{private_review_fee}}` | Private structured medication review fee |

**Additional owner fields for Stage 2:** Typical appointment duration locally, home visit availability, IP pharmacist on team, NMS registration, GP notification method, languages, carer policy, repeat review interval guidance, parking/access.

---

## 11. PATIENT EMOTIONS (Stage 1 Enhancement)

**Format:** Research notes only. Not publish copy.

### 11.1 Overwhelm from polypharmacy

| Field | Research note |
|-------|---------------|
| **Trigger** | 10+ medicines; multiple prescribers; post-hospital discharge bag |
| **Patient concern** | "I can't keep track — something will go wrong" |
| **Typical behaviour** | Brings carrier bag of boxes; relies on carer to explain; anxious about duration |
| **Common questions** | Do I need all of these? / What is each one for? / Can anything be stopped? |

### 11.2 Embarrassment about non-adherence

| Field | Research note |
|-------|---------------|
| **Trigger** | Forgotten doses; stopped medicine due to side effects without telling GP |
| **Patient concern** | Pharmacist or GP will scold me; I'll get in trouble |
| **Typical behaviour** | Minimises missed doses; defensive; may omit OTC purchases |
| **Common questions** | Will you tell my GP I haven't been taking them? / Is it my fault? |

### 11.3 Anxiety about deprescribing

| Field | Research note |
|-------|---------------|
| **Trigger** | GP letter mentions medication review; media stories on reducing opioids |
| **Patient concern** | "They want to take away my pain relief / my tablets keep me alive" |
| **Typical behaviour** | Resistance to review; fear of rationing; brings advocate/family member |
| **Common questions** | Are you going to stop my medicines? / Who decides? / Can I refuse? |

### 11.4 Confusion about service types (MUR/SMR/NMS/private)

| Field | Research note |
|-------|---------------|
| **Trigger** | Mixed terminology online; GP invitation vs pharmacy advert |
| **Patient concern** | Booking wrong service; paying unnecessarily; duplicating GP SMR |
| **Typical behaviour** | Multiple phone calls; asks "is this the same as MUR?" |
| **Common questions** | What's the difference? / Is this free? / Do I need both GP and pharmacy review? |

### 11.5 Distrust of pharmacy vs GP expertise

| Field | Research note |
|-------|---------------|
| **Trigger** | Long-standing GP relationship; specialist-led complex care |
| **Patient concern** | Pharmacist is shop staff not real clinician |
| **Typical behaviour** | Challenges recommendations; demands GP confirmation before acting |
| **Common questions** | Are you qualified? / Will my GP agree? / Why not just see my doctor? |

### 11.6 Carer stress and responsibility

| Field | Research note |
|-------|---------------|
| **Trigger** | Managing medicines for parent with dementia or disabled partner |
| **Patient concern** | Making lethal error; missing GP-pharmacy communication |
| **Typical behaviour** | Attends with detailed notes; asks for written instructions; emotional fatigue |
| **Common questions** | Can I speak for them? / What if they refuse tablets? / How do I simplify the routine? |

### 11.7 Privacy concern on the high street

| Field | Research note |
|-------|---------------|
| **Trigger** | Sensitive medicines — mental health, HIV, addiction, fertility |
| **Patient concern** | Neighbours will see; overheard in consultation room |
| **Typical behaviour** | Requests quiet appointment; prefers early/late slots; hesitates to disclose all medicines |
| **Common questions** | Is it confidential? / Can we talk privately? / Will people know why I'm here? |

### 11.8 Fear after side effect or near-miss

| Field | Research note |
|-------|---------------|
| **Trigger** | Fall, bleed, hypoglycaemia, rash — suspected medicine-related |
| **Patient concern** | Permanent harm from current regimen; urgency for answers |
| **Typical behaviour** | Distressed presentation; wants immediate change; may have stopped medicines already |
| **Common questions** | Which tablet caused this? / Should I stop now? / Do I need A&E? |

### 11.9 Relief-seeking after action plan

| Field | Research note |
|-------|---------------|
| **Trigger** | Clearer regimen; simplified timing; technique corrected |
| **Patient concern** | False certainty — "everything fixed" without GP follow-up |
| **Typical behaviour** | May not contact GP for recommended changes; skips follow-up |
| **Common questions** | So I'm all sorted now? / Do I still need to call the GP? |

### 11.10 Financial worry about private review

| Field | Research note |
|-------|---------------|
| **Trigger** | Cannot access NHS pathway; long GP SMR wait |
| **Patient concern** | Wasting money if GP review would be free anyway |
| **Typical behaviour** | Price-shopping; asks what's included; may decline after quote |
| **Common questions** | How much? / Is it worth it? / Can I get NHS instead? |

---

## 12. CLINICAL FRAMEWORK (Stage 1 Enhancement)

**Format:** Clinical reference for master content accuracy. Decision bands for eligibility, pathway selection, and referral. Not patient-facing copy.

### 12.1 NHS PCN SMR invitation — patient should attend GP/PCN pathway

| Field | Detail |
|-------|--------|
| **Presentation** | Patient received GP/PCN SMR invitation; on priority cohort (polypharmacy, care home, high-risk medicines) |
| **Primary pathway** | GP practice / PCN clinical pharmacist SMR |
| **Community pharmacy role** | Support dispensing, NMS if new medicine, signpost if patient confused about invitation |
| **Pharmacy action** | Do not claim to replace DES SMR unless locally commissioned; clarify pathway |
| **Urgency** | **Routine booked** — attend SMR appointment as invited |

### 12.2 Private community pharmacy structured review — self-referral suitable

| Field | Detail |
|-------|--------|
| **Presentation** | Polypharmacy, adherence concerns, interaction questions; no acute red flags; wants booked pharmacist time |
| **Primary pathway** | Private medication review at pharmacy (`{{private_review_fee}}`) |
| **Inclusions** | Medicines reconciliation, optimisation discussion, device technique, action plan |
| **Pharmacy action** | Book consultation; disclose fee; structured review in `{{consultation_room}}` |
| **Urgency** | **Routine** — typically within days to 2 weeks |

### 12.3 Locally commissioned NHS pharmacy review — eligibility confirmed

| Field | Detail |
|-------|--------|
| **Presentation** | Patient meets local ICB criteria; pharmacy registered for commissioned review (`{{nhs_medication_review}}`) |
| **Primary pathway** | NHS-funded pharmacy structured review per local specification |
| **Pharmacy action** | Verify eligibility; deliver per local protocol; claim/report as required |
| **Urgency** | **Routine** per local access standards |

### 12.4 NMS indicated — not full polypharmacy review

| Field | Detail |
|-------|--------|
| **Presentation** | Patient started new medicine for NMS-eligible condition within intervention window |
| **Primary pathway** | NMS Advanced Service — separate from full regimen review |
| **Pharmacy action** | Offer NMS; may flag need for broader review if polypharmacy also present |
| **Urgency** | **Time-defined** — NMS intervention ~14 days post-start |

### 12.5 Post-hospital discharge — reconciliation priority

| Field | Detail |
|-------|--------|
| **Presentation** | Recent discharge with medicine changes; confusion about stopped/started medicines |
| **Primary pathway** | Medicines reconciliation — may be pharmacy local service or trigger full review |
| **Pharmacy action** | Compare discharge letter with patient packs; urgent GP contact if major discrepancy |
| **Urgency** | **Priority** — within days of discharge |

### 12.6 Red flags present — urgent care not review

| Field | Detail |
|-------|--------|
| **Presentation** | Acute chest pain, stroke symptoms, severe reaction, overdose, suicidal crisis |
| **Primary pathway** | 999 / A&E / same-day urgent GP / crisis team |
| **Pharmacy action** | Stop review booking; immediate signposting; do not delay emergency care |
| **Urgency** | **Emergency / same day** |

### 12.7 Complex specialist care — GP/specialist co-ordination required

| Field | Detail |
|-------|--------|
| **Presentation** | Oncology, transplant, complex biologics, recent specialist titration |
| **Primary pathway** | Specialist or GP-led review; pharmacy advisory role only |
| **Pharmacy action** | Limited optimisation; liaison with specialist before change recommendations |
| **Urgency** | **Refer** — pharmacy review supplementary not sole pathway |

### 12.8 Capacity/carer governance — review deferred or adjusted

| Field | Detail |
|-------|--------|
| **Presentation** | Patient lacks capacity; no authorised representative; safeguarding concern |
| **Primary pathway** | Best interest process; carer with LPA; GP involvement |
| **Pharmacy action** | Follow local safeguarding/capacity policy; defer or involve authorised decision-maker |
| **Urgency** | **Case-by-case** — may defer until governance resolved |

### 12.9 Prescribing change identified — GP referral band

| Field | Detail |
|-------|--------|
| **Presentation** | Review finds potentially inappropriate medicine, interaction, or dose concern requiring prescriber action |
| **Primary pathway** | GP/specialist prescribing review |
| **Pharmacy action** | Document recommendation; patient agrees plan to contact GP; urgent contact if immediate harm risk |
| **IP exception** | Independent prescriber within commissioned scope may prescribe per local formulary |
| **Urgency** | **Routine to urgent** depending on harm risk |

---

## 13. PATIENT JOURNEY RESEARCH (Stage 1 Enhancement)

**Format:** Journey map for master content structure. Not publish copy. **7 stages.**

### 13.1 Awareness

| Field | Research note |
|-------|---------------|
| **Patient goals** | Understand what medication review is; know if they need one |
| **Patient concerns** | MUR/SMR/NMS confusion; cost; GP vs pharmacy |
| **Information needs** | Service exists; terminology update post-MUR; NHS vs private |
| **Common misunderstandings** | MUR still free at pharmacy; any counter chat equals review |

### 13.2 Trigger and decision to act

| Field | Research note |
|-------|---------------|
| **Patient goals** | Resolve medicines confusion or respond to invitation |
| **Patient concerns** | Whether to wait for GP SMR or book pharmacy private |
| **Information needs** | Which pathway applies; eligibility; urgency |
| **Common misunderstandings** | Must choose only one pathway; private always duplicates SMR wastefully |

### 13.3 Booking and preparation

| Field | Research note |
|-------|---------------|
| **Patient goals** | Secure appointment; know what to bring |
| **Patient concerns** | Fee surprise; time off work; gathering all medicines |
| **Information needs** | Booking method; duration; bring all packs and OTC |
| **Common misunderstandings** | List on phone sufficient; stop medicines before appointment |

### 13.4 Consultation

| Field | Research note |
|-------|---------------|
| **Patient goals** | Clarity on regimen; voice concerns; technique check |
| **Patient concerns** | Judgment; privacy; being rushed |
| **Information needs** | Step-by-step process; confidentiality; carer role |
| **Common misunderstandings** | Pharmacist will change prescriptions immediately |

### 13.5 Action plan and GP liaison

| Field | Research note |
|-------|---------------|
| **Patient goals** | Clear next steps; GP alignment |
| **Patient concerns** | GP won't listen; recommendations ignored |
| **Information needs** | Written summary; who contacts GP; timeline |
| **Common misunderstandings** | Action plan automatically changes GP prescription |

### 13.6 Implementation at home

| Field | Research note |
|-------|---------------|
| **Patient goals** | Follow new regimen; improved technique; contact GP if needed |
| **Patient concerns** | Withdrawal if medicine stopped; new side effects |
| **Information needs** | Safe deprescribing pace; when to seek help |
| **Common misunderstandings** | Can discard all old medicines immediately without prescriber confirmation |

### 13.7 Follow-up and repeat review

| Field | Research note |
|-------|---------------|
| **Patient goals** | Sustained optimisation; know when next review needed |
| **Patient concerns** | Medicines changed again by GP/hospital — review now outdated |
| **Information needs** | Follow-up appointment; repeat interval; NMS vs full review |
| **Common misunderstandings** | One review lasts indefinitely; no review needed if feeling well |

---

## 15. CONTENT OPPORTUNITY RESEARCH (Stage 1 Enhancement)

**Format:** Ranked opportunities for future master content. Not content itself.

### 15.1 Strongest patient questions — ranked

| Rank | Question theme | Priority | Rationale |
|------|----------------|----------|-----------|
| 1 | What is a medication review / MUR vs SMR vs NMS? | **HIGH** | Terminology confusion dominates intent |
| 2 | Is NHS medication review free and who is eligible? | **HIGH** | Access and commissioning accuracy |
| 3 | Pharmacy vs GP SMR — which pathway? | **HIGH** | Scope boundary — Section 12 |
| 4 | Do I need to bring all my medicines? | **HIGH** | Preparation driver; review quality |
| 5 | Will GP be informed / will medicines change? | **HIGH** | Trust and authority concerns |
| 6 | How long does review take / booking access? | **HIGH** | Owner variables — practical |
| 7 | Private review cost and what's included | **HIGH** | `{{private_review_fee}}` |
| 8 | Can pharmacist stop or change my medicines? | **HIGH** | Major myth; prescriber authority |
| 9 | How often should I have a review? | **MEDIUM** | Repeat access rules |
| 10 | Inhaler technique and device checking | **MEDIUM** | Respiratory patient value |
| 11 | Carer attendance and booking for others | **MEDIUM** | Polypharmacy elderly cohort |
| 12 | Post-hospital discharge medicines | **MEDIUM** | Reconciliation urgency |
| 13 | OTC and supplement disclosure | **MEDIUM** | Interaction screening completeness |
| 14 | Insurance for private review | **LOW** | Edge case |
| 15 | Video/phone review availability | **LOW** | Owner-dependent |

### 15.2 Strongest myths — ranked

| Rank | Myth | Priority | Rationale |
|------|------|----------|-----------|
| 1 | MUR still available free at pharmacy | **HIGH** | Decommissioned 2021 — accuracy critical |
| 2 | Medication review replaces GP | **HIGH** | Scope and complementary care |
| 3 | Counter chat equals structured review | **HIGH** | Service definition |
| 4 | Pharmacist stops medicines on spot | **HIGH** | Prescriber authority |
| 5 | Every pharmacy offers NHS SMR | **HIGH** | PCN vs community commissioning |
| 6 | NMS is same as full review | **HIGH** | Pathway selection |
| 7 | Only prescription medicines matter | **HIGH** | OTC/supplement interactions |
| 8 | Review always reduces tablets | **MEDIUM** | Deprescribing anxiety |
| 9 | Feel fine so review unnecessary | **MEDIUM** | Hidden interaction/adherence harm |
| 10 | Private review always better than NHS | **MEDIUM** | Pathway value comparison |

### 15.3 Strongest concerns — ranked

| Rank | Concern | Priority | Rationale |
|------|---------|----------|-----------|
| 1 | MUR/SMR/NMS terminology confusion | **HIGH** | Primary access barrier |
| 2 | Pharmacy vs GP thoroughness | **HIGH** | Trust objection from blueprint seeds |
| 3 | GP notification and privacy | **HIGH** | Dual concern — tell vs not tell |
| 4 | Deprescribing fear | **HIGH** | Emotional blocker |
| 5 | Adherence embarrassment | **HIGH** | Non-disclosure risk |
| 6 | NHS availability at local pharmacy | **HIGH** | `{{nhs_medication_review}}` |
| 7 | Private cost transparency | **HIGH** | Booking barrier |
| 8 | Polypharmacy overwhelm | **MEDIUM** | Preparation and duration |
| 9 | Privacy on high street | **MEDIUM** | Sensitive medicines |
| 10 | Carer burden | **MEDIUM** | Capacity governance |

### 15.4 Strongest trust factors — ranked

| Rank | Trust factor | Priority | Rationale |
|------|--------------|----------|-----------|
| 1 | Structured private consultation | **HIGH** | Sensitive medicines discussion |
| 2 | Complete medicines reconciliation | **HIGH** | Clinical credibility |
| 3 | Honest scope and GP referral | **HIGH** | Safety over commercial pressure |
| 4 | Non-judgemental adherence support | **HIGH** | Embarrassment barrier |
| 5 | Clear NHS vs private explanation | **HIGH** | Commissioning accuracy |
| 6 | Written action plan | **MEDIUM** | Continuity |
| 7 | Inhaler/device technique demonstration | **MEDIUM** | Respiratory outcomes |
| 8 | GPhC registration and CPPE training | **MEDIUM** | Professional legitimacy |
| 9 | Integration with dispensing PMR | **MEDIUM** | Continuity for existing patients |
| 10 | Transparent private fee | **MEDIUM** | Cost trust |

---

## 16. KNOWLEDGE GAPS — REVIEW AND RECOMMENDATIONS (Stage 1 Enhancement)

### 16.1 Gaps addressed in v1

| Gap | Status in v1 |
|-----|--------------|
| MUR vs SMR vs NMS terminology unclear | **Addressed** — Sections 1.2, 1.3, 1.5, 5.5, 7 |
| NHS SMR PCN vs community pharmacy scope | **Addressed** — Sections 1.2, 1.4, 12.1, 12.3 |
| MUR decommission date not documented | **Addressed** — Sections 1.3, 5.3, 7 |
| Patient emotional drivers | **Addressed** — Section 11 (10 emotions) |
| Clinical eligibility/referral framework | **Addressed** — Section 12 (9 decision bands) |
| Patient journey | **Addressed** — Section 13 (7 stages) |
| Content priorities | **Addressed** — Section 15 (ranked) |
| Polypharmacy prioritisation context | **Addressed** — Sections 1.2, 5.6 |

### 16.2 Remaining missing clinical information

| Gap | Recommendation |
|-----|----------------|
| Local ICB commissioned pharmacy SMR specifications | Owner variable — `{{nhs_medication_review}}` with local protocol reference at onboarding |
| IP Pathfinder deprescribing models — national rollout status | Master notes pilot/evaluation phase; avoid universal claims |
| Devolved nations pathways (Scotland/Wales/NI) | Document England focus; flag UK owners for local appendix (MUR/SMR models differ) |
| Exact SNOMED/local reporting templates for pharmacy reviews | Professional SOP scope — not patient-facing |
| NMS condition list updates | Master references NMS as distinct; verify current NHS England NMS spec at Stage 2 |
| Seven-step SMR framework detail | Master summarises; link to SPS/NICE — do not reproduce full clinical algorithm |

### 16.3 Remaining missing patient concerns

| Gap | Recommendation |
|-----|----------------|
| Cultural/religious attitudes to deprescribing | Sensitive master tone guidance |
| Digital exclusion — online booking only pharmacies | Owner variable — phone booking emphasis |
| Homebound patients unable to bring medicines | Owner home visit policy at Stage 2 |
| Learning disability reasonable adjustments | Brief inclusive language; STOMP signposting for professionals |

### 16.4 Remaining missing trust factors

| Gap | Recommendation |
|-----|----------------|
| Named clinical pharmacist credentials | Owner variable at publish |
| Local GP surgery partnership agreements | Owner confirmation |
| Patient testimonials for medicines reviews | Publish-stage owner content |
| Audit/inspection ratings | Owner optional |

### 16.5 Remaining missing pathway information

| Gap | Recommendation |
|-----|----------------|
| Owner NHS commissioning status | Required before publish — `{{nhs_medication_review}}` |
| Private fee schedule | `{{private_review_fee}}` |
| GP notification method locally | Generic "may inform GP" sufficient; local detail Stage 2 |
| Repeat review interval policy | Owner/clinical policy — no universal rule |
| Future CPCF expansion of community pharmacy SMR | Monitor 2025+ negotiations — master version note |

### 16.6 Recommendations before Master V1

1. **Human clinical sign-off** on Sections 5, 6, 12 (SMR/MUR/NMS distinctions, referral bands, red flags)
2. **Confirm England-only scope** for MUR decommission and DES SMR claims
3. **Owner variables** remain placeholders until pharmacy onboarding
4. **Use Section 15 HIGH-priority items** to drive master emphasis — especially MUR/SMR/NMS terminology
5. **Use Section 11 emotions** for tone guidance — not publish prose
6. **Use Section 13 journey** to structure patient-facing flow
7. **Never claim universal NHS SMR at community pharmacy** without `{{nhs_medication_review}}` confirmed

---

## RESEARCH COMPLETENESS SCORE (V1)

| Area | Weight | Score (0–10) | Notes |
|------|--------|--------------|-------|
| 1. Service definition | 8% | 9 | SMR DES + MUR legacy + private/local mapped; pending local commissioning detail |
| 2. Patient intent | 7% | 9 | Triggers, MUR/SMR confusion, carer intent covered |
| 3. Patient questions (50+) | 10% | 10 | 58 questions |
| 4. Patient concerns (20+) | 7% | 10 | 24 concerns + ranked |
| 5. Clinical facts | 12% | 9 | NHS England, NICE, CPE, SPS; pending sign-off |
| 6. Red flags | 10% | 9 | Emergency, specialist, capacity bands |
| 7. Myths (20+) | 7% | 10 | 24 myths + ranked |
| 8. Trust factors | 5% | 9 | Ranked opportunities added |
| 9. Local advantages | 4% | 8 | Owner-dependent; SMR caveat essential |
| 10. Owner variables | 4% | 9 | Six core variables defined |
| 11. Patient emotions | 10% | 9 | 10 emotions mapped |
| 12. Clinical framework | 8% | 9 | 9 decision bands — eligibility and referral |
| 13. Patient journey | 5% | 9 | 7 stages mapped |
| 15. Content opportunities | 5% | 9 | Ranked HIGH/MEDIUM/LOW |

**Weighted completeness score: 9.0 / 10**

---

## REMAINING KNOWLEDGE GAPS (Summary)

1. Local ICB pharmacy commissioning — owner confirmation via `{{nhs_medication_review}}`
2. Human clinical sign-off — not yet recorded
3. Devolved nations SMR/MUR models — England-only recommended for Master V1
4. IP Pathfinder / future CPCF community SMR expansion — evolving policy landscape
5. NMS specification current condition list — verify at Stage 2 against live NHS England spec
6. Owner-specific GP liaison templates and repeat review intervals

**Critical gaps blocking Master V1:** Items 1 and 2 only (owner vars can remain as placeholders per benchmark pattern).

---

## READINESS SCORE FOR MASTER V1

| Criterion | Score | Max | Notes |
|-----------|-------|-----|-------|
| Factual research completeness | 9.0 | 10 | v1 complete |
| Clinical pathway documented | 9 | 10 | Pending sign-off |
| Patient intent/emotion coverage | 9 | 10 | Section 11 complete |
| Question/concern inventory | 10 | 10 | Exceeds minimums |
| Clinical framework (Section 12) | 9 | 10 | 9 decision bands |
| Journey mapping | 9 | 10 | Section 13 complete |
| Content priority guidance | 9 | 10 | Section 15 complete |
| Owner variables identified | 9 | 10 | Six placeholders defined |
| Human clinical review | 0 | 10 | Not yet recorded |
| Publish scope decision (England + MUR legacy) | 8 | 10 | Recommended not yet formalised |

**Readiness score: 8.0 / 10**

---

## RECOMMENDATION

### **READY FOR MASTER V1**

**Conditions:**

1. Master V1 author uses this document as sole research source for medication reviews
2. Clinical reviewer signs off Sections 5, 6, and 12 before QA checklist
3. Master treats owner variables as placeholders (same pattern as emergency-contraception and prescription-dispensing research v1)
4. Master scope: England NHS SMR (PCN pathway) + MUR legacy clarification + private/local community pharmacy review variant
5. **Never claim universal NHS SMR at community pharmacy** — use `{{nhs_medication_review}}` and explain GP/PCN invitation pathway
6. **MUR decommissioned 31 March 2021** — redirect terminology in all patient-facing content
7. Section 15 HIGH-priority items drive master emphasis; LOW-priority may be brief or omitted
8. NMS framed as related but distinct service — not synonymous with full medication review

**Research foundation is comprehensive enough that Master V1 can be written without additional factual research**, provided the conditions above are met during drafting and review.

**Do not create:** publish content, service pages, variations, area pages, hub pages, or HTML as part of this research task.

---

## Document Control

| Version | Date | Change |
|---------|------|--------|
| v1.0 | 2026-06-22 | Initial Stage 1 research foundation — sections 1–16 |

**Next step:** Clinical sign-off → `medication-reviews-master-v1.md` revision (Stage 2)
