# PharmaConnect Demo Login

Operator guide for the Brook Pharmacy validation workflow on the PharmaConnect platform.

## Login

| Field | Value |
| --- | --- |
| **Login URL** | `http://127.0.0.1:3001/api/login` |
| **Username** | `admin` |
| **Password** | `<set in config/users.json — contact platform administrator>` |

After login, dashboards under `/api/*` remain authenticated for the browser session.

## Demo workflow order

Follow this sequence for the Blood Pressure Checks validation campaign:

1. **Profile Dashboard** — `/api/pharmacy-profile-dashboard?slug=pharmaconnect`  
   Confirm Brook Pharmacy trust data, logo, and professional reviewer fields.

2. **Campaign OS** — `/api/pharmacy-campaigns?slug=pharmaconnect`  
   Open **Blood Pressure Checks — Increase Visibility** (`2e5cf653-7df3-4918-96f8-c99d687b764b`).

3. **Image Library** — `/api/pharmacy-image-library?slug=pharmaconnect`  
   Verify four slots assigned for blood-pressure-checks (hero, support, trust, conversion).

4. **Enhancement Workspace** — `/api/pharmacy-enhancement-workspace?slug=pharmaconnect&service=blood-pressure-checks`  
   Complete real enhancement actions (reviewer, review dates, images, canonical, noindex).

5. **Publishing Settings** — `/api/pharmacy-publishing-settings?slug=pharmaconnect&service=blood-pressure-checks`  
   Confirm canonical URL and `noindex: false`.

6. **Visual page preview** — `/api/pharmacy-visual-experience/blood-pressure-checks/?slug=pharmaconnect`  
   Check header/footer logo, single support image, and Brook localisation.

7. **Launch Queue** — `/api/pharmacy-campaign-launch-queue?slug=pharmaconnect`  
   Review authority sign-off tasks before live publish.

## Validation command

From the project root:

```bash
pnpm pharmacy:platform:workflow:validate
```

Success criteria for the stabilisation sprint:

- Publish Gate **PASS**
- Authority score **95+** for blood-pressure-checks
- One active campaign per benchmark service
- No duplicate support images on the visual page
- No `undefined` in image alt text
- Brook Pharmacy logo visible on profile, Campaign OS, and visual pages

## Benchmark services

The platform tracks four benchmark services:

- pharmacy-first
- blood-pressure-checks
- travel-vaccinations
- emergency-contraception

Keep one active campaign per service in Campaign OS for a clean portfolio view.
