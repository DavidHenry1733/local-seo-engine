# Pharmacy Contraception Service — Stage 1 Research Foundation (V1)

**Document type:** Research foundation only  
**Service ID:** `pharmacy-contraception-service`  
**Category:** `nhs-clinical`  
**Benchmark process:** Pharmacy First framework (`MASTER-SERVICE-CREATION-PROCESS.md` Stage 1)  
**Benchmark document:** `emergency-contraception-research-v1.md`  
**Cross-reference:** `emergency-contraception-research-v1.md` — shared PCS commissioning, PGD family PRN02207, safeguarding, GP notification, technician scope (Oct 2025). **This document covers ongoing oral contraception only; oral EC is researched separately.**  
**Status:** Draft for human clinical review  
**Created:** 2026-06-22  

**Purpose:** Comprehensive clinical and patient-intent research before any master library prose is written. This document is not publish content.

---

## Source Material (Evidence Base)

| Source | Reference | Use in this document |
|--------|-----------|----------------------|
| NHS England Advanced Service Specification | NHS Pharmacy Contraception Service (PCS) — PRN00751 v3.0 (valid from 29 October 2025) | Pathway, eligibility, commissioning, initiation vs ongoing supply, BP/BMI requirements, supply durations, LARC discussion |
| NHS England Patient Group Directions | PRN02207 — COC PGD v3.0 (PRN02207_iv); POP PGD v3.0 (PRN02207_v) — valid from 29 October 2025 | Contraindications, cautions, dosing, switching, aftercare, documentation, product scope |
| College of Sexual and Reproductive Healthcare (CoSRH/FSRH) | UK Medical Eligibility Criteria (UKMEC); CoSRH clinical guidance on COC and POP; e-SRH modules 03_01–03_04 | Eligibility categories, migraine rules, missed-pill guidance, LARC counselling |
| Community Pharmacy England | PCS guidance, service pathway, expansion timeline | Eligibility clarifications, commissioning status, technician scope, drospirenone addition |
| Centre for Postgraduate Pharmacy Education (CPPE) | Contraception e-learning; Sexual health in pharmacies; Emergency contraception (for cross-referral only) | Competency requirements for staff |
| Internal intelligence | `data/pharmacy-service-intelligence/pharmacy-contraception-service.json` | Patient intent signals, question seeds |
| Internal blueprint | `data/pharmacy-service-blueprints/pharmacy-contraception-service.json` | Concerns, myths, process steps, unsuitability criteria |
| Internal blueprint seeds | `src/pharmacy/pharmacyServiceBlueprintSeeds.ts` (pharmacy-contraception-service) | Core myths, enrichment objections, safety concerns |
| Internal enrichment | `data/pharmacy-service-expansion/pharmacy-contraception-service.json`, `data/pharmacy-service-expertise/pharmacy-contraception-service.json`, `data/pharmacy-service-authority/pharmacy-contraception-service.json` | BP checks, contraindications, preparation, referral boundaries |

**Verification note:** Clinical thresholds mapped to PRN02207 COC/POP PGDs (Oct 2025), NHS PCS specification PRN00751 v3.0, and CoSRH/FSRH UKMEC. Owner-specific commissioning status (`{{nhs_contraception_service}}`) must be confirmed locally before publish claims. England-only scope for NHS PCS pathway.

---

## 1. SERVICE DEFINITION

### 1.1 What the service is

- Confidential pharmacist or pharmacy technician consultation for **initiation, review, and ongoing supply** of selected oral contraceptive pills under NHS PCS PGDs
- Clinical assessment of medical history, medicines, contraindications, and suitability per UKMEC/CoSRH guidance
- **Blood pressure and BMI measurement** for combined oral contraceptive (COC) supply per NICE NG136 and service specification
- Supply of eligible combined oral contraceptives (COC) and progestogen-only pills (POP) within PGD scope — including **drospirenone POP** (added October 2025)
- Method switching between pills within PGD scope where clinically appropriate (treated as initiation per specification)
- **Ongoing supply** of current pill without routine GP appointment for each cycle — where person previously supplied by GP, pharmacy, or sexual health clinic and current supply still in use
- Signposting and referral for **long-acting reversible contraception (LARC)** — coils, implants, injections — when appropriate or preferred
- Missed-pill guidance signposting; complex scenarios may need GP or sexual health clinic
- Safety-netting: side effects, VTE warning signs, when to seek urgent help, pregnancy testing advice, STI/condom promotion
- Private contraception consultation may exist separately where NHS PCS not commissioned or patient ineligible — fee-based (`{{private_contraception}}`)
- Delivered in private consultation room (`{{consultation_room}}`) by GPhC-registered pharmacist or trained pharmacy technician authorised under PGD

**Explicitly NOT this service (separate research/pathway):**
- Oral emergency contraception after UPSI — see `emergency-contraception-research-v1.md`
- LARC fitting (Cu-IUD, hormonal IUS, implant, injection administration)
- Diagnosis of pregnancy, ectopic pregnancy, or gynaecological conditions
- STI testing/treatment (may be signposted)

### 1.2 NHS pathway — Pharmacy Contraception Service ongoing oral contraception (England)

**Service name (official):** NHS Pharmacy Contraception Service (PCS) — oral contraception initiation and ongoing supply component

**Commissioning:** Advanced Service under Community Pharmacy Contractual Framework (England). Pharmacy must be registered to deliver PCS and staff authorised under relevant PRN02207 PGDs. Not automatically available at every pharmacy. Find participating pharmacies via NHS.uk Find a Pharmacy.

**Expansion timeline:**
- **24 April 2023** — PCS commenced: ongoing supply of oral contraception only
- **1 December 2023** — expanded to include initiation plus ongoing supply
- **29 October 2025** — further expanded: oral emergency contraception via PGD; **pharmacy technician delivery**; **drospirenone POP** added to POP scope (see CPE/NHS England announcements, March 2025 negotiation)

**Primary purpose (ongoing OC component):**
- Improve access to oral contraception without routine GP appointment for suitable patients
- Continue supplies initiated in primary care, pharmacy, or sexual health settings
- Initiate first-time oral contraception or restart after pill-free break where PGD criteria met
- Routine monitoring including BP/BMI for COC; contraindication screening for all pills
- Discuss LARC as more effective alternative; signpost where accepted

**Service types within ongoing OC scope:**

| Type | Definition (NHS specification) |
|------|-------------------------------|
| **Initiation** | First-time OC; restart after pill-free break; switch to new (to individual) oral contraceptive |
| **Ongoing supply** | Further equivalent supply where person previously supplied OC by GP, pharmacy, or sexual health clinic; current supply still in use |

**Inclusion criteria (NHS PCS — ongoing OC):**
- Individual seeking initiation or further supply of ongoing OC for contraceptive purposes
- **COC:** from menarche up to and including **49 years**
- **POP (norethisterone, levonorgestrel, desogestrel):** from menarche up to and including **54 years**
- **POP (drospirenone only):** from menarche up to and including **49 years**
- Able to confirm BP and BMI prior to COC supply (measured in pharmacy or acceptable self-reported per specification)
- Meets PGD inclusion criteria for chosen pill type; no PGD exclusions
- Under-16: Fraser-guidelines capacity assessment required and documented

**Exclusion criteria (NHS PCS / PGD — cannot supply OC):**
- PGD-specific exclusions for COC or POP (see Sections 5.4–5.6) — including but not limited to:
  - Established pregnancy
  - Known hypersensitivity to product components
  - Acute porphyria
  - **COC:** age ≥35 and smoker/vaper (stopped <1 year); BMI ≥35; BP >140/90 mmHg or controlled hypertension; migraine with aura; previous VTE; breast cancer history; multiple CVD risk factors
  - **POP:** cardiovascular disease history; breast cancer; desogestrel — meningioma history; drospirenone — hyperkalaemia, renal impairment, undiagnosed bleeding, diabetes (drospirenone-specific)
  - Enzyme-inducing drugs/herbals (within 4 weeks of stopping)
