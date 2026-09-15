# Prescription Dispensing — Stage 1 Research Foundation (V1)

**Document type:** Research foundation only  
**Service ID:** `prescription-dispensing`  
**Category:** `core-pharmacy` (NHS essential service + private prescriptions)  
**Benchmark process:** Pharmacy First framework (`MASTER-SERVICE-CREATION-PROCESS.md` Stage 1)  
**Benchmark document:** `blood-pressure-checks-research-v1.1.md`  
**Status:** Draft for human clinical review  
**Created:** 2026-06-22  

**Purpose:** Comprehensive clinical and patient-intent research before any master library prose is written. This document is not publish content.

---

## Source Material (Evidence Base)

| Source | Reference | Use in this document |
|--------|-----------|----------------------|
| Human Medicines Regulations 2012 | Prescription-only medicine supply, dispensing governance | Legal basis for clinical screening before supply |
| GPhC Standards for Registered Pharmacies | Professional standards for safe and effective pharmacy care | Clinical check, accuracy check, counselling obligations |
| NHS Community Pharmacy Contractual Framework (England) | Essential service — dispensing | NHS dispensing obligations, EPS, exemptions |
| NHS Business Services Authority | NHS prescription charges and exemptions (2025/26) | England charge £9.90 per item; exemption categories |
| NHS Digital / EPS guidance | Electronic Prescription Service | Nomination, token, paper FP10 coexistence |
| Misuse of Drugs Regulations 2001 | Controlled drugs Schedules 2–5 | ID requirements, record-keeping, Schedule 2/3 rules |
| NHS Dictionary of Medicines and Devices (dm+d) | Generic/branded equivalence | Generic substitution framework |
| Community Pharmacy England | Dispensing and EPS guidance | Patient-facing process clarifications |
| Internal intelligence | `data/pharmacy-service-intelligence/prescription-dispensing.json` | Patient intent signals, question seeds |
| Internal expertise | `data/pharmacy-service-expertise/prescription-dispensing.json` | Concerns, risk factors, content boundaries |
| Internal expansion | `data/pharmacy-service-expansion/prescription-dispensing.json` | Preparation notes, comparison points |
| Internal blueprint | `data/pharmacy-service-blueprints/prescription-dispensing.json` + `src/pharmacy/pharmacyServiceBlueprintSeeds.ts` | Myths, process steps, unsuitability criteria |

**Verification note:** Prescription charge and exemption categories mapped to NHSBSA 2025/26 rates (England). Devolved nations have no prescription charge — master content should note England focus for charge claims. Owner-specific EPS nomination, delivery, and private dispensing scope must be confirmed locally before publish claims.

---

## 1. SERVICE DEFINITION

### 1.1 What the service is

- Regulated supply of prescription-only medicines (POMs) from a GPhC-registered community pharmacy
- **Clinical screening** of every prescription by a pharmacist before supply — mandatory under Human Medicines Regulations and GPhC standards
- **Accuracy checking** of prepared medicines against the prescription and patient record
- Patient **counselling at handover** — especially for new medicines, dose changes, and complex regimens
- Handling of **NHS prescriptions** (FP10 paper and Electronic Prescription Service) and **private prescriptions**
- Interaction, allergy, and duplicate therapy screening against patient medicines record
- Prescriber query resolution when clinical concerns arise — supply deferred until resolved
- Labelling, packaging, and documentation for safe home use
- Repeat prescription integration where pharmacy manages ongoing supply
- Optional **delivery** where pharmacy offers it (`{{delivery_available}}`)
- **EPS nomination** support — electronic transfer of prescriptions from GP to nominated pharmacy (`{{eps_nomination}}`)
- Private prescription dispensing with disclosed fees (`{{private_dispensing}}`)

### 1.2 NHS essential dispensing service (England)

**Service name (official):** NHS Essential Service — Dispensing (Community Pharmacy Contractual Framework)

**Commissioning:** Core contractual obligation for all NHS England community pharmacies. Not an optional Advanced Service — dispensing is the foundation essential service.

**Primary purpose:**
- Supply prescribed medicines safely and accurately to NHS patients
- Perform clinical checks before every supply
- Provide patient counselling to support adherence and reduce medicines-related harm
- Maintain patient medicines records
- Integrate with EPS for efficient prescription transfer

**Who can use NHS dispensing:**
- Any patient with a valid NHS prescription (FP10 or EPS)
- Prescription must be legally valid — signed/date by appropriate prescriber, correct form, within validity period
- Patient or authorised proxy collects (with ID for controlled drugs)

**Pharmacy cannot (without prescriber authorisation):**
- Alter prescription directions, dose, drug, or quantity
- Supply without resolving clinical queries
- Diagnose conditions or initiate treatment without valid prescription (except separate commissioned services)
- Guarantee universal turnaround times — depends on prescription complexity, stock, queries

**Prescription validity (England — research note):**
- Standard FP10 validity: generally 6 months from appropriate date (unless specified otherwise for certain medicines)
- Controlled drugs: shorter validity periods apply (Schedule 2/3 typically 28 days)
- EPS prescriptions follow same clinical validity rules when downloaded

### 1.3 Private prescription dispensing (typical UK pharmacy)

- Supply against private prescription from GP, dentist, nurse prescriber, pharmacist prescriber, or hospital
- Patient pays **medicine cost + dispensing fee** — fees vary by pharmacy (`{{private_dispensing}}`)
- Same clinical governance as NHS — clinical check, accuracy check, counselling
- No NHS prescription charge applies — private prescription and product costs are separate
- May include hospital discharge prescriptions, specialist private clinics, travel medicines not on NHS
- Pricing, delivery options, and turnaround communicated locally — owner variables required at content stage

### 1.4 Typical dispensing workflow structure

**Prescription receipt (EPS or paper):**
1. Prescription received — EPS download to nominated pharmacy or paper FP10/token presented
2. Prescription logged on patient medicines record (PMR)
3. Patient identity confirmed; exemption status checked (England)

**Clinical check (pharmacist):**
4. Prescription clinically screened — legality, appropriateness, dose, interactions, allergies, duplicates
5. Queries raised with prescriber if concern — supply held until resolved
6. Generic substitution applied where permitted (NHS SER and local formulary rules)

**Dispensing and accuracy check:**
7. Medicine selected, labelled, and prepared
8. Accuracy check — second staff member or pharmacist verifies against prescription ( governance-dependent)
9. Controlled drug additional checks and register entry (Schedules 2/3)

**Handover and counselling:**
10. Patient or authorised proxy collects
11. ID verified for Schedule 2/3 controlled drugs
12. Counselling provided — especially new/changed medicines; questions answered
13. Exemption/charge processed (England); documentation complete

