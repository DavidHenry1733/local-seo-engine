# Emergency Contraception — Stage 1 Research Foundation (V1)

**Document type:** Research foundation only  
**Service ID:** `emergency-contraception`  
**Category:** `nhs-clinical`  
**Benchmark process:** Pharmacy First framework (`MASTER-SERVICE-CREATION-PROCESS.md` Stage 1)  
**Benchmark document:** `blood-pressure-checks-research-v1.1.md`  
**Status:** Draft for human clinical review  
**Created:** 2026-06-22  

**Purpose:** Comprehensive clinical and patient-intent research before any master library prose is written. This document is not publish content.

---

## Source Material (Evidence Base)

| Source | Reference | Use in this document |
|--------|-----------|----------------------|
| NHS England Advanced Service Specification | NHS Pharmacy Contraception Service (PCS) — expanded 29 October 2025 to include oral EC | Pathway, eligibility, commissioning, service scope |
| NHS England Patient Group Directions | PRN02207 — Levonorgestrel 1.5mg (LNG-EC) and Ulipristal acetate 30mg (UPA-EC) PGDs v1.0 (valid from 29 Oct 2025) | Time windows, contraindications, dosing, cautions, aftercare, documentation |
| College of Sexual and Reproductive Healthcare (CoSRH/FSRH) | Clinical Guideline: Emergency Contraception (March 2017, amended July 2023); drug interaction guidance | Effectiveness factors, missed-pill scenarios, Cu-IUD timing, breastfeeding |
| Community Pharmacy England | PCS guidance and service pathway for oral EC | Eligibility clarifications, commissioning status, technician scope |
| Centre for Postgraduate Pharmacy Education (CPPE) | PCS training modules | Competency requirements for staff |
| Internal intelligence | `data/pharmacy-service-intelligence/emergency-contraception.json` | Patient intent signals, question seeds |
| Internal blueprint | `data/pharmacy-service-blueprints/emergency-contraception.json` | Concerns, myths, process steps, unsuitability criteria |
| Internal blueprint seeds | `src/pharmacy/pharmacyServiceBlueprintSeeds.ts` (emergency-contraception) | Core myths, enrichment objections, safety concerns |
| Internal enrichment | `src/pharmacy/pharmacyServiceBlueprintEnrichmentSeeds.ts` (emergency-contraception) | Booking barriers, eligibility questions, NHS/private comparisons |

**Verification note:** Clinical thresholds mapped to PRN02207 PGDs (Oct 2025) and CoSRH EC guidance. Owner-specific commissioning status (`{{nhs_service}}`) must be confirmed locally before publish claims. England-only scope for NHS PCS pathway.

---

## 1. SERVICE DEFINITION

### 1.1 What the service is

- Time-sensitive confidential pharmacist consultation for emergency contraception (EC) after unprotected sexual intercourse (UPSI) or contraceptive failure/compromise
- Clinical assessment of timing, medical history, medicines, and suitability for oral EC supply under PGD
- Supply of levonorgestrel 1.5mg (LNG-EC) and/or ulipristal acetate 30mg (UPA-EC) where clinically appropriate under NHS PCS PGDs
- Comparison and shared decision-making between available oral EC options within PGD scope
- Signposting and referral for copper intrauterine device (Cu-IUD) — the most effective EC method — when appropriate and acceptable
- Cannot supply oral EC in advance "just in case" under PGD
- Safety-netting: pregnancy test advice, menstrual disturbance counselling, STI/ongoing contraception signposting
- Private EC consultation and supply may exist separately where NHS PCS not commissioned or patient ineligible — fee-based (`{{private_ec_fee}}`)
- Delivered in private consultation room (`{{consultation_room}}`) by GPhC-registered pharmacist or trained pharmacy technician authorised under PGD

### 1.2 NHS pathway — Pharmacy Contraception Service oral EC (England)

**Service name (official):** NHS Pharmacy Contraception Service (PCS) — oral emergency contraception component

**Commissioning:** Advanced Service under Community Pharmacy Contractual Framework (England). Pharmacy must be registered to deliver PCS and staff authorised under PRN02207 PGDs. Not automatically available at every pharmacy.

**Expansion timeline:**
- PCS commenced April 2023 (ongoing oral contraception supply)
- Expanded December 2023 (initiation + ongoing supply)
- Further expanded **29 October 2025** — oral EC via PGD; pharmacy technician delivery; drospirenone POP added to ongoing contraception scope

**Primary purpose (oral EC component):**
- Reduce risk of unintended pregnancy after UPSI or when regular contraception compromised/used incorrectly
- Provide timely access without GP appointment where PGD criteria met
- Signpost most effective option (Cu-IUD) and ongoing contraception

**Inclusion criteria (NHS PGD — oral EC):**
- Individual presenting 0–96 hours after UPSI for LNG-EC (off-label use 72–96 hours per PGD/CoSRH)
- Individual presenting 0–120 hours after UPSI for UPA-EC
- Contraceptive failure/compromise scenarios per CoSRH EC guideline Table 1 (e.g. missed pills, condom breakage — assessed individually)
- Repeat dose if vomiting within 3 hours of prior oral EC dose
- Age from menarche up to 54 years (PCS broader scope); PGD capacity assessment required under 16

**Exclusion criteria (NHS PGD — cannot supply oral EC):**
- Known pregnancy
- UPSI episode >96 hours ago (LNG) or >120 hours ago (UPA) — note: earlier UPSI in same cycle may still be treated if most recent within window
- UPA-EC used in previous 5 days (for LNG supply)
- LNG-EC or any progestogen in previous 7 days (for UPA supply)
- Less than 21 days post-childbirth
- Less than 5 days post-miscarriage, abortion, ectopic pregnancy, or GTD evacuation
- Acute porphyria
- Known hypersensitivity to product components
- Request for advance/"just in case" supply
- Under 16 lacking Fraser-guidelines capacity to consent
- 16+ assessed as lacking capacity to consent
- UPA-specific: concurrent antacids/PPI/H2 blockers; severe asthma on oral glucocorticoids; enzyme-inducing drugs/herbals (UPA excluded — LNG double-dose alternative); EE/LNG COC users who missed two pills in first week

**Pharmacy cannot (under PGD):**
- Fit Cu-IUD — must signpost/refer to appropriate provider (sexual health clinic, GP, gynaecology)
- Supply oral EC in advance for future use
- Guarantee pregnancy prevention — effectiveness varies by method, timing, and individual factors
- Replace sexual health clinic for STI testing/treatment, abortion counselling, or complex gynaecological care
- Override PGD exclusions — must refer or signpost alternative EC

**Cu-IUD signposting (mandatory discussion per PGD):**
- All individuals informed Cu-IUD within 5 days of UPSI OR within 5 days from earliest estimated ovulation is most effective EC
- If Cu-IUD appropriate and acceptable: supply oral EC if indicated AND refer to fitting service without delay

### 1.3 Private service variants (typical UK pharmacy)

- Walk-in or booked EC consultation for disclosed fee (`{{private_ec_fee}}`)
- May supply LNG and/or UPA outside NHS PCS where pharmacy has private PGD/protocol or pharmacist prescriber
- Broader access possible but same clinical governance — assessment still required
- Fee typically covers consultation + medicine supply; varies by pharmacy and product
- NHS eligibility not required; may serve visitors, those at non-PCS pharmacies, or outside commissioning hours
- Cu-IUD referral signposting still clinically required regardless of funding route

