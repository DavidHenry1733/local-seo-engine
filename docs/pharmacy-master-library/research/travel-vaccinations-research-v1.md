# Travel Vaccinations — Stage 1 Research Foundation (V1)

**Document type:** Research foundation only  
**Service ID:** `travel-vaccinations`  
**Category:** `private-clinical` (primarily private; partial NHS vaccines)  
**Benchmark process:** Pharmacy First framework (`MASTER-SERVICE-CREATION-PROCESS.md` Stage 1)  
**Benchmark quality target:** `blood-pressure-checks-research-v1.1.md`  
**Status:** Draft for human clinical review  
**Created:** 2026-06-22  

**Purpose:** Comprehensive clinical and patient-intent research before any master library prose is written. This document is not publish content.

---

## Source Material (Evidence Base)

| Source | Reference | Use in this document |
|--------|-----------|----------------------|
| NHS.uk | [Travel vaccinations](https://www.nhs.uk/vaccinations/travel-vaccinations/) (reviewed 30 Apr 2026) | NHS free vs paid vaccine list, booking lead times, ICVP, GP primary route for NHS vaccines |
| NaTHNaC / TravelHealthPro | [TravelHealthPro](https://travelhealthpro.org.uk/) — country information pages, yellow fever maps, outbreak alerts | Destination-specific risk, entry requirements, yellow fever designated centres |
| UK Health Security Agency | Green Book — *Immunisation against infectious disease* (travel chapter; vaccine schedules, contraindications, intervals) | Clinical vaccine facts, timing, booster intervals, pregnancy/immunocompromised notes |
| Internal intelligence | `data/pharmacy-service-intelligence/travel-vaccinations.json` | Patient intent signals, question seeds, trust signals, blog/FAQ topics |
| Internal expertise | `data/pharmacy-service-expertise/travel-vaccinations.json` | Concerns, risk factors, content boundaries, common mistakes |
| Internal expansion | `data/pharmacy-service-expansion/travel-vaccinations.json` | Preparation guide, timeline, deep-dive vaccine blocks, comparison points |
| Internal authority | `data/pharmacy-service-authority/travel-vaccinations.json` | Professional insights, safety considerations, myth vs fact seeds |
| Internal blueprint | `data/pharmacy-service-blueprints/travel-vaccinations.json` + `src/pharmacy/pharmacyServiceBlueprintSeeds.ts` (`travel-vaccinations` section) | Process steps, myths, unsuitability criteria, related services |

**Verification note:** NHS free vaccine list and lead-time guidance mapped to NHS.uk travel vaccinations page. Yellow fever centre requirement mapped to NaTHNaC designated centre listing. England GP primary route for NHS travel vaccines is default; Scotland/Wales/NI devolved pathways noted as gaps. Owner-specific vaccine menu, NHS partial availability, and pricing must be confirmed locally before publish claims.

**Devolved nations caveat:** England focus throughout. Some NHS Scotland health boards commission pharmacy travel vaccine services under local arrangements — do not generalise to all UK pharmacies without owner confirmation.

---

## 1. SERVICE DEFINITION

### 1.1 What the service is

- Destination-specific travel immunisation and travel health consultation delivered in a community pharmacy setting
- Structured travel risk assessment based on itinerary (countries, regions, duration, season, activities, accommodation type)
- Recommendation of vaccines and prophylaxis appropriate to destination and individual medical history
- Administration of vaccines where clinically indicated, in stock, and within pharmacy scope/authorisation
- Documentation of vaccinations given; International Certificate of Vaccination or Prophylaxis (ICVP) where applicable (e.g. yellow fever)
- Malaria chemoprophylaxis advice and private supply where pharmacy scope permits (often linked service)
- Broader travel health precautions: food/water safety, insect bite avoidance, altitude illness signposting, sun protection
- Safety-netting, deferral, or referral when outside pharmacy scope (pregnancy complexity, immunosuppression, incomplete history)
- Primarily **private fee-based** in England; partial overlap with NHS-funded vaccines (see 1.2)

### 1.2 NHS pathway — partial (England)

**Primary NHS route for free travel vaccines:** GP surgery (after travel risk assessment form), not universally available at pharmacy.

**NHS free travel vaccines (England — for travel purposes after risk assessment):**
- Hepatitis A
- Typhoid fever
- Combined hepatitis A + typhoid
- Cholera (where clinically indicated)
- DTP (diphtheria, tetanus, polio) booster — polio component relevant to some destinations

**NOT free on NHS for travel (typically private pay):**
- Hepatitis B
- Rabies (pre-exposure)
- Yellow fever
- Japanese encephalitis (JE)
- Meningococcal ACWY (meningitis) — travel indication
- Tick-borne encephalitis (TBE)
- Tuberculosis (BCG) — travel/indication-specific; not routine NHS travel list item

**Pharmacy NHS partial pathway:**
- Some pharmacies may deliver **subset** of NHS travel vaccines under local PGD/commissioning — uncommon in England compared with GP route
- Scotland: selected health board pharmacy contracts exist for NHS travel vaccines — owner must confirm `{{nhs_travel_vaccines}}`
- Wales/NI: confirm locally; England GP-primary model is default research assumption

**Pharmacy cannot (general scope boundaries):**
- Guarantee all vaccines stocked or same-day availability
- Issue yellow fever ICVP unless pharmacy is NaTHNaC-designated yellow fever centre
- Replace specialist travel/hospital clinic for complex immunocompromised cases without GP/specialist involvement
- Guarantee entry compliance — requirements change; patient must verify with embassy/NaTHNaC
- Provide NHS-funded vaccines without confirmed eligibility and local commissioning

### 1.3 Private service variants (typical UK pharmacy)

- Private travel health consultation fee (advice-only or bundled with first vaccine)
- Per-vaccine private pricing (`{{private_vaccine_pricing}}`)
- Multi-appointment courses (rabies 3-dose, hep B, JE)
- Yellow fever at designated centres only — premium pricing + certificate fee
- Malaria tablet supply (private prescription/PGD where applicable) — may be separate service
- Occupational/volunteer travel packages (NGO, healthcare abroad)
- Family/group bookings
- Last-minute accelerated schedules where clinically possible (not always achievable)
- No NHS claim for non-NHS vaccines — patient pays directly
- Insurance receipt provided; reimbursement is insurer-dependent

### 1.4 Typical appointment structure

**Initial travel health consultation:**
1. Booking/triage — itinerary dates, destination, urgency assessed (`{{phone}}`, `{{booking_link}}`)
2. Patient arrival and check-in
3. Private consultation room (`{{consultation_room}}`)
4. Consent and service scope explanation (NHS vs private elements, fees before supply)
5. Travel history review — full itinerary, rural/urban, duration, season, activities (trekking, VFR, animal contact, medical volunteering)
6. Medical history — allergies, pregnancy/breastfeeding, immunosuppression, medicines, previous vaccines
7. Review of routine UK schedule status (MMR, DTP, etc.) — signpost to GP if not up to date
8. Destination risk review — NaTHNaC country information underpins recommendations
9. Personalised vaccine schedule created — doses, intervals, latest feasible dates before departure
10. Discussion of non-vaccine precautions — malaria, food/water, insects, altitude
11. Shared decision-making — patient accepts/declines recommendations
12. Vaccination(s) administered if appropriate, in stock, and patient fit to vaccinate today
13. Documentation — vaccine record, ICVP if yellow fever, patient information leaflets
14. Follow-up appointments booked for multi-dose courses
15. GP notification where clinically appropriate / patient consent
16. Safety-netting — side effects, when to seek help, limits of protection

**Follow-up appointment (multi-dose vaccines):**
1. Confirm identity and previous dose date
2. Interval suitability check (minimum intervals per Green Book)
3. Brief health check since last dose
4. Administer next dose or defer if unwell/contraindicated
5. Schedule subsequent doses; update records

**Typical duration:**
- Initial consultation alone: ~20–45 minutes
- Consultation + one or more vaccinations: ~30–60 minutes
- Follow-up dose visit: ~15–20 minutes
- Complex multi-country/long-stay itinerary: up to 60+ minutes

**Staff:** GPhC-registered pharmacist (often independent prescriber or PGD-authorised); trained vaccinator under pharmacist oversight; designated yellow fever centre requires NaTHNaC registration.

---

## 2. PATIENT INTENT

### 2.1 Why patients seek travel vaccinations

- Upcoming holiday or business trip abroad
- Uncertainty which vaccines are required or recommended
- Avoid GP waiting times — want faster pharmacy access
- Last-minute travel — urgent need for whatever protection is still achievable
- Country entry requirement (yellow fever certificate, meningitis for Hajj/Umrah)
- Family travel — vaccinating children alongside adults
- Student placement, gap year, backpacking, adventure travel
- Visiting friends and relatives (VFR) in higher-risk regions — may underestimate risk
- Occupational travel — journalists, aid workers, healthcare volunteers
- Previous trip years ago — unsure if boosters still valid
- Employer or visa health requirements
- Malaria tablet advice alongside vaccines
- Prefer single local provider for vaccines + travel medicines

### 2.2 Common triggers

- Flight/holiday booking confirmation
- Travel agent or airline reminder about health requirements
- Passport/visa application health section
- University placement abroad notification
- News coverage of disease outbreak in destination
- Friend/colleague travel health experience
- NaTHNaC/NHS website check showing vaccine recommendations
- Approaching departure with no vaccines arranged (panic booking)
- Pharmacy marketing — seasonal travel health campaigns
- GP unable to offer appointment before travel date

### 2.3 Common concerns (intent-level)

- Cost of multiple private vaccines
- NHS vs private confusion — "why isn't this free?"
- Too late before departure — will vaccines still work?
- Vaccine safety — side effects, pregnancy, children
- Needle anxiety
- Whether pharmacy is as thorough as GP or travel clinic
- Yellow fever certificate authenticity and timing
- Stock availability — "do you have everything I need?"
- Number of appointments required
- Interactions with regular medicines
- Insurance reimbursement

### 2.4 Typical motivations

- Convenience — high street, extended hours (`{{opening_hours}}`)
- One-stop — vaccines + malaria tablets + travel supplies
- Clear pricing upfront (`{{private_vaccine_pricing}}`)
- Professional destination-specific advice
- Documentation for border entry
- Reduce risk of serious illness abroad
- Avoid disrupting GP surgery capacity for straightforward travel health
- Trust in pharmacist medicines expertise

---

## 3. PATIENT QUESTIONS (Raw Research List)

**Format note:** Questions only. Not written as publish FAQs. **Count: 82**.

### 3.1 Eligibility

1. Who can use pharmacy travel vaccinations?
2. Do I need to be registered with a GP in England?
3. Can I use the service if I'm not a UK resident?
4. Are travel vaccinations suitable for children?
5. What is the minimum age for travel vaccines at a pharmacy?
6. Can pregnant women have travel vaccinations?
7. Can I be vaccinated while breastfeeding?
8. I have a weakened immune system — can I still travel vaccinate?
9. I had a serious allergic reaction to a vaccine before — am I excluded?
10. Do I need a GP referral for pharmacy travel vaccines?
11. Can someone with a chronic illness use pharmacy travel services?
12. Is pharmacy travel vaccination suitable for last-minute travellers?
13. Can I book travel vaccinations for my whole family in one visit?
14. Do I need to be a registered patient of this pharmacy?
15. Who qualifies for NHS travel vaccines at this pharmacy?

### 3.2 Appointments

16. Do I need an appointment or can I walk in?
17. How do I book a travel vaccination consultation?
18. How far before travel should I book?
19. Is it too late if I'm travelling in one week?
20. How long does the appointment take?
21. How many appointments will I need?
22. Can I get a same-day appointment?
23. What are your opening hours for travel health?
24. Can I book online?
25. Can my partner book on my behalf?
26. Do you offer evening or weekend appointments?
27. What should I bring to the appointment?
28. Should I bring my travel itinerary?
29. Do I need my previous vaccination records?
30. Can I combine travel vaccination with other pharmacy services same day?
31. What if I miss a follow-up dose appointment?
32. Can I reschedule if my travel dates change?

### 3.3 Vaccines / destinations

33. Which vaccines do I need for my destination?
34. Which countries require yellow fever vaccination?
35. Do I need a yellow fever certificate?
36. How long is a yellow fever certificate valid?
37. Which vaccines are needed for Thailand / India / Africa / South America? (representative destination queries)
38. Do I need rabies vaccine for backpacking?
39. Is typhoid enough or do I also need hepatitis A?
40. Do I need Japanese encephalitis for rural Asia travel?
41. What vaccines do children need for travel?
42. Do I need meningitis vaccine for Hajj or Umrah?
43. Is tick-borne encephalitis needed for Eastern Europe?
44. Do adventure activities (caving, trekking) change which vaccines I need?
45. Does staying in a resort vs rural homestay change recommendations?
46. I'm visiting friends and relatives — do I need the same vaccines as tourists?
47. Do I need cholera vaccine?
48. Are my childhood vaccines still valid for travel?
49. How do I check what vaccines I had previously?
50. Will you tell me exactly what my destination requires for entry?

### 3.4 Costs

51. How much do travel vaccinations cost at a pharmacy?
52. Which vaccines are free on the NHS?
53. Why do I have to pay for some vaccines?
54. Is the consultation fee separate from the vaccine cost?
55. Can I get a quote before booking?
56. Do you offer family discounts or package prices?
57. Can I claim travel vaccinations on private medical insurance?
58. Is it cheaper at the pharmacy than a private travel clinic?
59. Why is yellow fever more expensive?
60. What payment methods do you accept?
61. Do I pay even if I'm not suitable to vaccinate today?

### 3.5 Risks

62. Are travel vaccines safe?
63. What side effects should I expect?
64. Can I travel if I feel unwell after vaccination?
65. Can I have vaccines if I have a cold or fever today?
66. What are the risks of not being vaccinated?
67. Can vaccines interact with my regular medicines?
68. Is there a risk of allergic reaction?
69. How long should I wait after vaccination before flying?
70. Can multiple vaccines be given at the same visit?
71. What if I don't finish the full vaccine course before I travel?

### 3.6 NHS

72. Are travel vaccinations available on the NHS at a pharmacy?
73. What's the difference between NHS and private travel vaccines?
74. Can I get free hepatitis A at the pharmacy?
75. Should I go to my GP for free NHS vaccines first?
76. Why does my friend get NHS vaccines but I have to pay?
77. Does the NHS cover malaria tablets?
78. Will my GP be told about pharmacy vaccinations?

### 3.7 Medication

79. Can you prescribe malaria tablets for my trip?
80. Should I stop my regular medicines before vaccination?
81. Do anticoagulants (blood thinners) affect vaccination?
82. Can I take travel vaccines while on immunosuppressants?

### 3.8 Follow-up

83. When do I need my second or third dose?
84. What happens if I travel before my course is complete?
85. Do I need boosters for future trips?
86. How long does protection last after each vaccine?
87. What aftercare advice will I receive?
88. Who do I contact if I have side effects after leaving the pharmacy?
89. Will I get written proof of all vaccinations?
90. Should I see my GP after returning from travel if I become unwell?

**Note:** Count includes 90 numbered items — exceeds minimum 50.

---

## 4. PATIENT CONCERNS (Raw Research List)

**Count: 28**

1. Unsure which vaccines are actually needed vs optional
2. Worried it's too late before departure
3. Sticker shock at total cost for multiple family members
4. Confused about NHS free vs private paid vaccines
5. Fear of vaccine side effects
6. Needle phobia / anxiety about injections
7. Uncertainty whether pharmacy advice is as reliable as GP/travel clinic
8. Concern pharmacy won't stock all required vaccines
9. Yellow fever certificate requirements unclear
10. Worried about vaccinating children safely
11. Pregnancy/breastfeeding safety uncertainty
12. Previous allergic reaction to vaccine — fear of repeat
13. Multiple appointments inconvenient with work schedule
14. Unsure if partial vaccine course still worth having
15. Malaria tablet choice confusion (side effects, cost, effectiveness)
16. Privacy concern discussing travel health on shop floor
17. Distrust of online destination advice vs personalised assessment
18. Immunosuppressed — fear vaccines could harm
19. Assumed one appointment covers everything
20. Employer/visa proof requirements — will documentation be accepted?
21. Language barrier understanding complex schedules
22. Worried flying soon after vaccination
23. Conflicting advice from travel agent, internet, and friends
24. Reluctance to disclose full medical history
25. Fear of being upsold unnecessary vaccines
26. Last-minute trip — overwhelmed by information
27. VFR travellers — "I've been before without vaccines" complacency
28. Uncertainty about validity of old vaccination records

---

## 5. CLINICAL FACTS

### 5.1 Common travel vaccines — overview

| Vaccine | Typical indication (summary) | NHS free for travel (England) | Common schedule notes |
|---------|------------------------------|--------------------------------|----------------------|
| Hepatitis A | Most destinations outside Western Europe/N.America/Australasia; food/water exposure | Yes (GP primary; pharmacy if locally commissioned) | Single dose; booster at 6–12 months for long-term protection |
| Typhoid | Risk in S. Asia, Africa, S. America; food/water exposure | Yes | Single injection or oral course; shorter duration protection than hep A |
| Hep A + Typhoid combined | Convenience where both indicated | Yes (combined product) | Single injection |
| Cholera | Specific high-risk humanitarian/rural scenarios; rarely holiday | Yes if indicated | Oral course (2 doses) |
| DTP/polio booster | Countries with polio risk; general travel preparedness | Yes (booster component) | Single booster if not up to date |
| Hepatitis B | Long-stay, healthcare work, sexual/blood exposure risk | No — private | 3-dose course (0, 1, 6 months typical) |
| Rabies (pre-exposure) | Extended stay, rural, animal exposure, remote areas | No — private | 3-dose course (days 0, 7, 21–28) |
| Yellow fever | Endemic areas in Africa/S. America; entry requirement countries | No — private | Single dose; ICVP issued; designated centres only |
| Japanese encephalitis | Rural Asia, prolonged stay, monsoon season | No — private | 2-dose course (days 0, 28 typical) |
| Meningitis ACWY | Hajj/Umrah requirement; meningitis belt travel | No — private for travel | Single dose; certificate may be required |
| Tick-borne encephalitis | Central/Eastern Europe, forest/rural activities | No — private | 3-dose course |
| TB (BCG) | Specific occupational/VFR scenarios — specialist indication | Not routine NHS travel list | Case-by-case; often specialist/GP |

### 5.2 NHS free vs paid — England summary

**Free on NHS (travel indication, after risk assessment — GP primary route):**
- Hepatitis A
- Typhoid
- Combined hep A/typhoid
- Cholera (if indicated)
- DTP booster including polio component

**Not free on NHS for travel:**
- Hepatitis B
- Rabies
- Yellow fever
- Japanese encephalitis
- Meningitis ACWY
- Tick-borne encephalitis
- TB (BCG)

**Research note:** NHS.uk states free vaccines obtained at GP surgery after risk assessment form. Pharmacy may deliver subset under local arrangement — owner confirms `{{nhs_travel_vaccines}}`.

### 5.3 Timing and lead times

| Time before departure | Research note |
|-----------------------|---------------|
| **6–8 weeks (ideal)** | Allows multi-dose courses (rabies, hep B, JE); immune response development; stock ordering |
| **4 weeks** | Many single-dose vaccines still beneficial; some accelerated schedules possible |
| **2 weeks** | Limited — some vaccines still worth giving; incomplete course common |
| **<1 week** | Very limited options; advice-only + malaria prophylaxis may be main intervention |
| **Day of travel** | Most vaccines impractical; bite avoidance and chemoprophylaxis priority |

**NHS.uk guidance:** Seek advice at least 4–6 weeks before travel. Some vaccines need days/weeks between doses.

**Green Book principle:** Minimum intervals between doses must be respected — accelerated schedules only where product SPC and clinical judgement allow.

### 5.4 Yellow fever — designated centres and ICVP

- Yellow fever vaccine (Stamaril and equivalents) only administered at **NaTHNaC-designated yellow fever vaccination centres**
- Not all pharmacies are designated — verify centre status before claiming availability
- **International Certificate of Vaccination or Prophylaxis (ICVP)** — official proof; required for entry to some countries; also required if transiting >12 hours through yellow fever risk country en route to destination (NaTHNaC country pages)
- Certificate valid from **10 days after vaccination** (earlier certificate invalid for entry purposes)
- Single dose generally confers lifelong protection (Green Book — booster rules updated; clinical sign-off on current guidance)
- Contraindications include certain age groups, immunosuppression, thymus disorder history — specialist assessment may be required

### 5.5 Malaria advice scope (pharmacy)

- Malaria chemoprophylaxis requires individual risk assessment: destination, area within country, season, accommodation, duration, patient factors (pregnancy, G6PD, epilepsy, drug interactions)
- NaTHNaC country malaria maps inform recommendation
- Pharmacy scope: advice + private supply where PGD/prescriber authority exists — not all pharmacies prescribe all agents
- **No vaccine for malaria** — tablets + bite avoidance essential
- Standalone malaria prevention may be separate service ID (`malaria-prevention`) — often linked in patient journey
- NHS does not routinely fund malaria tablets for travel

### 5.6 Non-vaccine travel health (consultation scope boundary)

- Food and water hygiene advice
- Insect bite prevention (DEET, permethrin-treated clothing)
- Altitude illness — signpost; pharmacy scope limited
- Travellers' diarrhoea self-care
- Sun protection
- Safe sex abroad
- Post-travel illness safety-netting — fever after malaria area = urgent medical assessment abroad

### 5.7 Routine UK vaccines relevant to travel

- MMR — outbreaks worldwide; all travellers should be up to date
- DTP — booster if not current
- NHS.uk recommends all travellers including children up to date with standard UK vaccinations

### 5.8 Documentation and records

- Pharmacy maintains record of vaccines given
- Patient should retain personal travel vaccination record
- ICVP for yellow fever — official booklet/card
- GP notification supports continuity — patient consent dependent
- Lost records — revaccination decisions require clinical judgement (may not need repeat if documented elsewhere)

---

## 6. RED FLAGS

### 6.1 Defer vaccination — seek GP/specialist first

- Pregnancy (most live/attenuated vaccines contraindicated; inactivated case-by-case — specialist/GP pathway)
- Severe immunosuppression ( chemotherapy, high-dose steroids, transplant ) — specialist travel clinic often required
- History of anaphylaxis to vaccine component — specialist allergy assessment
- Acute febrile illness — defer until recovered (NHS.uk)
- Uncontrolled epilepsy or progressive neurological disorder — case-by-case per Green Book
- Thymus disorder history — yellow fever contraindicated
- Age outside product licence for specific vaccine — paediatric/adult limits
- Complex multi-morbidity without GP involvement
- Patient cannot provide accurate medical/allergy history where safety depends on it

### 6.2 Refer to GP / specialist travel clinic

- Immunocompromised patient needing live vaccines or complex schedule
- Pregnant traveller needing destination-specific risk balancing
- Infant below minimum age for required vaccine — alternative strategies
- Patient with bleeding disorder — injection route risk assessment
- HIV with low CD4 — specialist advice
- Occupational exposure requiring post-exposure protocols not yet administered
- Legal/visa health requirements beyond pharmacy scope

### 6.3 Emergency — not travel vaccination service

- Acute illness requiring 999/A&E
- Suspected anaphylaxis post-vaccination — immediate emergency treatment
- Post-travel fever in malaria area — urgent assessment abroad (not pre-travel booking)

### 6.4 Service not appropriate / decline and signpost

- Patient demands specific vaccine without assessment
- Vaccine not stocked and cannot be ordered before travel date
- Yellow fever requested at non-designated centre
- Patient unwell on day of appointment — reschedule
- Demands guarantee of disease protection — cannot provide

### 6.5 When private consultation may proceed with limits

- Last-minute traveller — partial schedule + honest limits of protection
- Advice-only outcome when vaccination contraindicated or declined
- Referral to GP for NHS-funded vaccines while providing private vaccines in scope

---

## 7. MYTHS (Real Misconceptions Only)

**Count: 24**

| # | Misconception | Research correction (not publish prose) |
|---|---------------|----------------------------------------|
| 1 | All travel vaccines are free on the NHS | Only hep A, typhoid, combined, cholera (if indicated), DTP/polio booster — others private (NHS.uk) |
| 2 | Pharmacy always offers NHS travel vaccines | England default is GP for NHS vaccines; pharmacy mainly private unless locally commissioned |
| 3 | One appointment is always enough | Rabies, hep B, JE, TBE require multi-dose courses over weeks |
| 4 | Vaccines work immediately | Immune response takes days to weeks; yellow fever ICVP valid from day 10 |
| 5 | Travel vaccines only needed for tropical countries | Risk depends on destination, activities, standards — not latitude alone |
| 6 | Resort holidays don't need vaccines | Destination disease risk exists outside resort bubble; food/water exposure en route |
| 7 | "I've been before without vaccines" means safe | Immunity wanes; outbreak patterns change; prior exposure ≠ protection |
| 8 | Online country list replaces consultation | Personal medical history and itinerary detail require individual assessment |
| 9 | Yellow fever certificate available anywhere | Only NaTHNaC-designated centres |
| 10 | Yellow fever certificate valid immediately | Valid from 10 days post-vaccination for entry purposes |
| 11 | Pharmacy can stock every travel vaccine | Stock varies; ordering lead times exist |
| 12 | Malaria tablets optional if vaccinated | No malaria vaccine; chemoprophylaxis separate decision |
| 13 | NHS pays for malaria tablets | Not routinely funded for travel |
| 14 | Children need the same vaccines as adults | Doses and products differ by age; some vaccines not licensed for young children |
| 15 | Pregnant women can have all travel vaccines | Many contraindicated — specialist risk assessment required |
| 16 | Last-minute vaccination is pointless | Partial protection may still be worthwhile — clinical judgement |
| 17 | Travel vaccines guarantee no illness | Reduce risk; no 100% protection; other precautions still needed |
| 18 | GP referral always required for pharmacy | Most private pharmacy travel services are self-referral |
| 19 | Pharmacists aren't qualified to give travel vaccines | GPhC-registered professionals under PGD/clinical governance |
| 20 | Combined vaccines always available | Depends on stock; separate injections may be needed |
| 21 | Previous childhood vaccines cover all travel needs | Boosters and travel-specific vaccines often still required |
| 22 | Insurance always covers private travel vaccines | Policy-dependent; receipt ≠ reimbursement |
| 23 | Flying is unsafe immediately after vaccination | Mild side effects possible; serious restriction uncommon — individual advice |
| 24 | Pharmacy travel service replaces GP entirely | GP remains route for NHS vaccines and complex cases |

---

## 8. TRUST FACTORS

- GPhC-registered premises and regulated professionals
- NaTHNaC-designated yellow fever centre status (where applicable) — verifiable
- Destination-specific advice aligned with TravelHealthPro/NaTHNaC
- Private consultation room for confidential itinerary and medical discussion
- Transparent fee structure before supply (`{{private_vaccine_pricing}}`)
- Clear NHS vs private explanation (`{{nhs_travel_vaccines}}`)
- Written vaccination record and certificates where required
- Pharmacist independent prescriber or PGD governance
- Professional indemnity and clinical governance protocols
- Anaphylaxis kit and emergency protocol on premises
- Cold chain storage for vaccines (MHRA standards)
- Non-judgemental approach to lifestyle/travel type (backpacking, VFR, business)
- Honest limits — defers/refers rather than overpromising
- GP liaison for continuity of care
- Patient reviews citing helpful destination-specific advice
- Service-specific vaccinator training and CPD records

---

## 9. LOCAL PHARMACY ADVANTAGES

- High street access — no hospital referral for suitable cases
- Extended opening hours vs GP (`{{opening_hours}}`)
- Faster access than GP waiting lists for private vaccines
- One-stop: vaccines + malaria tablets + travel health products
- Private consultation room (`{{consultation_room}}`)
- Direct booking online or phone (`{{booking_link}}`, `{{phone}}`)
- Flexible appointments including evenings/weekends (owner-dependent)
- Same location as prescription and OTC travel supplies
- Familiar local setting — less formal than hospital travel clinic
- Family group bookings in single visit
- Transparent local pricing vs opaque clinic quotes
- Integration with wider pharmacy services (flu, health checks, prescriptions)

**Caveats:** Not every pharmacy offers full vaccine menu; yellow fever requires designation; NHS vaccines may still require GP in England; stock limitations apply.

---

## 10. OWNER VARIABLES

| Variable | Purpose |
|----------|---------|
| `{{phone}}` | Booking enquiries, triage, urgent travel health questions |
| `{{opening_hours}}` | Appointment and walk-in availability |
| `{{booking_link}}` | Online booking URL if offered |
| `{{consultation_room}}` | Private consultation facility for travel health |
| `{{nhs_travel_vaccines}}` | Which NHS travel vaccines (if any) delivered on-site — yes/no + list |
| `{{private_vaccine_pricing}}` | Consultation fee and per-vaccine price list or "from" pricing |

**Additional owner fields for Stage 2:** Yellow fever centre designation (yes/no), vaccine stock list, paediatric age limits, malaria prescribing scope, walk-in policy, GP notification practice, insurance receipt availability, languages/accessibility.

---

## 11. PATIENT EMOTIONS (Stage 1 Enhancement)

**Format:** Research notes only. Not publish copy.

### 11.1 Anxiety about leaving it too late

| Field | Research note |
|-------|---------------|
| **Trigger** | Departure in days/weeks; realisation vaccines not arranged |
| **Patient concern** | "Is there any point now?" / "Will I be turned away?" |
| **Typical behaviour** | Urgent same-day calls; accepts first available slot; may shop multiple providers |
| **Common questions** | Is it too late? / Can I still get protected? / How many doses can I fit in? |

### 11.2 Overwhelm at vaccine complexity

| Field | Research note |
|-------|---------------|
| **Trigger** | NaTHNaC country page listing multiple vaccines; family multi-destination trip |
| **Patient concern** | Cannot prioritise; fear of wrong choices |
| **Typical behaviour** | Brings printed web pages; asks pharmacist to "just tell me everything I need" |
| **Common questions** | Which are essential vs optional? / Do I really need all of these? / What if I skip one? |

### 11.3 Sticker shock / cost anxiety

| Field | Research note |
|-------|---------------|
| **Trigger** | Quote for family of four; rabies + yellow fever + hep B combined |
| **Patient concern** | Total cost exceeds holiday budget; NHS confusion amplifies frustration |
| **Typical behaviour** | Requests itemised quote; compares GP/pharmacy/clinic; may delay or selectively decline vaccines |
| **Common questions** | Why isn't this free? / Can I get some on NHS? / Is there a cheaper option? |

### 11.4 Fear of side effects

| Field | Research note |
|-------|---------------|
| **Trigger** | Online side-effect stories; previous unpleasant flu jab experience |
| **Patient concern** | Vaccines will ruin holiday; serious harm to self or child |
| **Typical behaviour** | Googling before appointment; may cancel; asks about skipping doses |
| **Common questions** | What side effects will I get? / Can I fly after? / Is it safe for my child? |

### 11.5 Needle phobia

| Field | Research note |
|-------|---------------|
| **Trigger** | Multiple injections required; childhood needle trauma |
| **Patient concern** | Cannot cope with injections; embarrassment |
| **Typical behaviour** | Delays booking; asks about oral alternatives; fainting history |
| **Common questions** | How many needles? / Can typhoid be oral? / Can someone come with me? |

### 11.6 Mistrust of pharmacy vs GP/clinic

| Field | Research note |
|-------|---------------|
| **Trigger** | Assumption only doctors give "real" travel health advice |
| **Patient concern** | Pharmacy will upsell; advice less thorough |
| **Typical behaviour** | Cross-checks advice with GP; asks about qualifications |
| **Common questions** | Are you qualified? / Should I see my GP instead? / Is this as good as a travel clinic? |

### 11.7 Guilt / complacency (VFR travellers)

| Field | Research note |
|-------|---------------|
| **Trigger** | Returning to family homeland; "locals don't vaccinate" narrative |
| **Patient concern** | Vaccines unnecessary for "home" country |
| **Typical behaviour** | Minimises risk; resists recommendations; may disclose destination late |
| **Common questions** | I go every year — do I need vaccines? / My family lives there fine / Why treat me differently from tourists? |

### 11.8 Protective parental anxiety

| Field | Research note |
|-------|---------------|
| **Trigger** | First family holiday abroad with young children |
| **Patient concern** | Child harm from vaccines or from disease |
| **Typical behaviour** | Extensive questioning; wants same-day reassurance; brings both parents |
| **Common questions** | Are travel vaccines safe for toddlers? / Which are mandatory? / What if they react? |

### 11.9 Excitement / optimism bias

| Field | Research note |
|-------|---------------|
| **Trigger** | Holiday booking high; focus on logistics not health |
| **Patient concern** | Health preparation feels like unnecessary bureaucracy |
| **Typical behaviour** | Leaves booking to last minute; underestimates appointment need |
| **Common questions** | Do I really need this for a beach holiday? / Can't I just get tablets at the airport? |

### 11.10 Entry requirement panic

| Field | Research note |
|-------|---------------|
| **Trigger** | Airline/embassy yellow fever or meningitis requirement discovered late |
| **Patient concern** | Will be denied boarding or entry; certificate won't arrive in time |
| **Typical behaviour** | Emergency appointment demand; may not understand 10-day yellow fever rule |
| **Common questions** | I fly in 5 days — can I still get yellow fever? / Will certificate work immediately? / What if I transit through yellow fever country? |

---

## 12. TRAVEL HEALTH KNOWLEDGE (Evidence Notes Only)

**Format:** Evidence-based research notes. Not advice copywriting. Weight: N/A (service-specific knowledge domain).

### 12.1 Vaccines by destination type

| Destination type | Commonly discussed vaccines (not exhaustive — individual assessment required) | Evidence source |
|------------------|-------------------------------------------------------------------------------|-----------------|
| **Sub-Saharan Africa** | Yellow fever (endemic zones + entry reqs), hep A, typhoid, rabies (extended/rural), meningitis ACWY (belt/Hajj), cholera (select) | NaTHNaC country pages; Green Book |
| **South America** | Yellow fever (Amazon basin etc.), hep A, typhoid, rabies (Amazon/rural) | NaTHNaC |
| **Indian subcontinent** | Hep A, typhoid, rabies (rural), JE (rural prolonged), cholera (select) | NaTHNaC |
| **South-East Asia** | Hep A, typhoid, rabies, JE (rural), tetanus booster | NaTHNaC |
| **East Asia (urban)** | Hep A, typhoid; JE if rural/prolonged | NaTHNaC |
| **Central/Eastern Europe** | TBE (forests/rural), hep A (select), rabies (rural) | NaTHNaC |
| **Middle East (Hajj/Umrah)** | Meningitis ACWY (certificate requirement), hep A, typhoid | NaTHNaC; Saudi MOH requirements |
| **Caribbean / Mexico** | Hep A, typhoid; rabies (remote); yellow fever (select areas) | NaTHNaC |
| **Western Europe / USA / Australia** | Routine UK vaccines up to date; selective hep A/B for risk activities | NaTHNaC |
| **Antarctica / remote expedition** | Comprehensive review — rabies, hep A/B, tetanus; specialist input | NaTHNaC; expedition medicine |

### 12.2 Malaria — research notes

| Field | Research note |
|-------|---------------|
| **Risk assessment factors** | Country, specific region, urban vs rural, altitude, season, accommodation type, duration, night outdoor exposure |
| **Primary prevention** | Bite avoidance (DEET, nets, clothing); no vaccine |
| **Chemoprophylaxis agents** | Atovaquone-proguanil, doxycycline, mefloquine — choice depends on destination resistance, patient factors, pregnancy, interactions |
| **Standby emergency treatment** | May be discussed for select low-risk but high-consequence scenarios — specialist guidance |
| **Pharmacy role** | Risk assessment + supply where prescribing authority; signpost if outside scope |
| **Evidence source** | NaTHNaC malaria maps; Green Book malaria chapter; BNF for interactions |

### 12.3 Timing — evidence notes

| Field | Research note |
|-------|---------------|
| **Ideal lead time** | 6–8 weeks (NHS.uk: 4–6 weeks minimum advice window) |
| **Multi-dose courses** | Rabies: 0, 7, 21–28 days; Hep B: 0, 1, 6 months; JE: 0, 28 days |
| **Accelerated schedules** | Some products allow — check SPC and Green Book; not all courses can be compressed to last-minute |
| **Protection onset** | Varies by vaccine; yellow fever ICVP from day 10 |
| **Booster intervals** | Product-specific; prior vaccination history affects need for primary vs booster |

### 12.4 Side effects — evidence notes

| Field | Research note |
|-------|---------------|
| **Common local** | Injection site pain, redness, swelling — most travel vaccines |
| **Common systemic** | Mild fever, headache, fatigue, myalgia — usually self-limiting 24–48h |
| **Yellow fever** | Higher reactogenicity profile than many vaccines; designated centre observes per protocol |
| **Oral typhoid/cholera** | GI upset possible |
| **Serious adverse events** | Anaphylaxis rare but requires emergency preparedness; yellow fever serious events very rare but documented |
| **When to defer** | Acute illness with fever (NHS.uk) |
| **Patient reassurance boundary** | Common mild effects expected; serious effects — seek urgent help |
| **Evidence source** | Green Book; product SPCs; MHRA Yellow Card |

---

## 13. CLINICAL ACTION FRAMEWORK

**Format:** Clinical reference for master content accuracy. Not patient-facing copy.

### 13.1 Fit to vaccinate — proceed today

| Field | Detail |
|-------|--------|
| **Criteria** | Suitable history; no contraindications; vaccine indicated; in stock; minimum interval from previous dose met; patient consent |
| **Pharmacy action** | Administer vaccine(s); document batch/expiry; provide PIL; schedule follow-up if needed |
| **Documentation** | Vaccine record; ICVP if yellow fever |
| **Urgency** | Routine — same visit |

### 13.2 Fit to vaccinate — schedule future dose(s)

| Field | Detail |
|-------|--------|
| **Criteria** | Indicated but interval not met; multi-dose course; stock to be ordered |
| **Pharmacy action** | Book follow-up; give dose 1 if appropriate today; provide written schedule |
| **Documentation** | Appointment card; full schedule with dates |
| **Urgency** | Planned — before departure deadline |

### 13.3 Defer vaccination

| Field | Detail |
|-------|--------|
| **Criteria** | Acute febrile illness; recent live vaccine interval violation; temporary contraindication |
| **Pharmacy action** | Reschedule; safety-net symptoms; do not administer today |
| **Documentation** | Deferral reason recorded |
| **Urgency** | Rebook ASAP if departure approaching |

### 13.4 Refer to GP

| Field | Detail |
|-------|--------|
| **Criteria** | NHS-funded vaccines when pharmacy not commissioned; complex medical history; pregnancy; routine schedule not up to date |
| **Pharmacy action** | Explain GP route for NHS vaccines; provide written recommendation list; may still offer private vaccines in scope |
| **Documentation** | Referral/advice letter if appropriate |
| **Urgency** | Before travel — days to weeks |

### 13.5 Refer to specialist travel clinic / hospital

| Field | Detail |
|-------|--------|
| **Criteria** | Severe immunosuppression; complex allergy history; yellow fever contraindication assessment; HIV with immune concern |
| **Pharmacy action** | Signpost specialist centre; do not administer contraindicated vaccines |
| **Documentation** | Referral with itinerary and recommendation summary |
| **Urgency** | Priority — may affect travel feasibility |

### 13.6 Advice-only outcome (no vaccination today)

| Field | Detail |
|-------|--------|
| **Criteria** | Patient declines; all vaccines already up to date; no indicated vaccines; too late for meaningful benefit |
| **Pharmacy action** | Document advice given; malaria/bite avoidance counselling; written summary |
| **Documentation** | Consultation record |
| **Urgency** | Routine |

### 13.7 Certificate issued (yellow fever / meningitis)

| Field | Detail |
|-------|--------|
| **Criteria** | Vaccine administered at designated centre; entry requirement documented |
| **Pharmacy action** | Complete ICVP with batch, date, signature, stamp; explain 10-day validity rule for yellow fever |
| **Documentation** | ICVP booklet |
| **Urgency** | Must align with travel date — plan ≥10 days before entry if yellow fever required |

### 13.8 Malaria prophylaxis supplied

| Field | Detail |
|-------|--------|
| **Criteria** | Risk assessment indicates chemoprophylaxis; no contraindications; within prescribing scope |
| **Pharmacy action** | Supply with counselling on adherence, side effects, sun exposure (doxycycline), completion after return |
| **Documentation** | Prescription/PGD record; written dosing instructions |
| **Urgency** | Start before entering risk area — lead time per agent |

### 13.9 Emergency / anaphylaxis post-vaccination

| Field | Detail |
|-------|--------|
| **Criteria** | Acute allergic reaction on premises |
| **Pharmacy action** | Emergency protocol; adrenaline if indicated; 999; do not leave patient alone |
| **Documentation** | Incident record; MHRA Yellow Card |
| **Urgency** | **Emergency — 999** |

---

## 14. PATIENT JOURNEY RESEARCH

**Format:** Journey map for master content structure. Not publish copy.

### 14.1 Awareness

| Field | Research note |
|-------|---------------|
| **Patient goals** | Know travel vaccines exist; understand timing need |
| **Patient concerns** | "Do I even need vaccines?" |
| **Information needs** | When to start planning; NHS vs private; pharmacy vs GP |
| **Common misunderstandings** | Only tropical trips need vaccines; all free on NHS |

### 14.2 Trigger

| Field | Research note |
|-------|---------------|
| **Patient goals** | Act on booking confirmation or entry requirement |
| **Patient concerns** | Urgency if departure near |
| **Information needs** | How soon to book; what destination requires |
| **Common misunderstandings** | Can sort vaccines day before flight |

### 14.3 Booking

| Field | Research note |
|-------|---------------|
| **Patient goals** | Secure appointment; get price indication |
| **Patient concerns** | Availability; cost; wait times |
| **Information needs** | Phone/online booking; preparation list; fee structure |
| **Common misunderstandings** | Walk-in always available; all vaccines in stock |

### 14.4 Consultation

| Field | Research note |
|-------|---------------|
| **Patient goals** | Clear personalised plan; fair pricing |
| **Patient concerns** | Upselling; privacy; medical disclosure |
| **Information needs** | Itinerary review process; what's included in fee; consent |
| **Common misunderstandings** | Generic country list sufficient; no medical history needed |

### 14.5 Vaccination

| Field | Research note |
|-------|---------------|
| **Patient goals** | Minimal discomfort; same-day start |
| **Patient concerns** | Needle pain; side effects; multiple jabs |
| **Information needs** | Observation time; what to expect after |
| **Common misunderstandings** | All doses done in one visit |

### 14.6 Follow-up doses

| Field | Research note |
|-------|---------------|
| **Patient goals** | Complete course before travel |
| **Patient concerns** | Missing appointment; travelling mid-course |
| **Information needs** | Dose dates; partial protection value |
| **Common misunderstandings** | Missing dose 2 makes dose 1 useless |

### 14.7 Travel and post-travel

| Field | Research note |
|-------|---------------|
| **Patient goals** | Safe travel; valid certificates; know when to seek help abroad |
| **Patient concerns** | Fever/malaria symptoms; lost certificate |
| **Information needs** | ICVP validity; malaria adherence; post-travel illness signs |
| **Common misunderstandings** | Vaccinated = no malaria precautions needed |

---

## 15. CONTENT OPPORTUNITY RESEARCH

**Format:** Ranked opportunities for future master content. Not content itself.

### 15.1 Strongest patient questions — ranked

| Rank | Question theme | Priority | Rationale |
|------|----------------|----------|-----------|
| 1 | Which vaccines do I need for my destination? | **HIGH** | Core service value proposition |
| 2 | How far before travel should I book? | **HIGH** | Primary planning barrier; drives early conversion |
| 3 | Which vaccines are free on NHS vs private? | **HIGH** | Major confusion and trust issue |
| 4 | How much do travel vaccinations cost? | **HIGH** | Primary conversion barrier |
| 5 | Do I need a yellow fever certificate? | **HIGH** | Entry requirement anxiety |
| 6 | Is it too late if travelling soon? | **HIGH** | Last-minute patient segment |
| 7 | Can pharmacy give travel vaccines or do I need GP? | **HIGH** | Pathway clarity |
| 8 | How many appointments will I need? | **MEDIUM** | Planning expectation |
| 9 | Are travel vaccines safe for children? | **MEDIUM** | Family traveller segment |
| 10 | Can you prescribe malaria tablets? | **MEDIUM** | Linked service demand |
| 11 | What side effects should I expect? | **MEDIUM** | Anxiety reduction |
| 12 | Do I need a GP referral? | **MEDIUM** | Access barrier |
| 13 | What should I bring to appointment? | **MEDIUM** | Preparation quality |
| 14 | Will you stock all vaccines I need? | **MEDIUM** | Expectation management |
| 15 | Can I claim on insurance? | **LOW** | Niche — receipt process |
| 16 | Pregnancy/breastfeeding eligibility | **LOW** | Edge case — refer pathway |

### 15.2 Strongest myths — ranked

| Rank | Myth | Priority | Rationale |
|------|------|----------|-----------|
| 1 | All travel vaccines free on NHS | **HIGH** | Pricing trust critical |
| 2 | One appointment always enough | **HIGH** | Schedule expectation |
| 3 | Vaccines work immediately | **HIGH** | Yellow fever 10-day rule |
| 4 | Pharmacy offers all NHS travel vaccines | **HIGH** | England GP-primary accuracy |
| 5 | Malaria tablets optional if vaccinated | **HIGH** | Safety-critical |
| 6 | Only tropical countries need vaccines | **MEDIUM** | VFR and Europe segments |
| 7 | Yellow fever anywhere | **MEDIUM** | Designated centre accuracy |
| 8 | Last-minute vaccination pointless | **MEDIUM** | Captures late bookers |
| 9 | Pharmacist not qualified | **MEDIUM** | Trust building |
| 10 | Previous visits mean no vaccines needed | **MEDIUM** | VFR complacency |
| 11 | Insurance always covers | **LOW** | Policy variable |
| 12 | Resort = no risk | **LOW** | Secondary education |

### 15.3 Strongest concerns — ranked

| Rank | Concern | Priority | Rationale |
|------|---------|----------|-----------|
| 1 | Cost of multiple vaccines | **HIGH** | Primary objection |
| 2 | Too late before departure | **HIGH** | Urgency driver |
| 3 | NHS vs private confusion | **HIGH** | Trust and expectation |
| 4 | Which vaccines actually needed | **HIGH** | Decision paralysis |
| 5 | Side effects / child safety | **HIGH** | Consent barrier |
| 6 | Stock/availability uncertainty | **MEDIUM** | Owner variable |
| 7 | Yellow fever certificate timing | **MEDIUM** | Entry panic |
| 8 | Pharmacy vs GP thoroughness | **MEDIUM** | Trust objection |
| 9 | Needle phobia | **MEDIUM** | Affects compliance |
| 10 | Upselling unnecessary vaccines | **MEDIUM** | Commercial trust |

### 15.4 Strongest trust factors — ranked

| Rank | Trust factor | Priority | Rationale |
|------|--------------|----------|-----------|
| 1 | Transparent pricing before supply | **HIGH** | Private service essential |
| 2 | NaTHNaC-aligned destination advice | **HIGH** | Clinical credibility |
| 3 | Clear NHS vs private explanation | **HIGH** | Expectation management |
| 4 | GPhC-registered / qualified vaccinator | **HIGH** | Professional legitimacy |
| 5 | Private consultation room | **HIGH** | Itinerary/medical privacy |
| 6 | Written schedule and certificates | **MEDIUM** | Documentation need |
| 7 | Honest deferral/referral | **MEDIUM** | Safety trust |
| 8 | Yellow fever designation (if applicable) | **MEDIUM** | Entry requirement |
| 9 | Convenient booking/hours | **MEDIUM** | Practical differentiator |
| 10 | GP notification option | **LOW** | Continuity |

---

## 16. KNOWLEDGE GAPS + RESEARCH COMPLETENESS SCORE + READINESS FOR MASTER V1

### 16.1 Gaps addressed in v1

| Gap | Status in v1 |
|-----|--------------|
| NHS free vs paid vaccine list | **Addressed** — Section 5.2 |
| Pharmacy vs GP pathway (England) | **Addressed** — Sections 1.2, 1.3 |
| Yellow fever designated centre rules | **Addressed** — Sections 5.4, 13.7 |
| Timing/lead times | **Addressed** — Sections 5.3, 12.3 |
| Malaria scope boundary | **Addressed** — Sections 5.5, 12.2 |
| Patient emotions | **Addressed** — Section 11 (10 emotions) |
| Clinical action outcomes | **Addressed** — Section 13 (9 outcomes) |
| Patient journey | **Addressed** — Section 14 (7 stages) |
| Content priorities | **Addressed** — Section 15 ranked |

### 16.2 Remaining missing clinical information

| Gap | Recommendation |
|-----|----------------|
| Devolved nations pharmacy NHS contracts (Scotland/Wales/NI) | Master V1 England-default; owner appendix for devolved |
| Exact Green Book booster intervals per product | Clinical sign-off with current Green Book edition at master stage |
| Yellow fever lifelong protection policy updates | Sign-off against current Green Book/NaTHNaC |
| Paediatric age limits per vaccine product | Product SPC sign-off — avoid generic ages in master |
| Individual pharmacy vaccine formulary | Owner variable — `{{private_vaccine_pricing}}` + stock list |
| Hajj/Umrah meningitis certificate specifics | Verify current Saudi MOH requirements at publish |
| COVID-19 travel requirements | Volatile — link to NaTHNaC; avoid static country lists in master |

### 16.3 Remaining missing patient concerns

| Gap | Recommendation |
|-----|----------------|
| Cultural/language barriers | Owner variable `{{languages}}` at publish |
| Accessibility / reasonable adjustments | Owner variable |
| LGBTQ+ travel health specifics | Brief signpost — specialist resources if needed |
| Chronic mental health and travel health anxiety | Section 11 covers core emotions; master tone guidance |

### 16.4 Remaining missing pathway information

| Gap | Recommendation |
|-----|----------------|
| Owner NHS vaccine menu | Required — `{{nhs_travel_vaccines}}` |
| Yellow fever centre status | Owner confirmation |
| Private price list | Required — `{{private_vaccine_pricing}}` |
| Malaria prescribing scope | Owner confirmation at onboarding |
| GP electronic notification workflow | Local — generic statement sufficient |

### 16.5 Recommendations before Master V1

1. **Human clinical sign-off** on Sections 5, 6, 12, 13 (vaccine lists, red flags, travel health knowledge, action framework)
2. **Confirm England-primary scope** for NHS pathway claims; devolved caveat in master
3. **Owner variables** remain placeholders until pharmacy onboarding
4. **Use Section 15 HIGH-priority items** to drive master section emphasis
5. **Use Section 11 emotions** for tone guidance — not publish prose
6. **Use Section 14 journey** to structure patient-facing flow
7. **Do not publish static destination vaccine lists** — direct to consultation + NaTHNaC

---

## RESEARCH COMPLETENESS SCORE (V1)

| Area | Weight | Score (0–10) | Notes |
|------|--------|--------------|-------|
| 1. Service definition | 8% | 9 | NHS partial + private variants mapped; devolved caveat noted |
| 2. Patient intent | 7% | 9 | Triggers, motivations, intent-level concerns |
| 3. Patient questions (50+) | 10% | 10 | 90 questions across 8 groups |
| 4. Patient concerns (20+) | 7% | 10 | 28 concerns + ranked opportunities |
| 5. Clinical facts | 12% | 9 | NHS.uk + NaTHNaC aligned; product detail needs sign-off |
| 6. Red flags | 10% | 9 | Defer, refer, emergency bands |
| 7. Myths (20+) | 7% | 10 | 24 myths + ranked |
| 8. Trust factors | 5% | 9 | Ranked opportunities added |
| 9. Local advantages | 4% | 8 | Owner-dependent |
| 10. Owner variables | 4% | 9 | Six core variables defined |
| 11. Patient emotions | 10% | 9 | 10 emotions fully mapped |
| 12. Travel health knowledge | 8% | 8 | Destination types, malaria, timing, side effects — evidence notes |
| 13. Clinical action framework | 8% | 10 | 9 consultation outcomes with actions |
| 14. Patient journey | 5% | 9 | 7 stages mapped |
| 15. Content opportunities | 5% | 9 | Ranked HIGH/MEDIUM/LOW |

**Weighted completeness score: 9.1 / 10**

---

## REMAINING KNOWLEDGE GAPS (Summary)

1. Devolved nations NHS pharmacy contracts — England-default for Master V1
2. Owner confirmation — NHS vaccine subset, yellow fever designation, pricing, stock
3. Human clinical sign-off — not yet recorded
4. Product-specific paediatric ages and intervals — Green Book/SPC at master stage
5. Volatile entry requirements (COVID, outbreaks) — NaTHNaC link not static lists
6. Local GP integration specifics — owner/onboarding

**Critical gaps blocking Master V1:** Items 2 and 3 only (owner vars can remain as placeholders in master template per Pharmacy First benchmark pattern).

---

## READINESS SCORE FOR MASTER V1

| Criterion | Score | Max | Notes |
|-----------|-------|-----|-------|
| Factual research completeness | 9.1 | 10 | v1 foundation complete |
| Clinical pathway documented | 9 | 10 | Pending sign-off |
| Patient intent/emotion coverage | 9 | 10 | Section 11 complete |
| Question/concern inventory | 10 | 10 | Exceeds minimums |
| Clinical action framework | 10 | 10 | Section 13 complete |
| Journey mapping | 9 | 10 | Section 14 complete |
| Content priority guidance | 9 | 10 | Section 15 complete |
| Owner variables identified | 9 | 10 | Six placeholders defined |
| Human clinical review | 0 | 10 | Not yet recorded |
| Publish scope decision (England) | 7 | 10 | Recommended not yet formalised |

**Readiness score: 8.0 / 10**

---

## RECOMMENDATION

### **READY FOR MASTER V1**

**Conditions:**

1. Master V1 author uses this document as sole research source for `travel-vaccinations`
2. Clinical reviewer signs off Sections 5, 6, 12, and 13 before QA checklist
3. Master treats owner variables as placeholders (same pattern as Pharmacy First / blood-pressure benchmark)
4. Master scope: England-primary NHS partial pathway + generic private pharmacy travel vaccination variant; devolved caveat in footnote
5. Section 15 HIGH-priority items drive master emphasis; LOW-priority items may be omitted or brief
6. Do not publish exhaustive destination vaccine matrices — consultation and NaTHNaC referral required

**Research foundation is comprehensive enough that Master V1 can be written without additional factual research**, provided the conditions above are met during drafting and review.

**Do not create:** publish content, service pages, variations, area pages, hub pages, or HTML as part of this research task.

---

## Document Control

| Version | Date | Change |
|---------|------|--------|
| v1 | 2026-06-22 | Initial Stage 1 research foundation — travel vaccinations |

**Next step:** Clinical sign-off → `travel-vaccinations-master-v1.md` (Stage 2)