**Partial supply (when stock unavailable):**
14. Partial supply with patient agreement and endorsement where required
15. Balance supplied when stock arrives — patient advised on timing

**Typical duration:**
- Repeat prescriptions (no queries): may be ready same day or within 24–48 hours — **pharmacy-dependent, no universal promise**
- New prescriptions requiring clinical review: typically longer — allow 48–72 hours unless pharmacy states otherwise
- Urgent/emergency supply pathways exist separately (Emergency Supply service — distinct from routine dispensing)

**Staff:** Pharmacist performs clinical check; dispensing technicians/accredited staff prepare under pharmacist supervision; accuracy checker per local SOP; responsible pharmacist oversees overall governance.

---

## 2. PATIENT INTENT

### 2.1 Why patients seek prescription dispensing

- GP has issued new prescription — need medicines supplied
- Regular repeat medication — ongoing supply for chronic conditions
- Dose or medicine changed — need updated supply and explanation
- Running low — reorder before supply runs out
- Discharged from hospital with new medicines — need community supply and counselling
- Private specialist issued private prescription
- Switching pharmacy — EPS nomination change or new pharmacy registration
- Carer collecting on behalf of vulnerable patient
- Prefer local pharmacy over distance/hospital pharmacy
- Need delivery because housebound or mobility limited
- Questions about how to take new medicine safely
- Previous pharmacy out of stock — seeking alternative supplier
- Travelling — need supply timing coordinated (distinct from travel clinic)

### 2.2 Common triggers

- GP appointment resulting in new/changed prescription
- Repeat prescription reminder (app, SMS, pharmacy prompt)
- Running out of tablets — last dose imminent
- Hospital discharge with medication list
- Side effect concern — wants pharmacist advice at collection
- Care home or family member requesting proxy collection
- EPS nomination prompt from GP surgery
- Online/private prescriber sent prescription electronically or by post
- Medicine out of stock at previous pharmacy
- Seasonal demand (e.g. winter illness prescriptions)

### 2.3 Common concerns (intent-level)

- How long until prescription is ready?
- Will pharmacist check medicines are safe together?
- Cost — NHS charge vs exempt vs private fees
- Can someone else collect?
- Will I get counselling or just a bag of boxes?
- What if medicine is out of stock?
- EPS confusion — where did my prescription go?
- Privacy — discussing medicines on shop floor
- ID requirements for controlled drugs
- Generic vs branded — is it the same?
- Why is pharmacy querying GP — will I wait longer?
- Delivery reliability and cost

### 2.4 Typical motivations

- Convenience — local high street, extended hours
- Trust in pharmacist medicines expertise
- Faster than hospital pharmacy for community patients
- EPS nomination — prescription arrives before patient travels to pharmacy
- Relationship with regular pharmacy team who knows their medicines
- Delivery for housebound patients
- One-stop — collect prescription while shopping for OTC items
- Clear labelling and spoken instructions for complex regimens
- Avoid medicine errors through professional checking

---

## 3. PATIENT QUESTIONS (Raw Research List)

**Format note:** Questions only. Not written as publish FAQs. **Count: 72**.

### 3.1 Access and eligibility

1. How do I get my prescription dispensed at a pharmacy?
2. Do I need to register with your pharmacy first?
3. Can I use any pharmacy for my NHS prescription?
4. How do I nominate your pharmacy for EPS?
5. What is EPS and how does it work?
6. My GP sent my prescription electronically — do I still need to bring anything?
7. Can I still use a paper prescription (FP10)?
8. What if I have a token instead of a paper prescription?
9. Do I need an appointment to collect my prescription?
10. Can I get my prescription dispensed if I'm not registered with a GP?
11. Can I switch pharmacies if I'm already nominated elsewhere?
12. How do I change my EPS nomination to your pharmacy?
13. Do you dispense private prescriptions?
14. Can I use an NHS prescription in England if I live in Scotland/Wales?

### 3.2 Turnaround and process

15. How long does prescription dispensing take?
16. How long will my new prescription take compared to a repeat?
17. Can you do same-day dispensing?
18. Why does my prescription take longer sometimes?
19. What happens after my GP sends the prescription?
20. Will you text me when my prescription is ready?
21. Can I drop off my paper prescription and collect later?
22. What if my prescription hasn't arrived electronically yet?
23. How do I track whether my prescription has been received?
24. What happens during the clinical check?
25. Why do you need to query my GP before giving me my medicine?
26. Can I wait in the pharmacy while it's being prepared?
27. What are your opening hours for collection? (`{{opening_hours}}`)
28. Can I book a collection time? (`{{booking_link}}`)

### 3.3 Cost and exemptions (England focus)

29. How much is the NHS prescription charge in England?
30. Is the prescription charge per item or per prescription?
31. Am I exempt from paying prescription charges?
32. I'm over 60 — do I still pay?
33. I'm under 16 — is my prescription free?
34. I'm 16–18 in full-time education — do I pay?
35. What is a medical exemption certificate and how do I get one?
36. What is a prescription prepayment certificate (PPC)?
37. Is a PPC worth it if I have several regular medicines?
38. Do I pay if I'm on Universal Credit?
39. Are contraceptives and HRT exempt from charges?
40. Do I pay for NHS prescriptions in Scotland or Wales at your pharmacy?
41. How much does a private prescription cost?
42. What fees apply to private dispensing? (`{{private_dispensing}}`)

### 3.4 Collection, proxy, and delivery

43. Can someone else collect my prescription for me?
44. What ID does my carer need to collect my medicines?
45. Can my neighbour collect on my behalf?
46. Do you offer prescription delivery? (`{{delivery_available}}`)
47. Is delivery free on the NHS?
48. Can controlled drugs be delivered?
49. What if I'm housebound and cannot collect?
50. Can I collect for my child or elderly parent?
51. What proof do I need for Schedule 2 controlled drug collection?
52. Can my care home collect bulk prescriptions?

### 3.5 Medicines safety and counselling

53. Will the pharmacist check my medicines are safe together?
54. Will you explain how to take my new medicine?
55. What if I'm allergic to something on the prescription?
56. Can the pharmacist change my medicine to a generic?
57. Are generic medicines as good as branded ones?
58. What if the pharmacy gives me a different brand than usual?
59. Should I tell you about medicines I buy over the counter?
60. What if I think there's an error on my prescription?
61. Can the pharmacist advise on side effects at collection?
62. Will you check my blood pressure medicines with my new tablets?
63. What if I'm pregnant or breastfeeding — will you check the prescription?

### 3.6 Stock, partial supply, and queries