### 1.4 Typical appointment structure

**NHS PCS oral EC consultation:**
1. Patient contact — walk-in, phone triage, or booked slot (`{{booking_link}}`, `{{phone}}`)
2. Urgency acknowledged — time window critical; same-day prioritisation where possible
3. Private consultation room — confidential assessment (`{{consultation_room}}`)
4. Consent and capacity assessment (Fraser guidelines if under 16; safeguarding if under 13)
5. Clinical history — timing of UPSI, contraceptive use/failure, cycle history, medicines (including OTC/herbal/enzyme inducers), allergies, breastfeeding, previous EC this cycle
6. Biometrics where relevant — weight, height, BMI (affects product choice and dosing)
7. Discussion of all EC methods — Cu-IUD (most effective), LNG-EC, UPA-EC — effectiveness windows explained
8. Product selection per PGD criteria — shared decision where options exist
9. Supply with PIL, written advice, and safety-netting
10. Ongoing contraception signposting — PCS ongoing contraception, GP, sexual health clinic
11. STI/condom advice where appropriate
12. Pregnancy test advice — 3 weeks after treatment if period delayed >7 days or abnormal
13. Documentation per PGD specification; GP notification where appropriate

**Typical duration:** ~15–30 minutes (complex histories, missed-pill scenarios, or safeguarding may extend)

**Staff:** GPhC-registered pharmacist or pharmacy technician — both must be PCS-trained and PGD-authorised

---

## 2. PATIENT INTENT

### 2.1 Why patients seek emergency contraception

- Unprotected sex — no contraception used
- Condom breakage or slipped off during intercourse
- Missed contraceptive pills (number and timing assessed per CoSRH)
- Late contraceptive injection or implant expiry
- Removed/expelled IUD or contraceptive patch failure
- Sexual assault — may present distressed; safeguarding pathways apply
- Uncertainty whether regular contraception was effective (withdrawal method, timing errors)
- Cannot access GP or sexual health clinic quickly enough
- Previous EC from another provider — vomiting, need repeat dose
- Partner told them to "get the morning-after pill"
- Travel or displacement from usual healthcare provider

### 2.2 Common triggers

- Immediate post-UPSI anxiety — "something went wrong last night"
- Realisation contraceptive pill was missed for several days
- Calendar/cycle app alert about fertile window overlap
- Friend or online advice to "get it within 72 hours"
- Pharmacy poster, NHS campaign, or social media about free pharmacy EC
- Repeat need within same menstrual cycle (second UPSI episode)
- Contraceptive supply running out coinciding with UPSI

### 2.3 Common concerns (intent-level)

- "Am I too late?" — timing anxiety dominates
- Embarrassment asking at pharmacy counter
- Fear of judgment from pharmacist or staff
- Confidentiality — will parents/partner/GP find out
- Whether EC is same as abortion pill
- Effectiveness — "will it actually work?"
- Side effects and impact on future fertility
- Cost — NHS free vs private fee confusion
- Which pill is better — Levonelle vs ellaOne brand confusion
- Whether weight/BMI affects whether it works
- Age — under 16 consent and parental involvement
- Breastfeeding safety
- Interaction with regular contraceptive pill

### 2.4 Typical motivations

- Prevent unintended pregnancy — primary driver
- Speed and convenience — pharmacy faster than GP
- Confidentiality — private room, no GP record embarrassment (misconception — GP may be notified)
- Free NHS care where PCS commissioned (`{{nhs_service}}`)
- Trusted healthcare professional — pharmacist expertise
- Extended hours / weekend access (`{{opening_hours}}`)
- Local high street — no hospital/clinic travel
- Clear next steps — ongoing contraception and STI advice in same visit

---

## 3. PATIENT QUESTIONS (Raw Research List)

**Format note:** Questions only. Not written as publish FAQs. **Count: 62**.

### 3.1 Eligibility and timing

1. How soon do I need to take emergency contraception after unprotected sex?
2. Am I too late if it's been more than 72 hours?
3. Can I still get emergency contraception after 96 hours?
4. What's the latest I can take the morning-after pill?
5. Can a pharmacy give me emergency contraception?
6. Do I need to be over 16 to get emergency contraception at a pharmacy?
7. Can I get emergency contraception if I'm under 16 without telling my parents?
8. Am I eligible for free NHS emergency contraception at this pharmacy?
9. Is this service available at every pharmacy?
10. Can I get emergency contraception if I'm not registered with a GP?
11. Can I get EC if I'm breastfeeding?
12. Can I get EC if I think I might already be pregnant?
13. Can I get EC more than once in the same month?
14. I already took emergency contraception this cycle — can I take it again?
15. I vomited after taking the pill — do I need another dose?
16. Does emergency contraception work if I've already ovulated?

### 3.2 Appointments and access

17. Do I need an appointment or can I walk in?
18. How do I book an emergency contraception consultation?
19. How long does the appointment take?
20. What are your opening hours for emergency contraception?
21. Can I get same-day emergency contraception?
22. Can I book online?
23. Can my partner or friend pick it up for me?
24. Do you offer evening or weekend emergency contraception?
25. What if the pharmacy is closed — where do I go?
26. Can I speak to someone on the phone before coming in?
27. Can I request a female pharmacist?
28. How private is the consultation?
29. Will other customers know why I'm there?

### 3.3 EC options and effectiveness

30. What's the difference between Levonelle and ellaOne?
31. Which emergency contraception pill is more effective?
32. Is the copper coil better than the morning-after pill?
33. Can the pharmacy fit a coil for emergency contraception?
34. Does emergency contraception work if I'm overweight?
35. I'm over 70kg — will the pill still work?
36. I take epilepsy medication — which EC can I have?
37. Can I take EC if I'm on the contraceptive pill?
38. I missed two pills — do I need emergency contraception?
39. The condom broke — which pill should I take?
40. Can I take both types of morning-after pill?

### 3.4 NHS and cost

41. Is emergency contraception free on the NHS at the pharmacy?
42. How much does private emergency contraception cost?
43. What's the difference between NHS and private emergency contraception?
44. Do I need an NHS number?
45. Can I get a receipt for private EC?

### 3.5 Aftercare and follow-up

46. What side effects should I expect?
47. Will emergency contraception affect my period?
48. When should I take a pregnancy test?
49. What if my period is late after taking EC?
50. Do I need to see my GP afterwards?
51. Will my GP be told I had emergency contraception?
52. How soon can I start my regular contraceptive pill again?
53. Do I need to use condoms after taking EC?
54. Should I get an STI test?
55. Where can I get ongoing contraception?

### 3.6 Safety and scope

56. Is emergency contraception the same as an abortion pill?
57. Will emergency contraception affect my future fertility?
58. Is it safe to take emergency contraception multiple times?
59. Can I get emergency contraception to keep at home just in case?
60. Should I go to A&E for emergency contraception?
61. What symptoms mean I need urgent medical help instead?
62. Can I buy emergency contraception online instead of coming to the pharmacy?

---

## 4. PATIENT CONCERNS (Raw Research List)