- Under 16 lacking Fraser-guidelines capacity
- 16+ assessed as lacking capacity to consent
- Clinical unsuitability per UKMEC Category 4 or PGD exclusion list
- Request outside PGD product/method scope (LARC, patch, ring not supplied under oral OC PGDs)

**Pharmacy cannot (under PGD):**
- Fit or administer LARC — must signpost/refer to sexual health clinic, GP, or gynaecology
- Supply every contraceptive brand or method — only PGD-listed COC and POP products
- Override PGD exclusions — must refer or signpost alternative contraception
- Diagnose hypertension — BP check supports safe supply; abnormal readings trigger referral per pathway
- Replace comprehensive sexual health clinic for complex gynaecology, STI treatment, or abortion counselling

**LARC signposting (mandatory discussion per specification):**
- All OC consultations must include conversation regarding alternative and more effective contraception, e.g. LARC
- If LARC appropriate and acceptable: signpost/refer to fitting service; OC supply may proceed in parallel if eligible

**Shared PCS pathway elements (see emergency-contraception-research-v1.md Section 1.2):**
- Same commissioning registration and PRN02207 PGD family
- Same staff competency framework (CPPE/CoSRH e-SRH modules)
- Same safeguarding requirements (Fraser guidelines under 16; safeguarding lead contact under 13)
- Same GP notification/consent framework (Section 4.13–4.14 specification)
- Same pharmacy technician authorisation from October 2025
- Same data sharing for service monitoring (NHS England, NHSBSA PPV)

### 1.3 Private service variants (typical UK pharmacy)

- Walk-in or booked contraception consultation for disclosed fee (`{{private_contraception}}`)
- May supply COC/POP outside NHS PCS where pharmacy has private PGD/protocol or pharmacist independent prescriber
- Broader access possible but same clinical governance — assessment still required
- Fee typically covers consultation + medicine supply; varies by pharmacy and product
- NHS eligibility not required; may serve visitors, those at non-PCS pharmacies, or outside commissioning hours
- LARC referral signposting still clinically required regardless of funding route

### 1.4 Typical appointment structure

**NHS PCS ongoing oral contraception consultation:**
1. Patient contact — walk-in, phone triage, or booked slot (`{{booking_link}}`, `{{phone}}`)
2. Private consultation room — confidential assessment (`{{consultation_room}}`)
3. Consent and capacity assessment (Fraser guidelines if under 16; safeguarding if under 13)
4. Clinical history — contraceptive history, medical history, migraine history, smoking/vaping, medicines (including OTC/herbal/enzyme inducers), allergies, pregnancy status, bleeding patterns
5. **Biometrics for COC** — blood pressure (BIHS-validated monitor per specification), height, weight, BMI calculation per NICE NG136
6. GP record check where consent given (GP Connect or equivalent)
7. Contraindication screening per UKMEC and PGD — COC vs POP selection
8. Discussion of all contraception options including **LARC** — shared decision-making
9. Product selection per PGD criteria and local formulary
10. Supply with PIL, written advice, missed-pill guidance, VTE warning signs
11. STI/condom advice where appropriate; signpost sexual health services
12. Documentation per PGD specification; GP notification where consent given
13. Follow-up interval agreed — annual review minimum; BP re-check at COC renewals

**Typical duration:** ~20–45 minutes (initiation/switching longer than straightforward ongoing resupply; COC BP/BMI adds time)

**Staff:** GPhC-registered pharmacist or pharmacy technician — both must be PCS-trained and PGD-authorised (technician scope from Oct 2025)

**Supply quantities (specification/PGD):**
- **Initiation:** up to **3 months** in original labelled packs
- **Ongoing supply:** **minimum 6 months**, up to **12 months** unless clinical reason to restrict (documented). CoSRH/FSRH guidance supports avoiding short supplies that increase discontinuation risk

---

## 2. PATIENT INTENT

### 2.1 Why patients seek pharmacy ongoing contraception

- Running out of current pill — GP appointment wait too long
- Want to start the pill for the first time without GP wait
- Switching pill brands due to side effects — within pharmacy scope after assessment
- Restarting pill after break (postpartum, stopped temporarily)
- Moved area — need new local supply source
- GP surgery no longer prescribing contraception routinely / directed to pharmacy
- Prefer high-street access — evenings/weekends (`{{opening_hours}}`)
- Confidential contraception advice without GP embarrassment
- Follow-up after emergency contraception — starting ongoing contraception
- Heard about free NHS pharmacy contraception service
- Cost saving vs private online pill services
- Carer booking for dependent where appropriate

### 2.2 Common triggers

- Last pill in pack — "I need my repeat before it runs out"
- GP appointment cancelled or weeks away
- Side effects on current pill — considering switch
- Postpartum return to contraception planning
- New relationship — starting contraception
- Pharmacy poster, NHS campaign, or social media about pharmacy pill service
- Friend recommendation — "my pharmacy does the pill now"
- Seasonal/travel — need supply before holiday
- Weight/BP check reminder from previous pharmacy supply

### 2.3 Common concerns (intent-level)

- "Can a pharmacy really give me the pill?"
- Embarrassment discussing contraception at pharmacy counter
- Fear of judgment from pharmacist about sexual activity
- Confidentiality — will parents/partner/GP find out
- Whether pharmacy supply is as safe as GP
- Blood pressure check anxiety — "what if it's too high?"
- Which pills are included — is my brand available?
- Cost — NHS free vs private fee confusion
- Whether they need GP referral first
- Side effects and health risks (VTE, migraine)
- Age limits — under 16 consent
- What happens if pharmacist says no
- Difference between combined pill and mini pill
- Missed pills — will pharmacy help or send to GP?
- Whether this replaces sexual health clinic for coils/implants

### 2.4 Typical motivations

- Convenience and speed — avoid GP wait
- Continuity — same pill without interruption
- Free NHS care where PCS commissioned (`{{nhs_contraception_service}}`)
- Trusted healthcare professional — pharmacist medicines expertise
- Extended hours / weekend access (`{{opening_hours}}`)
- Local high street — no hospital/clinic travel
- Integrated care — BP check and pill in one visit
- Confidential private room — sensitive topic
- Clear next steps — LARC signposting if wanted

---

## 3. PATIENT QUESTIONS (Raw Research List)

**Format note:** Questions only. Not written as publish FAQs. **Count: 58**.

### 3.1 Eligibility and suitability

1. Can I get my contraceptive pill from a pharmacy instead of my GP?
2. Who is eligible for the NHS Pharmacy Contraception Service?
3. Do I need a GP referral to get the pill at a pharmacy?
4. Can I start the pill for the first time at a pharmacy?
5. Can I get ongoing supply of my current pill at the pharmacy?
6. Is the pharmacy contraception service available at every pharmacy?
7. Am I eligible for free NHS contraception at this pharmacy?
8. Can I get the pill if I'm not registered with a GP?
9. Can I get contraception at the pharmacy if I'm under 16?
10. Can I come alone at 15 without telling my parents?
11. Can I get the pill if I'm over 50?
12. What's the age limit for the combined pill at a pharmacy?
13. What's the age limit for the mini pill at a pharmacy?
14. Can I use the pharmacy service if I'm breastfeeding?
15. Can I get the pill if I might be pregnant?
16. What if the pharmacist says I'm not eligible?

### 3.2 Appointments and access

17. Do I need an appointment or can I walk in?
18. How do I book a contraception consultation at the pharmacy?
19. How long does the appointment take?
20. What are your opening hours for contraception appointments?
21. Can I get same-day contraception at the pharmacy?
22. Can I book online?
23. How soon can I get an appointment before my pill runs out?
24. Can I request a female pharmacist?
25. How private is the consultation?
26. Will other customers know why I'm there?
27. Can someone come with me to the appointment?

### 3.3 Pill types, switching, and supply