64. What if my medicine is out of stock?
65. Can you give me part of my prescription and the rest later?
66. Will you order the medicine specially for me?
67. Can I get an alternative if you don't have my usual brand?
68. How long until out-of-stock items arrive?
69. What happens if the pharmacist finds a problem with my prescription?
70. Can you dispense early if I'm going on holiday?
71. What if my GP hasn't approved my repeat yet?

### 3.7 Controlled drugs and special categories

72. Why do I need photo ID for some medicines?
73. Which medicines require ID to collect?
74. Can I get morphine/strong painkillers dispensed here?
75. How often can I collect controlled drug prescriptions?
76. Can I take my prescription to a different pharmacy for controlled drugs?

---

## 4. PATIENT CONCERNS (Raw Research List)

**Count: 24**

1. Anxious about how long dispensing will take
2. Worried prescription has been lost in EPS system
3. Uncertain whether medicines are safe together
4. Confused about NHS charge vs exemption status
5. Embarrassed discussing sensitive medicines in public area
6. Fear of receiving wrong medicine or wrong dose
7. Concerned generic is inferior to usual brand
8. Frustrated when pharmacy queries GP and delays supply
9. Worried about running out before repeat arrives
10. Unsure whether carer can collect without hassle
11. Confused about EPS nomination — "where is my script?"
12. Anxious about controlled drug ID requirements
13. Concerned about privacy of medicines record
14. Uncertainty about private prescription total cost
15. Worried out-of-stock means going without treatment
16. Doesn't understand partial supply — thinks something withheld
17. Fear pharmacist will refuse supply without clear reason
18. Concerned delivery won't arrive on time
19. Overwhelmed by multiple new medicines after hospital discharge
20. Doesn't want to pay £9.90 per item when struggling financially
21. Unsure if pharmacy clinical check is thorough or "just bagging boxes"
22. Worried about switching pharmacy and losing medicines history
23. Concerned about language barrier understanding counselling
24. Anxious about collecting strong painkillers due to stigma

---

## 5. CLINICAL FACTS

### 5.1 Legal and professional framework

- **Human Medicines Regulations 2012:** Prescription-only medicines must not be supplied without valid prescription; pharmacist must perform clinical assessment before supply
- **GPhC Standards:** Registered pharmacies must ensure medicines are supplied safely, effectively, and with appropriate counselling
- **Responsible pharmacist:** Legally accountable for safe pharmacy operations during each session
- Clinical check is **mandatory on every prescription** — not optional for repeats
- Pharmacist must not supply if prescription is clinically inappropriate until query resolved with prescriber

### 5.2 Clinical check components

| Check domain | Research note |
|--------------|---------------|
| Legal validity | Prescriber authorised, correct form, date, signature (where required), within validity |
| Clinical appropriateness | Indication plausible, dose within limits, duration appropriate |
| Patient factors | Age, pregnancy/breastfeeding, renal/hepatic function (if known), comorbidities |
| Interactions | Drug-drug, drug-disease, drug-food where relevant |
| Allergies/adverse reactions | Cross-check against PMR and patient declaration |
| Duplication | Same drug from multiple prescribers, therapeutic duplication |
| Monitoring | Required blood tests or monitoring in place where applicable |

### 5.3 Accuracy check

- Separate verification step after preparation — "clinical governance check"
- Confirms correct medicine, strength, form, quantity, label details against prescription
- Typically performed by second competent person (technician or pharmacist per local SOP)
- Controlled drugs require additional witness/check procedures
- Barcode scanning and PMR integration reduce error risk where used

### 5.4 EPS (Electronic Prescription Service)

- Prescriptions sent electronically from GP/hospital to nominated pharmacy
- **Nomination:** Patient chooses regular pharmacy — prescriptions download automatically
- **Token:** One-off collection at any pharmacy — patient receives token (SMS/paper) with unique ID
- Paper FP10 still valid and coexists with EPS
- EPS reduces paper handling delays but does **not** eliminate clinical check time
- Prescription may show as "pending" until prescriber releases or surgery systems sync

### 5.5 NHS prescription charges and exemptions (England 2025/26)

| Category | Charge status |
|----------|---------------|
| Standard charge | **£9.90 per prescribed item** (frozen 2025/26) |
| Under 16 | Exempt |
| 16–18 in full-time education | Exempt |
| 60 and over | Exempt |
| Medical exemption certificate (specified conditions) | Exempt |
| Maternity exemption | Exempt |
| War pension exemption | Exempt |
| NHS Low Income Scheme (HC2/HC3) | Full or partial exemption |
| Prescription prepayment certificate (PPC) | Covers all NHS items for period |
| Inpatient dispensing | Exempt |
| Certain contraceptives and HRT (specified products) | Exempt |
| Controlled drugs Schedule 2/3 | **Charge applies** unless patient exempt |

**Devolved nations:** Scotland, Wales, and Northern Ireland — **no NHS prescription charge**. Master content with England charge claims must note this geographic distinction.

### 5.6 Controlled drugs

| Schedule | Examples (illustrative) | Key dispensing rules |
|----------|------------------------|---------------------|
| Schedule 2 | Morphine, oxycodone, methylphenidate, temazepam | Strict register; **photo ID** typically required; 28-day validity; no repeat dispensing without specific authority |
| Schedule 3 | Buprenorphine, tramadol (when CD), gabapentin/pregabalin (CD status) | ID commonly required; additional record-keeping |
| Schedule 4/5 | Lower abuse potential CDs | Standard CD records; ID per local/policy |

- **Misuse of Drugs Regulations 2001** and **Human Medicines Regulations** govern supply
- Pharmacist must satisfy identity of patient or authorised collector for Schedule 2/3
- Early supply, lost prescriptions, and altered directions require prescriber re-authorisation

### 5.7 Generic substitution

- NHS: **Serious Shortage Protocol (SSP)** and **Substitution Enabled Regimes (SER)** allow specified generic substitution per NHS England guidance
- Same active ingredient, same route, same form (unless SSP specifies alternative)
- Patient may be informed when brand changes — counselling at handover
- Private prescriptions: substitution only if prescription permits or prescriber approves
- **Pharmacist cannot substitute controlled drug formulations** without explicit prescription authority

### 5.8 Partial supply

- When full quantity not in stock, pharmacy may supply available quantity with patient consent
- FP10 endorsement or EPS adjustment per current NHS rules
- Remainder supplied when stock arrives — patient given expected timeframe
- Patient should not be left without critical medicine if alternatives exist — pharmacist/clinician liaison
- Charge in England: per item supplied (each chargeable item on separate script line)

### 5.9 Counselling at handover

- GPhC expects appropriate counselling for all supplies; **enhanced for new medicines and changes**
- New Medicine Service (NMS) — separate Advanced Service for eligible new starters
- Topics: what medicine is for, how/when to take, common side effects, storage, missed dose, duration, when to seek help
- Delivery: counselling via phone or written information when face-to-face not possible
- Patient should be invited to ask questions — not rushed handover

