# Repeat Prescriptions — Stage 1 Research Foundation (V1)

**Document type:** Research foundation only  
**Service ID:** `repeat-prescriptions`  
**Category:** `core-pharmacy`  
**Benchmark process:** Pharmacy First framework (`MASTER-SERVICE-CREATION-PROCESS.md` Stage 1)  
**Benchmark document:** `emergency-contraception-research-v1.md`  
**Status:** Draft for human clinical review  
**Created:** 2026-06-22  

**Purpose:** Comprehensive patient-intent and workflow research before any master library prose is written. This document is not publish content.

**Scope boundary:** This research covers NHS repeat **ordering**, EPS nomination, electronic repeat dispensing (eRD), GP authorisation liaison, reorder timing, collection coordination, and pharmacy-managed repeat cycles. It does **not** duplicate the dispensing clinical-check detail covered in `prescription-dispensing-research-v1.md` — clinical screening at supply is referenced only where it affects reorder expectations.

---

## Source Material (Evidence Base)

| Source | Reference | Use in this document |
|--------|-----------|----------------------|
| NHS England Digital | [Electronic Prescription Service (EPS) — dispensers](https://digital.nhs.uk/services/electronic-prescription-service/dispensers) | Nomination, EPS workflow, dispenser obligations |
| NHS England Digital | [Electronic repeat dispensing (eRD)](https://digital.nhs.uk/services/electronic-prescription-service/electronic-repeat-dispensing/maximising-erd) | Batch prescribing, Spine delivery intervals, prescriber control |
| NHS England | [Electronic repeat dispensing (eRD) long read](https://www.england.nhs.uk/long-read/electronic-repeat-dispensing-erd/) | GP contract requirement (April 2019+), 12-month batch authorisation |
| Community Pharmacy England | [EPS Nominations & Patient Choice](https://cpe.org.uk/quality-and-regulations/other-regulatory-and-terms-of-service-requirments/eps-nominations-patient-choice/) | Patient choice, nomination governance, Terms of Service |
| Community Pharmacy England | [NHS updates EPS nomination standards](https://cpe.org.uk/our-news/nhs-updates-eps-nomination-standards/) | Consent-based nomination, prohibited automated re-nomination |
| Community Pharmacy England | [Prescription prepayment certificates (PPCs)](https://cpe.org.uk/dispensing-and-supply/prescription-processing/receiving-a-prescription/patient-charges/prescription-prepayment-certificates-ppcs/) | PPC guidance, HRT PPC, pharmacy sale of PPCs |
| Community Pharmacy England | [NHS prescription charges frozen 2026/27](https://cpe.org.uk/our-news/nhs-prescription-charges-frozen-for-the-second-year-running/) | Current England charge rates |
| GOV.UK / DHSC | [Prescription charges frozen 2025/26 and 2026/27](https://www.gov.uk/government/news/cost-of-living-boost-for-millions-as-prescription-charges-frozen) | £9.90 per item; PPC rates |
| GOV.UK | [Get a prescription prepayment certificate](https://www.gov.uk/get-a-ppc) | PPC eligibility, purchase routes |
| GPhC | [Standards for pharmacy professionals](https://www.pharmacyregulation.org/pharmacists/standards-and-guidance-pharmacy-professionals/standards-pharmacy-professionals) | Person-centred care, partnership with others, professional judgement |
| GPhC | [Standards for registered pharmacies](https://www.pharmacyregulation.org/standards/standards-for-registered-pharmacies) | Principle 4 — safe supply; medicines obtained, stored, supplied safely |
| NHS Business Services Authority | eRD cancellation and Spine guidance | Batch cancellation, synching, pharmacy communication |
| Internal intelligence | `data/pharmacy-service-intelligence/repeat-prescriptions.json` | Patient intent signals, question seeds |
| Internal authority | `data/pharmacy-service-authority/repeat-prescriptions.json` | Myths, best practice, safety considerations |
| Internal expertise | `data/pharmacy-service-expertise/repeat-prescriptions.json` | Concerns, risk factors, content boundaries |
| Internal expansion | `data/pharmacy-service-expansion/repeat-prescriptions.json` | EPS deep dive, preparation guide, timeline notes |
| Internal blueprint | `data/pharmacy-service-blueprints/repeat-prescriptions.json` | Concerns, myths, process steps, FAQ library |
| Internal blueprint seeds | `src/pharmacy/pharmacyServiceBlueprintSeeds.ts` (`repeat-prescriptions`) | Core myths, reorder FAQs, related services |

**Verification note:** Prescription charge rates mapped to DHSC/CPE announcements for 2025/26 and 2026/27 (England). EPS nomination standards reflect NHS England/CPE updated guidance (2025–2026). Owner-specific reorder channels, delivery, reminder services, and surgery liaison processes (`{{repeat_ordering_method}}`) must be confirmed locally before publish claims. England-focused for NHS charge and EPS claims; devolved nations differ.

---

## 1. SERVICE DEFINITION

### 1.1 What the service is

- **Repeat medication ordering support** — helping patients on long-term NHS medicines reorder before supplies run out
- **EPS nomination guidance** — setting or changing nominated pharmacy so prescriptions flow electronically from GP surgery to chosen dispenser
- **Reorder timing advice** — typically 7–10 days before last dose; longer for items requiring ordering or GP authorisation
- **GP surgery liaison** — pharmacy contact with surgery when authorisation is delayed, items rejected, dose changed, or prescription not received on Spine
- **Electronic repeat dispensing (eRD) coordination** — supporting patients on GP-authorised batch prescriptions delivered automatically to nominated pharmacy at prescriber-set intervals
- **Collection and delivery coordination** — ready notifications, carer/proxy collection, optional home delivery (`{{delivery_available}}`)
- **Synchronisation support** — aligning multiple repeat items where possible to reduce partial collections
- **Medication continuity planning** — holiday supply requests (GP authorisation), bank holiday lead times, housebound/carer workflows
- **Signposting to GP** when medicine changes, new symptoms, or clinical review needed — pharmacy does not authorise repeats
- **Integration with dispensing** — once prescription arrives, standard NHS dispensing applies (clinical check detail in `prescription-dispensing` master, not here)
- Delivered by GPhC-registered pharmacy team under NHS essential service and professional standards

### 1.2 NHS repeat prescribing pathway (England) — patient and pharmacy roles

**Service name (context):** Repeat prescribing is a **GP/practice-managed** process; pharmacy provides **dispensing** (essential service) and **patient support** for ordering, nomination, and supply coordination. There is no separate NHS "Repeat Prescription Service" Advanced Service — content must not overclaim a commissioned standalone service unless owner offers additional private repeat-management (`{{repeat_management_service}}`).

**How standard repeat prescribing works:**

1. **GP adds medicine to repeat list** — patient must be on stable long-term treatment; GP retains clinical responsibility
2. **Patient orders repeat** — via GP surgery (online, app, phone, repeat slip) OR pharmacy orders on patient's behalf where locally agreed and consented
3. **GP authorises** — doctor or authorised prescriber approves each repeat cycle (unless on eRD batch — see Section 12)
4. **Prescription issued** — electronically via EPS to nominated pharmacy, or paper FP10/token
5. **Pharmacy receives and dispenses** — download from Spine or receive paper; supply after dispensing workflow
6. **Patient collects** — or delivery where offered

**EPS nomination (Electronic Prescription Service):**

- Patient chooses **nominated pharmacy** (or dispensing GP practice, or appliance contractor — up to three nominations)
- Prescriptions sent electronically to nomination — no paper collection from surgery in most cases
- Nomination set/changed only with **patient consent** — at GP surgery, pharmacy, NHS App, or patient access app (CPE/NHS England standards)
- Pharmacies must not auto re-nominate, bulk-monitor nominations, or change nomination without explicit patient request

**Electronic repeat dispensing (eRD):**

- GP authorises **batch of repeats up to 12 months** with one digital signature
- Prescriptions stored on NHS Spine; **automatically downloaded** to nominated pharmacy at prescriber-set intervals (typically 7 days before due date)
- Reduces repeat ordering burden — patient goes directly to pharmacy when due
- GP contract (since April 2019): eRD should be used for all clinically appropriate stable patients
- **Not suitable for all medicines** — e.g. controlled drugs excluded from eRD in typical local guidance
- Pharmacy asks **mandatory questions** at each eRD collection (see Section 12.3)

**Pharmacy role in reorder workflow (not authorisation):**

- Advise when to reorder; explain EPS nomination
- Order repeats on patient's behalf where practice agreement and patient consent exist (`{{pharmacy_orders_repeats}}`)
- Chase surgery when prescription delayed or rejected
- Notify patient when ready; coordinate collection/delivery
- Flag dose discrepancies to GP — cannot supply changed dose without updated prescription
- Support eRD patients — explain batch cycles, when to contact GP for new batch

**Pharmacy cannot (repeat ordering scope):**

- **Authorise** repeat prescriptions — GP/practice responsibility only
- Add/remove medicines from GP repeat list without prescriber
- Guarantee GP authorisation turnaround — surgery-dependent
- Guarantee same-day supply — depends on authorisation, stock, dispensing workload
- Override EPS nomination rules or change nomination without consent
- Promise unlimited early supply — governed by prescription dates, eRD rules, CD regulations

### 1.3 Private and hybrid variants (typical UK pharmacy)

- **Private prescription repeats** — private prescriber issues repeat; patient pays medicine + dispensing fee (`{{private_dispensing}}`)
- **Private repeat-management fee** — some pharmacies charge for ordering/admin support beyond NHS essential dispensing (`{{repeat_management_fee}}`) — owner-dependent; must be transparent
- **Online pharmacy repeats** — EPS nomination to distance-selling pharmacy; same nomination consent rules (GPhC distance-selling guidance)
- **Emergency supply** — separate pathway when repeat lapses (`emergency-medicines-supply` service) — not routine repeat ordering

### 1.4 Typical repeat ordering workflow structure

**New patient / EPS setup:**
1. Patient registers with pharmacy or enquires about repeat service (`{{phone}}`, `{{booking_link}}`)
2. Pharmacist/team explains EPS nomination — patient consents to nominate (`{{pharmacy_name}}`)
3. Nomination set via PMR/PDS with auditable consent record
4. Patient advised how to order repeats (surgery app, pharmacy-assisted order, eRD if eligible)

**Routine repeat cycle:**
1. Patient or pharmacy triggers repeat order **7–10 days before run-out** (earlier for bank holidays/slow authorisers)
2. GP surgery authorises — electronic prescription released to Spine
3. Pharmacy downloads EPS prescription or receives notification
4. Dispensing team prepares medicines (dispensing detail out of scope here)
5. Patient notified ready — SMS/app/phone (`{{ready_notification}}`)
6. Collection or delivery; carer/proxy with consent where permitted

**Delayed authorisation:**
1. Pharmacy monitors expected prescription — not received within expected window
2. Pharmacy contacts GP surgery to chase (`{{surgery_liaison}}`)
3. Patient updated on delay; interim options discussed (emergency supply signposting if critical medicine)

**eRD batch cycle:**
1. GP sets up eRD batch — patient informed by surgery
2. Prescriptions auto-download to pharmacy before due date
3. Pharmacy prepares; patient collects (or delivery)
4. Pharmacy asks eRD questions at collection
5. When batch ends — patient contacts GP for medication review and new batch

**Typical timelines (research ranges — owner must confirm locally):**
- GP authorisation: **48 hours to 7+ days** — highly variable by surgery
- Dispensing after prescription received: **same day to 48 hours** — workload/stock dependent
- eRD download: **~7 days before due date** per NHS Digital guidance
- Nomination change: effective for **next prescription** issued after change

**Staff:** Pharmacy technicians and dispensers manage ordering workflow; pharmacists oversee clinical queries, liaison, and governance

---

## 2. PATIENT INTENT

### 2.1 Why patients seek repeat prescription support

- Running low on regular tablets — fear of missing doses
- Confusion about **how to order** repeats (surgery vs pharmacy vs app)
- Want to **nominate pharmacy for EPS** — faster electronic flow
- GP surgery slow or unresponsive to repeat requests
- **Carer** managing medicines for elderly parent or dependent
- Multiple medicines — want **synchronised** collection
- Changed pharmacy — need to **update nomination**
- On holiday — need extra supply or travel planning
- Housebound — need **delivery** instead of collection
- New to area — unfamiliar with local GP/pharmacy repeat process
- Hospital started new medicine — not yet on GP repeat list
- eRD/batch prescription confusion — "do I still need to order?"
- Work hours — need evening/weekend collection (`{{opening_hours}}`)
- Cost confusion — prescription charge, PPC, exemptions

### 2.2 Common triggers

- Last few days of medicine remaining
- Repeat slip tick-box reminder
- Pharmacy SMS "time to reorder"
- GP review appointment approaching — repeat blocked pending review
- Bank holiday approaching — surgery closed
- Pharmacy moved or patient moved home
- NHS App notification about prescription status
- Dose changed at hospital/GP — old repeat no longer valid
- Friend/carer says "order early"

### 2.3 Common concerns (intent-level)

- "Will I run out before it's ready?"
- "Can the pharmacy order for me or do I contact the GP?"
- "How do I nominate this pharmacy?"
- "Why hasn't my prescription arrived yet?"
- "Can someone else collect?"
- "Do I still pay £9.90 per item?"
- "Is repeat ordering free?" (service vs prescription charge confusion)
- "Will the GP refuse my repeat?"
- "Are all my items ready together?"
- "Can I get 3 months at once?"
- Privacy — others hearing what medicines they collect

### 2.4 Typical motivations

- **Convenience** — one local pharmacy for all repeats
- **Reduced admin** — pharmacy orders on their behalf
- **Medication continuity** — avoid dangerous gaps (antiepileptics, anticoagulants, insulin)
- **Time saving** — no GP visit for routine authorisation
- **Reminders** — pharmacy-managed reorder cycle
- **Trusted medicines expert** — pharmacist advice on timing and process
- **Extended access** — pharmacy hours vs surgery (`{{opening_hours}}`)
- **Carer relief** — single point of coordination

---

## 3. PATIENT QUESTIONS (Raw Research List)

**Format note:** Questions only. Not written as publish FAQs. **Count: 58**.

### 3.1 Ordering and timing

1. How do I order my repeat prescription?
2. When should I reorder my repeat medication?
3. How many days before I run out should I order?
4. Can the pharmacy order my repeats for me?
5. Do I order from the GP or the pharmacy?
6. Can I order repeats online?
7. Can I order by phone?
8. What is a repeat prescription slip and do I still need it?
9. How often can I order each medicine?
10. Can I order some items and not others?
11. What happens if I order too early?
12. What happens if I order too late?
13. How do bank holidays affect repeat ordering?

### 3.2 EPS and nomination

14. What is EPS nomination?
15. How do I nominate this pharmacy for EPS?
16. Can I change my nominated pharmacy?
17. How long does nomination take to work?
18. Do I still need paper prescriptions with EPS?
19. Can I have more than one pharmacy nominated?
20. Will my prescription go to the wrong pharmacy?
21. Can I use EPS if I'm not registered with a local GP?
22. What if my nomination is wrong or outdated?

### 3.3 GP authorisation and delays

23. How long does the GP take to authorise a repeat?
24. What if my surgery rejects my repeat request?
25. Why do I need a medication review before my repeat is issued?
26. Can the pharmacy chase my GP for me?
27. What if my dose has changed — can I still get the old repeat?
28. How do I add a new medicine to my repeats?
29. Can I get a repeat without seeing my GP?
30. What if I'm due a hospital follow-up — will repeats stop?

### 3.4 Electronic repeat dispensing (eRD / batch)

31. What is electronic repeat dispensing (eRD)?
32. Do I still need to order if I'm on eRD?
33. How do batch prescriptions work?
34. When does my pharmacy receive my eRD prescription?
35. What questions will the pharmacy ask at eRD collection?
36. Can I get controlled drugs on eRD?
37. What happens when my eRD batch runs out?

### 3.5 Collection, delivery, and carers

38. How long after the GP authorises will my medicine be ready?
39. Can someone else collect my repeat prescription?
40. What ID do I need to collect?
41. Do you offer prescription delivery?
42. Can a carer manage repeats for my relative?
43. Will you text me when my prescription is ready?
44. Can I collect outside work hours?
45. What if not all items are in stock?

### 3.6 Cost and exemptions

46. How much is the NHS prescription charge per item?
47. Is repeat ordering itself free?
48. What is a prescription prepayment certificate (PPC)?
49. Am I exempt from prescription charges?
50. Can I buy a PPC at the pharmacy?
51. What is the HRT prescription prepayment certificate?

### 3.7 Safety and scope

52. What if I run out completely — can the pharmacy help?
53. Can the pharmacist change my prescription?
54. Should I stop taking medicine if I can't get a repeat?
55. What if I have side effects — is that a repeat issue or GP?
56. Can I get repeats for medicines started in hospital?
57. Is repeat prescription support the same as a medication review?
58. What's the difference between repeat ordering and dispensing?

---

## 4. PATIENT CONCERNS (Raw Research List)

**Count: 24**

1. Running out of essential medicine before next supply arrives
2. Uncertainty whether to order from GP or pharmacy
3. GP surgery slow to authorise — anxiety about gaps
4. Confusion about EPS nomination — "will it work automatically?"
5. Fear prescription sent to wrong pharmacy after moving
6. Not knowing reorder lead time — ordered too late
7. Medication review blocking repeat — unexpected GP appointment needed
8. Partial supply — some items ready, others not
9. Cost of multiple items — £9.90 per item adds up
10. Exemption/PPC confusion — paying when should be free
11. Embarrassment collecting sensitive medicines in public queue
12. Carer burden coordinating multiple family members' repeats
13. Housebound — difficulty collecting without delivery
14. Work hours clash with pharmacy/surgery opening times
15. Dose changed by GP/hospital but old repeat still showing
16. Belief pharmacy can authorise without GP — then refused
17. eRD confusion — "I didn't order but prescription appeared"
18. Bank holiday/surgery closure poor planning
19. Stock shortages delaying supply
20. Language/literacy barriers understanding ordering apps
21. Multiple pharmacies used historically — nomination conflicts
22. Fear of being judged for frequent reorder requests (e.g. pain medicines)
23. Uncertainty about proxy collection rules for controlled drugs
24. Worry that switching pharmacy loses repeat history

---

## 5. CLINICAL AND WORKFLOW FACTS

### 5.1 Repeat prescribing governance

| Role | Responsibility |
|------|----------------|
| GP / practice | Clinical responsibility; repeat list management; authorisation; medication reviews; eRD batch setup |
| Patient | Order in timely manner; attend reviews; declare medicine changes; nominate pharmacy with consent |
| Pharmacy | Dispense authorised prescriptions; EPS nomination on request; reorder support; surgery liaison; patient counselling at supply |
| NHS Spine | Stores EPS prescriptions and eRD batches; delivers to nominated dispenser |

**Key principle:** Repeat **authorisation** is always a prescriber decision. Pharmacy **supports** ordering and **supplies** once legally valid prescription exists.

### 5.2 Reorder timing (best practice)

- **Standard guidance:** reorder **7–10 days** before medicines run out (internal seeds, CPE-aligned patient education)
- **Allow longer for:** slow authorising surgeries, items requiring ordering, bank holidays, multiple items needing sync
- **Critical medicines** (antiepileptics, anticoagulants, insulin, immunosuppressants): reorder **earlier** — patient-specific counselling
- **Too early:** GP may reject order if interval not due — prevents waste
- **Too late:** risk missed doses; emergency supply pathway may apply for critical gaps

### 5.3 EPS — core facts

- Prescriptions sent electronically from EPS-enabled prescriber to **nominated dispenser**
- Patient can nominate: **one pharmacy**, **one dispensing appliance contractor**, **one dispensing doctor** (three nominations max)
- Nomination change: patient request at GP, pharmacy, NHS App — effective from next prescription
- **Patient choice protected** — no inducements; no automated re-nomination (CPE/NHS England 2025–2026 standards)
- Wales-registered patients may nominate England pharmacy — confirm nomination current
- Misdirected prescriptions: pharmacy updates nomination and returns misdirected Rx to Spine

### 5.4 Electronic repeat dispensing (eRD) — core facts

- Batch of repeats authorised up to **12 months**; one prescriber digital signature
- Stored on NHS Spine; downloaded to nominated pharmacy at **prescriber-set intervals**
- First issue available immediately; subsequent issues typically **7 days before due date**
- Prescriber can **cancel or amend** batch at any time
- GP contract: eRD for all **clinically appropriate** stable patients since April 2019
- **Excluded typically:** controlled drugs, unstable conditions, items needing frequent monitoring
- Pharmacy **four questions** at each eRD supply (NHS Digital eRD guidance):
  1. Have you seen any health professional since last supply?
  2. Have you had any problems with your medicines?
  3. Do you take all medicines as prescribed?
  4. Do you need all items on this prescription today?

### 5.5 NHS prescription charges (England 2025/26 and 2026/27)

| Charge type | Rate |
|-------------|------|
| Single prescription item | **£9.90** (frozen) |
| 3-month PPC | **£32.05** |
| 12-month PPC | **£114.50** |
| 12-month HRT PPC | **£19.80** |

- Charges apply **per item**, not per prescription form
- **Repeat ordering support** at pharmacy is part of NHS essential dispensing — no separate NHS charge for ordering assistance
- PPC cost-effective if **4+ items in 3 months** or **12+ items in 12 months** (standard PPC)
- Exemptions: under 16 (or 16–18 in FT education), 60+, pregnancy/maternity exemption, specified medical exemptions, qualifying benefits — [NHSBSA exemption checker](https://www.nhsbsa.nhs.uk/check)
- Prescription charges **England only** — Scotland, Wales, NI have different arrangements

### 5.6 Pharmacy professional standards (relevant to repeat workflow)

**GPhC Standards for Pharmacy Professionals (applicable principles):**
- **Standard 1** — person-centred care: tailor reorder advice to individual medicines and circumstances
- **Standard 2** — work in partnership: liaison with GP surgery, carers, patient
- **Standard 3** — communicate effectively: plain-language EPS/reorder explanation
- **Standard 5** — professional judgement: escalate when supply delay risks harm
- **Standard 7** — confidentiality: discreet handling of repeat medicine enquiries

**GPhC Standards for Registered Pharmacies (Principle 4):**
- Medicines supplied safely; concerns raised when not fit for purpose
- Services accessible to patients and public

**Note:** Detailed clinical screening steps at dispensing are documented in `prescription-dispensing-research-v1.md`.

### 5.7 Common patient mistakes (from internal seeds)

- Running out before reordering
- Not updating nomination after changing pharmacy
- Assuming all items renew automatically without GP authorisation
- Not declaring OTC medicines (relevant at collection counselling)
- Collecting without checking for dose changes on label
- Ordering all eRD items when not needed — medicine waste

### 5.8 Synchronisation ("sync")

- Multiple repeat items often due different dates — partial collections common
- eRD synching: prescriber aligns batch end dates with medication review (NHSBSA eRD guide)
- Pharmacy may support aligning order dates — GP/practice cooperation required
- Reduces patient trips; supports interaction checking when all items collected together

---

## 6. RED FLAGS

### 6.1 Urgent medical review required (999 / same day)

**999 / A&E:**
- Severe allergic reaction to regular medicine — anaphylaxis
- Suicidal crisis related to mental health medicines — emergency mental health pathway
- Diabetic emergency — hypoglycaemia, DKA symptoms
- Seizure in epilepsy patient after missed antiepileptic doses

**Same-day GP / urgent care:**
- Missed doses of critical medicine and unable to obtain supply — emergency supply assessment
- New serious side effects since last repeat supply
- Symptoms suggesting condition destabilised — repeat may be inappropriate until reviewed
- Controlled drug supply issue — cannot be resolved by routine repeat ordering

### 6.2 Referral / GP contact required (non-emergency but mandatory)

- **Dose or medicine change needed** — GP must update repeat list and issue new prescription
- **Repeat rejected** pending medication review — patient must attend GP review
- **New medicine** (e.g. hospital discharge) not on repeat list — GP addition required
- **eRD batch expired** — new batch requires GP authorisation
- **Pregnancy** affecting teratogenic medicines — urgent GP/maternity review
- **Suspected supply chain fraud** or prescription misuse — pharmacist governance pathway

### 6.3 When pharmacy repeat support is NOT the primary pathway

- **Emergency supply** needed imminently — dedicated emergency supply protocol (`emergency-medicines-supply`)
- **Acute prescription** for new condition — not repeat workflow
- **Private prescription** without valid private Rx — separate private dispensing pathway
- **Medication review (MUR/structured)** — scheduled clinical service, not reorder admin
- **Prescriber query unresolved** — supply held; reorder chasing does not bypass clinical check

### 6.4 Workflow escalation triggers (pharmacy internal)

- Prescription not received **>48–72 hours** after expected authorisation (owner threshold `{{liaison_threshold}}`)
- Patient reports **<3 days** supply remaining on critical medicine
- **Two failed** surgery liaison attempts
- EPS nomination error causing repeated misdirection
- Patient/carer distress about continuity — pharmacist review

---

## 7. MYTHS (Real Misconceptions Only)

**Count: 24**

| # | Misconception | Research correction (not publish prose) |
|---|---------------|----------------------------------------|
| 1 | Repeats are automatic forever | GP authorisation expires; medication reviews required; eRD batches have end dates |
| 2 | Pharmacy can authorise repeat prescriptions | Only GP/practice authorises; pharmacy dispenses and supports ordering |
| 3 | Reorder on the day you run out | Reorder 7–10 days early; longer for slow surgeries and special-order items |
| 4 | EPS works without nomination | Patient must nominate pharmacy; nomination requires consent |
| 5 | Repeats skip all checks | Every supply includes dispensing governance; eRD has mandatory questions |
| 6 | Hospital medicines are automatically on GP repeats | GP must add to repeat list after hospital communication |
| 7 | Unlimited early supply available | Supply timing follows prescription dates, eRD rules, CD regulations |
| 8 | All items on repeat slip ready together | Partial supply when items need ordering or authorise separately |
| 9 | Changing pharmacy breaks repeats permanently | Update EPS nomination; GP repeat list unchanged |
| 10 | Repeat means no GP review ever | Periodic medication reviews mandatory; repeats may be blocked pending review |
| 11 | Pharmacy ordering replaces GP authorisation | Pharmacy may submit order; GP still must authorise (except eRD batch already authorised) |
| 12 | eRD means never contact GP again | Reviews still required; new batch needed when current expires |
| 13 | One NHS fee covers all items | England charge is **per item** (£9.90 each unless exempt/PPC) |
| 14 | Repeat ordering at pharmacy costs extra on NHS | Ordering support part of essential dispensing; charge is for prescription items |
| 15 | Any pharmacy can pull my prescription without nomination | EPS sends to nominated dispenser; ad-hoc supply uses token/paper pathways |
| 16 | Pharmacist can change my dose on repeat | Dose changes require prescriber; pharmacist queries prescriber |
| 17 | I can give my repeat medicines to family | Prescription medicines are individualised — illegal and unsafe to share |
| 18 | Online apps mean I never need a pharmacy | Nominated pharmacy still dispenses; apps order authorisation |
| 19 | PPC covers private prescriptions | PPC covers NHS prescription charges only |
| 20 | If GP is slow, pharmacy can invent a prescription | Emergency supply has strict legal criteria — not routine workaround |
| 21 | eRD includes controlled drugs | Typically excluded from eRD batches |
| 22 | Nomination can be changed by pharmacy without asking | Patient consent required; automated re-nomination prohibited |
| 23 | Repeat prescription service is a separate NHS Advanced Service | Core dispensing + patient support; owner private add-ons may exist |
| 24 | Skipping doses extends supply safely | Missed doses on critical medicines dangerous — reorder early instead |

---

## 8. TRUST FACTORS

- GPhC-registered premises and regulated professionals
- Clear explanation of GP vs pharmacy roles — no overclaim on authorisation
- EPS nomination handled with documented patient consent (CPE standards)
- Transparent prescription charge and PPC guidance (England rates)
- Proactive reorder reminders where offered (`{{repeat_reminders}}`)
- Surgery liaison when delays occur — patient kept informed
- Discreet handling of sensitive repeat medicines
- Accurate ready notifications — reliable collection planning
- Signposting to emergency supply when critical gaps risk harm
- Integration with delivery for housebound (`{{delivery_available}}`)
- Carer-friendly processes with appropriate consent
- Professional indemnity and clinical governance
- Honest turnaround expectations — no guaranteed times without caveats
- eRD questions asked consistently — patient safety at each supply
- Documentation on PMR for continuity

---

## 9. LOCAL PHARMACY ADVANTAGES

- High street access — collect repeats locally (`{{opening_hours}}`)
- Extended hours vs GP surgery for collection
- Pharmacy-assisted ordering where offered (`{{pharmacy_orders_repeats}}`)
- EPS nomination setup in person with explanation
- SMS/ready notifications (`{{ready_notification}}`)
- Home delivery for housebound (`{{delivery_available}}`)
- Single point for multiple family members' repeats
- Pharmacist medicines expertise for reorder timing on critical drugs
- Surgery liaison — chase authorisation on patient's behalf
- Sync support for multiple items where practicable
- PPC sale and exemption guidance at collection
- Parking/access (`{{parking}}`) — practical for elderly collectors
- Relationship continuity — familiar team knows patient's repeat regimen

**Caveats:** GP authorisation speed not controlled by pharmacy; stock outages may delay supply; nomination errors require patient action with GP/pharmacy.

---

## 10. OWNER VARIABLES

| Variable | Purpose |
|----------|---------|
| `{{phone}}` | Reorder enquiries, ready notifications, liaison updates |
| `{{opening_hours}}` | Collection access; reorder cut-off times |
| `{{booking_link}}` | Online reorder/nomination enquiry if offered |
| `{{pharmacy_orders_repeats}}` | Whether pharmacy orders repeats on patient's behalf (yes/no/process) |
| `{{repeat_reminders}}` | SMS/app reminder service for reorder timing |
| `{{ready_notification}}` | How patients notified when prescription ready |
| `{{delivery_available}}` | Home delivery for repeats (yes/no/area) |
| `{{eps_nomination}}` | EPS nomination setup offered (yes/process) |
| `{{liaison_threshold}}` | When pharmacy chases surgery (e.g. 48h) |
| `{{repeat_management_fee}}` | Private fee for enhanced repeat management if applicable |
| `{{parking}}` | Access for collection |
| `{{surgery_liaison}}` | Named local surgeries or generic liaison statement |

**Additional owner fields for Stage 2:** Online reorder portal URL, carer consent form, controlled drug collection ID policy, eRD patient leaflet, bank holiday reorder calendar.

---

## 11. PATIENT EMOTIONS (Stage 1 Enhancement)

**Format:** Research notes only. Not publish copy.

### 11.1 Anxiety about running out

| Field | Research note |
|-------|---------------|
| **Trigger** | 2–3 days supply left; weekend approaching; GP closed |
| **Patient concern** | "I'll miss doses and something bad will happen" |
| **Typical behaviour** | Urgent calls; may panic-order; asks for emergency supply |
| **Common questions** | What if it doesn't arrive in time? / Can you give me some now? |

### 11.2 Frustration with GP delays

| Field | Research note |
|-------|---------------|
| **Trigger** | Repeat ordered but no prescription received |
| **Patient concern** | "Nobody is doing anything; system is broken" |
| **Typical behaviour** | Blames pharmacy first; angry at counter; multiple calls |
| **Common questions** | Why hasn't my GP sent it? / Can you chase them today? |

### 11.3 Confusion about EPS and nomination

| Field | Research note |
|-------|---------------|
| **Trigger** | Changed pharmacy; first time using electronic prescriptions |
| **Patient concern** | "Where is my prescription? Which pharmacy has it?" |
| **Typical behaviour** | Visits wrong pharmacy; blames nomination; needs step-by-step setup |
| **Common questions** | How do I nominate you? / Did my prescription go elsewhere? |

### 11.4 Overwhelm (polypharmacy / carer)

| Field | Research note |
|-------|---------------|
| **Trigger** | Managing 8+ medicines or multiple family members |
| **Patient concern** | "I can't keep track of what to order when" |
| **Typical behaviour** | Seeks sync; asks pharmacy to manage; brings shoebox of medicines |
| **Common questions** | Can you remind me? / Can you order everything together? |

### 11.5 Embarrassment at collection

| Field | Research note |
|-------|---------------|
| **Trigger** | Mental health, sexual health, or stigmatised medicines |
| **Patient concern** | Others will know what I take |
| **Typical behaviour** | Avoids busy times; prefers delivery; whispers at counter |
| **Common questions** | Is it confidential? / Can I use a private area? |

### 11.6 Cost anxiety

| Field | Research note |
|-------|---------------|
| **Trigger** | Multiple items; fixed income; unexpected charge |
| **Patient concern** | "I can't afford all my medicines this month" |
| **Typical behaviour** | Requests partial supply; asks about PPC/exemptions; may skip items |
| **Common questions** | How much will this cost? / Am I exempt? / What is a PPC? |

### 11.7 eRD uncertainty

| Field | Research note |
|-------|---------------|
| **Trigger** | GP letter about batch prescriptions; unexpected pharmacy contact |
| **Patient concern** | "I didn't order this — is it a mistake?" |
| **Typical behaviour** | Suspicious of unsolicited readiness; needs eRD education |
| **Common questions** | Do I still need to order? / What is batch prescribing? |

### 11.8 Mistrust after previous error

| Field | Research note |
|-------|---------------|
| **Trigger** | Wrong item previously; late supply; nomination mix-up |
| **Patient concern** | "It will go wrong again" |
| **Typical behaviour** | Double-checks everything; reluctant to nominate; verifies labels obsessively |
| **Common questions** | How do I know it's correct? / Can I speak to the pharmacist? |

### 11.9 Relief when process works smoothly

| Field | Research note |
|-------|---------------|
| **Trigger** | Reminder received; prescription ready on time |
| **Patient concern** | False security — may stop self-monitoring dates |
| **Typical behaviour** | High satisfaction; word-of-mouth referral; depends entirely on pharmacy |
| **Common questions** | Will you always remind me? / Can I set and forget? |

### 11.10 Guilt about "bothering" GP/pharmacy

| Field | Research note |
|-------|---------------|
| **Trigger** | Frequent reorders; pain medicines; elderly politeness |
| **Patient concern** | "I'm being a nuisance" |
| **Typical behaviour** | Delays ordering; runs out; apologises excessively |
| **Common questions** | Is it okay to order again? / Am I ordering too often? |

---

## 12. REPEAT ORDERING PATHWAYS KNOWLEDGE (Stage 1 Enhancement)

**Format:** Evidence-based research notes. Not advice copywriting. Covers EPS, standard repeats, eRD, and ordering channels — not dispensing clinical-check detail.

### 12.1 Standard repeat prescribing (GP-authorised cycle)

| Field | Research note |
|-------|---------------|
| **Who initiates order** | Patient (app/online/phone/slip) or pharmacy on patient's behalf where agreed |
| **Authorisation** | GP or authorised prescriber approves each cycle |
| **Prescription issue** | EPS to nominated pharmacy or paper FP10 |
| **Typical interval** | 28 days common; 56/84 days for some stable medicines — prescriber-defined |
| **Review blocks** | GP may withhold authorisation until medication review completed |
| **Pharmacy role** | Receive, dispense, advise reorder timing, liaise if delayed |
| **Patient action** | Order before run-out; attend reviews; update GP on medicine changes |

### 12.2 EPS nomination

| Field | Research note |
|-------|---------------|
| **What it is** | Patient chooses where EPS prescriptions are sent electronically |
| **How to set** | GP surgery, pharmacy (with consent), NHS App, patient access apps |
| **Max nominations** | One pharmacy + one appliance contractor + one dispensing doctor |
| **Change process** | Patient-requested only; auditable; effective next prescription |
| **Governance** | No inducements; no auto re-nomination; no bulk PDS monitoring (CPE 2025–2026) |
| **Pharmacy role** | Explain EPS; set nomination on request with consent; fix misdirected Rx |
| **Common issues** | Historic wrong nomination; patient moved; multiple pharmacy use |

### 12.3 Electronic repeat dispensing (eRD)

| Field | Research note |
|-------|---------------|
| **What it is** | GP-authorised batch of repeats up to 12 months on NHS Spine |
| **Patient experience** | Go to pharmacy when due — usually no repeat order to surgery |
| **Download timing** | Subsequent issues ~7 days before due date to nominated pharmacy |
| **Prescriber control** | Can cancel/amend batch anytime; reviews aligned to batch end |
| **Eligibility** | Stable long-term conditions; suitable medicines; not CDs typically |
| **Pharmacy questions** | Four mandatory questions each collection (see Section 5.4) |
| **Batch end** | Patient contacts GP for review and new batch |
| **Benefits** | Fewer surgery contacts; predictable supply; reduced admin |

### 12.4 Ordering channels comparison

| Channel | Patient action | Pharmacy role | GP role |
|---------|---------------|---------------|---------|
| GP online/app | Patient orders via surgery system | Receives EPS when authorised | Authorises |
| Repeat slip | Tick items; drop at surgery or pharmacy | May forward order if agreed | Authorises |
| Pharmacy-assisted | Patient asks pharmacy to order | Submits order to surgery | Authorises |
| eRD | No order — attend pharmacy when due | Auto-receives from Spine | Pre-authorised batch |
| Paper FP10 (legacy) | Collect paper from surgery | Dispense from paper | Issues paper |

### 12.5 Turnaround factors — patient expectation matrix

| Factor | Impact on ready date |
|--------|---------------------|
| GP authorisation speed | Primary variable — 1–7+ days |
| EPS vs paper | EPS usually faster once authorised |
| Stock availability | Special-order items delay supply |
| Pharmacy workload | Peak times extend dispensing |
| Partial authorisation | Some items authorised, others pending |
| Bank holidays | Surgery/pharmacy closure — order earlier |
| eRD | Prescription arrives before due date automatically |

### 12.6 Prescription charges at repeat collection (England)

| Field | Research note |
|-------|---------------|
| **Per item charge** | £9.90 (2025/26 and 2026/27 frozen) |
| **PPC 3-month** | £32.05 — saves if 4+ items in 3 months |
| **PPC 12-month** | £114.50 — saves if 12+ items in 12 months |
| **HRT PPC** | £19.80 — listed HRT medicines only |
| **Exemptions** | Age, maternity, medical, benefits — NHSBSA checker |
| **Pharmacy role** | Verify exemption; sell PPC; signpost to NHSBSA — not determine exemption fraud |

---

## 13. WORKFLOW DECISION FRAMEWORK (Stage 1 Enhancement)

**Format:** Workflow reference for master content accuracy. Not patient-facing copy. Focus: reorder routing, not dispensing clinical bands.

### 13.1 Routine repeat — adequate supply (>7 days remaining)

| Field | Detail |
|-------|--------|
| **Presentation** | Patient planning next order |
| **Action** | Advise reorder now if within 7–10 day window; confirm EPS nomination |
| **Channel** | Patient or pharmacy-assisted order to GP |
| **Urgency** | **Routine** |

### 13.2 Repeat due soon (<7 days supply)

| Field | Detail |
|-------|--------|
| **Presentation** | Patient supplies running low |
| **Action** | Order immediately; pharmacy-assisted if available; warn about authorisation delay |
| **Liaison** | Chase surgery if not received within `{{liaison_threshold}}` |
| **Urgency** | **Priority** |

### 13.3 Critical medicine — imminent run-out (<3 days)

| Field | Detail |
|-------|--------|
| **Presentation** | Antiepileptic, anticoagulant, insulin, immunosuppressant etc. |
| **Action** | Emergency order/liaison; signpost emergency supply if authorisation fails |
| **Escalation** | Pharmacist involvement; same-day surgery contact |
| **Urgency** | **Urgent** |

### 13.4 Prescription not received — ordered >48–72h ago

| Field | Detail |
|-------|--------|
| **Presentation** | Patient waiting; no EPS download |
| **Action** | Surgery liaison; check nomination; confirm items authorised |
| **Patient update** | Realistic timeline; interim safety advice |
| **Urgency** | **Priority to urgent** depending on supply left |

### 13.5 Dose or medicine change

| Field | Detail |
|-------|--------|
| **Presentation** | GP/hospital changed treatment; old repeat invalid |
| **Action** | Cannot supply new dose from old Rx; refer patient to GP for updated repeat |
| **Pharmacy** | Query prescriber if conflicting EPS received |
| **Urgency** | **Routine to urgent** depending on medicine |

### 13.6 New EPS nomination / pharmacy switch

| Field | Detail |
|-------|--------|
| **Presentation** | Patient changed pharmacy |
| **Action** | Consent-based nomination update; explain next Rx flows here |
| **Caution** | Prescriptions in flight may go to old nomination — check Spine |
| **Urgency** | **Routine** |

### 13.7 eRD patient — routine collection

| Field | Detail |
|-------|--------|
| **Presentation** | Batch prescription downloaded |
| **Action** | Ask four eRD questions; dispense needed items only (reduce waste) |
| **End of batch** | Signpost GP for review and new batch |
| **Urgency** | **Routine** |

### 13.8 eRD batch expired / review overdue

| Field | Detail |
|-------|--------|
| **Presentation** | No further issues on Spine; GP blocked repeats |
| **Action** | Explain GP review needed; support booking; emergency supply if critical |
| **Urgency** | **Priority** |

### 13.9 Holiday / extra supply request

| Field | Detail |
|-------|--------|
| **Presentation** | Patient travelling; needs longer supply |
| **Action** | GP authorisation required for increased quantity; order early |
| **Note** | eRD may allow pharmacy-managed extra issue in some setups — prescriber-dependent |
| **Urgency** | **Routine** — plan weeks ahead |

### 13.10 Repeat rejected pending review

| Field | Detail |
|-------|--------|
| **Presentation** | Surgery declined authorisation |
| **Action** | Explain review requirement; book GP; emergency supply if critical gap |
| **Pharmacy** | Cannot override GP decision |
| **Urgency** | **Priority** |

---

## 14. PATIENT JOURNEY RESEARCH (Stage 1 Enhancement)

**Format:** Journey map for master content structure. Not publish copy.

### 14.1 Awareness

| Field | Research note |
|-------|---------------|
| **Patient goals** | Understand how repeats work; find local pharmacy support |
| **Patient concerns** | Confusion GP vs pharmacy roles |
| **Information needs** | EPS explained; reorder timing; charges |
| **Common misunderstandings** | Pharmacy authorises repeats; repeats are automatic |

### 14.2 Registration / EPS setup

| Field | Research note |
|-------|---------------|
| **Patient goals** | Nominate pharmacy; register for reminders |
| **Patient concerns** | Will it work; privacy; wrong nomination |
| **Information needs** | Consent process; what to tell GP |
| **Common misunderstandings** | Nomination is automatic when visiting pharmacy |

### 14.3 Routine reorder trigger

| Field | Research note |
|-------|---------------|
| **Patient goals** | Order before run-out with minimal effort |
| **Patient concerns** | Forgetting; timing; admin burden |
| **Information needs** | When to order; which channel; reminder services |
| **Common misunderstandings** | Can order day before run-out safely |

### 14.4 GP authorisation wait

| Field | Research note |
|-------|---------------|
| **Patient goals** | Prescription authorised quickly |
| **Patient concerns** | Delay; rejection; review blocking |
| **Information needs** | Expected wait; what pharmacy can chase |
| **Common misunderstandings** | Pharmacy controls authorisation speed |

### 14.5 Pharmacy receipt and preparation

| Field | Research note |
|-------|---------------|
| **Patient goals** | Medicines ready promptly |
| **Patient concerns** | Partial supply; stock issues |
| **Information needs** | Ready notification; collection hours |
| **Common misunderstandings** | Instant ready when GP authorises |

### 14.6 Collection / delivery

| Field | Research note |
|-------|---------------|
| **Patient goals** | Collect discreetly or receive at home |
| **Patient concerns** | Queue privacy; proxy rules; payment |
| **Information needs** | ID for CDs; PPC/exemption; carer consent |
| **Common misunderstandings** | Anyone can collect controlled drugs without ID |

### 14.7 Ongoing cycle / eRD maintenance

| Field | Research note |
|-------|---------------|
| **Patient goals** | Predictable hassle-free supply |
| **Patient concerns** | Batch end; review appointments; medicine changes |
| **Information needs** | eRD vs standard repeat; when to contact GP |
| **Common misunderstandings** | eRD never requires GP contact again |

---

## 15. CONTENT OPPORTUNITY RESEARCH (Stage 1 Enhancement)

**Format:** Ranked opportunities for future master content. Not content itself.

### 15.1 Strongest patient questions — ranked

| Rank | Question theme | Priority | Rationale |
|------|----------------|----------|-----------|
| 1 | When/how to reorder repeats | **HIGH** | Core workflow; prevents run-out |
| 2 | EPS nomination setup | **HIGH** | Major access barrier; CPE governance |
| 3 | GP vs pharmacy ordering role | **HIGH** | Fundamental scope accuracy |
| 4 | How long until ready | **HIGH** | Expectation management |
| 5 | Prescription charge / PPC / exemptions | **HIGH** | Cost barrier England |
| 6 | Can pharmacy chase GP | **HIGH** | Key pharmacy value-add |
| 7 | eRD / batch prescriptions explained | **HIGH** | Growing NHS pathway |
| 8 | Carer/proxy collection | **MEDIUM** | Elderly/carer segment |
| 9 | Delivery options | **MEDIUM** | Housebound access |
| 10 | Holiday/extra supply | **MEDIUM** | Seasonal demand |
| 11 | Partial supply / stock delays | **MEDIUM** | Frustration driver |
| 12 | What if I run out | **MEDIUM** | Links emergency supply |
| 13 | Changing pharmacy nomination | **MEDIUM** | Common mover scenario |
| 14 | Medication review blocking repeat | **MEDIUM** | GP policy education |
| 15 | Difference repeat ordering vs dispensing | **LOW** | Scope clarity vs dispensing master |

### 15.2 Strongest myths — ranked

| Rank | Myth | Priority | Rationale |
|------|------|----------|-----------|
| 1 | Pharmacy authorises repeats | **HIGH** | Critical scope boundary |
| 2 | Reorder on run-out day | **HIGH** | Harm prevention |
| 3 | Repeats automatic forever | **HIGH** | Review/GP authorisation |
| 4 | EPS works without nomination | **HIGH** | Technical literacy |
| 5 | One fee for all items | **HIGH** | £9.90 per item confusion |
| 6 | eRD = never contact GP | **MEDIUM** | Batch/review education |
| 7 | Changing pharmacy breaks repeats | **MEDIUM** | Nomination update |
| 8 | Unlimited early supply | **MEDIUM** | CD/date rules |
| 9 | Pharmacy ordering replaces GP | **MEDIUM** | Assisted order clarity |
| 10 | Repeat ordering costs extra NHS fee | **MEDIUM** | Charge vs service confusion |

### 15.3 Strongest concerns — ranked

| Rank | Concern | Priority | Rationale |
|------|---------|----------|-----------|
| 1 | Running out before supply ready | **HIGH** | Safety and anxiety |
| 2 | GP authorisation delays | **HIGH** | Liaison value proposition |
| 3 | EPS/nomination confusion | **HIGH** | Access barrier |
| 4 | Prescription cost | **HIGH** | PPC/exemption guidance |
| 5 | Partial supply / not all ready | **MEDIUM** | Expectation setting |
| 6 | Carer coordination burden | **MEDIUM** | Elderly segment |
| 7 | Privacy at collection | **MEDIUM** | Sensitive medicines |
| 8 | eRD uncertainty | **MEDIUM** | Growing pathway |
| 9 | Dose change vs old repeat | **MEDIUM** | GP referral trigger |
| 10 | Bank holiday planning | **LOW** | Seasonal content |

### 15.4 Strongest trust factors — ranked

| Rank | Trust factor | Priority | Rationale |
|------|--------------|----------|-----------|
| 1 | Honest GP vs pharmacy role explanation | **HIGH** | Scope credibility |
| 2 | Surgery liaison when delayed | **HIGH** | Tangible support |
| 3 | EPS nomination with consent | **HIGH** | CPE compliance |
| 4 | Reorder reminders | **HIGH** | Continuity value |
| 5 | Reliable ready notifications | **HIGH** | Practical trust |
| 6 | Clear charge/PPC guidance | **MEDIUM** | Cost transparency |
| 7 | Discreet sensitive medicine handling | **MEDIUM** | Embarrassment barrier |
| 8 | Delivery for housebound | **MEDIUM** | Access equity |
| 9 | eRD questions asked consistently | **MEDIUM** | Safety signal |
| 10 | GPhC-registered team | **MEDIUM** | Professional baseline |

---

## 16. KNOWLEDGE GAPS — REVIEW AND RECOMMENDATIONS (Stage 1 Enhancement)

### 16.1 Gaps addressed in v1

| Gap | Status in v1 |
|-----|--------------|
| EPS nomination governance (2025–2026) | **Addressed** — Sections 1.2, 5.3, 12.2 |
| eRD pathway underdocumented | **Addressed** — Sections 1.2, 5.4, 12.3, 13.7–13.8 |
| Prescription charge rates | **Addressed** — Section 5.5, 12.6 |
| GP vs pharmacy role confusion | **Addressed** — Sections 1.1, 1.2, 7, 13 |
| Reorder timing guidance | **Addressed** — Sections 5.2, 13.1–13.3 |
| Patient emotional drivers | **Addressed** — Section 11 (10 emotions) |
| Workflow decision framework | **Addressed** — Section 13 (10 bands) |
| Patient journey | **Addressed** — Section 14 (7 stages) |
| Content priorities | **Addressed** — Section 15 (ranked) |
| Dispensing clinical check overlap | **Addressed** — Scope boundary; cross-ref to prescription-dispensing |

### 16.2 Remaining missing clinical information

| Gap | Recommendation |
|-----|----------------|
| Devolved nations (Scotland/Wales/NI) charge and EPS nuances | England-only in Master V1; flag UK owners for appendix |
| Surgery-specific ordering apps and SLAs | Owner variable — `{{repeat_ordering_method}}` |
| Local eRD penetration rates | Not needed for master — generic eRD content |
| Repeat Dispensing (paper RD) legacy patients | Brief mention; eRD preferred nationally |
| Detailed CD reorder rules | Cross-ref prescription-dispensing and emergency-medicines-supply |

### 16.3 Remaining missing patient concerns

| Gap | Recommendation |
|-----|----------------|
| Digital exclusion — no smartphone/app | Owner variable — phone/in-person ordering |
| Care home bulk ordering | Separate care home liaison content if owner serves homes |
| Language/accessibility | Owner variable — `{{languages}}` |
| Online-only pharmacy vs community nomination | Brief signpost if owner is bricks-and-mortar |

### 16.4 Remaining missing trust factors

| Gap | Recommendation |
|-----|----------------|
| Named pharmacy team | Owner variable at publish |
| Patient testimonials on repeat service | Publish-stage owner content |
| Specific surgery partnerships | Owner confirmation — `{{surgery_liaison}}` |

### 16.5 Remaining missing pathway information

| Gap | Recommendation |
|-----|----------------|
| Pharmacy-assisted ordering agreement with local surgeries | Owner confirmation — `{{pharmacy_orders_repeats}}` |
| Reminder service mechanics | Owner variable — `{{repeat_reminders}}` |
| Delivery area and charge | Owner variable — `{{delivery_available}}` |
| Private repeat-management fee | Owner variable — `{{repeat_management_fee}}` |

### 16.6 Recommendations before Master V1

1. **Human clinical/operations sign-off** on Sections 5, 6, 12, 13 (workflow thresholds, eRD questions, escalation)
2. **Confirm England scope** for prescription charge and EPS claims
3. **Cross-check prescription-dispensing master** — no duplication of clinical-check steps; link where relevant
4. **Owner variables** remain placeholders until pharmacy onboarding
5. **Use Section 15 HIGH-priority items** to drive master emphasis
6. **Use Section 11 emotions** for tone guidance — not publish prose
7. **CPE nomination standards** must be reflected — no auto re-nomination claims

---

## RESEARCH COMPLETENESS SCORE (V1)

| Area | Weight | Score (0–10) | Notes |
|------|--------|--------------|-------|
| 1. Service definition | 8% | 9 | EPS, eRD, GP liaison mapped; scope boundary clear |
| 2. Patient intent | 7% | 9 | Emotions and triggers covered |
| 3. Patient questions (50+) | 10% | 10 | 58 questions |
| 4. Patient concerns (20+) | 7% | 10 | 24 concerns + ranked |
| 5. Clinical/workflow facts | 12% | 9 | NHS EPS, eRD, charges, GPhC; pending sign-off |
| 6. Red flags | 10% | 9 | Run-out, critical medicines, review blocks |
| 7. Myths (20+) | 7% | 10 | 24 myths + ranked |
| 8. Trust factors | 5% | 9 | Ranked opportunities added |
| 9. Local advantages | 4% | 8 | Owner-dependent |
| 10. Owner variables | 4% | 9 | Twelve core variables defined |
| 11. Patient emotions | 10% | 9 | 10 emotions mapped |
| 12. Repeat ordering pathways | 8% | 10 | EPS, eRD, channels, charges |
| 13. Workflow decision framework | 8% | 9 | 10 decision bands |
| 14. Patient journey | 5% | 9 | 7 stages mapped |
| 15. Content opportunities | 5% | 9 | Ranked HIGH/MEDIUM/LOW |

**Weighted completeness score: 9.2 / 10**

---

## REMAINING KNOWLEDGE GAPS (Summary)

1. Devolved nations pathways — England-only recommended for Master V1
2. Owner confirmation — pharmacy-assisted ordering, reminders, delivery, liaison SLAs
3. Human clinical/operations sign-off — not yet recorded
4. Surgery-specific app/ordering integrations — owner/onboarding
5. Care home bulk repeat workflows — optional owner appendix
6. Detailed CD reorder/collection rules — cross-ref prescription-dispensing master

**Critical gaps blocking Master V1:** Items 2 and 3 only (owner vars can remain as placeholders per benchmark pattern).

---

## READINESS SCORE FOR MASTER V1

| Criterion | Score | Max | Notes |
|-----------|-------|-----|-------|
| Factual research completeness | 9.2 | 10 | v1 complete |
| Workflow pathway documented | 9 | 10 | Pending sign-off |
| Patient intent/emotion coverage | 9 | 10 | Section 11 complete |
| Question/concern inventory | 10 | 10 | Exceeds minimums |
| Repeat ordering pathways (Section 12) | 10 | 10 | EPS, eRD, channels complete |
| Workflow decision framework | 9 | 10 | Section 13 complete |
| Journey mapping | 9 | 10 | Section 14 complete |
| Content priority guidance | 9 | 10 | Section 15 complete |
| Owner variables identified | 9 | 10 | Twelve placeholders defined |
| Scope separation from dispensing | 9 | 10 | Boundary documented |
| Human clinical review | 0 | 10 | Not yet recorded |
| Publish scope decision (England) | 7 | 10 | Recommended not yet formalised |

**Readiness score: 8.2 / 10**

---

## RECOMMENDATION

### **READY FOR MASTER V1**

**Conditions:**

1. Master V1 author uses this document as sole research source for repeat **ordering** workflow
2. Clinical/operations reviewer signs off Sections 5, 6, 12, and 13 before QA checklist
3. Master treats owner variables as placeholders (same pattern as emergency-contraception V1)
4. Master scope: England NHS repeat ordering, EPS, eRD + generic private variants where applicable
5. **Do not duplicate** dispensing clinical-check detail — cross-link `prescription-dispensing` master
6. Section 15 HIGH-priority items drive master emphasis; LOW-priority items may be brief or omitted
7. EPS nomination content must comply with CPE patient choice standards — no auto re-nomination claims
8. Prescription charge rates cited as £9.90/item (2025/26–2026/27) with England-only caveat

**Research foundation is comprehensive enough that Master V1 can be written without additional factual research**, provided the conditions above are met during drafting and review.

**Do not create:** publish content, service pages, variations, area pages, hub pages, or HTML as part of this research task.

---

## Document Control

| Version | Date | Change |
|---------|------|--------|
| v1.0 | 2026-06-22 | Initial Stage 1 research foundation — sections 1–16 |

**Next step:** Clinical/operations sign-off → `repeat-prescriptions-master-v1.md` (Stage 2)