28. Which contraceptive pills can the pharmacy supply?
29. Can I switch to a different pill at the pharmacy?
30. Will I get the same brand I've always had?
31. What's the difference between the combined pill and the mini pill?
32. Is drospirenone (Slinda) available at the pharmacy?
33. How many months of pills will I get?
34. Why would I only get 3 months instead of 12?
35. Can I get a year's supply at once?
36. What if my usual pill isn't in the PGD list?
37. Can the pharmacy give me the contraceptive patch or ring?
38. Can the pharmacy fit a coil or implant?

### 3.4 Blood pressure, health checks, and contraindications

39. Do I need a blood pressure check every time?
40. What blood pressure is too high for the combined pill?
41. Can I use my home blood pressure reading?
42. Do I need a BMI check for the pill?
43. Can I get the combined pill if I smoke?
44. Can I get the pill if I have migraine?
45. What if I had a blood clot before?
46. Can I get the pill if I take epilepsy medication?
47. Will my medicines affect which pill I can have?

### 3.5 NHS and cost

48. Is the pharmacy contraception service free on the NHS?
49. How much does private contraception cost at a pharmacy?
50. What's the difference between NHS and private contraception at a pharmacy?
51. Do I need an NHS number?
52. Will my GP be told I got the pill from the pharmacy?

### 3.6 Aftercare, missed pills, and follow-up

53. What side effects should I expect from the pill?
54. What if I miss pills — can the pharmacy advise me?
55. When do I need to come back for review?
56. What symptoms mean I should stop the pill and get help?
57. Should I get an STI test?
58. Where can I get a coil or implant instead?

---

## 4. PATIENT CONCERNS (Raw Research List)

**Count: 24**