### 5.10 Prescriber query process

- Pharmacist contacts prescriber (phone, EPS messaging, fax per local arrangement) when:
  - Dose appears incorrect or unsafe
  - Interaction or allergy concern
  - Illegible or ambiguous directions
  - Medicine unavailable and no suitable alternative without approval
  - Patient request for early supply beyond permitted limits
- **Supply deferred** until query resolved — patient informed of reason and expected timeline
- Protects patient safety — not a delay tactic

---

## 6. RED FLAGS

### 6.1 Supply must not proceed without prescriber resolution

- Known allergy to prescribed medicine or class
- Potentially fatal interaction identified
- Dose outside safe limits for patient age/weight/renal function
- Pregnancy/breastfeeding contraindication
- Duplicate therapy with existing prescription
- Prescription appears forged, altered, or stolen
- Controlled drug prescription irregularities (date, quantity, prescriber details)
- Patient appears intoxicated or not competent to consent (case-by-case clinical judgement)

### 6.2 Patient should seek urgent medical care (999 / A&E / same-day GP) — not routine dispensing

- **Anaphylaxis** or severe allergic reaction to medicine — 999
- **Suspected overdose** (deliberate or accidental) — 999
- **Serious adverse reaction** — severe rash, breathing difficulty, angioedema — 999
- **Acute mental health crisis** with risk — crisis team / 999
- **Chest pain, stroke symptoms, severe breathlessness** — 999 (may have attended for unrelated prescription)
- **Suspected child safeguarding concern** — pharmacy safeguarding protocol

### 6.3 When routine dispensing is not the right pathway

- Patient needs **Emergency Supply** (run out, GP unavailable) — separate clinical assessment under specific regulations
- Patient needs **prescriber appointment** — no valid prescription exists
- **Hospital-only or specialist** medicine not stocked in community — referral to hospital pharmacy
- **Unlicensed/special manufacture** — extended ordering timeline; may need import

### 6.4 Proxy collection red flags

- Collector cannot verify patient identity for controlled drugs
- Third party appears coercive or patient may be exploited (safeguarding)
- Collector not authorised and patient not contactable for CD verification

---

## 7. MYTHS (Real Misconceptions Only)

**Count: 24**

| # | Misconception | Research correction (not publish prose) |
|---|---------------|----------------------------------------|
| 1 | Dispensing is just putting pills in a bag | Includes clinical check, preparation, accuracy check, and counselling |
| 2 | Any shop can dispense prescriptions | Only GPhC-registered pharmacies with superintendent pharmacist |
| 3 | Pharmacists never contact the GP | Prescriber queried when clinical concerns arise before supply |
| 4 | EPS means instant supply always | Clinical checks and stock availability still affect timing |
| 5 | Repeats skip the clinical check | Clinical screening applies to every supply including repeats |
| 6 | Generic medicines are inferior | Same active ingredient; same MHRA quality standards |
| 7 | Pharmacists can change my prescription dose | Cannot alter without prescriber authorisation |
| 8 | I must use the pharmacy nearest my GP | Any pharmacy can dispense NHS prescription (nomination affects EPS routing) |
| 9 | NHS prescriptions are free for everyone in the UK | England: £9.90 per item unless exempt; Scotland/Wales/NI: no charge |
| 10 | One prescription charge covers all items | England charge is **per item** on FP10/EPS |
| 11 | Private prescriptions are cheaper than NHS | Often more expensive — medicine cost plus dispensing fee |
| 12 | Controlled drugs can be collected by anyone | Schedule 2/3 typically require patient ID and authorised collector verification |
| 13 | Delivery means no counselling | Counselling provided by phone or written materials |
| 14 | If pharmacy queries GP, something is wrong with me | Queries are routine safety checks — dose, interaction, stock |
| 15 | Out of stock means I cannot get treatment | Partial supply, ordering, or prescriber-approved alternative |
| 16 | Pharmacists diagnose at dispensing | Screen for safety; diagnosis remains with prescriber |
| 17 | It's safe to share dispensed medicines | Medicines prescribed for individuals — sharing unsafe and illegal |
| 18 | All prescriptions ready in 10 minutes | New prescriptions need clinical checks — timing varies |
| 19 | EPS nomination locks me forever | Patient can change nomination at any pharmacy |
| 20 | Paper prescriptions are obsolete | FP10 and tokens still valid alongside EPS |
| 21 | Over-60s pay in England | Over 60 exempt from NHS prescription charge in England |
| 22 | Pharmacist refused supply because they don't like me | Refusal is clinical/legal — safety or validity issue |
| 23 | Brand change means pharmacy is cutting costs illegally | NHS generic substitution follows SER/SSP and regulations |
| 24 | I don't need to tell pharmacy about OTC medicines | OTC/herbal products affect interaction screening |

---

## 8. TRUST FACTORS

- GPhC-registered premises and regulated professionals
- Pharmacist performs clinical check on **every** prescription
- Accuracy checking before handover
- Clear counselling at collection — especially new/changed medicines
- Prescriber contact when safety concerns arise — not silent supply of risky combinations
- Patient medicines record maintained for continuity
- EPS integration for reliable electronic transfer (`{{eps_nomination}}`)
- Transparent NHS charge and exemption checking (England)
- Transparent private fee disclosure (`{{private_dispensing}}`)
- Delivery option for vulnerable patients (`{{delivery_available}}`)
- Professional indemnity and clinical governance
- Non-judgemental handling of sensitive medicines (mental health, contraception, pain)
- Extended opening hours vs GP for collection (`{{opening_hours}}`)
- Phone access for queries (`{{phone}}`)
- Safeguarding-trained staff for proxy collection concerns
- Integration with NMS, MUR, and other medicines support services

---

## 9. LOCAL PHARMACY ADVANTAGES

- High street convenience — collect while local
- Extended opening hours (`{{opening_hours}}`)
- EPS nomination — prescriptions arrive before you travel (`{{eps_nomination}}`)
- Delivery for housebound patients (`{{delivery_available}}`)
- Known pharmacy team familiar with patient's regular medicines
- Faster than hospital outpatient pharmacy for many community prescriptions
- Clinical checks and interaction screening at every supply
- Counselling without separate appointment
- One-stop for prescription + OTC advice + other pharmacy services
- Phone triage for stock and readiness (`{{phone}}`)
- Online booking for collection slots where offered (`{{booking_link}}`)
- Private dispensing with clear local pricing (`{{private_dispensing}}`)

**Caveats:** Turnaround varies; not all medicines stocked; controlled drug rules apply uniformly; NHS charge rules are England-specific.

---

## 10. OWNER VARIABLES