**Count: 24**

1. Fear of being too late — timing window closing
2. Embarrassment asking at pharmacy counter in public
3. Fear of judgment about sexual activity or contraceptive failure
4. Worry pharmacist will tell parents (under 16 or living at home)
5. Worry GP or partner will be informed without consent
6. Confusion whether EC is an abortion pill
7. Uncertainty whether pharmacy EC is as thorough as GP/clinic
8. Anxiety about effectiveness — especially if near 72/120-hour limit
9. Concern about weight/BMI reducing pill effectiveness
10. Fear EC will harm future fertility or ability to conceive
11. Confused about NHS free vs private cost (`{{private_ec_fee}}`)
12. Unsure which product (LNG vs UPA) is right for their situation
13. Worry about side effects — nausea, vomiting, period changes
14. Breastfeeding safety concern
15. Medicine interaction worry (epilepsy drugs, St John's Wort, regular pill)
16. Belief that buying online is faster and more private
17. Fear of being overheard in consultation room or pharmacy
18. Uncertainty about age limits and parental consent
19. Concern service not available at local pharmacy (`{{nhs_service}}`)
20. Worry about attending alone — whether support person allowed
21. Anxiety after sexual assault — fear of questions or disbelief
22. Shame about repeated EC use in short period
23. Confusion about restarting regular contraception after UPA (5-day delay)
24. Fear of ectopic pregnancy if EC "doesn't work"

---

## 5. CLINICAL FACTS

### 5.1 Emergency contraception methods overview

| Method | Pharmacy supply under PCS PGD? | Time window (UPSI) | Relative effectiveness |
|--------|-------------------------------|-------------------|------------------------|
| Cu-IUD | No — signpost/refer only | ≤5 days UPSI OR ≤5 days from estimated ovulation | Most effective (>99%) |
| UPA-EC (ulipristal 30mg) | Yes | 0–120 hours | More effective than LNG, especially 72–120h and near ovulation |
| LNG-EC (levonorgestrel 1.5mg) | Yes | 0–96 hours (licensed 72h; PGD extends to 96h) | Effective; less so than UPA in later window and near ovulation |

**Key principle:** EC prevents or delays ovulation — neither oral method terminates existing pregnancy. Ineffective if taken after ovulation has occurred.

### 5.2 Levonorgestrel (LNG-EC) — PGD PRN02207

- **Dose:** 1.5mg single oral dose as soon as possible
- **Window:** Up to 96 hours after UPSI
- **Double dose (3mg — two 1.5mg tablets):** BMI >26 kg/m² OR weight >70 kg; enzyme-inducing drugs (or within 4 weeks of stopping). Effectiveness of double dose **unknown** — Cu-IUD recommended
- **Repeat dose:** If vomiting within 3 hours; separate episode of care
- **Same cycle repeats:** If within 7 days of prior LNG → offer LNG again (not UPA). If within 5 days of UPA → offer UPA again (not LNG)
- **Breastfeeding:** Secreted in breast milk — take immediately after feed; avoid nursing 8 hours
- **Restart hormonal contraception:** Immediately after LNG; use condoms/abstain until contraception fully effective

### 5.3 Ulipristal acetate (UPA-EC) — PGD PRN02207

- **Dose:** 30mg single oral dose as soon as possible
- **Window:** Up to 120 hours after UPSI
- **Excluded if:** LNG/progestogen in previous 7 days; enzyme inducers; antacids/PPI/H2 blockers; severe asthma on oral glucocorticoids; EE/LNG COC missed two pills in first week
- **Progestogen effect:** UPA effectiveness reduced by progestogen in following 5 days — advise no progestogen-containing drugs (including COC) for 5 days after UPA
- **Restart hormonal contraception:** Delay 5 days after UPA; use condoms/abstain until fully effective
- **Breastfeeding:** No need to avoid breastfeeding after single dose (CoSRH guidance per PGD)
- **Missed pill situations:** UPA generally not recommended — refer to CoSRH Table 1

### 5.4 Cu-IUD — pharmacy signposting role

- Most effective EC method
- Can be fitted up to 5 days after UPSI OR up to 5 days after earliest estimated ovulation (whichever is later)
- Pharmacy cannot fit — must refer to sexual health clinic, GP with coil service, or gynaecology
- Recommended especially: high BMI/weight; enzyme inducers; late presentation; repeated EC; patient preference for ongoing contraception
- PGD: if Cu-IUD appropriate and acceptable, supply oral EC AND refer without delay

### 5.5 Contraindications summary (oral EC under PGD)

| Condition | LNG-EC | UPA-EC |
|-----------|--------|--------|
| Known pregnancy | Excluded | Excluded |
| UPA in previous 5 days | Excluded | — |
| LNG/progestogen in previous 7 days | — | Excluded |
| >96h / >120h since UPSI | Excluded | Excluded |
| <21 days post-childbirth | Excluded | Excluded |
| <5 days post-miscarriage/abortion/ectopic/GTD | Excluded | Excluded |
| Acute porphyria | Excluded | Excluded |
| Advance supply request | Excluded | Excluded |
| Enzyme inducers | Double LNG dose (efficacy unknown) | Excluded |
| Antacids/PPI/H2 blockers | — | Excluded |
| Under 16 without Fraser capacity | Excluded | Excluded |

### 5.6 Under-16 governance

- **Fraser guidelines (Gillick competence):** Capacity assessment mandatory and documented for under-16s
- **Under 13:** Contact local safeguarding lead; follow local safeguarding policy
- **16+ lacking capacity:** Capacity assessment; consider sexual assault/vulnerability
- Confidentiality maintained where competent — no automatic parental notification

### 5.7 Effectiveness factors

- **Time since UPSI:** Earlier = more effective for oral EC
- **Cycle timing / ovulation:** LNG and UPA ineffective post-ovulation; UPA more effective than LNG in 72–120h window and pre-ovulation
- **BMI >26 or weight >70 kg:** Oral EC may be less effective; double LNG dose per PGD (efficacy unknown); Cu-IUD recommended
- **Enzyme-inducing medicines:** Reduced oral EC efficacy; double LNG or Cu-IUD
- **Vomiting within 3 hours:** Repeat dose required
- **Repeated UPSI in same cycle:** Further pregnancy risk if ovulation occurs later — condoms/abstinence advised

### 5.8 Aftercare and safety-netting (PGD standard advice)

- Menstrual disturbances common — next period may be early/late; spotting possible
- **Pregnancy test:** 3 weeks after treatment if expected period delayed >7 days, abnormal, or hormonal contraception affecting bleeding pattern
- No evidence of harm if pregnancy occurs in cycle when oral EC used
- Oral EC does not provide ongoing contraception
- STI risk — condom promotion; signpost screening where appropriate
- Further UPSI in same cycle before ovulation — additional pregnancy risk
- Seek medical advice for adverse reactions; attend provider if period absent/abnormal or concerns

### 5.9 Common side effects (oral EC)

**LNG-EC:** Nausea, vomiting, headache, dizziness, fatigue, abdominal pain, breast tenderness, diarrhoea

**UPA-EC:** Nausea/vomiting, abdominal pain, headache, dizziness, myalgia, dysmenorrhoea, pelvic pain, breast tenderness, mood changes, fatigue

---

## 6. RED FLAGS

### 6.1 Urgent medical review required (999 / same day)

**999 / A&E:**
- Suspected ectopic pregnancy — severe unilateral abdominal pain, shoulder tip pain, collapse, heavy bleeding with dizziness
- Severe allergic reaction to supplied medicine — anaphylaxis
- Sexual assault with acute injury — emergency department; safeguarding parallel pathway

**Same-day GP / urgent care / sexual health:**
- Suspected pregnancy with concerning symptoms (pain, bleeding) — EC will not treat existing pregnancy
- Symptoms suggesting ectopic pregnancy even if mild initially
- Severe persistent vomiting preventing oral EC retention (after repeat dose attempt)
- Outside oral EC window — urgent Cu-IUD referral if within Cu-IUD window; pregnancy options counselling if not

### 6.2 Referral required (non-emergency but mandatory)

- Cu-IUD desired or clinically preferred — refer to fitting service within window
- Outside PGD inclusion — sexual health clinic, GP, or NHS 111 for alternative EC
- UPA contraindicated and LNG inappropriate or outside window — Cu-IUD or pregnancy options pathway
- Under 13 — safeguarding referral per local policy
- Under 16 failing Fraser capacity assessment — follow local policy; may involve GP/safeguarding (not automatic parental disclosure)
- Enzyme inducers where UPA excluded and LNG double-dose considered insufficient — Cu-IUD strongly recommended
- Suspected STI requiring treatment — sexual health clinic referral
- Request for advance supply — declined under PGD; signpost ongoing contraception (PCS, GP)

### 6.3 When pharmacy NHS PCS oral EC is NOT appropriate

- Known pregnancy
- Outside time windows with no earlier treatable UPSI in cycle
- PGD exclusion criteria met (see Section 5.5)
- Patient lacks capacity and cannot consent
- Advance/"just in case" supply request
- Cu-IUD only appropriate option and patient declines all oral EC — still refer for Cu-IUD if within window
- Complex missed-pill scenario where UPA not recommended and LNG unsuitable — GP/sexual health

### 6.4 When private EC may still proceed but with limits

- Private fee-based supply where pharmacy offers non-NHS pathway
- Same PGD-equivalent clinical governance expected for safe supply
- NHS PCS claim not made — patient pays `{{private_ec_fee}}`
- Cu-IUD signposting and safety-netting still required

---

## 7. MYTHS (Real Misconceptions Only)

**Count: 24**

| # | Misconception | Research correction (not publish prose) |
|---|---------------|----------------------------------------|
| 1 | Emergency contraception is the same as the abortion pill | EC prevents pregnancy; does not terminate existing pregnancy. Mifepristone/misoprostol for abortion is different medicine and pathway |
| 2 | EC works at any time after unprotected sex | Oral EC has finite windows (96h LNG, 120h UPA); Cu-IUD has 5-day/ovulation-based window. Later = less/no effectiveness |
| 3 | The morning-after pill always works | No method 100% effective; depends on timing, ovulation, BMI, interactions |
| 4 | EC will ruin my fertility | No evidence EC affects long-term fertility; repeated use does not cause infertility |
| 5 | I can get EC to keep at home just in case | PGD explicitly excludes advance supply requests |
| 6 | Pharmacy can fit an emergency coil | Pharmacy signposts/refers for Cu-IUD; cannot insert IUD under oral EC PGD |
| 7 | A&E is the right place for morning-after pill | Pharmacy, GP, or sexual health clinic — not A&E unless emergency symptoms |
| 8 | EC is always free at any pharmacy | Free under NHS PCS where pharmacy commissioned and patient eligible; private fee otherwise |
| 9 | Every pharmacy offers NHS emergency contraception | Pharmacy must be registered for PCS with authorised staff |
| 10 | Partner can collect EC on my behalf without me attending | Patient must be assessed individually; proxy supply inappropriate for PGD consultation |
| 11 | Buying online is safer and faster than pharmacy | Clinical assessment required for correct product/timing; online supply bypasses consultation |
| 12 | Two morning-after pills are better than one | Only double dose per PGD for BMI/weight or enzyme inducers — not routine |
| 13 | Levonelle and ellaOne are interchangeable | Different drugs, windows, contraindications, and interactions — pharmacist selects per assessment |
| 14 | I shouldn't take EC if I'm on the pill | Missed pill scenarios may require EC; assessment determines need — do not assume |
| 15 | EC protects for the rest of the cycle | No ongoing contraception; further UPSI carries pregnancy risk if ovulation occurs |
| 16 | If I vomit once it doesn't matter | Vomiting within 3 hours requires repeat dose |
| 17 | EC causes an abortion if I'm already pregnant | EC does not work if pregnancy implanted; no evidence of harm if unknowingly pregnant |
| 18 | Pharmacist will tell my parents if I'm under 16 | Fraser guidelines govern confidentiality for competent under-16s; safeguarding applies under 13 |
| 19 | Weight doesn't affect EC | BMI >26 or >70 kg may reduce oral EC effectiveness; Cu-IUD recommended |
| 20 | I can take UPA after taking Levonelle this week | UPA excluded if LNG/progestogen in previous 7 days; timing rules apply for same-cycle repeats |
| 21 | I should restart my pill immediately after any EC | After UPA: delay hormonal contraception 5 days; after LNG: restart immediately — different rules |
| 22 | EC is only for young people | Any person of childbearing potential from menarche may need EC |
| 23 | One EC per lifetime limit | Can be used more than once in a cycle and across cycles if clinically indicated — not regular contraception |
| 24 | GP doesn't need to know | GP may be notified for continuity where appropriate; confidentiality explained at consultation |

---

## 8. TRUST FACTORS

- GPhC-registered premises and regulated professionals
- PCS-trained pharmacist or pharmacy technician under PGD governance
- Private consultation room — confidential sensitive discussion
- Non-judgemental professional approach to sexual health
- All EC options discussed including most effective Cu-IUD referral
- Evidence-based product selection — not one-size-fits-all supply
- Clear time window and effectiveness honesty — manages expectations
- NHS commissioned free service where eligible (`{{nhs_service}}`)
- Transparent private fee before supply (`{{private_ec_fee}}`)
- Safeguarding-trained staff for under-16 presentations
- Safety-netting — pregnancy test advice, period changes, STI signposting
- Ongoing contraception signposting — PCS, GP, sexual health
- Same-day access when time-critical
- Extended hours vs GP surgery (`{{opening_hours}}`)
- Professional indemnity and clinical governance
- Documentation for patient records and continuity

---

## 9. LOCAL PHARMACY ADVANTAGES

- High street access — no hospital appointment for oral EC
- Same-day and walk-in availability where offered
- Extended evening/weekend hours (`{{opening_hours}}`)
- Faster access than GP appointment when time window closing
- Private consultation room (`{{consultation_room}}`)
- Phone triage for urgency (`{{phone}}`)
- Online booking (`{{booking_link}}`)
- Free NHS supply where PCS commissioned (`{{nhs_service}}`)
- Integrated signposting to PCS ongoing contraception at same pharmacy
- Pharmacist medicines expertise — interaction checking with regular medicines
- No GP referral required for self-referral NHS PCS pathway
- Local familiarity — repeat contraception and health services hub

**Caveats:** Not every pharmacy offers NHS PCS oral EC; Cu-IUD requires referral elsewhere; diagnosis of pregnancy or ectopic not done in standard EC consultation.

---

## 10. OWNER VARIABLES

| Variable | Purpose |
|----------|---------|
| `{{phone}}` | Urgent triage, booking enquiries, same-day availability |
| `{{opening_hours}}` | Time-critical access — evenings/weekends especially |
| `{{booking_link}}` | Online booking URL if offered |
| `{{consultation_room}}` | Private confidential consultation facility |
| `{{nhs_service}}` | NHS PCS oral EC active at this pharmacy (yes/no) |
| `{{private_ec_fee}}` | Private EC consultation + supply fee if NHS unavailable |

**Additional owner fields for Stage 2:** Cu-IUD referral partner details, walk-in policy, female pharmacist availability, languages, safeguarding lead contact, GP notification practice.

---

## 11. PATIENT EMOTIONS (Stage 1 Enhancement)

**Format:** Research notes only. Not publish copy.

### 11.1 Panic about timing

| Field | Research note |
|-------|---------------|
| **Trigger** | UPSI last night; clock counting to 72/120 hours; weekend/GP closed |
| **Patient concern** | "Am I too late? Every hour matters" |
| **Typical behaviour** | Rushed attendance; may not have eaten; anxious about queue; asks for pill immediately without consultation |
| **Common questions** | How long do I have? / Is 90 hours too late? / Can you just give me the pill? |

### 11.2 Embarrassment and shame

| Field | Research note |
|-------|---------------|
| **Trigger** | First time requesting EC; small community pharmacy; fear of staff recognition |
| **Patient concern** | Everyone will know; pharmacist will judge me |
| **Typical behaviour** | Whispers at counter; avoids eye contact; may leave if busy; prefers phone first |
| **Common questions** | Is it confidential? / Can I speak privately? / Will you tell my GP? |

### 11.3 Fear of pregnancy

| Field | Research note |
|-------|---------------|
| **Trigger** | Contraceptive failure; fertile window awareness; previous scare |
| **Patient concern** | "What if it doesn't work?" |
| **Typical behaviour** | Seeks reassurance repeatedly; asks about pregnancy test timing; may request both pill types |
| **Common questions** | How effective is it really? / When can I test? / What if my period is late? |

### 11.4 Confusion about EC vs abortion

| Field | Research note |
|-------|---------------|
| **Trigger** | Media conflation; misinformation online; religious/cultural background |
| **Patient concern** | EC is morally equivalent to abortion |
| **Typical behaviour** | Hesitates to ask; may use euphemisms; needs clear mechanism explanation |
| **Common questions** | Does it kill a baby? / Is this the abortion pill? / What if I'm already pregnant? |

### 11.5 Anxiety about fertility impact

| Field | Research note |
|-------|---------------|
| **Trigger** | Repeat EC use; friend warning; desire for future children |
| **Patient concern** | EC will damage ability to conceive later |
| **Typical behaviour** | Asks how many times is safe; may decline EC; seeks "natural" alternatives |
| **Common questions** | Will this affect my fertility? / How often can I take it? / Is it bad to use twice in one month? |

### 11.6 Distress after sexual assault

| Field | Research note |
|-------|---------------|
| **Trigger** | UPSI non-consensual; acute trauma |
| **Patient concern** | Judgment; forced disclosure; re-traumatisation by questions |
| **Typical behaviour** | Distressed presentation; may attend with friend; fragmented history |
| **Common questions** | Do I have to explain what happened? / Will you call the police? / Can someone stay with me? |

### 11.7 Worry about weight and effectiveness

| Field | Research note |
|-------|---------------|
| **Trigger** | Online articles about EC and BMI; previous EC "failure" story |
| **Patient concern** | Pill won't work because of body size |
| **Typical behaviour** | Pre-emptively states weight; asks for "stronger" option; Cu-IUD discussion important |
| **Common questions** | Does weight affect it? / Should I take two pills? / Is the coil my only option? |

### 11.8 Under-16 fear of parental involvement

| Field | Research note |
|-------|---------------|
| **Trigger** | Young person alone; school-age; parental insurance/GP link |
| **Patient concern** | Parents will be told; school will find out |
| **Typical behaviour** | Reluctance to give details; asks about confidentiality upfront; may abandon if unclear |
| **Common questions** | Do my parents need to know? / Can I come alone at 15? / Will it go on my medical record? |

### 11.9 Relief-seeking after supply

| Field | Research note |
|-------|---------------|
| **Trigger** | Pill supplied; immediate anxiety reduction |
| **Patient concern** | False certainty — "I'm safe now" |
| **Typical behaviour** | May dismiss aftercare advice; leaves quickly; ignores ongoing contraception |
| **Common questions** | So I'm definitely not pregnant? / Do I need to do anything else? / Can I have sex again? |

### 11.10 Regret and self-blame

| Field | Research note |
|-------|---------------|
| **Trigger** | Contraceptive mistake; intoxicated UPSI; relationship context |
| **Patient concern** | Personal failure; fear of pharmacist lecture |
| **Typical behaviour** | Over-explains circumstances; defensive; minimises risk |
| **Common questions** | Is it my fault? / Will you judge me? / I should have been more careful |

---

## 12. EC OPTIONS KNOWLEDGE (Stage 1 Enhancement)

**Format:** Evidence-based research notes. Not advice copywriting. Section maps levonorgestrel, ulipristal, Cu-IUD signposting, time windows, and effectiveness factors per PRN02207 PGDs and CoSRH guidance.

### 12.1 Levonorgestrel 1.5mg (LNG-EC)

| Field | Research note |
|-------|---------------|
| **Brand examples** | Levonelle, generic levonorgestrel 1.5mg |
| **Mechanism** | Progestogen — inhibits or delays ovulation; may affect tubal transport and endometrium |
| **Time window** | 0–96 hours after UPSI (PGD off-label extension to 96h; SPC often states 72h) |
| **Standard dose** | 1 × 1.5mg tablet single dose ASAP |
| **Altered dose** | 3mg (2 × 1.5mg) single dose if BMI >26 or weight >70 kg OR enzyme-inducing drugs (within 4 weeks of stopping). Efficacy of double dose unknown |
| **Effectiveness** | ~95% if <24h; declines with time. Less effective 72–96h than UPA. Ineffective post-ovulation |
| **Key exclusions** | Known pregnancy; UPA in last 5 days; >96h UPSI; advance supply; acute porphyria; postpartum/post-abortion windows |
| **Breastfeeding** | Take after feed; avoid nursing 8 hours |
| **Restart contraception** | Hormonal contraception restarted immediately; condoms until effective |
| **Repeat in cycle** | If prior LNG within 7 days → LNG again. If prior UPA within 5 days → UPA again (not LNG) |
| **Pharmacy role** | Supply under PGD where criteria met; discuss Cu-IUD alternative especially if high BMI or late presentation |

### 12.2 Ulipristal acetate 30mg (UPA-EC)

| Field | Research note |
|-------|---------------|
| **Brand example** | ellaOne |
| **Mechanism** | Selective progesterone receptor modulator — delays ovulation even closer to ovulation than LNG |
| **Time window** | 0–120 hours (5 days) after UPSI |
| **Standard dose** | 1 × 30mg tablet single dose ASAP |
| **Effectiveness** | More effective than LNG overall; particularly 72–120h and in pre-ovulatory phase. Ineffective post-ovulation |
| **Key exclusions** | LNG/progestogen in previous 7 days; enzyme inducers; antacids/PPI/H2 blockers; severe asthma on oral steroids; EE/LNG missed two pills week 1; known pregnancy; >120h; advance supply |
| **Progestogen interaction** | No progestogen (including COC) for 5 days after UPA — reduces UPA efficacy if taken concurrently after |
| **Breastfeeding** | No need to avoid breastfeeding (CoSRH/FSRH statement per PGD) |
| **Restart contraception** | Delay hormonal contraception 5 days; condoms/abstain until fully effective |
| **Missed pill scenarios** | Generally not recommended — use CoSRH Table 1; LNG often preferred |
| **Pharmacy role** | Supply when no progestogen in last 7 days and no UPA exclusions; preferred when 72–120h or near ovulation |

### 12.3 Copper IUD (Cu-IUD) — signposting and referral

| Field | Research note |
|-------|---------------|
| **Mechanism** | Copper toxic to sperm and egg; prevents fertilisation and implantation |
| **Time window** | ≤5 days after UPSI OR ≤5 days from earliest estimated date of ovulation |
| **Effectiveness** | >99% — most effective EC method |
| **Additional benefit** | Provides ongoing contraception (5–10+ years depending on device) |
| **Pharmacy role** | Cannot supply or fit — mandatory discussion that Cu-IUD is most effective; refer to sexual health/GP/gynaecology if acceptable |
| **When to emphasise** | BMI >26/weight >70 kg; enzyme inducers; oral EC contraindicated; patient preference; repeated EC; late presentation still within Cu-IUD window |
| **PGD action** | If appropriate and acceptable: supply oral EC if indicated AND refer for fitting without delay |
| **Referral urgency** | Time-critical — fitting window same as oral EC urgency |

### 12.4 Time windows — decision reference

| Hours since UPSI | LNG-EC (PGD) | UPA-EC (PGD) | Cu-IUD (signpost) |
|----------------|--------------|--------------|-------------------|
| 0–72 | Yes (standard) | Yes (preferred if no exclusions) | Yes — discuss |
| 72–96 | Yes (off-label per PGD) | Yes (preferred) | Yes — discuss |
| 96–120 | No | Yes | Yes if within ovulation window |
| >120 | No | No | Only if within 5 days of ovulation |

### 12.5 Effectiveness factors — clinical decision matrix

| Factor | Impact | Pharmacy action |
|--------|--------|-----------------|
| Time since UPSI | Later → lower oral EC efficacy | Prioritise same-day; UPA if >72h and eligible |
| Ovulation timing | Post-ovulation → oral EC ineffective | Cu-IUD if within window; pregnancy test if delayed period |
| BMI >26 / weight >70 kg | Reduced oral EC efficacy | Double LNG per PGD (unknown efficacy); strongly recommend Cu-IUD |
| Enzyme inducers | UPA excluded; LNG reduced efficacy | Double LNG or Cu-IUD referral |
| Vomiting <3 hours | Dose not absorbed | Repeat dose — separate episode |
| Prior EC this cycle | Product selection rules apply | LNG vs UPA sequencing per PGD |
| Progestogen in last 7 days | UPA excluded | LNG if otherwise eligible |
| UPA in last 5 days | LNG excluded | UPA only if within 5 days of prior UPA |
| Breastfeeding | Product-specific advice | LNG: 8h avoid nursing; UPA: continue breastfeeding |
| Malabsorption (IBD/Crohn's active) | Oral EC may be less effective | Cu-IUD recommended |

### 12.6 LNG vs UPA — comparison summary

| Feature | LNG-EC | UPA-EC |
|---------|--------|--------|
| Max window | 96 hours | 120 hours |
| Near ovulation | Less effective | More effective |
| After progestogen | Can use (unless UPA in 5 days) | Excluded if progestogen in 7 days |
| Enzyme inducers | Double dose (efficacy unknown) | Excluded |
| High BMI | Double dose (efficacy unknown) | Standard dose (efficacy may be reduced) |
| Restart COC/POP | Immediately | Delay 5 days |
| Breastfeeding | 8h nursing pause | No restriction |
| Missed pill EC | Often suitable per CoSRH table | Generally not recommended |

---

## 13. CLINICAL DECISION FRAMEWORK (Stage 1 Enhancement)

**Format:** Clinical reference for master content accuracy. Not patient-facing copy.

### 13.1 Within LNG window (0–96h), UPA eligible, no exclusions

| Field | Detail |
|-------|--------|
| **Presentation** | UPSI 0–96h; no progestogen in 7 days; no UPA exclusions |
| **Options** | LNG or UPA — UPA preferred if >72h or near ovulation |
| **Cu-IUD** | Discuss as most effective — refer if acceptable |
| **Pharmacy action** | Shared decision; supply selected product; full safety-netting |
| **Urgency** | **Same-day** — time critical |

### 13.2 Within UPA-only window (96–120h)

| Field | Detail |
|-------|--------|
| **Presentation** | UPSI 96–120h ago |
| **Options** | UPA-EC only (LNG excluded) if no UPA contraindications |
| **Cu-IUD** | Still discuss if within ovulation-based window |
| **Pharmacy action** | UPA supply or refer if UPA excluded |
| **Urgency** | **Same-day urgent** — window closing |

### 13.3 Outside oral EC window (>120h UPSI)

| Field | Detail |
|-------|--------|
| **Presentation** | >120h since UPSI |
| **Options** | Cu-IUD only if within 5 days of ovulation; otherwise pregnancy test and options counselling |
| **Pharmacy action** | Exclude oral EC; refer Cu-IUD if eligible; signpost GP/sexual health |
| **Urgency** | **Urgent referral** if Cu-IUD window open |

### 13.4 High BMI / weight >70 kg

| Field | Detail |
|-------|--------|
| **Presentation** | BMI >26 or weight >70 kg requesting oral EC |
| **Options** | Cu-IUD strongly recommended; if LNG chosen → 3mg double dose |
| **Effectiveness note** | Double dose efficacy unknown — document and counsel |
| **Pharmacy action** | Measure BMI; counsel; supply double LNG if declined Cu-IUD |
| **Urgency** | **Same-day** |

### 13.5 Enzyme-inducing medicines

| Field | Detail |
|-------|--------|
| **Presentation** | On enzyme inducer or stopped within 4 weeks |
| **Options** | UPA excluded; LNG 3mg double dose OR Cu-IUD |
| **Pharmacy action** | Medicine history critical; prefer Cu-IUD referral |
| **Urgency** | **Same-day** |

### 13.6 Known or suspected pregnancy

| Field | Detail |
|-------|--------|
| **Presentation** | Positive test or strong suspicion |
| **Options** | EC not indicated — pregnancy pathway |
| **Pharmacy action** | Exclude supply; signpost GP/sexual health/pregnancy advice |
| **Urgency** | **Routine to urgent** depending on symptoms |

### 13.7 Under-16 presentation

| Field | Detail |
|-------|--------|
| **Presentation** | Patient under 16 requesting EC |
| **Assessment** | Fraser guidelines capacity — document |
| **Under 13** | Safeguarding lead contact |
| **Pharmacy action** | Supply if competent; follow local policy if not |
| **Urgency** | **Same-day** — time critical with safeguarding overlay |

### 13.8 Vomiting after prior EC dose

| Field | Detail |
|-------|--------|
| **Presentation** | Vomiting within 3 hours of oral EC taken elsewhere |
| **Options** | Repeat same class per PGD repeat rules |
| **Pharmacy action** | Supply repeat as separate episode; document prior dose |
| **Urgency** | **Same-day urgent** |

---

## 14. PATIENT JOURNEY RESEARCH (Stage 1 Enhancement)

**Format:** Journey map for master content structure. Not publish copy.

### 14.1 Awareness

| Field | Research note |
|-------|---------------|
| **Patient goals** | Know EC exists; find local access; understand time limit |
| **Patient concerns** | Shame; don't know where to go; think only GP provides |
| **Information needs** | Pharmacy can supply; time windows; free NHS option |
| **Common misunderstandings** | A&E needed; online pill sufficient; any pharmacy has it |

### 14.2 Trigger (post-UPSI)

| Field | Research note |
|-------|---------------|
| **Patient goals** | Act immediately; minimise pregnancy risk |
| **Patient concerns** | Too late; pharmacy closed; cost |
| **Information needs** | How many hours left; walk-in vs appointment; opening hours |
| **Common misunderstandings** | Must wait 12 hours; must see GP first; 72h is hard limit for all products |

### 14.3 Contact and booking

| Field | Research note |
|-------|---------------|
| **Patient goals** | Fast appointment; discreet enquiry |
| **Patient concerns** | Overheard on phone; long wait; judgment |
| **Information needs** | Phone triage; private room; same-day slots |
| **Common misunderstandings** | Must book days ahead; partner can collect without patient |

### 14.4 Consultation

| Field | Research note |
|-------|---------------|
| **Patient goals** | Get pill quickly; understand if it will work |
| **Patient concerns** | Intrusive questions; weight discussion; GP notification |
| **Information needs** | What happens step-by-step; confidentiality; product choice |
| **Common misunderstandings** | No assessment needed; can choose any brand; coil available on site |

### 14.5 Supply and immediate aftercare

| Field | Research note |
|-------|---------------|
| **Patient goals** | Take pill; leave with clear instructions |
| **Patient concerns** | Side effects; vomiting; when to restart pill |
| **Information needs** | How to take; what if vomit; condoms; restart contraception rules |
| **Common misunderstandings** | Protected for rest of cycle; no follow-up needed |

### 14.6 Follow-up (days to weeks)

| Field | Research note |
|-------|---------------|
| **Patient goals** | Confirm not pregnant; period returns to normal |
| **Patient concerns** | Late period; ectopic symptoms; EC failure |
| **Information needs** | Pregnancy test at 3 weeks; when to worry; GP if abnormal bleeding |
| **Common misunderstandings** | Test next day; late period always means pregnancy |

### 14.7 Ongoing contraception

| Field | Research note |
|-------|---------------|
| **Patient goals** | Avoid repeat EC; reliable contraception |
| **Patient concerns** | Cost; GP wait; starting method after UPA delay |
| **Information needs** | PCS at pharmacy; GP; sexual health; LARC options |
| **Common misunderstandings** | EC replaces regular contraception; can't start pill for 5 days after any EC |

---

## 15. CONTENT OPPORTUNITY RESEARCH (Stage 1 Enhancement)

**Format:** Ranked opportunities for future master content. Not content itself.

### 15.1 Strongest patient questions — ranked

| Rank | Question theme | Priority | Rationale |
|------|----------------|----------|-----------|
| 1 | How soon / am I too late? | **HIGH** | Primary anxiety driver; time-critical service |
| 2 | Is emergency contraception free at this pharmacy? | **HIGH** | Access barrier; NHS vs private |
| 3 | What's the difference between the pills / which is better? | **HIGH** | Core clinical decision — Section 12 |
| 4 | Is EC the same as abortion pill? | **HIGH** | Major myth; moral blocker |
| 5 | Can pharmacy supply EC / do I need GP? | **HIGH** | Service awareness |
| 6 | Confidentiality / will parents know (under 16) | **HIGH** | Access barrier for young people |
| 7 | Does weight affect effectiveness? | **HIGH** | Growing awareness; Cu-IUD link |
| 8 | When should I take pregnancy test? | **HIGH** | Safety-netting compliance |
| 9 | Walk-in or appointment? | **HIGH** | Owner variable — practical access |
| 10 | Can pharmacy fit emergency coil? | **MEDIUM** | Scope boundary; signposting |
| 11 | Side effects and period changes | **MEDIUM** | Aftercare expectation |
| 12 | Restarting contraceptive pill after EC | **MEDIUM** | UPA 5-day rule confusion |
| 13 | Can I get EC in advance? | **MEDIUM** | PGD exclusion — ongoing contraception redirect |
| 14 | Breastfeeding safety | **MEDIUM** | Product-specific |
| 15 | STI testing need | **LOW** | Signpost — not primary intent |

### 15.2 Strongest myths — ranked

| Rank | Myth | Priority | Rationale |
|------|------|----------|-----------|
| 1 | EC = abortion pill | **HIGH** | Fundamental mechanism misunderstanding |
| 2 | Works anytime / always works | **HIGH** | Effectiveness expectations |
| 3 | Ruins fertility | **HIGH** | Avoidance behaviour |
| 4 | Can keep at home just in case | **HIGH** | PGD exclusion |
| 5 | Pharmacy fits emergency coil | **HIGH** | Scope accuracy |
| 6 | Always free at any pharmacy | **HIGH** | Commissioning accuracy |
| 7 | Partner can collect without patient | **MEDIUM** | Governance |
| 8 | Online faster/safer than pharmacy | **MEDIUM** | Clinical assessment value |
| 9 | One per lifetime | **MEDIUM** | Repeat use stigma |
| 10 | Restart pill same rules for all EC | **MEDIUM** | UPA vs LNG difference |

### 15.3 Strongest concerns — ranked

| Rank | Concern | Priority | Rationale |
|------|---------|----------|-----------|
| 1 | Too late / timing panic | **HIGH** | Core service driver |
| 2 | Embarrassment / judgment | **HIGH** | Access barrier |
| 3 | Confidentiality (parents/GP) | **HIGH** | Trust |
| 4 | Effectiveness anxiety | **HIGH** | Cu-IUD and BMI messaging |
| 5 | EC vs abortion confusion | **HIGH** | Moral/emotional blocker |
| 6 | NHS vs private cost | **HIGH** | Owner variable |
| 7 | Weight/BMI effectiveness | **MEDIUM** | Clinical counselling |
| 8 | Future fertility fear | **MEDIUM** | Myth correction |
| 9 | Which product is right | **MEDIUM** | Shared decision |
| 10 | Period late = pregnant | **MEDIUM** | Safety-netting |

### 15.4 Strongest trust factors — ranked

| Rank | Trust factor | Priority | Rationale |
|------|--------------|----------|-----------|
| 1 | Confidential private consultation | **HIGH** | Sensitive service |
| 2 | Non-judgemental professional care | **HIGH** | Embarrassment barrier |
| 3 | Honest effectiveness and timing advice | **HIGH** | Clinical credibility |
| 4 | All options including Cu-IUD discussed | **HIGH** | Patient-centred |
| 5 | NHS free where commissioned | **HIGH** | Access |
| 6 | Same-day urgent access | **HIGH** | Time-critical |
| 7 | Clear aftercare and pregnancy test advice | **MEDIUM** | Safety-netting |
| 8 | Ongoing contraception signposting | **MEDIUM** | Holistic care |
| 9 | GPhC-registered trained staff | **MEDIUM** | Professional trust |
| 10 | Transparent private fee | **MEDIUM** | Cost trust |

---

## 16. KNOWLEDGE GAPS — REVIEW AND RECOMMENDATIONS (Stage 1 Enhancement)

### 16.1 Gaps addressed in v1

| Gap | Status in v1 |
|-----|--------------|
| EC product comparison underdeveloped | **Addressed** — Section 12 (LNG, UPA, Cu-IUD, windows, effectiveness factors) |
| PCS Oct 2025 expansion not documented | **Addressed** — Section 1.2, 5, 12 |
| PGD contraindications incomplete | **Addressed** — Sections 5.5, 6, 12 |
| Patient emotional drivers | **Addressed** — Section 11 (10 emotions) |
| Clinical decision framework | **Addressed** — Section 13 (8 bands) |
| Patient journey | **Addressed** — Section 14 (7 stages) |
| Content priorities | **Addressed** — Section 15 (ranked) |

### 16.2 Remaining missing clinical information

| Gap | Recommendation |
|-----|----------------|
| Devolved nations pathways (Scotland/Wales/NI) | Document England-only in Master V1; flag UK owners for local appendix |
| Detailed CoSRH Table 1 missed-pill scenarios | Master should reference pharmacist assessment — not reproduce full table |
| Local Cu-IUD referral provider names | Owner variable at publish — `{{cu_iud_referral}}` optional Stage 2 |
| Pregnancy options counselling beyond EC scope | Signpost to BPAS/MSI/NHS sexual health — not pharmacy role |
| Independent prescriber private pathways outside PGD | Owner-dependent — generic private variant sufficient |

### 16.3 Remaining missing patient concerns

| Gap | Recommendation |
|-----|----------------|
| Cultural/religious barriers to EC | Sensitive master tone guidance — not clinical scope |
| Language/accessibility | Owner variable — `{{languages}}` at publish |
| Trans and non-binary patients | Reasonable adjustments — brief inclusive language in master |
| Post-coercion trafficking indicators | Safeguarding — staff training scope; not patient-facing detail |

### 16.4 Remaining missing trust factors

| Gap | Recommendation |
|-----|----------------|
| Named pharmacist credentials | Owner variable at publish |
| Local sexual health clinic partnerships | Owner confirmation |
| Patient reviews/testimonials | Publish-stage owner content |

### 16.5 Remaining missing pathway information

| Gap | Recommendation |
|-----|----------------|
| Owner PCS sign-up status | Required before publish — `{{nhs_service}}` |
| Private fee | Owner variable — `{{private_ec_fee}}` |
| Cu-IUD referral pathway locally | Owner variable Stage 2 |
| GP notification practice | Local policy — generic "may inform GP" sufficient |

### 16.6 Recommendations before Master V1

1. **Human clinical sign-off** on Sections 5, 6, 12, 13 (PGD thresholds, product selection, red flags)
2. **Confirm England-only scope** for NHS PCS claims in master
3. **Owner variables** remain placeholders until pharmacy onboarding
4. **Use Section 15 HIGH-priority items** to drive master emphasis
5. **Use Section 11 emotions** for tone guidance — not publish prose
6. **Use Section 14 journey** to structure patient-facing flow

---

## RESEARCH COMPLETENESS SCORE (V1)

| Area | Weight | Score (0–10) | Notes |
|------|--------|--------------|-------|
| 1. Service definition | 8% | 9 | PCS Oct 2025 + PGD mapped; private variant generic |
| 2. Patient intent | 7% | 9 | Emotions and triggers covered |
| 3. Patient questions (50+) | 10% | 10 | 62 questions |
| 4. Patient concerns (20+) | 7% | 10 | 24 concerns + ranked |
| 5. Clinical facts | 12% | 9 | PRN02207 + CoSRH; pending sign-off |
| 6. Red flags | 10% | 9 | Ectopic, safeguarding, window expiry |
| 7. Myths (20+) | 7% | 10 | 24 myths + ranked |
| 8. Trust factors | 5% | 9 | Ranked opportunities added |
| 9. Local advantages | 4% | 8 | Owner-dependent |
| 10. Owner variables | 4% | 9 | Six core variables defined |
| 11. Patient emotions | 10% | 9 | 10 emotions mapped |
| 12. EC options knowledge | 8% | 10 | LNG, UPA, Cu-IUD, windows, effectiveness |
| 13. Clinical decision framework | 8% | 9 | 8 decision bands |
| 14. Patient journey | 5% | 9 | 7 stages mapped |
| 15. Content opportunities | 5% | 9 | Ranked HIGH/MEDIUM/LOW |

**Weighted completeness score: 9.2 / 10**

---

## REMAINING KNOWLEDGE GAPS (Summary)

1. Devolved nations pathways — England-only recommended for Master V1
2. Owner confirmation — PCS participation, private fee, Cu-IUD referral partner
3. Human clinical sign-off — not yet recorded
4. Detailed missed-pill algorithm — CoSRH Table 1 referenced not reproduced
5. Local sexual health integration specifics — owner/onboarding
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
| EC options knowledge (Section 12) | 10 | 10 | Complete |
| Clinical decision framework | 9 | 10 | Section 13 complete |
| Journey mapping | 9 | 10 | Section 14 complete |
| Content priority guidance | 9 | 10 | Section 15 complete |
| Owner variables identified | 9 | 10 | Six placeholders defined |
| Human clinical review | 0 | 10 | Not yet recorded |
| Publish scope decision (England) | 7 | 10 | Recommended not yet formalised |

**Readiness score: 8.1 / 10**

---

## RECOMMENDATION

### **READY FOR MASTER V1**

**Conditions:**

1. Master V1 author uses this document as sole research source
2. Clinical reviewer signs off Sections 5, 6, 12, and 13 before QA checklist
3. Master treats owner variables as placeholders (same pattern as blood-pressure-checks V1.1)
4. Master scope: England NHS PCS oral EC + generic private EC variant
5. Section 15 HIGH-priority items drive master emphasis; LOW-priority items may be brief or omitted
6. Cu-IUD always framed as signpost/refer — never pharmacy supply claim

**Research foundation is comprehensive enough that Master V1 can be written without additional factual research**, provided the conditions above are met during drafting and review.

**Do not create:** publish content, service pages, variations, area pages, hub pages, or HTML as part of this research task.

---

## Document Control

| Version | Date | Change |
|---------|------|--------|
| v1.0 | 2026-06-22 | Initial Stage 1 research foundation — sections 1–16 |

**Next step:** Clinical sign-off → `emergency-contraception-master-v1.md` (Stage 2)