1. Uncertainty whether pharmacy pill supply is as thorough as GP
2. Embarrassment asking at pharmacy counter in public
3. Fear of judgment about sexual activity or contraceptive choices
4. Worry pharmacist will tell parents (under 16 or living at home)
5. Worry GP or partner will be informed without consent
6. Anxiety about blood pressure check — fear of exclusion if high
7. Concern BP reading will be inaccurate or "white coat hypertension"
8. Confusion about which pills are in NHS pharmacy scope
9. Fear of being refused supply and left without contraception
10. Uncertainty whether NHS free vs private cost (`{{private_contraception}}`)
11. Worry about side effects — weight gain, mood changes, bleeding
12. Fear of blood clots (VTE) on combined pill
13. Migraine history — worry about safety of combined pill
14. Smoking/vaping and age — combined pill exclusion anxiety
15. Medicine interaction worry (epilepsy drugs, St John's Wort, antibiotics)
16. Belief pharmacy only does repeats not initiation
17. Fear of being overheard in consultation room or pharmacy
18. Uncertainty about age limits and parental consent
19. Concern service not available at local pharmacy (`{{nhs_contraception_service}}`)
20. Worry GP will disapprove of bypassing surgery
21. Shame about needing contraception — cultural/religious barriers
22. Confusion between this service and emergency contraception
23. Concern short supply (3 months) means extra pharmacy visits
24. Fear coil/implant discussion is pushy or mandatory switch

---

## 5. CLINICAL FACTS

### 5.1 Oral contraception methods in PCS scope

| Method | PCS PGD supply? | Age range (PCS) | Key monitoring |
|--------|----------------|-----------------|----------------|
| Combined oral contraceptive (COC) | Yes — PRN02207_iv | Menarche–49 years | **BP + BMI required** per NICE NG136 |
| POP — norethisterone, levonorgestrel, desogestrel | Yes — PRN02207_v | Menarche–54 years | Medical history; no routine BP for POP alone |
| POP — drospirenone (e.g. Slinda) | Yes — PRN02207_v (from Oct 2025) | Menarche–49 years | Renal/K⁺ considerations; **must start day 1 of cycle** |
| Cu-IUD / hormonal IUS / implant / injection | No — signpost/refer only | — | LARC discussion mandatory |
| Contraceptive patch / vaginal ring | No — outside oral OC PGDs | — | Signpost GP/clinic |
| Oral emergency contraception | Separate PGD component — see EC research | — | Not covered here |

**Key principle:** PCS ongoing OC is for **routine contraceptive use** — initiation, review, and resupply with contraindication screening. Distinct from time-sensitive EC pathway.

### 5.2 Combined oral contraceptive (COC) — PGD PRN02207_iv

**Indications under PGD:**
- Initiation (first-time, after pill-free break, switch to new pill)
- Ongoing supply of current COC previously initiated in primary care/pharmacy/sexual health

**Required measurements:**
- Blood pressure per NICE NG136 — BIHS-validated monitor in pharmacy (not DSP)
- BMI — height and weight
- Self-reported BP/BMI acceptable if pharmacist deems clinically suitable (recorded as self-reported)

**BP thresholds (PGD exclusion):**
- BP **>140/90 mmHg** — excluded from COC supply
- Controlled hypertension — excluded
- UKMEC Category 3–4 hypertension bands apply — Stage 2+ (≥160/≥100) Category 4

**Key COC exclusions (PGD — not exhaustive):**
- Age ≥35 and current smoker/vaper or stopped <1 year ago
- BMI ≥35 kg/m²
- BP >140/90 or controlled hypertension
- Multiple CVD risk factors (smoking/vaping, diabetes, hypertension, obesity, dyslipidaemia)
- Current or past VTE; ischaemic heart disease; stroke/TIA
- Migraine **with aura** at any age
- Migraine without aura where first attack occurred on estrogen-containing contraception
- Current or past breast cancer
- Known thrombogenic mutations; first-degree relative VTE <45 years
- Complicated valvular/congenital heart disease; cardiomyopathy; atrial fibrillation
- Established pregnancy
- Acute porphyria; enzyme inducers (within 4 weeks of stopping)
- Lactose/sucrose intolerance syndromes — check excipients per product

**Supply:**
- Initiation: up to **3 months**
- Ongoing: **6–12 months** (minimum 6 unless documented clinical reason)

**Aftercare counselling (PGD standard):**
- VTE warning signs — calf pain/swelling, breathlessness, chest pain — stop pill and seek urgent help
- First migraine or new aura — stop and seek advice
- LARC effectiveness discussion
- STI/condom advice
- How to take; missed pill rules per product; when to use additional contraception

### 5.3 Progestogen-only pill (POP) — PGD PRN02207_v

**Products in scope:**
- Norethisterone, levonorgestrel, desogestrel — to age 54
- **Drospirenone** — to age 49 (added Oct 2025); 24 active + 4 inactive pill regimen

**Key POP exclusions (PGD — not exhaustive):**
- Age over limit (55+ for standard POP; 50+ for drospirenone)
- Established pregnancy
- Acute porphyria; known hypersensitivity
- Desogestrel — meningioma or history of meningioma
- Current or past breast cancer; malignant liver tumour
- Cardiovascular disease — IHD, stroke/TIA (first attack only if on method when event occurred)
- Severe decompensated cirrhosis; hepatocellular adenoma; malabsorption surgery
- **Drospirenone-specific:** hyperkalaemia, Addison's disease, potassium-sparing diuretics/aldosterone antagonists/K⁺ supplements, severe hepatic disease, renal impairment (all stages), undiagnosed vaginal bleeding, diabetes, sex-steroid sensitive malignancies
- Enzyme inducers (within 4 weeks of stopping); interacting medicines per BNF/SPC

**Drospirenone-specific starting rules:**
- Must start on **day 1** of menstrual cycle for immediate protection
- Started after day 5 — additional precautions **7 days**; pregnancy test at 21 days if indicated
- After EC: 48 hours additional precautions (7 days for drospirenone); 5-day delay after UPA before restarting hormonal contraception

**Supply:**
- Initiation: up to **3 months**
- Ongoing: **6–12 months** (minimum 6 unless documented reason)

**Cautions:**
- Malabsorption (IBD/Crohn's) — POP may be less effective; LARC recommended
- GLP-1 agonists — may reduce oral contraception effectiveness; additional barrier methods; CoSRH PIL
- Medications causing diarrhoea/vomiting (orlistat, laxatives) — effectiveness concern

### 5.4 Blood pressure monitoring — clinical role

| Scenario | Action |
|----------|--------|
| COC initiation or ongoing supply | BP measurement required — pharmacy BIHS-validated device or acceptable self-report |
| BP ≤140/90, no other exclusions | COC may proceed if otherwise eligible |
| BP >140/90 or controlled hypertension | **COC excluded** — offer POP if eligible or refer GP/clinic |
| POP only (no estrogen) | Routine BP not required for PGD supply; hypertension history still relevant to counselling |
| Raised BP found incidentally | Signpost GP; may link to Hypertension Case-Finding Service where commissioned — cannot double-claim same activity |
| Patient anxious about BP | Explain purpose — safety screening, not diagnosis; white-coat effect acknowledged |

**Owner link:** Related service `blood-pressure-checks` — integrated messaging but PCS BP is part of contraception consultation not standalone diagnosis.

### 5.5 UKMEC framework — pharmacy application

Pharmacists apply UKMEC categories via PGD exclusion lists (Category 4 = must not use; Category 3 = usually excluded in PGD for pharmacy supply without specialist input):

| Condition | COC (CHC) typical UKMEC | Pharmacy action |
|-----------|------------------------|-----------------|
| Migraine with aura | Category 4 | Exclude COC; POP may be option |
| Migraine without aura, age <35 | Category 2 | COC may be possible |
| Smoker age ≥35 | Category 4 | Exclude COC |
| BMI ≥35 | Category 3 (PGD excludes) | Exclude COC; discuss POP/LARC |
| BP 140–159/90–99 | Category 3 (PGD excludes) | Exclude COC |
| BP ≥160/≥100 | Category 4 | Exclude COC |
| Previous VTE | Category 4 | Exclude COC |
| Breastfeeding <6 weeks | Category 4 for CHC | POP usually preferred |

**Reference:** FSRH/CoSRH UKMEC (2016, amended; 2025 update published — master should cite current version at publish).

### 5.6 Under-16 governance

- **Fraser guidelines (Gillick competence):** Capacity assessment mandatory and documented for under-16s
- **Under 13:** Contact local safeguarding lead; follow local safeguarding policy
- **16+ lacking capacity:** Capacity assessment; consider sexual assault/vulnerability
- Confidentiality maintained where competent — no automatic parental notification
- Chaperone may be requested by either party — document in record

### 5.7 Initiation vs ongoing supply — clinical distinction

| Feature | Initiation | Ongoing supply |
|---------|-----------|----------------|
| Definition | First pill; restart after break; switch to new pill | Continue current pill; previous supply from GP/pharmacy/clinic still in use |
| Max supply | 3 months | 6–12 months |
| Assessment depth | Full history, contraindication screen, method choice, LARC discussion | Review changes since last supply; BP/BMI for COC; confirm still eligible |
| Switching pill | Classed as initiation | N/A — new pill is initiation |
| GP record check | Recommended with consent | Recommended with consent |

### 5.8 Common side effects (oral contraception — counselling topics)

**COC:** Nausea, breast tenderness, headache, breakthrough bleeding, mood changes, weight change (patient concern — evidence mixed)

**POP:** Irregular bleeding, amenorrhoea, breast tenderness, acne, mood changes

**Serious — stop and seek urgent help:** Signs of VTE (COC especially), severe abdominal pain, sudden severe headache with neuro symptoms, chest pain, jaundice

### 5.9 Missed pill guidance — pharmacy role

- Pharmacist can provide **signposting and advice** for missed pills within competence
- Rules differ by COC vs POP vs drospirenone — CoSRH missed pill charts apply
- Complex scenarios (multiple missed pills, vomiting, enzyme inducers, EC interaction) may need GP/sexual health referral
- Missed pills in fertile window may need **emergency contraception** — redirect to EC pathway (separate service)
- After UPA-EC: delay restarting hormonal contraception 5 days

---

## 6. RED FLAGS

### 6.1 Urgent medical review required (999 / same day)

**999 / A&E:**
- Suspected VTE — unilateral leg swelling/pain, breathlessness, chest pain, haemoptysis (especially on COC)
- Suspected stroke — sudden weakness, speech difficulty, facial droop
- Severe allergic reaction to supplied medicine — anaphylaxis
- Suspected ectopic pregnancy — severe unilateral abdominal pain, shoulder tip pain, collapse
- Severe headache with neuro symptoms — possible stroke/MRV on COC

**Same-day GP / urgent care / sexual health:**
- Positive pregnancy test — contraception review; pregnancy options pathway
- BP severely elevated with symptoms — hypertensive emergency
- New migraine with aura while on COC — stop COC same day
- Unexplained severe abdominal pain on COC — consider hepatic/adnexal pathology
- Suspected STI requiring treatment — sexual health clinic

### 6.2 Referral required (non-emergency but mandatory)

- **LARC desired** — refer to fitting service (coil, implant, injection)
- **PGD exclusion met** — GP or sexual health clinic for alternative contraception
- COC excluded (BP, migraine with aura, VTE history, smoker ≥35) — POP if eligible, else LARC/GP
- Complex medical history outside PGD — GP or specialist
- Under 13 — safeguarding referral per local policy
- Under 16 failing Fraser capacity — follow local policy
- Request for patch, ring, or non-PGD brand — GP/clinic
- Enzyme inducers — specialist contraception advice; LARC often preferred
- Undiagnosed abnormal bleeding — GP/gynaecology before continuing OC
- Pregnancy prevention plan with teratogenic medicines — specialist/highly effective method

### 6.3 When pharmacy NHS PCS ongoing OC is NOT appropriate

- PGD exclusion criteria met (Section 5.2–5.3)
- Patient lacks capacity and cannot consent
- Established pregnancy
- Method outside oral OC PGD scope
- No prior OC supply for "ongoing" pathway and person does not meet initiation criteria
- BP/BMI cannot be confirmed for COC and patient cannot provide acceptable measurement

### 6.4 When private contraception may still proceed but with limits

- Private fee-based supply where pharmacy offers non-NHS pathway
- Same PGD-equivalent clinical governance expected for safe supply
- NHS PCS claim not made — patient pays `{{private_contraception}}`
- LARC signposting and exclusion rules still apply

---

## 7. MYTHS (Real Misconceptions Only)

**Count: 24**

| # | Misconception | Research correction (not publish prose) |
|---|---------------|----------------------------------------|
| 1 | Pharmacy can supply any contraceptive method | PCS covers selected COC and POP only — not coils, implants, injections, patch, ring |
| 2 | Pharmacy contraception is the same as emergency contraception | Ongoing OC is routine contraception; EC after UPSI is separate time-sensitive pathway |
| 3 | Every pharmacy offers free NHS contraception | Pharmacy must be registered for PCS with authorised staff |
| 4 | No clinical assessment needed — just hand over the pill | Structured consultation, contraindication screen, and documentation always required |
| 5 | Pharmacy replaces GP for all women's health | PCS complements GP — complex gynaecology, LARC fitting, and excluded patients need GP/clinic |
| 6 | You always get 12 months of pills | Initiation max 3 months; ongoing 6–12 months — minimum 6 unless clinical reason |
| 7 | Blood pressure check is optional for the combined pill | COC supply requires BP and BMI per specification — exclusion if >140/90 |
| 8 | Mini pill and combined pill have the same rules | Different contraindications, age limits, starting rules — drospirenone has unique requirements |
| 9 | Smoking doesn't matter for the pill at any age | Smokers/vapers ≥35 excluded from COC under PGD |
| 10 | Migraine never affects pill choice | Migraine with aura excludes COC; history determines POP vs COC eligibility |
| 11 | Pharmacy can fit a coil or implant | Signpost/refer only — pharmacy cannot insert LARC |
| 12 | GP must refer you to pharmacy | Self-referral to participating PCS pharmacy where commissioned |
| 13 | Pharmacist will automatically tell your parents if under 16 | Fraser guidelines govern confidentiality for competent under-16s |
| 14 | You can't start the pill at a pharmacy — only repeats | Initiation included since December 2023 expansion |
| 15 | All pill brands are available at every pharmacy | PGD scope + local ICB formulary determines products supplied |
| 16 | Private online pill services are equivalent to pharmacy | Pharmacy assessment includes BP, UKMEC screening, and GP liaison |
| 17 | The pill causes infertility long-term | No evidence routine OC affects future fertility after stopping |
| 18 | You should stop the pill periodically for a "break" | No medical requirement for pill-free break — CoSRH supports continuous use where appropriate |
| 19 | Missed pill rules are the same for all pills | COC, desogestrel POP, levonorgestrel POP, drospirenone — different rules |
| 20 | Breastfeeding means you cannot use any pill | POP generally suitable; CHC excluded early postpartum |
| 21 | BP check at pharmacy diagnoses hypertension | Screening for safe supply — diagnosis is GP role |
| 22 | Pharmacy technician cannot provide contraception | Pharmacy technicians authorised under PGD from October 2025 |
| 23 | Drospirenone POP starts the same as other mini pills | Drospirenone must start day 1 of cycle; 7-day precautions if later |
| 24 | If refused COC you have no options at pharmacy | POP may still be eligible; LARC signposting; GP referral |

---

## 8. TRUST FACTORS

- GPhC-registered premises and regulated professionals
- PCS-trained pharmacist or pharmacy technician under PGD governance
- Private consultation room — confidential sensitive discussion
- Non-judgemental professional approach to sexual health
- Evidence-based contraindication screening — UKMEC/PGD compliance
- BIHS-validated BP equipment for COC supply
- All contraception options discussed including LARC referral
- Honest eligibility communication — explains exclusions clearly
- NHS commissioned free service where eligible (`{{nhs_contraception_service}}`)
- Transparent private fee before supply (`{{private_contraception}}`)
- Safeguarding-trained staff for under-16 presentations
- GP notification with consent — continuity of care
- Adequate supply duration (6–12 months ongoing) — reduces interruption risk
- Missed pill and VTE safety-netting
- CPPE/CoSRH competency-trained staff
- Professional indemnity and clinical governance
- Documentation for patient records and audit

---

## 9. LOCAL PHARMACY ADVANTAGES

- High street access — no GP appointment for routine pill supply
- Same-day and walk-in availability where offered
- Extended evening/weekend hours (`{{opening_hours}}`)
- Faster access than GP appointment for resupply
- Private consultation room (`{{consultation_room}}`)
- Phone triage for suitability (`{{phone}}`)
- Online booking (`{{booking_link}}`)
- Free NHS supply where PCS commissioned (`{{nhs_contraception_service}}`)
- BP check integrated with contraception consultation
- Pharmacist medicines expertise — interaction checking
- No GP referral required for self-referral NHS PCS pathway
- LARC signposting in same visit — holistic contraception counselling
- Linked emergency contraception at same pharmacy (separate pathway — see EC research)
- Local familiarity — repeat health services hub

**Caveats:** Not every pharmacy offers NHS PCS; LARC requires referral elsewhere; COC excluded if BP high — POP or GP alternative needed.

---

## 10. OWNER VARIABLES

| Variable | Purpose |
|----------|---------|
| `{{phone}}` | Triage, booking enquiries, supply urgency |
| `{{opening_hours}}` | Access for working patients — evenings/weekends |
| `{{booking_link}}` | Online booking URL if offered |
| `{{consultation_room}}` | Private confidential consultation facility |
| `{{nhs_contraception_service}}` | NHS PCS ongoing OC active at this pharmacy (yes/no) |
| `{{private_contraception}}` | Private contraception consultation + supply fee if NHS unavailable |

**Additional owner fields for Stage 2:** Walk-in policy, female pharmacist availability, languages, safeguarding lead contact, GP notification practice, LARC referral partner (`{{larc_referral}}`), participating PCS registration confirmation, product formulary list.

---

## 11. PATIENT EMOTIONS (Stage 1 Enhancement)

**Format:** Research notes only. Not publish copy.

### 11.1 Relief at avoiding GP wait

| Field | Research note |
|-------|---------------|
| **Trigger** | Last pills in pack; GP appointment weeks away |
| **Patient concern** | "I'll run out and be unprotected" |
| **Typical behaviour** | Urgent attendance; wants quick supply; minimal history disclosure initially |
| **Common questions** | Can I get my pill today? / Do I need an appointment? / How many packs can I have? |

### 11.2 Embarrassment and shame

| Field | Research note |
|-------|---------------|
| **Trigger** | First contraception consultation; small community pharmacy |
| **Patient concern** | Everyone will know; pharmacist will judge me |
| **Typical behaviour** | Whispers at counter; avoids eye contact; prefers phone first; may request female staff |
| **Common questions** | Is it confidential? / Can I speak privately? / Will you tell my GP? |

### 11.3 Anxiety about blood pressure check

| Field | Research note |
|-------|---------------|
| **Trigger** | Combined pill user; previous high reading; white-coat fear |
| **Patient concern** | "They'll refuse me if BP is high" |
| **Typical behaviour** | Arrives stressed; asks if home reading counts; nervous during measurement |
| **Common questions** | What if my BP is too high? / Can I use my own reading? / Will I have to stop the pill? |

### 11.4 Fear of exclusion/refusal

| Field | Research note |
|-------|---------------|
| **Trigger** | Smoker, migraine history, previous clot, age near limit |
| **Patient concern** | "I'll leave with nothing" |
| **Typical behaviour** | Pre-emptively discloses or hides history; anxious throughout |
| **Common questions** | Can I still get the pill if I smoke? / What if I've had migraine? / What are my alternatives? |

### 11.5 Confusion about service scope

| Field | Research note |
|-------|---------------|
| **Trigger** | Heard "pharmacy does contraception" — unclear what's included |
| **Patient concern** | Wrong service for their need (coil, EC, patch) |
| **Typical behaviour** | Asks for coil at pharmacy; conflates with EC |
| **Common questions** | Can you fit a coil? / Is this the morning-after pill service? / Which pills do you do? |

### 11.6 Worry about side effects and health risks

| Field | Research note |
|-------|---------------|
| **Trigger** | Friend warnings; social media; previous bad experience |
| **Patient concern** | Clots, weight gain, mood, fertility impact |
| **Typical behaviour** | Extensive questioning; may want to switch brands |
| **Common questions** | Is the pill safe? / Will it affect my fertility? / What side effects will I get? |

### 11.7 Under-16 fear of parental involvement

| Field | Research note |
|-------|---------------|
| **Trigger** | Young person alone; school-age |
| **Patient concern** | Parents will be told; school will find out |
| **Typical behaviour** | Reluctance to give details; asks confidentiality upfront |
| **Common questions** | Do my parents need to know? / Can I come alone at 15? / Will it go on my record? |

### 11.8 Frustration at supply limits

| Field | Research note |
|-------|---------------|
| **Trigger** | Expected 12 months; received 3 months at initiation |
| **Patient concern** | Extra trips; cost; inconvenience |
| **Typical behaviour** | Questions why less than GP gave previously |
| **Common questions** | Why only 3 months? / When can I get more? / My GP used to give a year |

### 11.9 Uncertainty switching methods

| Field | Research note |
|-------|---------------|
| **Trigger** | Side effects on current pill; wants different method |
| **Patient concern** | Gap in protection; wrong choice |
| **Typical behaviour** | Brings multiple pill packs; asks pharmacist to decide |
| **Common questions** | Can I switch pills here? / What's better — combined or mini? / Do I need a break between pills? |

### 11.10 Trust-seeking after GP redirect

| Field | Research note |
|-------|---------------|
| **Trigger** | GP surgery directed patient to pharmacy for contraception |
| **Patient concern** | Pharmacy is "second best" to GP |
| **Typical behaviour** | Compares thoroughness; asks about GP notification |
| **Common questions** | Is this as good as seeing my GP? / Will my GP know? / Why did my doctor send me here? |

---

## 12. ORAL CONTRACEPTION OPTIONS KNOWLEDGE (Stage 1 Enhancement)

**Format:** Evidence-based research notes. Not advice copywriting. Section maps COC, POP (including drospirenone), LARC signposting, BP/BMI requirements, and supply rules per PRN02207 PGDs and NHS PCS specification.

### 12.1 Combined oral contraceptive (COC)

| Field | Research note |
|-------|---------------|
| **Mechanism** | Estrogen + progestogen — inhibits ovulation, thickens cervical mucus, thins endometrium |
| **Age range (PCS)** | Menarche up to and including 49 years |
| **Required checks** | BP + BMI at initiation and ongoing supply per NICE NG136 |
| **BP exclusion** | >140/90 mmHg; controlled hypertension |
| **Key exclusions** | Smoker/vaper ≥35; BMI ≥35; migraine with aura; VTE history; breast cancer; multiple CVD risks |
| **Initiation supply** | Up to 3 months original packs |
| **Ongoing supply** | 6–12 months (min 6 unless documented reason) |
| **Starting** | Day 1–5 of cycle standard; quick-start protocols per CoSRH where appropriate |
| **LARC discussion** | Mandatory — COC less effective than LARC methods |
| **Pharmacy role** | Full assessment, BP/BMI, supply under PGD, VTE counselling, GP notification |

### 12.2 Progestogen-only pill — standard (norethisterone, levonorgestrel, desogestrel)

| Field | Research note |
|-------|---------------|
| **Mechanism** | Progestogen only — thickens cervical mucus; may inhibit ovulation (desogestrel) |
| **Age range (PCS)** | Menarche up to and including 54 years |
| **Required checks** | Medical history; no routine BP for POP alone |
| **Key exclusions** | Breast cancer; CVD history; desogestrel — meningioma; enzyme inducers; acute porphyria |
| **Initiation supply** | Up to 3 months |
| **Ongoing supply** | 6–12 months |
| **Starting** | Day 1–5 immediate protection; after day 5 if not pregnant — 48h extra precautions (standard POP) |
| **When preferred** | COC excluded (BP, migraine with aura, smoker ≥35); breastfeeding; VTE risk |
| **Pharmacy role** | Assessment, supply, missed pill advice, LARC signposting |

### 12.3 Progestogen-only pill — drospirenone (Oct 2025 addition)

| Field | Research note |
|-------|---------------|
| **Brand example** | Slinda (4mg drospirenone) |
| **Regimen** | 24 active + 4 inactive pills — 4-day hormone-free interval |
| **Age range (PCS)** | Menarche up to and including 49 years (excluded 50+) |
| **Key exclusions** | Hyperkalaemia; renal impairment; K⁺-sparing drugs; diabetes; undiagnosed bleeding; hepatic disease |
| **Starting rule** | **Must start day 1** of cycle for immediate protection |
| **Late start** | After day 5 — 7 days additional precautions; pregnancy test at 21 days if indicated |
| **After EC** | 7 days additional precautions if starting after LNG; 5-day delay after UPA before restarting any hormonal contraception |
| **Pharmacy role** | Same as POP with drospirenone-specific screening and counselling |

### 12.4 LARC — signposting and referral

| Field | Research note |
|-------|---------------|
| **Methods** | Cu-IUD, hormonal IUS, implant, injectable (Depo) |
| **Effectiveness** | >99% — superior to oral methods |
| **Pharmacy role** | Cannot fit/administer — mandatory discussion; refer if acceptable |
| **When to emphasise** | POP/COC less effective preferences; malabsorption; enzyme inducers; teratogenic medicines; repeated user errors |
| **Referral** | Sexual health clinic, GP with LARC service, community gynaecology |
| **Specification requirement** | OC consultation must include LARC conversation |

### 12.5 COC vs POP — comparison summary

| Feature | COC | Standard POP | Drospirenone POP |
|---------|-----|--------------|------------------|
| Max age (PCS) | 49 | 54 | 49 |
| BP required | Yes | No (routine) | No (routine) |
| Smoker ≥35 | Excluded | May be eligible | May be eligible |
| Migraine with aura | Excluded | May be eligible | May be eligible |
| Cycle control | Often regular periods | Irregular bleeding common | 4-day break pattern |
| Start flexibility | Day 1–5 standard | Flexible | **Day 1 only** for immediate protection |
| VTE risk | Higher than POP | Lower | Lower |

### 12.6 Supply duration — decision reference

| Scenario | Max supply | Minimum | Notes |
|----------|-----------|---------|-------|
| Initiation (any OC) | 3 months | — | First supply or switch |
| Ongoing COC/POP | 12 months | 6 months | Document if <6 months |
| Running out urgently | Per assessment | — | Same-day supply where eligible |
| New contraindication found | No supply | — | Refer; alternative method |

### 12.7 BP and BMI — clinical decision matrix

| Reading/finding | COC | POP |
|-----------------|-----|-----|
| BP ≤140/90, BMI <35, no other exclusions | Eligible if UKMEC allows | Eligible if no exclusions |
| BP 141–159/90–99 | **Excluded** | Eligible if otherwise OK |
| BP ≥160/100 | **Excluded** — GP same day if symptomatic | Eligible if otherwise OK |
| BMI ≥35 | **Excluded** | Eligible if otherwise OK |
| Smoker ≥35 | **Excluded** | Eligible if otherwise OK |
| Self-reported BP acceptable | If pharmacist deems suitable — record source | N/A for routine POP |

---

## 13. CLINICAL DECISION FRAMEWORK (Stage 1 Enhancement)

**Format:** Clinical reference for master content accuracy. Not patient-facing copy.

### 13.1 Ongoing COC resupply — eligible, BP acceptable

| Field | Detail |
|-------|--------|
| **Presentation** | Current COC user; supply running out; no new contraindications |
| **Assessment** | History review; BP + BMI; medicines check; pregnancy excluded |
| **Options** | Same COC ongoing supply 6–12 months |
| **LARC** | Discuss as per specification |
| **Pharmacy action** | Supply; safety-netting; GP notification if consented |
| **Urgency** | **Routine** — plan before pack ends |

### 13.2 COC initiation — new starter, eligible

| Field | Detail |
|-------|--------|
| **Presentation** | First COC; no exclusions; BP/BMI acceptable |
| **Assessment** | Full UKMEC screen; method counselling |
| **Options** | COC per formulary — up to 3 months |
| **LARC** | Discuss; signpost if preferred |
| **Pharmacy action** | Initiate; PIL; VTE warnings; follow-up plan |
| **Urgency** | **Routine** |

### 13.3 COC excluded — POP eligible alternative

| Field | Detail |
|-------|--------|
| **Presentation** | BP >140/90; or smoker ≥35; or migraine with aura; wants contraception |
| **Options** | POP if no POP exclusions; else LARC referral |
| **Pharmacy action** | Explain exclusion; offer POP assessment or refer |
| **Urgency** | **Routine to urgent** if supply imminently running out |

### 13.4 Switching pills — treated as initiation

| Field | Detail |
|-------|--------|
| **Presentation** | Side effects; wants different pill |
| **Assessment** | Full contraindication screen for new product |
| **Options** | New pill if eligible — max 3 months first supply |
| **Pharmacy action** | Switching counselling per CoSRH; additional precautions if needed |
| **Urgency** | **Routine** |

### 13.5 Raised BP at consultation

| Field | Detail |
|-------|--------|
| **Presentation** | COC requested; BP >140/90 |
| **Options** | No COC; POP if eligible; GP for BP management |
| **Pharmacy action** | Repeat measurement if appropriate; exclude COC; signpost GP and BP services |
| **Urgency** | **Routine** — BP management GP; contraception continuity via POP if suitable |

### 13.6 Under-16 presentation

| Field | Detail |
|-------|--------|
| **Presentation** | Under 16 seeking OC |
| **Assessment** | Fraser guidelines capacity — document |
| **Under 13** | Safeguarding lead contact |
| **Pharmacy action** | Supply if competent and clinically eligible; follow local policy if not |
| **Urgency** | **Routine** |

### 13.7 Enzyme inducers / interacting medicines

| Field | Detail |
|-------|--------|
| **Presentation** | On enzyme inducer or significant interaction |
| **Options** | Often excluded from PGD; LARC strongly preferred |
| **Pharmacy action** | Medicine history critical; refer if excluded |
| **Urgency** | **Routine** |

### 13.8 LARC preferred — OC not desired

| Field | Detail |
|-------|--------|
| **Presentation** | Patient wants coil/implant |
| **Options** | Refer to LARC provider — pharmacy cannot fit |
| **Pharmacy action** | Signpost/refer; interim OC only if needed and eligible pending LARC appointment |
| **Urgency** | **Routine** — timely referral to avoid gap |

---

## 14. PATIENT JOURNEY RESEARCH (Stage 1 Enhancement)

**Format:** Journey map for master content structure. Not publish copy.

### 14.1 Awareness

| Field | Research note |
|-------|---------------|
| **Patient goals** | Know pharmacy can supply pill; find local PCS pharmacy |
| **Patient concerns** | Thought only GP could prescribe; don't know service exists |
| **Information needs** | NHS free option; initiation not just repeats |
| **Common misunderstandings** | Same as emergency contraception; any pharmacy has it |

### 14.2 Trigger (supply running out / want to start)

| Field | Research note |
|-------|---------------|
| **Patient goals** | Continuity without gap; start contraception promptly |
| **Patient concerns** | GP wait; embarrassment; cost |
| **Information needs** | Walk-in vs book; how soon can I get pills |
| **Common misunderstandings** | Must see GP first; pharmacy only for repeats |

### 14.3 Contact and booking

| Field | Research note |
|-------|---------------|
| **Patient goals** | Appointment before pack empty; discreet enquiry |
| **Patient concerns** | Overheard on phone; long wait |
| **Information needs** | Booking link; what to bring; BP check warning for COC |
| **Common misunderstandings** | No appointment needed ever; partner can attend without patient |

### 14.4 Consultation

| Field | Research note |
|-------|---------------|
| **Patient goals** | Leave with pill; understand how to take |
| **Patient concerns** | Intrusive questions; BP failure; judgment |
| **Information needs** | Step-by-step; confidentiality; product choice |
| **Common misunderstandings** | No assessment; can get any brand; coil available on site |

### 14.5 Supply and immediate aftercare

| Field | Research note |
|-------|---------------|
| **Patient goals** | Adequate supply duration; clear instructions |
| **Patient concerns** | Side effects; missed pills; VTE symptoms |
| **Information needs** | How to start; what if vomit; when protected |
| **Common misunderstandings** | Protected immediately regardless of start day; no follow-up needed |

### 14.6 Follow-up (months)

| Field | Research note |
|-------|---------------|
| **Patient goals** | Seamless resupply; review if problems |
| **Patient concerns** | BP re-check anxiety; side effects persisting |
| **Information needs** | When to return; annual review; GP if concerns |
| **Common misunderstandings** | One visit lasts forever; no BP needed again |

### 14.7 LARC / method change

| Field | Research note |
|-------|---------------|
| **Patient goals** | More reliable method; stop pill side effects |
| **Patient concerns** | Referral wait; gap in cover |
| **Information needs** | Where to get coil/implant; interim pill if needed |
| **Common misunderstandings** | Pharmacy fits LARC; must stay on pill until LARC fitted (may need bridging) |

---

## 15. CONTENT OPPORTUNITY RESEARCH (Stage 1 Enhancement)

**Format:** Ranked opportunities for future master content. Not content itself.

### 15.1 Strongest patient questions — ranked

| Rank | Question theme | Priority | Rationale |
|------|----------------|----------|-----------|
| 1 | Can I get my pill from the pharmacy without GP? | **HIGH** | Core service awareness |
| 2 | Is pharmacy contraception free on NHS? | **HIGH** | Access barrier; commissioning |
| 3 | Do I need a blood pressure check? | **HIGH** | COC-specific; anxiety driver |
| 4 | Which pills are included? | **HIGH** | Scope accuracy |
| 5 | Can I start the pill at the pharmacy? | **HIGH** | Initiation misconception |
| 6 | How many months supply will I get? | **HIGH** | 3 vs 6–12 confusion |
| 7 | Confidentiality / under 16 | **HIGH** | Access barrier young people |
| 8 | Can pharmacy fit coil/implant? | **HIGH** | Scope boundary |
| 9 | Walk-in or appointment? | **HIGH** | Owner variable |
| 10 | What if BP too high / I'm refused? | **MEDIUM** | Exclusion anxiety |
| 11 | Combined vs mini pill difference | **MEDIUM** | Method choice |
| 12 | Switching pills at pharmacy | **MEDIUM** | Common intent |
| 13 | Difference from emergency contraception | **MEDIUM** | Service separation |
| 14 | Side effects and blood clots | **MEDIUM** | Safety counselling |
| 15 | Missed pill advice | **MEDIUM** | Signpost to EC if needed |

### 15.2 Strongest myths — ranked

| Rank | Myth | Priority | Rationale |
|------|------|----------|-----------|
| 1 | Pharmacy supplies all contraception methods | **HIGH** | Scope accuracy |
| 2 | Same as emergency contraception service | **HIGH** | Service separation |
| 3 | No assessment — just pick up pill | **HIGH** | Clinical governance |
| 4 | Every pharmacy offers free NHS service | **HIGH** | Commissioning |
| 5 | Pharmacy fits coils/implants | **HIGH** | LARC signposting |
| 6 | Only repeats not initiation | **HIGH** | Dec 2023 expansion unknown |
| 7 | Always get 12 months | **MEDIUM** | Supply rules |
| 8 | BP check optional for combined pill | **MEDIUM** | Safety requirement |
| 9 | Smoking OK at any age on combined pill | **MEDIUM** | Key exclusion |
| 10 | GP must refer first | **MEDIUM** | Self-referral access |

### 15.3 Strongest concerns — ranked

| Rank | Concern | Priority | Rationale |
|------|---------|----------|-----------|
| 1 | Embarrassment / judgment | **HIGH** | Access barrier |
| 2 | BP check failure / exclusion | **HIGH** | COC users |
| 3 | Confidentiality (parents/GP) | **HIGH** | Trust |
| 4 | Not as thorough as GP | **HIGH** | Trust building |
| 5 | Service not at local pharmacy | **HIGH** | Owner variable |
| 6 | Refused supply — no alternatives | **HIGH** | POP/LARC messaging |
| 7 | Side effects / VTE fear | **MEDIUM** | Safety counselling |
| 8 | NHS vs private cost | **MEDIUM** | Owner variable |
| 9 | Supply duration too short | **MEDIUM** | Initiation vs ongoing |
| 10 | Confusion with EC service | **MEDIUM** | Cross-link EC master |

### 15.4 Strongest trust factors — ranked

| Rank | Trust factor | Priority | Rationale |
|------|--------------|----------|-----------|
| 1 | Confidential private consultation | **HIGH** | Sensitive service |
| 2 | Non-judgemental professional care | **HIGH** | Embarrassment barrier |
| 3 | Proper BP/contraindication screening | **HIGH** | Clinical credibility |
| 4 | LARC options discussed honestly | **HIGH** | Patient-centred |
| 5 | NHS free where commissioned | **HIGH** | Access |
| 6 | Clear exclusion explanation + alternatives | **HIGH** | Refusal anxiety |
| 7 | GP notification with consent | **MEDIUM** | Continuity |
| 8 | Adequate supply duration | **MEDIUM** | Convenience trust |
| 9 | CPPE/PCS-trained staff | **MEDIUM** | Professional trust |
| 10 | Transparent private fee | **MEDIUM** | Cost trust |

---

## 16. KNOWLEDGE GAPS — REVIEW AND RECOMMENDATIONS (Stage 1 Enhancement)

### 16.1 Gaps addressed in v1

| Gap | Status in v1 |
|-----|--------------|
| Ongoing vs initiation pathway unclear | **Addressed** — Sections 1.2, 5.7, 12.6 |
| BP/BMI requirements underdeveloped | **Addressed** — Sections 5.4, 12.7, 13.5 |
| PGD contraindications incomplete | **Addressed** — Sections 5.2–5.3, 5.5, 6 |
| Drospirenone Oct 2025 addition | **Addressed** — Sections 1.2, 5.3, 12.3 |
| Pharmacy technician scope | **Addressed** — Sections 1.2, 1.4 (cross-ref EC research) |
| Patient emotional drivers | **Addressed** — Section 11 (10 emotions) |
| Clinical decision framework | **Addressed** — Section 13 (8 bands) |
| Patient journey | **Addressed** — Section 14 (7 stages) |
| Content priorities | **Addressed** — Section 15 (ranked) |
| EC service separation | **Addressed** — throughout; cross-ref EC research |

### 16.2 Remaining missing clinical information

| Gap | Recommendation |
|-----|----------------|
| Devolved nations pathways (Scotland/Wales/NI) | Document England-only in Master V1; flag UK owners for local appendix |
| Full UKMEC 2025 table reproduction | Master references UKMEC — not reproduce full table |
| Local ICB formulary product lists | Owner variable at publish — `{{formulary_products}}` optional Stage 2 |
| Detailed CoSRH missed-pill algorithms | Master references pharmacist assessment — link to CoSRH charts |
| Independent prescriber private pathways outside PGD | Owner-dependent — generic private variant sufficient |
| Zoely/other brand-specific exclusions | PGD notes product-specific excipients — clinical sign-off at publish |

### 16.3 Remaining missing patient concerns

| Gap | Recommendation |
|-----|----------------|
| Cultural/religious barriers to contraception | Sensitive master tone guidance — not clinical scope |
| Language/accessibility | Owner variable — `{{languages}}` at publish |
| Trans and non-binary patients | Reasonable adjustments — brief inclusive language in master |
| Post-coercion trafficking indicators | Safeguarding — staff training scope; not patient-facing detail |
| Men seeking contraception advice for partners | Signpost appropriately — PCS eligibility is for individual receiving supply |

### 16.4 Remaining missing trust factors

| Gap | Recommendation |
|-----|----------------|
| Named pharmacist credentials | Owner variable at publish |
| Local sexual health clinic LARC partnerships | Owner confirmation — `{{larc_referral}}` |
| Patient reviews/testimonials | Publish-stage owner content |

### 16.5 Remaining missing pathway information

| Gap | Recommendation |
|-----|----------------|
| Owner PCS sign-up status | Required before publish — `{{nhs_contraception_service}}` |
| Private fee | Owner variable — `{{private_contraception}}` |
| LARC referral pathway locally | Owner variable Stage 2 |
| GP notification practice | Local policy — consent-based framework in specification |
| DSP pharmacy BP measurement limits | Specification — BP cannot be done at DSP; master flags if owner is DSP |

### 16.6 Recommendations before Master V1

1. **Human clinical sign-off** on Sections 5, 6, 12, 13 (PGD thresholds, BP exclusions, product scope, red flags)
2. **Confirm England-only scope** for NHS PCS claims in master
3. **Owner variables** remain placeholders until pharmacy onboarding
4. **Use Section 15 HIGH-priority items** to drive master emphasis
5. **Use Section 11 emotions** for tone guidance — not publish prose
6. **Use Section 14 journey** to structure patient-facing flow
7. **Cross-link emergency-contraception master** — clear service separation; shared PCS registration
8. **Replace master research source** from generic intelligence to this document

---

## RESEARCH COMPLETENESS SCORE (V1)

| Area | Weight | Score (0–10) | Notes |
|------|--------|--------------|-------|
| 1. Service definition | 8% | 9 | PCS Oct 2025 + PGD mapped; initiation/ongoing distinguished; EC cross-ref |
| 2. Patient intent | 7% | 9 | Emotions and triggers covered |
| 3. Patient questions (50+) | 10% | 10 | 58 questions |
| 4. Patient concerns (20+) | 7% | 10 | 24 concerns + ranked |
| 5. Clinical facts | 12% | 9 | PRN02207 COC/POP + spec; pending sign-off |
| 6. Red flags | 10% | 9 | VTE, BP exclusion, safeguarding |
| 7. Myths (20+) | 7% | 10 | 24 myths + ranked |
| 8. Trust factors | 5% | 9 | Ranked opportunities added |
| 9. Local advantages | 4% | 8 | Owner-dependent |
| 10. Owner variables | 4% | 9 | Six core variables defined |
| 11. Patient emotions | 10% | 9 | 10 emotions mapped |
| 12. OC options knowledge | 8% | 10 | COC, POP, drospirenone, LARC, BP, supply durations |
| 13. Clinical decision framework | 8% | 9 | 8 decision bands |
| 14. Patient journey | 5% | 9 | 7 stages mapped |
| 15. Content opportunities | 5% | 9 | Ranked HIGH/MEDIUM/LOW |

**Weighted completeness score: 9.2 / 10**

---

## REMAINING KNOWLEDGE GAPS (Summary)

1. Devolved nations pathways — England-only recommended for Master V1
2. Owner confirmation — PCS participation, private fee, LARC referral partner
3. Human clinical sign-off — not yet recorded
4. Local ICB formulary product lists — owner/onboarding
5. UKMEC 2025 full adoption timeline in PGD updates — verify at publish
6. Cultural/accessibility adaptations — publish-stage owner content

**Critical gaps blocking Master V1:** Items 2 and 3 only (owner vars can remain as placeholders per benchmark pattern).

---

## READINESS SCORE FOR MASTER V1

| Criterion | Score | Max | Notes |
|-----------|-------|-----|-------|
| Factual research completeness | 9.2 | 10 | v1 complete |
| Clinical pathway documented | 9 | 10 | Pending sign-off |
| Patient intent/emotion coverage | 9 | 10 | Section 11 complete |
| Question/concern inventory | 10 | 10 | Exceeds minimums |
| OC options knowledge (Section 12) | 10 | 10 | Complete |
| Clinical decision framework | 9 | 10 | Section 13 complete |
| Journey mapping | 9 | 10 | Section 14 complete |
| Content priority guidance | 9 | 10 | Section 15 complete |
| Owner variables identified | 9 | 10 | Six placeholders defined |
| EC service separation documented | 9 | 10 | Cross-ref throughout |
| Human clinical review | 0 | 10 | Not yet recorded |
| Publish scope decision (England) | 7 | 10 | Recommended not yet formalised |

**Readiness score: 8.2 / 10**

---

## RECOMMENDATION

### **READY FOR MASTER V1**

**Conditions:**

1. Master V1 author uses this document as sole research source (replacing generic intelligence reference)
2. Clinical reviewer signs off Sections 5, 6, 12, and 13 before QA checklist
3. Master treats owner variables as placeholders (same pattern as emergency-contraception-research-v1.md)
4. Master scope: England NHS PCS ongoing oral contraception (initiation + ongoing supply) + generic private variant
5. **Emergency contraception treated as separate service** — brief cross-link only; no EC clinical detail in this master
6. Section 15 HIGH-priority items drive master emphasis; LOW-priority items may be brief or omitted
7. LARC always framed as signpost/refer — never pharmacy supply/fitting claim
8. BP >140/90 COC exclusion stated accurately; POP alternative messaging where eligible

**Research foundation is comprehensive enough that Master V1 can be written without additional factual research**, provided the conditions above are met during drafting and review.

**Do not create:** publish content, service pages, variations, area pages, hub pages, or HTML as part of this research task.

---

## Document Control

| Version | Date | Change |
|---------|------|--------|
| v1.0 | 2026-06-22 | Initial Stage 1 research foundation — sections 1–16; ongoing OC focus; PCS Oct 2025; PRN02207 COC/POP |

**Next step:** Clinical sign-off → update `pharmacy-contraception-service-master-v1.md` research source to this document (Stage 2)