| Variable | Purpose |
|----------|---------|
| `{{phone}}` | Prescription readiness enquiries, clinical questions, nomination support |
| `{{opening_hours}}` | Collection times, dispensing cut-off times |
| `{{booking_link}}` | Online collection booking or service enquiry URL if offered |
| `{{delivery_available}}` | Whether delivery offered; eligibility; charges |
| `{{eps_nomination}}` | Whether pharmacy accepts EPS nomination; how to nominate |
| `{{private_dispensing}}` | Private prescription acceptance; fee structure; turnaround |

**Additional owner fields for Stage 2:** Typical turnaround times (local, not universal), delivery radius, parking/access, languages, out-of-hours emergency supply policy, NMS availability, stock notification (SMS/app).

---

## 11. PATIENT EMOTIONS (Stage 1 Enhancement)

**Format:** Research notes only. Not publish copy.

### 11.1 Anxiety about waiting time

| Field | Research note |
|-------|---------------|
| **Trigger** | Urgent need for antibiotics; last tablet taken; pain flare |
| **Patient concern** | "Will I be left without medicine tonight?" |
| **Typical behaviour** | Repeated phone calls; arrives before prescription sent; frustration at counter |
| **Common questions** | How long will it take? / Can you rush it? / Why isn't it ready yet? |

### 11.2 Fear of medicine error

| Field | Research note |
|-------|---------------|
| **Trigger** | Previous dispensing error (any pharmacy); complex regimen; similar drug names |
| **Patient concern** | Wrong tablet, wrong dose, wrong person |
| **Typical behaviour** | Checks label obsessively at counter; asks pharmacist to verify; reluctant to leave without confirmation |
| **Common questions** | Is this definitely the right medicine? / Can you double-check? / This looks different from last time |

### 11.3 Embarrassment about sensitive medicines

| Field | Research note |
|-------|---------------|
| **Trigger** | Mental health medicines, ED treatment, contraception, STI treatment, strong painkillers |
| **Patient concern** | Others will hear; judgement from staff or public |
| **Typical behaviour** | Whispers at counter; avoids questions; prefers delivery or quiet time collection |
| **Common questions** | Can we talk privately? / Do you have a consultation room? / Can someone else collect? |

### 11.4 Frustration when GP query delays supply

| Field | Research note |
|-------|---------------|
| **Trigger** | Pharmacist holds supply pending prescriber clarification |
| **Patient concern** | Pharmacy or GP is blocking treatment unnecessarily |
| **Typical behaviour** | Anger at staff; demands supply anyway; calls GP surgery |
| **Common questions** | Why can't you just give it to me? / My GP said it's fine / How long will the query take? |

### 11.5 Financial stress over prescription charges

| Field | Research note |
|-------|---------------|
| **Trigger** | Multiple items at £9.90 each; end of month; not aware of PPC |
| **Patient concern** | Cannot afford all items; may ration doses |
| **Typical behaviour** | Asks which items to defer; declines part of prescription; enquires about exemption |
| **Common questions** | Do I have to pay for all of these? / Is there a monthly cap? / Am I exempt? |

### 11.6 Overwhelm after hospital discharge

| Field | Research note |
|-------|---------------|
| **Trigger** | Multiple new medicines; changed doses; bag of hospital labels |
| **Patient concern** | Cannot understand what to take when; fear of dangerous combination |
| **Typical behaviour** | Brings full hospital bag; relies heavily on counselling; may bring family member |
| **Common questions** | Can you explain all of these? / Which ones replace my old tablets? / What do I stop taking? |

### 11.7 Confusion about EPS/nomination

| Field | Research note |
|-------|---------------|
| **Trigger** | GP said "sent to pharmacy" but nothing ready; changed pharmacy recently |
| **Patient concern** | Prescription lost in system |
| **Typical behaviour** | Visits multiple pharmacies; blames current pharmacy |
| **Common questions** | Where is my prescription? / Did you receive it? / Do I need to nominate you? |

### 11.8 Distrust of generic substitution

| Field | Research note |
|-------|---------------|
| **Trigger** | Different coloured tablet; different packaging; media stories |
| **Patient concern** | Generic is cheaper therefore worse; brand change caused side effects |
| **Typical behaviour** | Refuses supply; demands brand; reports perceived side effect on first dose |
| **Common questions** | Why have you changed my tablets? / Is this the same? / Can I have my usual brand? |

### 11.9 Stigma collecting controlled drugs

| Field | Research note |
|-------|---------------|
| **Trigger** | Strong opioid, ADHD medication, benzodiazepines |
| **Patient concern** | Seen as drug-seeking; ID checks feel accusatory |
| **Typical behaviour** | Minimises conversation; anxious about ID; may avoid pharmacy |
| **Common questions** | Why do I need ID? / Will this go on a record? / Can my partner collect? |

### 11.10 Carer burden and proxy anxiety

| Field | Research note |
|-------|---------------|
| **Trigger** | Collecting for elderly parent, child, or disabled partner |
| **Patient concern** | Wrong documentation; won't be allowed to collect; counselling missed for patient |
| **Typical behaviour** | Brings multiple IDs; asks for written instructions for home; double-checks names |
| **Common questions** | What do I need to bring? / Will you explain it to me for them? / Can I collect CD for my mum? |

---

## 12. DISPENSING WORKFLOW KNOWLEDGE (Stage 1 Enhancement)

**Format:** Evidence-based research notes. Not advice copywriting. Core workflow domains for master content accuracy.

### 12.1 Clinical check

| Field | Research note |
|-------|---------------|
| **What it is** | Pharmacist review of prescription and patient PMR before any medicine is prepared |
| **Legal basis** | Human Medicines Regulations 2012; GPhC Standards — supply must be safe and appropriate |
| **Components** | Validity, dose, interactions, allergies, duplicates, clinical appropriateness, monitoring |
| **When queries arise** | Contact prescriber; hold supply until resolved; document outcome |
| **Patient-facing message (research)** | "Every prescription is clinically screened — this is not optional and protects you" |
| **Pharmacy cannot skip** | Repeats included — patient status may have changed since last supply |

### 12.2 Accuracy check

| Field | Research note |
|-------|---------------|
| **What it is** | Verification that prepared item matches prescription — medicine, strength, form, quantity, label |
| **Who performs** | Second competent person per local SOP (technician or pharmacist) |
| **Purpose** | Error reduction — wrong drug/strength/label is high-harm failure mode |
| **CD addition** | Controlled drugs often require witness or dual-check per regulations |
| **Technology** | Barcode scanning linked to PMR where available |
| **Patient-facing message (research)** | "A separate accuracy check happens before you collect" |

### 12.3 EPS (Electronic Prescription Service)

