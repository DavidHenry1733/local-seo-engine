# Malaria Prevention — Stage 1 Research Foundation (V1)

**Document type:** Research foundation only  
**Service ID:** `malaria-prevention`  
**Category:** `private-clinical`  
**Benchmark process:** Pharmacy First framework (`MASTER-SERVICE-CREATION-PROCESS.md` Stage 1)  
**Benchmark document:** `emergency-contraception-research-v1.md`  
**Status:** Draft for human clinical review  
**Created:** 2026-06-22  

**Purpose:** Comprehensive clinical and patient-intent research before any master library prose is written. This document is not publish content.

---

## Source Material (Evidence Base)

| Source | Reference | Use in this document |
|--------|-----------|----------------------|
| NaTHNaC / TravelHealthPro | [TravelHealthPro](https://travelhealthpro.org.uk/) — country malaria maps, outbreak alerts, ACMP-aligned recommendations | Destination risk, resistance patterns, chemoprophylaxis choice by region |
| UK Health Security Agency (UKHSA) / ACMP | *Guidelines for malaria prevention in travellers from the UK* (formerly PHE malaria guidelines; ACMP recommendations) | Chemoprophylaxis regimens, ABCD framework, pregnancy, standby treatment principles |
| TRAVAX | [TRAVAX](https://www.travax.nhs.uk/) — NHS Scotland travel health resource | Cross-reference for Scotland pathway; destination risk alignment |
| FSRH / CoSRH | Clinical Guidance: Contraception for women aged over 40 (travel context); broader SRH travel notes where pregnancy planning overlaps | Pregnancy, breastfeeding, contraceptive interaction with doxycycline |
| NHS.uk | [Malaria](https://www.nhs.uk/conditions/malaria/); travel health pages | Patient-facing risk framing, post-travel fever safety-netting |
| BNF | BNF Chapter: Antimalarials (atovaquone with proguanil, chloroquine, doxycycline, mefloquine, proguanil) | Dosing, contraindications, interactions, start/stop rules |
| Green Book (UKHSA) | Malaria chapter in *Immunisation against infectious disease* | Chemoprophylaxis in context of wider travel health; no malaria vaccine |
| Internal intelligence | `data/pharmacy-service-intelligence/malaria-prevention.json` | Patient intent signals, question seeds, trust signals |
| Internal blueprint | `data/pharmacy-service-blueprints/malaria-prevention.json` | Concerns, myths, process steps, unsuitability criteria, related services |
| Internal variants | `data/pharmacy-service-variants/malaria-prevention.json` | Service framing, eligibility blocks, FAQ seeds |
| Internal blueprint seeds | `src/pharmacy/pharmacyServiceBlueprintSeeds.ts` (`malaria-prevention`) | Core myths, related services, patient questions |
| Internal enrichment | `src/pharmacy/pharmacyServiceBlueprintEnrichmentSeeds.ts` (`malaria-prevention`) | ABCD benefits, booking barriers, objections, safety concerns, NHS/private comparisons |
| Cross-reference | `travel-vaccinations-research-v1.md` | Travel cluster dedupe boundaries (Sections 5.5, 12.2, 16) |

**Verification note:** Chemoprophylaxis regimens and resistance guidance mapped to ACMP/NaTHNaC country pages and BNF antimalarial monographs. Antimalarial tablets for travel are **not routinely NHS-funded** in England — owner-specific private pricing and prescribing scope (`{{private_malaria_fee}}`, `{{ip_prescriber_available}}`) must be confirmed locally before publish claims. Scotland/Wales/NI devolved pathways noted as gaps where applicable.

**Travel cluster note (dedupe):** This service owns **chemoprophylaxis depth** (drug selection, resistance, ABCD, adherence, post-travel fever). `travel-vaccinations` owns vaccine menus, ICVP, yellow fever designation. `travel-health-consultations` owns comprehensive multi-risk planning for complex itineraries. Overlap is intentional at journey level; master content must cross-link without duplicating vaccine prose or full travel-health consultation scope — see Section 16.6.

---

## 1. SERVICE DEFINITION

### 1.1 What the service is

- Private pharmacist-led consultation for **antimalarial chemoprophylaxis** (malaria prevention tablets) linked to travel to malaria-risk destinations
- Destination-specific risk assessment using itinerary detail: countries, regions, urban/rural, altitude, season, accommodation, duration, night outdoor exposure, activities
- Shared decision-making on whether chemoprophylaxis is indicated, optional, or not required for the specific trip
- Supply of appropriate antimalarial prophylaxis where clinically indicated and within pharmacist prescribing authority (independent prescriber or private PGD/protocol)
- **ABCD approach** counselling integrated into every consultation:
  - **A**wareness of malaria risk at destination
  - **B**ite avoidance (DEET repellents, permethrin-treated clothing, mosquito nets, air conditioning)
  - **C**hemoprophylaxis where recommended
  - **D**iagnosis — fever during or after travel to malaria area requires urgent medical assessment (malaria is a medical emergency)
- Adherence planning: start dates before travel, daily/weekly dosing during travel, continuation period after leaving risk area
- Side effect counselling specific to agent supplied (doxycycline photosensitivity/GI upset; mefloquine neuropsychiatric history; atovaquone-proguanil tolerability)
- Discussion of **standby emergency treatment (SBET)** where clinically appropriate for select low-risk but high-consequence scenarios — per ACMP guidance; not routine for all travellers
- Written prophylaxis schedule aligned to trip duration, return date, and any trip extensions
- Integration with wider travel health planning — vaccines and non-malaria precautions may be signposted or co-booked (`travel-vaccinations`, `travel-health-consultations`) but are not the primary scope of this service ID
- Advice-only outcome valid when chemoprophylaxis not indicated or patient declines after counselling
- Safety-netting for post-travel fever, drug interactions, pregnancy planning, and GP/specialist referral when outside pharmacy scope
- Delivered in private consultation room (`{{consultation_room}}`) by GPhC-registered pharmacist with independent prescribing qualification or authorised under private PGD where applicable

### 1.2 NHS pathway — limited (England default)

**Primary reality:** Antimalarial tablets for **travel prophylaxis are not routinely available on NHS prescription** for ordinary holiday/business travel in England. Patients typically pay privately for consultation + medicine supply at pharmacy or private travel clinic.

**Limited NHS exceptions (not pharmacy-default):**
- Certain occupational NHS contracts (e.g. some healthcare workers, military, diplomatic postings) may have employer/NHS-funded prophylaxis — outside standard community pharmacy malaria-prevention service
- Treatment of malaria (not prophylaxis) — hospital/infectious diseases pathway
- Some GP surgeries may occasionally prescribe for travel on NHS where local policy allows — uncommon; pharmacy service assumes **private pathway**

**Pharmacy NHS commissioning:**
- Rare for standalone malaria chemoprophylaxis commissioning in England community pharmacy
- Owner must confirm `{{nhs_malaria_service}}` — default research assumption is **private-only**
- Scotland: TRAVAX-aligned NHS travel health resources exist; pharmacy NHS malaria prescribing not universal — owner confirms

**Inclusion criteria (typical private pharmacy service):**
- Travel planned to malaria-risk area per NaTHNaC country/region assessment
- Patient able to provide accurate medical history, medicines list, allergies
- No contraindication to recommended prophylaxis agent after individual assessment
- Patient (or parent/guardian for paediatric cases within licensed ages) consents after counselling
- Trip dates allow adequate lead time for agent-specific start rules (especially mefloquine 2–3 weeks pre-travel tolerance window)

**Exclusion criteria (cannot supply / must refer):**
- Known hypersensitivity to proposed antimalarial or excipients
- Contraindications to all suitable agents for destination (e.g. pregnancy with only doxycycline/mefloquine options — specialist/GP pathway)
- Severe renal impairment affecting atovaquone-proguanil dosing
- History of neuropsychiatric disorder where mefloquine would otherwise be option
- Epilepsy or certain cardiac conduction disorders affecting mefloquine choice
- G6PD deficiency where primaquine/chloroquine-related agents relevant — specialist input
- Complex immunosuppression, uncontrolled comorbidity without GP involvement
- **Post-travel fever** or suspected acute malaria — emergency/urgent assessment, not pre-travel booking
- Patient requesting supply without consultation or for someone else's itinerary without assessment
- Destination/agent mismatch (e.g. atovaquone-proguanil resistance area without alternative in scope)

**Pharmacy cannot (scope boundaries):**
- Guarantee 100% malaria protection — chemoprophylaxis reduces risk; bite avoidance essential; no vaccine
- Replace specialist infectious diseases/tropical medicine clinic for complex cases (pregnancy in high-transmission area, multiple failed prophylaxis, severe drug intolerance)
- Prescribe without individual risk assessment based on online country list alone
- Supply counterfeit or unlicensed products; or advise buying tablets abroad without quality assurance
- Treat diagnosed malaria in standard pre-travel consultation
- Override BNF/ACMP contraindications
- Promise NHS-free supply unless `{{nhs_malaria_service}}` confirmed commissioned

### 1.3 Private service variants (typical UK pharmacy)

- Standalone malaria prevention consultation + supply (`{{private_malaria_fee}}` consultation fee + medicine cost)
- Combined appointment with travel vaccinations at same visit — separate service documentation; fee structure may bundle or itemise (`{{combined_travel_fee}}` owner variable)
- Malaria-only follow-up for trip extension, date change, or side effect review
- Family/group consultations — weight-based paediatric dosing where licensed
- Occupational/volunteer travel prophylaxis (NGO, healthcare abroad) — may need employer documentation
- Advice-only consultation when NaTHNaC maps indicate no chemoprophylaxis needed but patient wants reassurance
- Dispense of existing GP private prescription where pharmacy policy allows — may still require travel health review
- Standby emergency treatment supply — select scenarios only; prescriber judgement per ACMP
- No NHS claim for routine travel prophylaxis — patient pays consultation + tablets unless exceptional commissioning

### 1.4 Typical appointment structure

**Malaria prevention consultation:**
1. Patient contact — walk-in triage, phone, or booked slot (`{{booking_link}}`, `{{phone}}`)
2. Pre-triage where offered — destination, dates, urgency, fee indication
3. Private consultation room — confidential assessment (`{{consultation_room}}`)
4. Consent and service scope — private fees explained; NHS funding limits clarified
5. Full travel itinerary review — all countries/regions, rural side trips, duration, season, accommodation, activities (VFR, backpacking, business)
6. Medical history — allergies, pregnancy/breastfeeding/plans, psychiatric history (mefloquine), epilepsy, cardiac disease, renal/hepatic impairment, G6PD status if relevant
7. Complete medicines review — anticoagulants, antiepileptics, immunosuppressants, St John's Wort, oral contraceptives (doxycycline interaction), OTC/herbal
8. NaTHNaC/ACMP-aligned risk assessment — chemoprophylaxis indicated, optional, or not recommended
9. ABCD counselling — bite avoidance non-negotiable; chemoprophylaxis if indicated
10. Agent selection — destination resistance, patient factors, tolerability, cost, adherence (shared decision)
11. Written schedule — start before travel, during, stop after return (agent-specific tail)
12. Supply where appropriate — PIL, adherence aids, sun protection advice if doxycycline
13. Standby treatment discussion if applicable — not routine default
14. Signposting — travel vaccines (`travel-vaccinations`), complex itinerary (`travel-health-consultations`), GP notification
15. Safety-netting — post-travel fever = urgent medical assessment; side effects; trip extension protocol
16. Documentation — consultation record; GP notification where appropriate/consented

**Typical duration:** ~20–40 minutes (complex multi-country, family groups, or agent counselling may extend)

**Lead time:** Ideal ≥2–3 weeks before travel (mefloquine tolerance assessment); atovaquone-proguanil/doxycycline can start 1–2 days before entry but earlier booking allows counselling and stock

**Staff:** GPhC-registered pharmacist — **independent prescriber** for antimalarial supply in most private pharmacy models; PGD-authorised where local protocol exists (`{{ip_prescriber_available}}`)

---

## 2. PATIENT INTENT

### 2.1 Why patients seek malaria prevention

- Upcoming travel to Africa, South Asia, South-East Asia, Oceania, or Central/South America malaria-endemic regions
- Uncertainty whether their destination requires antimalarial tablets
- GP unable to offer timely appointment before departure
- Prefer pharmacy convenience — extended hours, local access, one-stop with travel vaccines
- Last-minute travel — need tablets quickly before flight
- Previous trip used different tablets — unsure if still appropriate for new destination
- Family holiday — need children's dosing and group supply
- Business travel to endemic cities or rural sites
- Backpacking/gap year — long-duration prophylaxis planning and cost
- Visiting friends and relatives (VFR) — may underestimate risk ("I'm going home")
- Occupational travel — employer requires documented prophylaxis
- Side effects on previous prophylaxis — want alternative agent
- Online research conflicting — want professional destination-matched advice
- Already have GP prescription — want pharmacy supply with counselling

### 2.2 Common triggers

- Flight/holiday booking to tropical/sub-tropical destination
- Travel agent or colleague warning about malaria
- NaTHNaC/NHS website check showing malaria map risk
- Travel vaccination appointment raises malaria question
- News of malaria outbreak in destination
- Approaching departure without tablets arranged
- Pharmacy marketing — seasonal travel health campaigns
- University placement or volunteer programme abroad
- Previous malaria scare on earlier trip
- Insurance or employer health requirement

### 2.3 Common concerns (intent-level)

- "Do I actually need tablets for a resort/city trip?"
- Cost of consultation plus tablets for whole family
- NHS vs private — "why isn't this free?"
- Side effects worse than malaria risk (mefloquine dreams, doxycycline nausea/sun)
- Which tablet is best for my destination
- Too late to start before travel
- Whether pharmacy is qualified vs GP/travel clinic
- Drug interactions with regular medicines
- Pregnancy or trying to conceive during/after trip
- Children — same tablets as adults?
- Forgetting doses during holiday
- How long after return must tablets continue
- Buying cheaper tablets abroad or online
- Friends travelled without tablets and were fine
- Chemoprophylaxis vs vaccination confusion

### 2.4 Typical motivations

- Prevent serious *Plasmodium falciparum* malaria — potentially fatal
- Convenience — high street pharmacy, flexible booking (`{{opening_hours}}`)
- Integrated travel health at one location — vaccines + malaria same pharmacy team
- Clear pricing upfront (`{{private_malaria_fee}}`, tablet cost)
- Pharmacist medicines expertise — interaction checking
- Faster access than GP waiting list
- Confidential itinerary discussion (`{{consultation_room}}`)
- Written schedule and professional records for employer/insurance
- Trusted regulated setting — GPhC premises
- Plain-language ABCD education — not just a prescription

---

## 3. PATIENT QUESTIONS (Raw Research List)

**Format note:** Questions only. Not written as publish FAQs. **Count: 58**.

### 3.1 Destination risk and eligibility

1. Do I need antimalarials for my destination?
2. I'm only going to a city — do I still need malaria tablets?
3. We're staying in a resort — is prophylaxis necessary?
4. Which countries require malaria prevention tablets?
5. Does my specific region within the country matter?
6. I'm transiting through a malaria country for a few hours — do I need tablets?
7. What if I'm visiting multiple countries with different malaria risks?
8. Is malaria risk seasonal at my destination?
9. Does altitude affect whether I need prophylaxis?
10. I'm visiting friends and family — do I need tablets if I grew up there?
11. Do I need prophylaxis for a short trip (weekend/one week)?
12. Is chemoprophylaxis recommended or optional for my destination?

### 3.2 Tablets, agents, and effectiveness

13. Which malaria tablet is best for my trip?
14. What's the difference between Malarone, doxycycline, and Lariam?
15. Why can't I take chloroquine like people used to?
16. Do malaria tablets actually work?
17. Which tablets work in Africa vs Asia?
18. Are there areas where Malarone doesn't work?
19. Can I switch tablets if I get side effects abroad?
20. Do I need different tablets for different parts of my trip?
21. Is there a malaria vaccine instead of tablets?
22. What's standby emergency treatment — do I need that as well?
23. Can I take half doses to reduce side effects?
24. What if I miss a dose while on holiday?

### 3.3 Timing, dosing, and adherence

25. When should I start malaria tablets before travel?
26. How long before my flight do I need to begin?
27. How long do I keep taking tablets after I return home?
28. Why do some tablets continue for weeks after travel?
29. Why does Lariam/mefloquine need to start weeks before travel?
30. Is it too late to start if I leave in three days?
31. What if my trip gets extended — do I need more tablets?
32. Can I stop tablets early once I'm back in the UK?
33. Should I take tablets at the same time each day?
34. Do I take weekly tablets on the same day each week?

### 3.4 Side effects and safety

35. What are the side effects of malaria tablets?
36. Will doxycycline make me sunburn more easily?
37. Does mefloquine cause nightmares or anxiety?
38. Is Malarone easier to tolerate?
39. Can I drink alcohol while on malaria prophylaxis?
40. Will malaria tablets affect my contraceptive pill?
41. Can I take malaria tablets if I'm on blood thinners?
42. Are malaria tablets safe for children?
43. Can I take malaria tablets while pregnant?
44. Is prophylaxis safe while breastfeeding?
45. I have epilepsy — which malaria tablet can I take?
46. I had depression before — can I take mefloquine?

### 3.5 Pharmacy access, NHS, and cost

47. Can a pharmacy prescribe malaria tablets?
48. Do I need a GP referral for antimalarials?
49. Are malaria tablets free on the NHS?
50. How much do malaria tablets cost for a two-week trip?
51. How much is the pharmacy consultation fee?
52. Is pharmacy cheaper than a private travel clinic?
53. Can I use my GP prescription at the pharmacy?
54. Can I buy malaria tablets online without a consultation?
55. Can I get malaria tablets abroad cheaper?
56. Does travel insurance cover antimalarial costs?

### 3.6 Appointments and preparation

57. Do I need an appointment or can I walk in?
58. How long does a malaria prevention appointment take?
59. What should I bring to my appointment?
60. Can I book malaria prevention online?
61. Can the whole family be seen in one appointment?
62. Do I need a travel vaccination appointment first?
63. Can I combine malaria tablets with my vaccine appointment?
64. How far ahead should I book before travel?

### 3.7 After travel and emergencies

65. What if I get a fever after returning from a malaria area?
66. How quickly can malaria develop after a bite?
67. Can I still get malaria if I took all my tablets?
68. Should I get a malaria test when I get home?
69. What symptoms mean I need urgent help abroad?
70. Is malaria prevention the same as malaria treatment?

---

## 4. PATIENT CONCERNS (Raw Research List)

**Count: 24**

1. Unnecessary tablets for "safe" city/resort travel — over-medicalisation worry
2. Cost of private consultation plus tablets multiplied by family size
3. NHS vs private confusion — expectation of free GP prescription
4. Side effect fear — especially mefloquine neuropsychiatric reputation
5. Doxycycline photosensitivity ruining beach holiday
6. Which agent is "right" — decision paralysis from conflicting online advice
7. Too late before departure — panic booking day before flight
8. Pharmacy less thorough than GP or hospital travel clinic
9. Drug interaction anxiety — anticoagulants, epilepsy medicines, contraception
10. Pregnancy or conception plans during/after travel
11. Paediatric dosing complexity — children cannot swallow tablets
12. Adherence worry — forgetting doses on irregular holiday schedule
13. Unclear stop date after return — stopping too early
14. Friends/family travelled without prophylaxis — social proof against tablets
15. Buying abroad cheaper — quality and counterfeit concern vs cost saving
16. Online pharmacy bypassing consultation — privacy and speed appeal
17. Chemoprophylaxis false security — neglecting bite prevention
18. Resistance confusion — "tablets won't work anyway"
19. Previous bad experience with one agent — reluctance to retry any prophylaxis
20. Embarrassment discussing psychiatric history for mefloquine screening
21. Itinerary complexity — side trips not disclosed at booking
22. Trip extension without enough tablets remaining
23. Post-travel fever misattributed to flu or COVID — delayed malaria diagnosis
24. Standalone malaria booking vs expecting vaccines covered in same free chat

---

## 5. CLINICAL FACTS

### 5.1 Malaria risk overview

- Malaria transmitted by *Anopheles* mosquito bites (usually dusk–dawn)
- Major species affecting travellers: *P. falciparum* (most dangerous), *P. vivax*, *P. ovale*, *P. malariae*, *P. knowlesi* (select regions)
- Risk varies **within countries** — urban vs rural, altitude, season, accommodation (AC, screened windows)
- **No licensed malaria vaccine** for travellers — chemoprophylaxis + bite avoidance remain primary prevention
- NaTHNaC country malaria maps classify areas: malaria present, risk variable, chloroquine resistance, atovaquone-proguanil resistance zones
- VFR travellers often at **higher actual exposure** despite familiarity — extended rural stays, local housing

### 5.2 ABCD framework (ACMP / NaTHNaC standard)

| Component | Research note |
|-----------|---------------|
| **Awareness** | Understand destination risk; malaria can kill; partial protection only with chemoprophylaxis |
| **Bite avoidance** | DEET 50% (or alternatives per ACMP), permethrin-treated clothing/nets, air-conditioned rooms, cover skin dusk–dawn |
| **Chemoprophylaxis** | Tablet prophylaxis where ACMP/NaTHNaC recommends for itinerary — agent matched to resistance and patient |
| **Diagnosis** | Fever ≥38°C during travel or up to **1 year after return** from malaria area — **urgent same-day medical assessment**; malaria is emergency |

**Key principle:** Chemoprophylaxis does not replace bite avoidance. Neither provides 100% protection.

### 5.3 Chemoprophylaxis agents — UK traveller options (BNF / ACMP)

| Agent | Typical use (resistance-dependent) | Adult prophylaxis dose (BNF summary) | Start before travel | Continue after leaving risk area |
|-------|-----------------------------------|--------------------------------------|---------------------|----------------------------------|
| **Atovaquone with proguanil** (Malarone®) | Most sub-Saharan Africa; many regions; **NOT** where AP resistance (parts of SE Asia — NaTHNaC) | 1 tablet daily (adult strength) | 1–2 days before | **7 days** after |
| **Doxycycline** | Alternative where AP unsuitable/resistance; many regions | 100 mg daily | 1–2 days before | **4 weeks** after |
| **Mefloquine** (Lariam®) | Alternative where AP/doxy unsuitable; resistance areas vary | 250 mg weekly | **2–3 weeks before** (tolerance assessment) | **4 weeks** after |
| **Chloroquine ± proguanil** | Very limited — only where ACMP indicates chloroquine-sensitive areas (few destinations) | Per BNF | 1 week before | **4 weeks** after |

**Research note:** Chloroquine-resistant *P. falciparum* widespread — chloroquine rarely first-line for most traveller destinations. Always cross-check current NaTHNaC country page.

### 5.4 Resistance patterns — clinical decision relevance

| Resistance issue | Research note | Pharmacy implication |
|------------------|---------------|---------------------|
| Chloroquine-resistant *P. falciparum* | Widespread in Africa, most of Asia, South America | Chloroquine not routine for most travellers |
| Atovaquone-proguanil resistance | Documented parts of SE Asia (e.g. Cambodia, Thai border areas, Myanmar — verify NaTHNaC) | Avoid AP in resistance zones; select doxycycline or mefloquine per ACMP |
| Mefloquine resistance | Parts of SE Asia and elsewhere | Check NaTHNaC; may exclude mefloquine |
| *P. vivax* relapse | Liver hypnozoites — primaquine radical cure separate issue | Post-travel specialist management; prophylaxis does not prevent vivax relapse pattern alone |

### 5.5 Agent-specific contraindications and cautions (BNF summary)

**Atovaquone with proguanil:**
- Contraindicated: severe renal impairment (eGFR <30 mL/min/1.73 m²)
- Caution: pregnancy (insufficient data — specialist advice if travel essential); weight limits for paediatric dosing
- Generally well tolerated; take with food/fatty meal for absorption

**Doxycycline:**
- Contraindicated: pregnancy, breastfeeding, children under 12 years (UK prophylaxis standard)
- Caution: photosensitivity (sun protection essential), oesophageal irritation (take upright with water), may reduce contraceptive efficacy — additional precautions advised (FSRH/CoSRH travel context)
- Interactions: anticoagulants (monitor INR), enzyme inducers, alcohol (GI)

**Mefloquine:**
- Contraindicated: history of psychiatric disorder (depression, anxiety, psychosis), epilepsy/seizures, certain cardiac conduction disorders, severe liver impairment
- Caution: neuropsychiatric symptoms during use — discontinue and seek help; start 2–3 weeks early to assess tolerance
- Not suitable if patient unwilling to disclose psychiatric history

### 5.6 Pregnancy and breastfeeding (ACMP / FSRH context)

- **Avoid travel** to high malaria transmission areas during pregnancy where possible — malaria in pregnancy high risk to mother and fetus
- Doxycycline — **contraindicated** in pregnancy and breastfeeding
- Atovaquone-proguanil — generally **avoid in pregnancy** unless essential (specialist risk-benefit)
- Mefloquine — may be considered **2nd/3rd trimester** in select scenarios per ACMP — specialist input preferred
- Breastfeeding: doxycycline contraindicated; check BNF for other agents — often defer travel or specialist advice
- Pharmacy action: pregnancy/planning pregnancy → enhanced referral; may be outside standalone supply scope

### 5.7 Paediatric prophylaxis (research notes)

- Weight-based dosing for atovaquone-proguanil paediatric tablets
- Doxycycline generally not for children under 12 for prophylaxis
- Mefloquine licensed for children above weight thresholds per BNF — psychiatric screening still applies
- Pharmacy confirms paediatric scope (`{{paediatric_malaria_age}}`)

### 5.8 Standby emergency treatment (SBET) — scope boundary

- ACMP recommends SBET only for **select remote itineraries** where prompt medical care unavailable and risk assessment supports
- Not a substitute for chemoprophylaxis where prophylaxis indicated
- Agents may include atovaquone-proguanil or artemether-lumefantrine — **prescriber specialist judgement**
- Pharmacy may supply in scope where IP qualified — document counselling on when to use and urgent medical follow-up
- **Not routine** for standard resort/package holiday — avoid upselling SBET as default add-on

### 5.9 NHS funding reality

- NHS.uk and ACMP context: travel antimalarial prophylaxis **not routinely NHS prescription**
- Patient pays private consultation + medicine cost at pharmacy (`{{private_malaria_fee}}` + tablet price)
- GP may occasionally prescribe privately (paid prescription) — varies
- Exception pathways occupational — not default pharmacy claim

### 5.10 Post-travel safety-netting (mandatory counselling)

- Fever or flu-like illness during travel or **up to 1 year after return** from malaria-endemic area → **urgent medical assessment same day**
- Malaria can be fatal within 24 hours of symptoms — emergency abroad or UK hospital
- Chemoprophylaxis failure possible — does not exclude malaria
- Prophylaxis does not treat malaria — treatment is hospital/GP infectious diseases pathway
- *P. vivax/ovale* relapse can occur months later — different management

---

## 6. RED FLAGS

### 6.1 Emergency — 999 / same-day hospital (not pre-travel service)

**999 / A&E / emergency abroad:**
- Fever (≥38°C) in patient who has been in malaria-endemic area — within travel or up to 1 year after return
- Confusion, drowsiness, seizures with fever in malaria context
- Severe anaemia, jaundice, dark urine with fever post-travel
- Collapse, shock, multi-organ failure suspected malaria
- Severe allergic reaction to supplied antimalarial — anaphylaxis

**Research note:** Pre-travel malaria prevention appointment is **wrong entry point** for febrile unwell patient — redirect to emergency assessment.

### 6.2 Refer to GP / specialist travel or infectious diseases clinic

- Pregnancy planning travel to high-transmission area — complex risk-benefit
- Pregnancy already — most agents contraindicated or specialist-only
- Severe renal/hepatic impairment affecting all usable agents
- Complex psychiatric history — mefloquine excluded; limited alternatives
- G6PD deficiency with chloroquine/primaquine considerations
- HIV with immunosuppression — specialist prophylaxis advice
- Failed prior prophylaxis (breakthrough malaria while adherent)
- Multiple drug intolerances — need specialist regimen
- Long-term residence (>6 months) in endemic area — not standard traveller prophylaxis model
- Infant below pharmacy paediatric prescribing scope
- Destination requires agent pharmacy cannot prescribe/stock

### 6.3 When pharmacy malaria prevention is NOT appropriate today

- Patient acutely unwell with fever — emergency pathway
- Insufficient itinerary detail to assess resistance area
- Contraindication to all suitable agents for destination
- Patient refuses bite avoidance counselling where chemoprophylaxis optional — still document advice
- Demand for chloroquine alone for chloroquine-resistant destination
- Request to supply for third party without assessment
- Trip starts imminently but mefloquine chosen and 2-week lead not met — reconsider agent or defer travel counselling honestly

### 6.4 Defer supply — reschedule with safety-netting

- Need GP records for complex comorbidity not yet obtained
- Awaiting pregnancy test result relevant to agent choice
- Stock unavailable — order for collection before travel if time allows
- Patient unwell with vomiting/diarrhoea — may affect absorption counselling; assess if still fit to travel

### 6.5 Advice-only outcome (valid)

- NaTHNaC assessment: no chemoprophylaxis recommended for specific itinerary (e.g. low-risk urban only) — document ABCD
- Patient declines all chemoprophylaxis after counselling — document informed decline + bite avoidance + diagnosis advice
- Chemoprophylaxis indicated but patient defers to GP — provide written recommendation list

---

## 7. MYTHS (Real Misconceptions Only)

**Count: 24**

| # | Misconception | Research correction (not publish prose) |
|---|---------------|----------------------------------------|
| 1 | There's a malaria vaccine so I don't need tablets | No licensed malaria vaccine for travellers; chemoprophylaxis + bite avoidance required where indicated |
| 2 | City/resort travel means no malaria risk | Risk varies by country/region; urban lower in some areas but not zero — NaTHNaC maps decide |
| 3 | Antimalarials are free on the NHS for travel | Not routinely funded; private consultation + medicine cost typical |
| 4 | Chloroquine still works everywhere | Chloroquine-resistant *P. falciparum* widespread; rarely first-line |
| 5 | Malarone works in every country | Atovaquone-proguanil resistance in parts of SE Asia — agent must match destination |
| 6 | Tablets alone fully protect me | Chemoprophylaxis reduces risk; bite avoidance essential; not 100% effective |
| 7 | I can stop tablets as soon as I land back in UK | Must continue tail period (7 days AP; 4 weeks doxy/mefloquine) per BNF |
| 8 | I only need tablets during the trip, not before | Start 1–2 days before (AP/doxy) or 2–3 weeks before (mefloquine) |
| 9 | Missing one dose doesn't matter | Adherence critical; missed doses increase risk — counselling on what to do if missed |
| 10 | Friends travelled without tablets and were fine | Survivorship bias; malaria can kill; VFR travellers at higher exposure |
| 11 | Buying tablets abroad is always fine | Counterfeit/substandard medicines risk; UK consultation ensures appropriate agent |
| 12 | Online pharmacies replace travel consultation | Individual itinerary and medical history required for safe prescribing |
| 13 | Pharmacists can't prescribe antimalarials | Independent prescriber pharmacists (and PGD where authorised) can supply privately |
| 14 | Mefloquine always causes madness | Neuropsychiatric risk real but not universal; contraindicated with psychiatric history |
| 15 | Doxycycline is always worst for sun | Photosensitivity real — manageable with sun protection; still valid agent |
| 16 | I'm immune because I grew up in malaria country | Partial immunity wanes after leaving endemic area; VFR travellers need prophylaxis per ACMP |
| 17 | Malaria only happens during the trip | Can present weeks to months after return; up to 1 year vigilance |
| 18 | Flu symptoms after travel can't be malaria | Malaria mimics flu — fever in malaria context needs urgent exclusion |
| 19 | Travel vaccines protect against malaria | Separate decision; no malaria vaccine in vaccine schedule |
| 20 | One travel clinic visit covers everything without extra fee | Malaria prevention may be separate service/booking; owner fee structure varies |
| 21 | Children take adult tablets | Weight/age-based dosing; doxycycline not for young children |
| 22 | Pregnancy is fine with doxycycline prophylaxis | Doxycycline contraindicated in pregnancy; travel may need deferral/specialist |
| 23 | I can use leftover tablets from last trip | Agent/dose/expiry must match current destination; full course needed |
| 24 | Chemoprophylaxis treats malaria if I get infected | Prophylaxis prevents; treatment is different urgent hospital pathway |

---

## 8. TRUST FACTORS

- GPhC-registered premises and regulated professionals
- Pharmacist independent prescriber qualification for antimalarial supply (`{{ip_prescriber_available}}`)
- NaTHNaC/ACMP-aligned destination risk assessment — not generic country guessing
- ABCD framework explained — bite avoidance prioritised alongside tablets
- Resistance-aware agent selection — honest limits where AP not suitable
- Transparent private fee before supply (`{{private_malaria_fee}}` + tablet cost)
- Clear NHS funding limits — no false free-service claim
- Private consultation room for itinerary and medical history (`{{consultation_room}}`)
- Complete medicines interaction check
- Written prophylaxis schedule with start/stop dates
- Non-judgemental psychiatric history screening for mefloquine
- Safety-netting — post-travel fever urgency explained
- Referral when outside scope rather than inappropriate supply
- GP notification option for continuity
- Integration with travel vaccines at same trusted pharmacy team
- Professional indemnity and clinical governance
- Documented informed decline when patient refuses prophylaxis

---

## 9. LOCAL PHARMACY ADVANTAGES

- High street access — malaria planning without hospital travel clinic referral for straightforward cases
- Extended evening/weekend hours vs GP (`{{opening_hours}}`)
- Same-day appointments where offered for imminent departures
- One-stop travel health — malaria + vaccines + insect repellent products (`travel-vaccinations` link)
- Private consultation room (`{{consultation_room}}`)
- Online/phone booking (`{{booking_link}}`, `{{phone}}`)
- Pharmacist medicines expertise — warfarin, epilepsy, contraception interactions
- Transparent local pricing vs opaque online clinics
- Family group consultations in familiar setting
- Written records for employer/insurance travel requirements
- Follow-up for trip extension or side effects at same location
- Stock and supply on site where formulary allows (`{{antimalarial_stock}}`)
- Reduced GP waiting list pressure for suitable self-pay travellers

**Caveats:** Not all pharmacies prescribe antimalarials — IP/PGD required; not NHS-free by default; complex pregnancy/immunosuppression cases need referral; agent stock varies.

---

## 10. OWNER VARIABLES

| Variable | Purpose |
|----------|---------|
| `{{phone}}` | Triage, booking, urgent pre-travel enquiries |
| `{{opening_hours}}` | Last-minute traveller access |
| `{{booking_link}}` | Online booking URL if offered |
| `{{consultation_room}}` | Private confidential consultation facility |
| `{{private_malaria_fee}}` | Private malaria consultation fee (advice ± supply) |
| `{{ip_prescriber_available}}` | Independent prescriber on team for antimalarial supply (yes/no) |
| `{{nhs_malaria_service}}` | NHS commissioned malaria service if any — default no |
| `{{antimalarial_stock}}` | Which agents stocked (AP, doxy, mefloquine) |
| `{{paediatric_malaria_age}}` | Minimum age/weight for paediatric supply |
| `{{combined_travel_fee}}` | Bundled travel health + malaria pricing if offered |

**Additional owner fields for Stage 2:** SBET supply scope, GP notification practice, malaria tablet price list, walk-in policy, languages/accessibility, link to `travel-vaccinations` and `travel-health-consultations` booking paths.

---

## 11. PATIENT EMOTIONS (Stage 1 Enhancement)

**Format:** Research notes only. Not publish copy.

### 11.1 Destination anxiety

| Field | Research note |
|-------|---------------|
| **Trigger** | First trip to Africa/Asia; news stories of malaria deaths |
| **Patient concern** | "Will I die if I forget something?" |
| **Typical behaviour** | Over-research online; conflicting advice paralysis |
| **Common questions** | Do I really need tablets? / Which country is worst? |

### 11.2 Side effect dread

| Field | Research note |
|-------|---------------|
| **Trigger** | Friend's mefloquine nightmares; doxycycline sunburn stories |
| **Patient concern** | Tablets will ruin the holiday |
| **Typical behaviour** | Wants "mildest" pill without medical disclosure; may decline all prophylaxis |
| **Common questions** | Which has fewest side effects? / Can I skip doses? |

### 11.3 Cost resentment

| Field | Research note |
|-------|---------------|
| **Trigger** | NHS vaccines free at GP but malaria tablets private |
| **Patient concern** | Being upsold unnecessary medicines |
| **Typical behaviour** | Price-shops online; compares pharmacy vs clinic; family cost multiplication |
| **Common questions** | Why isn't this free? / Can I buy abroad cheaper? |

### 11.4 Last-minute panic

| Field | Research note |
|-------|---------------|
| **Trigger** | Departure in 48–72 hours; no tablets arranged |
| **Patient concern** | Too late for protection |
| **Typical behaviour** | Walk-in expecting instant supply without full history |
| **Common questions** | Is it too late? / Can you give me tablets now? |

### 11.5 VFR complacency

| Field | Research note |
|-------|---------------|
| **Trigger** | "Going home" to endemic country; childhood immunity assumption |
| **Patient concern** | Prophylaxis unnecessary for "locals" |
| **Typical behaviour** | Minimises rural stay duration; declines chemoprophylaxis |
| **Common questions** | I lived there — do I need tablets? / City only visit |

### 11.6 Trust in pharmacy vs GP

| Field | Research note |
|-------|---------------|
| **Trigger** | GP wait time; belief only doctors prescribe serious medicines |
| **Patient concern** | Pharmacist not qualified for malaria |
| **Typical behaviour** | Asks for credentials; compares with hospital travel clinic |
| **Common questions** | Can a pharmacist prescribe this? / Should I see my GP instead? |

### 11.7 Adherence overwhelm

| Field | Research note |
|-------|---------------|
| **Trigger** | Long trip; weekly vs daily dosing confusion |
| **Patient concern** | Will forget doses on busy holiday |
| **Typical behaviour** | Seeks simplest regimen; asks about alarms/apps |
| **Common questions** | What if I miss a dose? / How long after return? |

### 11.8 Pregnancy fear

| Field | Research note |
|-------|---------------|
| **Trigger** | Planned conception; honeymoon travel; breastfeeding infant at home |
| **Patient concern** | Tablets harm baby |
| **Typical behaviour** | May conceal pregnancy; needs sensitive screening |
| **Common questions** | Safe if trying for baby? / Can I travel pregnant? |

### 11.9 False reassurance after supply

| Field | Research note |
|-------|---------------|
| **Trigger** | Tablets in bag; pre-flight relief |
| **Patient concern** | Fully protected; ignore mosquito bites |
| **Typical behaviour** | Dismisses DEET/net advice; stops tail doses early |
| **Common questions** | So I'm completely safe? / Can I stop when home? |

### 11.10 Post-travel health anxiety

| Field | Research note |
|-------|---------------|
| **Trigger** | Flu-like illness weeks after return |
| **Patient concern** | Is it malaria or cold/COVID? |
| **Typical behaviour** | Delays urgent assessment; self-tests inappropriately |
| **Common questions** | When should I worry? / Can pharmacy test for malaria? |

---

## 12. ANTIMALARIAL OPTIONS KNOWLEDGE (Stage 1 Enhancement)

**Format:** Evidence-based research notes. Not advice copywriting. Section maps agents, resistance, start/stop rules, and selection factors per ACMP/NaTHNaC and BNF.

### 12.1 Atovaquone with proguanil (Malarone®)

| Field | Research note |
|-------|---------------|
| **Brand examples** | Malarone®; generic atovaquone/proguanil |
| **Mechanism** | Inhibits parasite mitochondrial function and folate synthesis |
| **Typical destinations** | Most of sub-Saharan Africa; many South Asian/South American regions — **check NaTHNaC** |
| **Avoid** | AP resistance areas (parts of SE Asia — Cambodia, Thai borders, Myanmar per NaTHNaC) |
| **Adult dose** | 1 adult tablet daily |
| **Paediatric** | Weight-based paediatric tablets — pharmacy confirms scope |
| **Start/stop** | 1–2 days before entry; **7 days after** leaving risk area |
| **Food** | Take with food or milky drink — improves absorption |
| **Contraindications** | Severe renal impairment (eGFR <30) |
| **Pregnancy** | Avoid unless essential — specialist advice |
| **Tolerability** | Generally best tolerated; GI upset possible |
| **Cost** | Often most expensive per day — price sensitivity common |
| **Pharmacy role** | First-line for many destinations where no AP resistance |

### 12.2 Doxycycline

| Field | Research note |
|-------|---------------|
| **Mechanism** | Tetracycline antibiotic — antimalarial prophylaxis effect |
| **Typical destinations** | Alternative where AP unsuitable or resistance; many regions per ACMP |
| **Adult dose** | 100 mg once daily |
| **Start/stop** | 1–2 days before; **4 weeks after** leaving |
| **Key cautions** | Photosensitivity — high SPF, cover skin; oesophageal erosion — take upright with water |
| **Contraindications** | Pregnancy, breastfeeding, children <12 years (UK prophylaxis standard) |
| **Interactions** | Anticoagulants; may affect contraceptive pill — additional precautions (FSRH travel context) |
| **Additional benefit** | Some other tick/insect-borne coverage — not primary reason for selection |
| **Pharmacy role** | Cost-effective alternative; sun holiday counselling essential |

### 12.3 Mefloquine (Lariam®)

| Field | Research note |
|-------|---------------|
| **Mechanism** | Quinoline antimalarial — weekly dosing |
| **Typical destinations** | Alternative where AP/doxy unsuitable; check resistance maps |
| **Adult dose** | 250 mg once weekly (same day each week) |
| **Start/stop** | **2–3 weeks before** travel (assess tolerance); **4 weeks after** |
| **Contraindications** | Psychiatric history, epilepsy, certain cardiac conduction disorders |
| **Key cautions** | Neuropsychiatric symptoms — stop and seek help; vivid dreams common |
| **Advantage** | Weekly dosing — adherence preference for some long trips |
| **Pharmacy role** | Screen psychiatric history carefully; document informed consent |

### 12.4 Chloroquine and proguanil (limited role)

| Field | Research note |
|-------|---------------|
| **Use** | Only where ACMP/NaTHNaC indicates chloroquine-sensitive malaria |
| **Research note** | Very few destinations for modern UK traveller; often superseded |
| **Pharmacy role** | Rare supply; verify country page before recommending |

### 12.5 Destination-resistance decision matrix (research reference)

| Destination pattern | First-line research note | Alternatives |
|--------------------|--------------------------|--------------|
| Sub-Saharan Africa (most) | Atovaquone-proguanil | Doxycycline, mefloquine |
| AP resistance SE Asia zones | Doxycycline or mefloquine per NaTHNaC | **Not** AP |
| Chloroquine-sensitive only areas (rare) | Chloroquine ± proguanil per ACMP | Per country page |
| Multi-country trip (Africa + SE Asia) | **Highest risk region dictates** — may need doxy/mefloquine for whole trip | Individual assessment |
| Low-risk urban only (NaTHNaC optional) | No chemoprophylaxis — ABCD | Patient choice after counselling |
| *P. vivax* prevalent | Prophylaxis choice as above; relapse prevention separate | Specialist post-travel |

### 12.6 Patient factor selection matrix

| Factor | Impact | Pharmacy action |
|--------|--------|-----------------|
| Psychiatric history | Mefloquine excluded | AP or doxy if otherwise suitable |
| Pregnancy/planning | Doxy contraindicated; AP generally avoid | Refer specialist; consider defer travel |
| Child <12 | Doxy excluded | AP paediatric or mefloquine per weight |
| Renal impairment | AP dose/contraindication | Doxy or mefloquine per eGFR |
| Epilepsy | Mefloquine excluded | AP or doxy |
| Sun-exposed beach holiday | Doxy photosensitivity | Consider AP if destination suitable |
| Weekly vs daily preference | Mefloquine vs AP/doxy | Shared decision |
| Cost sensitivity | Doxy often cheapest | Counsel sun/adherence |
| Short trip tail | AP 7-day post vs 4-week doxy | AP may reduce post-travel burden |
| Contraception | Doxy interaction | Additional precautions or agent switch |

### 12.7 Missed dose research notes (counselling topics)

| Agent | Research note |
|-------|---------------|
| Atovaquone-proguanil | Take ASAP if remembered; if near next dose — do not double; seek pharmacist/GP advice if vomiting within 1 hour |
| Doxycycline | Take ASAP; never double; missed doses increase risk — document counselling |
| Mefloquine | Take ASAP if day late; if near weekly dose — clinical advice per BNF |

---

## 13. CLINICAL DECISION FRAMEWORK (Stage 1 Enhancement)

**Format:** Clinical reference for master content accuracy. Not patient-facing copy.

### 13.1 Chemoprophylaxis indicated — AP suitable destination, no contraindications

| Field | Detail |
|-------|--------|
| **Presentation** | Malaria-risk itinerary; NaTHNaC recommends chemoprophylaxis; no AP resistance |
| **Options** | Atovaquone-proguanil first-line; doxy/mefloquine alternatives if preference/contraindication |
| **ABCD** | Full bite avoidance counselling mandatory |
| **Pharmacy action** | Supply AP with written schedule; 7-day tail explained |
| **Urgency** | Before travel — ideally ≥1 week lead for counselling |

### 13.2 AP resistance area — SE Asia select regions

| Field | Detail |
|-------|--------|
| **Presentation** | Itinerary includes AP resistance zone per NaTHNaC |
| **Options** | Doxycycline or mefloquine — **not** atovaquone-proguanil |
| **Pharmacy action** | Match entire trip to highest-risk region if multi-country |
| **Urgency** | Before travel; mefloquine needs 2–3 week lead if chosen |

### 13.3 Chemoprophylaxis optional — low-risk urban itinerary

| Field | Detail |
|-------|--------|
| **Presentation** | NaTHNaC optional prophylaxis for specific urban/low-risk stay |
| **Options** | ABCD essential; chemoprophylaxis patient choice after shared decision |
| **Pharmacy action** | Document advice if decline; supply if patient chooses |
| **Urgency** | Routine |

### 13.4 No chemoprophylaxis recommended — minimal risk itinerary

| Field | Detail |
|-------|--------|
| **Presentation** | NaTHNaC indicates no prophylaxis for documented itinerary |
| **Options** | ABCD + diagnosis awareness still required if any exposure |
| **Pharmacy action** | Advice-only; avoid inappropriate supply |
| **Urgency** | Routine |

### 13.5 Mefloquine pathway — weekly preference, no psychiatric contraindication

| Field | Detail |
|-------|--------|
| **Presentation** | Patient prefers weekly; destination suitable; 2–3 weeks pre-travel available |
| **Options** | Mefloquine 250 mg weekly |
| **Pharmacy action** | Psychiatric screening documented; start early for tolerance |
| **Urgency** | **Plan ≥3 weeks before** travel |

### 13.6 Doxycycline pathway — cost/sun trade-off accepted

| Field | Detail |
|-------|--------|
| **Presentation** | AP unsuitable/declined; no doxy contraindication; sun counselling accepted |
| **Options** | Doxycycline 100 mg daily |
| **Pharmacy action** | Sun protection; contraception counselling; 4-week tail |
| **Urgency** | Start 1–2 days before entry minimum |

### 13.7 Pregnancy / planning pregnancy

| Field | Detail |
|-------|--------|
| **Presentation** | Pregnant or TTC travelling to endemic area |
| **Options** | Limited — specialist/GP pathway; often defer travel advised |
| **Pharmacy action** | Refer; likely no standalone supply |
| **Urgency** | **Refer before travel planning finalised** |

### 13.8 Paediatric traveller

| Field | Detail |
|-------|--------|
| **Presentation** | Child travelling to endemic area |
| **Options** | Weight-based AP; mefloquine per BNF; no doxy if under 12 |
| **Pharmacy action** | Guardian consent; confirm `{{paediatric_malaria_age}}` |
| **Urgency** | Before travel |

### 13.9 Trip extension / insufficient tablets

| Field | Detail |
|-------|--------|
| **Presentation** | Longer stay than prescribed |
| **Options** | Additional supply if assessment supports; never share tablets |
| **Pharmacy action** | Re-consult; extend tail dates |
| **Urgency** | Before tablets run out |

### 13.10 Post-travel fever — wrong service entry

| Field | Detail |
|-------|--------|
| **Presentation** | Fever after malaria-endemic travel |
| **Options** | Emergency/same-day hospital — not chemoprophylaxis supply |
| **Pharmacy action** | Redirect 999/A&E/NHS 111; do not treat as pre-travel |
| **Urgency** | **Emergency same day** |

---

## 14. PATIENT JOURNEY RESEARCH (Stage 1 Enhancement)

**Format:** Journey map for master content structure. Not publish copy.

### 14.1 Awareness

| Field | Research note |
|-------|---------------|
| **Patient goals** | Know malaria exists at destination; find where to get tablets |
| **Patient concerns** | Overwhelmed by conflicting online country advice |
| **Information needs** | Pharmacy can prescribe privately; ABCD framework exists |
| **Common misunderstandings** | Vaccine exists; NHS pays for tablets |

### 14.2 Trigger

| Field | Research note |
|-------|---------------|
| **Patient goals** | Arrange tablets before booking confirmation deadline |
| **Patient concerns** | Running out of time; GP closed |
| **Information needs** | Lead times; mefloquine 3-week rule |
| **Common misunderstandings** | Can start tablets day of flight for all agents |

### 14.3 Booking

| Field | Research note |
|-------|---------------|
| **Patient goals** | Secure appointment; know total cost |
| **Patient concerns** | Hidden fees; stock unavailable |
| **Information needs** | Consultation fee + tablet price; itinerary prep list |
| **Common misunderstandings** | Walk-in always available; combined with free NHS vaccine chat |

### 14.4 Consultation

| Field | Research note |
|-------|---------------|
| **Patient goals** | Correct tablet for destination; minimal side effects |
| **Patient concerns** | Intrusive medical history; psychiatric questions |
| **Information needs** | Itinerary detail required; agent comparison; ABCD |
| **Common misunderstandings** | City name alone sufficient; can omit side trips |

### 14.5 Supply and pre-travel start

| Field | Research note |
|-------|---------------|
| **Patient goals** | Start tablets on schedule; pack for whole trip + tail |
| **Patient concerns** | Vomiting after first dose; sun exposure on doxy |
| **Information needs** | Written schedule; missed dose advice; repellent products |
| **Common misunderstandings** | Tablets only needed "while there" |

### 14.6 During travel

| Field | Research note |
|-------|---------------|
| **Patient goals** | Remember doses; avoid bites |
| **Patient concerns** | GI side effects abroad; alcohol with doxy |
| **Information needs** | Time zone dosing; DEET reapplication |
| **Common misunderstandings** | Chemoprophylaxis means no mosquitoes matter |

### 14.7 Post-travel

| Field | Research note |
|-------|---------------|
| **Patient goals** | Complete tail doses; return to normal |
| **Patient concerns** | Flu-like illness = malaria? |
| **Information needs** | 7-day vs 4-week tail; fever urgency up to 1 year |
| **Common misunderstandings** | Stop tablets on landing; malaria only during trip |

---

## 15. CONTENT OPPORTUNITY RESEARCH (Stage 1 Enhancement)

**Format:** Ranked opportunities for future master content. Not content itself.

### 15.1 Strongest patient questions — ranked

| Rank | Question theme | Priority | Rationale |
|------|----------------|----------|-----------|
| 1 | Do I need antimalarials for my destination? | **HIGH** | Core eligibility — NaTHNaC-aligned |
| 2 | Which malaria tablet is best for my trip? | **HIGH** | Agent selection — Section 12 |
| 3 | When to start/stop tablets | **HIGH** | Adherence failure risk |
| 4 | Are malaria tablets free on NHS? | **HIGH** | Cost/trust barrier |
| 5 | Can pharmacy prescribe antimalarials? | **HIGH** | Pathway clarity — IP scope |
| 6 | Side effects — Malarone vs doxy vs Lariam | **HIGH** | Decision driver |
| 7 | City/resort — still need tablets? | **HIGH** | VFR/urban myth |
| 8 | How much does it cost (consult + tablets)? | **HIGH** | Conversion barrier |
| 9 | Too late before travel? | **HIGH** | Last-minute segment |
| 10 | Pregnancy/children eligibility | **MEDIUM** | Referral pathway |
| 11 | Missed dose / trip extension | **MEDIUM** | Adherence safety |
| 12 | Post-travel fever — what to do | **MEDIUM** | Safety-netting critical |
| 13 | Combine with travel vaccines? | **MEDIUM** | Travel cluster linking |
| 14 | Buy abroad vs UK supply | **MEDIUM** | Counterfeit myth |
| 15 | Standby emergency treatment | **LOW** | Niche — avoid upsell tone |

### 15.2 Strongest myths — ranked

| Rank | Myth | Priority | Rationale |
|------|------|----------|-----------|
| 1 | Malaria vaccine exists | **HIGH** | Fundamental — links to travel-vaccinations dedupe |
| 2 | NHS pays for travel tablets | **HIGH** | Pricing trust |
| 3 | City/resort = no risk | **HIGH** | Under-prophylaxis risk |
| 4 | Stop tablets on return to UK | **HIGH** | Tail dose adherence |
| 5 | Tablets 100% protect | **HIGH** | ABCD messaging |
| 6 | Chloroquine still universal | **HIGH** | Resistance accuracy |
| 7 | Malarone works everywhere | **HIGH** | AP resistance zones |
| 8 | Friends fine without tablets | **MEDIUM** | VFR complacency |
| 9 | Pharmacist can't prescribe | **MEDIUM** | Trust |
| 10 | Chemoprophylaxis treats malaria | **MEDIUM** | Post-travel red flag |

### 15.3 Strongest concerns — ranked

| Rank | Concern | Priority | Rationale |
|------|---------|----------|-----------|
| 1 | Side effect dread | **HIGH** | Agent selection |
| 2 | Private cost (family multiply) | **HIGH** | Owner variables |
| 3 | Wrong tablet for resistance area | **HIGH** | Clinical safety |
| 4 | Too late before departure | **HIGH** | Mefloquine lead time |
| 5 | NHS vs private confusion | **HIGH** | Expectation management |
| 6 | Pharmacy vs GP thoroughness | **MEDIUM** | Trust objection |
| 7 | Pregnancy/medicine interactions | **MEDIUM** | Referral |
| 8 | Adherence on holiday | **MEDIUM** | Tail counselling |
| 9 | False security neglecting bites | **MEDIUM** | ABCD |
| 10 | Post-travel fever delay | **MEDIUM** | Emergency safety-netting |

### 15.4 Strongest trust factors — ranked

| Rank | Trust factor | Priority | Rationale |
|------|--------------|----------|-----------|
| 1 | NaTHNaC-aligned destination assessment | **HIGH** | Clinical credibility |
| 2 | Transparent private pricing | **HIGH** | Private service essential |
| 3 | ABCD + bite avoidance honesty | **HIGH** | Not tablet-only upsell |
| 4 | Resistance-aware prescribing | **HIGH** | Safety |
| 5 | Independent prescriber qualification | **HIGH** | Legitimacy |
| 6 | Post-travel fever safety-netting | **MEDIUM** | Duty of care |
| 7 | Written schedule | **MEDIUM** | Adherence |
| 8 | Refer when outside scope | **MEDIUM** | Safety trust |
| 9 | Travel cluster integration | **MEDIUM** | Holistic care |
| 10 | Private consultation room | **MEDIUM** | Itinerary privacy |

---

## 16. KNOWLEDGE GAPS — REVIEW AND RECOMMENDATIONS (Stage 1 Enhancement)

### 16.1 Gaps addressed in v1

| Gap | Status in v1 |
|-----|--------------|
| ABCD framework underdeveloped | **Addressed** — Sections 1.1, 5.2, 12, 13 |
| Agent comparison by destination/resistance | **Addressed** — Sections 5.3–5.4, 12.1–12.6 |
| NHS funding reality for travel prophylaxis | **Addressed** — Sections 1.2, 5.9 |
| Start/stop rules per agent | **Addressed** — Sections 5.3, 12 |
| Post-travel fever red flags | **Addressed** — Sections 5.10, 6, 13.10 |
| Patient emotional drivers | **Addressed** — Section 11 (10 emotions) |
| Clinical decision framework | **Addressed** — Section 13 (10 bands) |
| Patient journey | **Addressed** — Section 14 (7 stages) |
| Content priorities | **Addressed** — Section 15 ranked |
| Travel cluster dedupe | **Addressed** — Section 16.6 |

### 16.2 Remaining missing clinical information

| Gap | Recommendation |
|-----|----------------|
| Exact current AP resistance country list | Master links to NaTHNaC country pages — avoid static lists |
| SBET detailed prescribing criteria | Clinical sign-off with current ACMP SBET guidance at master stage |
| Devolved nations NHS pharmacy malaria pathways (Scotland TRAVAX) | England-default master; owner appendix |
| Primaquine radical cure for *P. vivax* | Post-travel specialist — not pre-travel pharmacy supply scope |
| G6PD testing workflow | Refer specialist — brief signpost only in master |
| Individual pharmacy antimalarial formulary | Owner variable — `{{antimalarial_stock}}` |

### 16.3 Remaining missing patient concerns

| Gap | Recommendation |
|-----|----------------|
| Cultural barriers for VFR travellers | Master tone guidance — respectful risk messaging |
| Language/accessibility | Owner variable `{{languages}}` |
| LGBTQ+ travel health | Brief inclusive signpost if needed |
| Mental health travel anxiety beyond mefloquine | Section 11 partial — master tone only |

### 16.4 Remaining missing trust factors

| Gap | Recommendation |
|-----|----------------|
| Named prescriber credentials | Owner variable at publish |
| Local hospital malaria referral partner | Owner confirmation Stage 2 |
| Patient testimonials | Publish-stage owner content |

### 16.5 Remaining missing pathway information

| Gap | Recommendation |
|-----|----------------|
| Owner IP/PGD status | Required — `{{ip_prescriber_available}}` |
| Private fee and tablet price list | Required — `{{private_malaria_fee}}` + pricing |
| NHS malaria commissioning (rare) | Owner — `{{nhs_malaria_service}}` default no |
| GP notification practice | Local policy — generic statement |
| Combined booking with vaccines | Owner — `{{combined_travel_fee}}` |

### 16.6 Travel cluster relationship — dedupe guidance (critical)

| Service ID | Owns (master depth) | Do NOT duplicate in malaria-prevention master |
|------------|---------------------|-----------------------------------------------|
| **`malaria-prevention`** | Chemoprophylaxis agent selection, resistance, ABCD (C + A/B/D), start/stop schedules, adherence, side effects, post-travel fever safety-netting, private NHS funding reality, IP prescribing | Full vaccine menus, yellow fever ICVP rules, multi-dose vaccine intervals |
| **`travel-vaccinations`** | Vaccine indications, NHS free vs paid vaccines, yellow fever designation, ICVP 10-day rule, injection schedules | Deep chemoprophylaxis resistance matrices — **cross-link** to malaria-prevention |
| **`travel-health-consultations`** | Comprehensive multi-risk planning (altitude, diarrhoea, complex itineraries, occupational) | Tablet-only depth — refer to malaria-prevention for focused chemoprophylaxis booking |

**Patient journey overlap (intentional):**
- Single trip may touch all three services — pharmacy should cross-link, not merge prose
- `travel-vaccinations-research-v1.md` Section 5.5 and 12.2 flag malaria as **linked separate service ID** — this document is the authoritative chemoprophylaxis research source
- Avoid claiming one appointment covers all three without owner-confirmed bundled fee (`{{combined_travel_fee}}`)
- **SEO dedupe:** malaria-prevention pages target antimalarial/malaria tablet intent; travel-vaccinations targets vaccine intent; travel-health-consultations targets complex planning intent

**Knowledge gap for cluster:** No Stage 1 research file yet for `travel-health-consultations` — malaria-prevention master should cross-link using travel-health-consultations master v1 + this document; recommend travel-health-consultations Stage 1 research in future for parity.

### 16.7 Recommendations before Master V1

1. **Human clinical sign-off** on Sections 5, 6, 12, 13 (agents, resistance, red flags, decision framework)
2. **Confirm private-default scope** — NHS malaria commissioning rare; `{{nhs_malaria_service}}` default no
3. **Owner variables** remain placeholders until pharmacy onboarding
4. **Use Section 15 HIGH-priority items** to drive master emphasis
5. **Use Section 11 emotions** for tone guidance — not publish prose
6. **Use Section 14 journey** to structure patient-facing flow
7. **Apply Section 16.6 dedupe** when writing master — cross-link travel cluster; do not reproduce vaccine content
8. **Do not publish static destination chemoprophylaxis lists** — direct to consultation + NaTHNaC

---

## RESEARCH COMPLETENESS SCORE (V1)

| Area | Weight | Score (0–10) | Notes |
|------|--------|--------------|-------|
| 1. Service definition | 8% | 9 | Private IP pathway + ABCD + NHS limits mapped |
| 2. Patient intent | 7% | 9 | VFR, last-minute, family segments covered |
| 3. Patient questions (50+) | 10% | 10 | 70 questions |
| 4. Patient concerns (20+) | 7% | 10 | 24 concerns + ranked |
| 5. Clinical facts | 12% | 9 | ACMP/BNF/NaTHNaC aligned; pending sign-off |
| 6. Red flags | 10% | 9 | Post-travel fever emergency + referral bands |
| 7. Myths (20+) | 7% | 10 | 24 myths + ranked |
| 8. Trust factors | 5% | 9 | Ranked opportunities added |
| 9. Local advantages | 4% | 8 | Owner-dependent |
| 10. Owner variables | 4% | 9 | Ten core variables defined |
| 11. Patient emotions | 10% | 9 | 10 emotions mapped |
| 12. Antimalarial options knowledge | 8% | 9 | Agents, resistance, selection matrices |
| 13. Clinical decision framework | 8% | 9 | 10 decision bands |
| 14. Patient journey | 5% | 9 | 7 stages mapped |
| 15. Content opportunities | 5% | 9 | Ranked HIGH/MEDIUM/LOW |

**Weighted completeness score: 9.1 / 10**

---

## REMAINING KNOWLEDGE GAPS (Summary)

1. Devolved nations pharmacy NHS malaria pathways — England/private-default recommended for Master V1
2. Owner confirmation — IP status, private fees, antimalarial stock, combined travel booking
3. Human clinical sign-off — not yet recorded
4. Exact AP resistance geography — NaTHNaC link at master stage, not static list
5. SBET detailed criteria — clinical sign-off with ACMP
6. Travel cluster — `travel-health-consultations` Stage 1 research file not yet created (master v1 exists)
7. Local malaria referral hospital partner — owner/onboarding

**Critical gaps blocking Master V1:** Items 2 and 3 only (owner vars can remain placeholders per benchmark pattern).

---

## READINESS SCORE FOR MASTER V1

| Criterion | Score | Max | Notes |
|-----------|-------|-----|-------|
| Factual research completeness | 9.1 | 10 | v1 complete |
| Clinical pathway documented | 9 | 10 | Pending sign-off |
| Patient intent/emotion coverage | 9 | 10 | Section 11 complete |
| Question/concern inventory | 10 | 10 | Exceeds minimums |
| Antimalarial options knowledge (Section 12) | 9 | 10 | Resistance matrices complete |
| Clinical decision framework | 9 | 10 | Section 13 complete |
| Journey mapping | 9 | 10 | Section 14 complete |
| Content priority guidance | 9 | 10 | Section 15 complete |
| Travel cluster dedupe guidance | 9 | 10 | Section 16.6 complete |
| Owner variables identified | 9 | 10 | Ten placeholders defined |
| Human clinical review | 0 | 10 | Not yet recorded |
| Publish scope decision (private-default) | 8 | 10 | Recommended not yet formalised |

**Readiness score: 8.2 / 10**

---

## RECOMMENDATION

### **READY FOR MASTER V1**

**Conditions:**

1. Master V1 author uses this document as sole chemoprophylaxis research source
2. Clinical reviewer signs off Sections 5, 6, 12, and 13 before QA checklist
3. Master treats owner variables as placeholders (same pattern as emergency-contraception V1)
4. Master scope: **private-default** antimalarial chemoprophylaxis via pharmacist independent prescriber; NHS exception only if `{{nhs_malaria_service}}` confirmed
5. Section 15 HIGH-priority items drive master emphasis; LOW-priority items may be brief or omitted
6. **Apply Section 16.6 travel cluster dedupe** — cross-link `travel-vaccinations` and `travel-health-consultations`; do not duplicate vaccine prose
7. ABCD always framed — chemoprophylaxis never standalone without bite avoidance and diagnosis advice
8. Post-travel fever always framed as **urgent emergency** — not pharmacy pre-travel service

**Research foundation is comprehensive enough that Master V1 can be written without additional factual research**, provided the conditions above are met during drafting and review.

**Do not create:** publish content, service pages, variations, area pages, hub pages, or HTML as part of this research task.

---

## Document Control

| Version | Date | Change |
|---------|------|--------|
| v1.0 | 2026-06-22 | Initial Stage 1 research foundation — sections 1–16 |

**Next step:** Clinical sign-off → `malaria-prevention-master-v1.md` (Stage 2)