| Field | Research note |
|-------|---------------|
| **What it is** | NHS electronic transfer of prescription from prescriber to pharmacy |
| **Nomination** | Patient selects regular pharmacy — scripts download automatically (`{{eps_nomination}}`) |
| **Token** | One-off supply at chosen pharmacy — SMS/paper token with unique identifier |
| **Paper coexistence** | FP10 paper prescriptions still valid — not all prescribers or settings use EPS |
| **Patient action** | Nominate pharmacy OR present token OR bring paper FP10 |
| **Timing note** | Electronic arrival ≠ instant ready — clinical check and stock still required |
| **Common issues** | Wrong nomination; surgery not yet signed; prescriber cancelled/changed script |

### 12.4 Exemptions and charges (England)

| Field | Research note |
|-------|---------------|
| **Standard charge** | £9.90 per item (2025/26 frozen) |
| **Age exemptions** | Under 16; 16–18 FT education; 60+ |
| **Certificate exemptions** | Medical exemption, maternity, war pension, HC2 full / HC3 partial |
| **PPC** | Prepayment covers all NHS items for 3 or 12 months — cost-effective for 12+ items/year |
| **Declaration** | Patient signs exemption declaration on EPS or FP10 — false claim is offence |
| **Devolved nations** | Scotland, Wales, NI — no prescription charge (note when serving cross-border patients) |
| **Selected free items** | Specified contraceptives and HRT products on NHS list |
| **CD note** | Schedule 2/3 items chargeable unless patient exempt |

### 12.5 Controlled drugs (Schedule 2/3)

| Field | Research note |
|-------|---------------|
| **Schedule 2 examples** | Morphine, oxycodone, fentanyl patches, methylphenidate, temazepam |
| **Schedule 3 examples** | Tramadol (CD), buprenorphine, gabapentin/pregabalin (Schedule 3 CD) |
| **ID requirement** | Photo ID for patient or authorised collector — passport, driving licence, etc. |
| **Register** | Schedule 2 entries in controlled drugs register — strict accountability |
| **Validity** | Typically 28 days from prescribed date |
| **Proxy rules** | Collector identity verified; patient known to pharmacy or contactable |
| **Cannot** | Alter CD prescription; early supply without prescriber approval; dispense if forgery suspected |

### 12.6 Generic substitution

| Field | Research note |
|-------|---------------|
| **NHS framework** | SER and SSP enable specified substitutions — same active ingredient |
| **Patient notification** | Brand change explained at handover; appearance may differ |
| **Clinical equivalence** | MHRA-approved generic meets same quality standards |
| **When not substituted** | Patient-specific need documented; CD without authority; SSP not active for product |
| **Private Rx** | Substitution only if prescription permits or prescriber approves |
| **Patient concern** | Necessary appearance change vs therapeutic equivalence — counselling opportunity |

### 12.7 Partial supply

| Field | Research note |
|-------|---------------|
| **When used** | Insufficient stock for full quantity |
| **Process** | Supply available quantity; endorse/adjust FP10 or EPS; order balance |
| **Patient consent** | Agreed timeline for remainder; interim supply plan if critical |
| **Charge (England)** | Charged per item line supplied |
| **Alternatives** | Different strength/tablet count with prescriber approval if clinically equivalent |
| **Risk** | Patient left without adequate course — pharmacist must mitigate (query prescriber, loan, emergency supply pathway) |

---

## 13. SUPPLY STATUS INTERPRETATION FRAMEWORK (Stage 1 Enhancement)

**Format:** Clinical reference for master content accuracy. Not patient-facing copy. Maps patient enquiry states to pharmacy actions.

### 13.1 Prescription received — in preparation

| Field | Detail |
|-------|--------|
| **Status meaning** | Prescription logged; clinical check and dispensing underway |
| **Typical cause** | Normal workflow; stock being picked |
| **Patient action** | Wait for ready notification; ask typical local turnaround |
| **Pharmacy action** | Complete clinical check, prepare, accuracy check |
| **Urgency** | **Routine** — unless patient clinically urgent (pharmacist triage) |

### 13.2 Prescription not yet received

| Field | Detail |
|-------|--------|
| **Status meaning** | EPS not downloaded or paper not presented |
| **Typical cause** | GP not signed; wrong nomination; patient hasn't dropped FP10 |
| **Patient action** | Confirm GP sent; check nomination; bring token/paper |
| **Pharmacy action** | Check EPS queue; advise nomination change; contact surgery if persistent |
| **Urgency** | **Action needed** — patient to verify GP side |

### 13.3 Clinical query pending

| Field | Detail |
|-------|--------|
| **Status meaning** | Supply on hold pending prescriber response |
| **Typical cause** | Dose query, interaction, allergy, illegibility, stock alternative needed |
| **Patient action** | Wait; do not assume GP will call patient — pharmacy or GP resolves |
| **Pharmacy action** | Document query; chase prescriber; inform patient of reason |
| **Urgency** | **Safety hold** — not arbitrary delay |

### 13.4 Ready for collection

| Field | Detail |
|-------|--------|
| **Status meaning** | Clinical and accuracy checks complete; bagged and stored |
| **Patient action** | Collect within pharmacy storage policy; bring exemption proof/ID if CD |
| **Pharmacy action** | Counselling at handover; charge processing; CD ID check |
| **Urgency** | **Collect** — some medicines storage time-limited |

### 13.5 Partial supply issued

| Field | Detail |
|-------|--------|
| **Status meaning** | Part quantity supplied; balance outstanding |
| **Patient action** | Use partial as directed; return for remainder or await contact |
| **Pharmacy action** | Order stock; recall patient; complete supply when available |
| **Urgency** | **Monitor** — ensure patient not left without adequate treatment |

### 13.6 Unable to supply — refer back to prescriber

| Field | Detail |
|-------|--------|
| **Status meaning** | Prescription cannot be dispensed safely or legally |
| **Typical cause** | Invalid prescription; unresolved query; unsuitable patient presentation |
| **Patient action** | Contact GP/prescriber for amended prescription or alternative |
| **Pharmacy action** | Explain reason clearly; document; do not supply contra-indicated medicine |
| **Urgency** | **Prescriber action required** |

### 13.7 Emergency supply pathway (distinct service)

| Field | Detail |
|-------|--------|
| **Status meaning** | Patient out of medicine; GP unavailable; separate assessment |
| **Typical cause** | Run out over weekend; lost medicine; travel |
| **Patient action** | Request emergency supply assessment — not same as routine Rx processing |
| **Pharmacy action** | Clinical assessment under emergency supply regulations; limited quantity; may charge |
| **Urgency** | **Same-day triage** — separate governance from routine dispensing |

---

## 14. PATIENT JOURNEY RESEARCH (Stage 1 Enhancement)

**Format:** Journey map for master content structure. Not publish copy.

### 14.1 Awareness

| Field | Research note |
|-------|---------------|
| **Patient goals** | Know where to take prescription; understand EPS nomination |
| **Patient concerns** | Which pharmacy to use; NHS vs private |
| **Information needs** | Registration, nomination, services offered |
| **Common misunderstandings** | Must use GP's nearest pharmacy; EPS is automatic without nomination |

### 14.2 Prescription issued

| Field | Research note |
|-------|---------------|
| **Patient goals** | Get medicine without delay |
| **Patient concerns** | GP said sent electronically — is it there? |
| **Information needs** | What to do next — wait, nominate, bring paper |
| **Common misunderstandings** | Sent to pharmacy = ready to collect immediately |

### 14.3 Pharmacy receipt and processing

| Field | Research note |
|-------|---------------|
| **Patient goals** | Accurate, safe supply |
| **Patient concerns** | Invisible process — "what are you doing back there?" |
| **Information needs** | Clinical check exists; typical wait; notification method |
| **Common misunderstandings** | Processing is just counting pills |

### 14.4 Query or delay

| Field | Research note |
|-------|---------------|
| **Patient goals** | Understand why waiting; get medicine ASAP |
| **Patient concerns** | Blame pharmacy; fear treatment withheld |
| **Information needs** | Reason for query; expected resolution time |
| **Common misunderstandings** | Query means GP made mistake — often routine safety check |

### 14.5 Collection and counselling

| Field | Research note |
|-------|---------------|
| **Patient goals** | Correct medicine; know how to take it |
| **Patient concerns** | Privacy; rushed handover; charge surprise |
| **Information needs** | Exemption proof; ID for CDs; questions welcomed |
| **Common misunderstandings** | Counselling only for new patients |

### 14.6 Ongoing repeats

| Field | Research note |
|-------|---------------|
| **Patient goals** | Seamless reorder; never run out |
| **Patient concerns** | Syncing GP approval with pharmacy stock |
| **Information needs** | Repeat ordering process; delivery; nomination |
| **Common misunderstandings** | Repeats automatic forever without GP review |

### 14.7 Problem resolution

| Field | Research note |
|-------|---------------|
| **Patient goals** | Fix error, side effect, or stock issue |
| **Patient concerns** | Complaint process; getting alternative |
| **Information needs** | Who to contact (`{{phone}}`); prescriber vs pharmacy role |
| **Common misunderstandings** | Pharmacist can change prescriber's decision without contact |

---

## 15. CONTENT OPPORTUNITY RESEARCH (Stage 1 Enhancement)

**Format:** Ranked opportunities for future master content. Not content itself.

### 15.1 Strongest patient questions — ranked

| Rank | Question theme | Priority | Rationale |
|------|----------------|----------|-----------|
| 1 | How long until my prescription is ready? | **HIGH** | Top practical concern — must caveat locally |
| 2 | How does EPS nomination work? | **HIGH** | Major access confusion |
| 3 | Do I have to pay / am I exempt? | **HIGH** | England charge driver |
| 4 | Can someone else collect? | **HIGH** | Carer/proxy common need |
| 5 | Will you check my medicines are safe? | **HIGH** | Trust and clinical value |
| 6 | What if my medicine is out of stock? | **HIGH** | Anxiety driver |
| 7 | Generic vs brand — is it the same? | **HIGH** | Frequent concern |
| 8 | Why is pharmacy contacting my GP? | **MEDIUM** | Reduces frustration |
| 9 | Do you deliver? | **MEDIUM** | Owner variable |
| 10 | Private prescription costs | **MEDIUM** | Owner variable |
| 11 | ID for controlled drugs | **MEDIUM** | Stigma and access |
| 12 | Can I use any pharmacy? | **MEDIUM** | EPS vs paper distinction |
| 13 | What happens at counselling | **MEDIUM** | New medicine confidence |
| 14 | PPC worth it? | **LOW** | Cost optimisation |
| 15 | Cross-border charges Scotland/Wales | **LOW** | Edge case |

### 15.2 Strongest myths — ranked

| Rank | Myth | Priority | Rationale |
|------|------|----------|-----------|
| 1 | Dispensing is just bagging boxes | **HIGH** | Core value proposition |
| 2 | EPS = instant ready | **HIGH** | Expectation management |
| 3 | Repeats skip clinical check | **HIGH** | Safety messaging |
| 4 | Generics inferior | **HIGH** | Adherence risk |
| 5 | Pharmacist can change prescription | **HIGH** | Scope accuracy |
| 6 | NHS free for all UK | **HIGH** | England charge accuracy |
| 7 | Per prescription not per item charge | **HIGH** | Cost surprise |
| 8 | Anyone can collect CDs | **MEDIUM** | Legal requirement |
| 9 | Must use nearest pharmacy | **MEDIUM** | Access freedom |
| 10 | Paper prescriptions obsolete | **MEDIUM** | EPS coexistence |

### 15.3 Strongest concerns — ranked

| Rank | Concern | Priority | Rationale |
|------|---------|----------|-----------|
| 1 | Waiting time uncertainty | **HIGH** | Primary frustration |
| 2 | Medicine safety/interactions | **HIGH** | Clinical trust |
| 3 | Prescription charge affordability | **HIGH** | England equity |
| 4 | EPS lost prescription | **HIGH** | System confusion |
| 5 | Generic brand change | **HIGH** | Adherence |
| 6 | Privacy at handover | **MEDIUM** | Sensitive medicines |
| 7 | GP query delay | **MEDIUM** | Experience |
| 8 | Out of stock | **MEDIUM** | Continuity of treatment |
| 9 | Controlled drug stigma | **MEDIUM** | Vulnerable patients |
| 10 | Proxy collection barriers | **MEDIUM** | Carers |

### 15.4 Strongest trust factors — ranked

| Rank | Trust factor | Priority | Rationale |
|------|--------------|----------|-----------|
| 1 | Clinical check on every prescription | **HIGH** | Differentiator from retail |
| 2 | Accuracy checking process | **HIGH** | Error prevention |
| 3 | Counselling at handover | **HIGH** | Patient safety |
| 4 | Prescriber query when needed | **HIGH** | Safety over speed |
| 5 | GPhC registration | **HIGH** | Legitimacy |
| 6 | Transparent charges/exemptions | **MEDIUM** | Financial trust |
| 7 | Delivery for vulnerable | **MEDIUM** | Access |
| 8 | Known team / PMR continuity | **MEDIUM** | Repeat patients |
| 9 | Extended hours | **MEDIUM** | Convenience |
| 10 | EPS nomination support | **MEDIUM** | Modern access |

---

## 16. KNOWLEDGE GAPS — REVIEW AND RECOMMENDATIONS (Stage 1 Enhancement)

### 16.1 Gaps addressed in v1

| Gap | Status in v1 |
|-----|--------------|
| Dispensing workflow not documented | **Addressed** — Section 12 (7 domains) |
| EPS vs paper confusion | **Addressed** — Sections 5.4, 12.3 |
| England charge/exemptions | **Addressed** — Sections 5.5, 12.4 |
| Controlled drug ID rules | **Addressed** — Sections 5.6, 12.5 |
| Patient emotions underdeveloped | **Addressed** — Section 11 (10 emotions) |
| Supply status framework missing | **Addressed** — Section 13 |
| Journey not mapped | **Addressed** — Section 14 |
| Content priorities undefined | **Addressed** — Section 15 |

### 16.2 Remaining missing clinical information

| Gap | Recommendation |
|-----|----------------|
| Exact local turnaround times | Owner variable — never universal promise |
| SER/SSP active products list | Changes frequently — master references principle not product list |
| Hospital EPS (Outpatient) vs GP EPS | Master note both exist; query workflow similar |
| Specialist compounding/unlicensed imports | Signpost to specialist — not standard dispensing |
| Veterinary prescriptions | Out of scope unless pharmacy accepts — owner flag |

### 16.3 Remaining missing patient concerns

| Gap | Recommendation |
|-----|----------------|
| Digital exclusion (EPS-only confusion) | Master offer phone/paper pathway explanation |
| Accessibility at collection counter | Owner variable — reasonable adjustments |
| Language barriers | Owner variable — `{{languages}}` at publish |
| Homeless patients without ID for CDs | Sensitive — signpost to prescriber/social care |

### 16.4 Remaining missing trust factors

| Gap | Recommendation |
|-----|----------------|
| Named superintendent pharmacist | Owner publish content |
| Patient reviews/testimonials | Publish stage |
| Accredited training certificates | Owner optional |

### 16.5 Remaining missing pathway information

| Gap | Recommendation |
|-----|----------------|
| Local delivery charges/eligibility | `{{delivery_available}}` |
| Private dispensing fee schedule | `{{private_dispensing}}` |
| SMS/app notification systems | Owner technology variable |
| Repeat ordering app/integration | Owner variable |

### 16.6 Recommendations before Master V1

1. **Human clinical sign-off** on Sections 5, 6, 12, 13 (workflow, charges, CD rules)
2. **Confirm England focus** for prescription charge claims; note devolved nations difference
3. **Owner variables** remain placeholders until pharmacy onboarding
4. **Never quote universal turnaround** — use owner-local ranges only
5. **Use Section 15 rankings** to prioritise master emphasis
6. **Use Section 11 emotions** for tone guidance — not publish prose
7. **Use Section 14 journey** to structure patient-facing flow

---

## RESEARCH COMPLETENESS SCORE (V1)

| Area | Weight | Score (0–10) | Notes |
|------|--------|--------------|-------|
| 1. Service definition | 8% | 9 | NHS essential + private mapped |
| 2. Patient intent | 7% | 9 | Core dispensing intent covered |
| 3. Patient questions (50+) | 10% | 10 | 72 questions |
| 4. Patient concerns (20+) | 7% | 10 | 24 concerns + ranked |
| 5. Clinical facts | 12% | 9 | HMR, GPhC, EPS, charges, CDs |
| 6. Red flags | 10% | 9 | Supply refusal and emergency signposting |
| 7. Myths (20+) | 7% | 10 | 24 myths + ranked |
| 8. Trust factors | 5% | 9 | Ranked opportunities added |
| 9. Local advantages | 4% | 8 | Owner-dependent |
| 10. Owner variables | 4% | 9 | Six specified variables |
| 11. Patient emotions | 10% | 9 | 10 emotions mapped |
| 12. Dispensing workflow knowledge | 8% | 9 | 7 domains per brief |
| 13. Supply status framework | 8% | 9 | 7 status bands |
| 14. Patient journey | 5% | 9 | 7 stages mapped |
| 15. Content opportunities | 5% | 9 | Ranked HIGH/MEDIUM/LOW |

**Weighted completeness score: 9.2 / 10**

---

## REMAINING KNOWLEDGE GAPS (Summary)

1. Owner confirmation — delivery, EPS nomination process, private fees, local turnaround
2. Human clinical sign-off — not yet recorded
3. Devolved nations — charge-free but dispensing rules differ slightly in presentation
4. Active SER/SSP list — too dynamic for static master
5. Local GP integration and query response times — owner/onboarding
6. Accessibility and language adaptations — publish-stage owner content

**Critical gaps blocking Master V1:** Items 1 and 2 only (owner vars can remain as placeholders per benchmark pattern).

---

## READINESS SCORE FOR MASTER V1

| Criterion | Score | Max | Notes |
|-----------|-------|-----|-------|
| Factual research completeness | 9.2 | 10 | v1 complete |
| Clinical pathway documented | 9 | 10 | Pending sign-off |
| Patient intent/emotion coverage | 9 | 10 | Section 11 complete |
| Question/concern inventory | 10 | 10 | Exceeds minimums |
| Workflow/supply framework | 9 | 10 | Sections 12–13 complete |
| Journey mapping | 9 | 10 | Section 14 complete |
| Content priority guidance | 9 | 10 | Section 15 complete |
| Owner variables identified | 9 | 10 | Six placeholders defined |
| Human clinical review | 0 | 10 | Not yet recorded |
| Publish scope decision (England charges) | 8 | 10 | Recommended with devolved note |

**Readiness score: 8.1 / 10**

---

## RECOMMENDATION

### **READY FOR MASTER V1**

**Conditions:**

1. Master V1 author uses this document as sole research source for prescription dispensing
2. Clinical reviewer signs off Sections 5, 6, 12, and 13 before QA checklist
3. Master treats owner variables as placeholders (same pattern as blood-pressure-checks V1.1)
4. Master scope: NHS essential dispensing + private prescription variant; **England focus for prescription charges** with devolved nations note
5. **Never publish universal turnaround promises** — owner-local only
6. Section 15 HIGH-priority items drive master emphasis; LOW-priority may be brief or omitted

**Research foundation is comprehensive enough that Master V1 can be written without additional factual research**, provided the conditions above are met during drafting and review.

**Do not create:** publish content, service pages, variations, area pages, hub pages, or HTML as part of this research task.

---

## Document Control

| Version | Date | Change |
|---------|------|--------|
| v1 | 2026-06-22 | Initial Stage 1 research foundation — dispensing workflow, supply framework, journey, content opportunities |

**Next step:** Clinical sign-off → `prescription-dispensing-master-v1.md` (Stage 2)
