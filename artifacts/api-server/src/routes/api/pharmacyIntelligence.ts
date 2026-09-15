import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { normalizeProfileData } from "../../../../../src/pharmacy/pharmacyProfileSchema.ts";

const router = Router();

const ROOT = process.env.WORKSPACE_ROOT ?? "/home/inboxingproweb/pharmaconnect-growth-engine";
const PROFILE_DIR = path.join(ROOT, "data", "pharmacy-profiles");
const INTEL_DIR = path.join(ROOT, "data", "pharmacy-intelligence");
const SERVICE_LIBRARY = path.join(ROOT, "config", "pharmacy", "service-library.json");

function safeSlug(v: string) {
  return String(v || "pharmaconnect")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "pharmaconnect";
}

function readJson(file: string) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

router.post("/pharmacy/intelligence/:slug/generate", (req, res) => {
  fs.mkdirSync(INTEL_DIR, { recursive: true });

  const slug = safeSlug(req.params.slug);
  const profileFile = path.join(PROFILE_DIR, `${slug}.json`);

  if (!fs.existsSync(profileFile)) {
    return res.status(404).json({ ok: false, error: "Saved pharmacy profile not found" });
  }

  const profile = readJson(profileFile);
  const profileData = normalizeProfileData(profile.data || {});
  const library = fs.existsSync(SERVICE_LIBRARY) ? readJson(SERVICE_LIBRARY) : { serviceGroups: [] };

  const selected = new Set(profileData.selectedServices || []);
  const selectedServices: any[] = [];

  for (const group of library.serviceGroups || []) {
    for (const service of group.services || []) {
      if (selected.has(service.id)) {
        selectedServices.push({
          ...service,
          groupId: group.id,
          groupLabel: group.label
        });
      }
    }
  }

  const intelligence = {
    slug,
    generatedAt: new Date().toISOString(),
    pharmacy: {
      name: profileData.pharmacyName || "",
      website: profileData.website || "",
      phone: profileData.phone || "",
      email: profileData.email || profileData.businessEmail || "",
      businessEmail: profileData.businessEmail || "",
      nhsEmail: profileData.nhsEmail || "",
      bookingUrl: profileData.bookingUrl || "",
      bookingMethod: profileData.bookingMethod || "",
      ownershipType: profileData.ownershipType || "",
      gphcNumber: profileData.gphcNumber || "",
      gphcPremisesUrl: profileData.gphcPremisesUrl || "",
      nhsProfileUrl: profileData.nhsProfileUrl || "",
      superintendentName: profileData.superintendentName || profileData.superintendentPharmacistName || "",
      superintendentPharmacistName: profileData.superintendentPharmacistName || "",
      pharmacyOwnerName: profileData.pharmacyOwnerName || "",
      companyName: profileData.companyName || "",
      independentPharmacy: profileData.independentPharmacy || false,
      homeDeliveryAvailable: profileData.homeDeliveryAvailable || false,
      languagesSpoken: profileData.languagesSpoken || [],
    },
    location: {
      addressLine1: profileData.addressLine1 || "",
      addressLine2: profileData.addressLine2 || "",
      townCity: profileData.townCity || "",
      county: profileData.county || "",
      postcode: profileData.postcode || "",
      localAuthority: profileData.localAuthority || "",
      icb: profileData.icb || "",
      nhsRegion: profileData.nhsRegion || "",
      coverageRadius: profileData.coverageRadius || "",
      nearbyAreas: profileData.nearbyAreas || [],
      rankingAreas: profileData.rankingAreas || [],
      localGpSurgeries: profileData.localGpSurgeries || [],
      careHomesServed: profileData.careHomesServed || []
    },
    services: {
      selectedServiceCount: selectedServices.length,
      selectedServices,
      priorityServices: profileData.priorityServices || [],
      serviceContentAngles: selectedServices.flatMap(s => s.contentAngles || []),
      serviceFaqs: selectedServices.flatMap(s => (s.faqs || []).map((q: string) => ({
        serviceId: s.id,
        serviceLabel: s.label,
        question: q
      }))),
      serviceKeywords: selectedServices.flatMap(s => (s.keywords || []).map((k: string) => ({
        serviceId: s.id,
        serviceLabel: s.label,
        keyword: k
      })))
    },
    growthSeo: {
      primaryGrowthGoal: profileData.primaryGrowthGoal || "",
      targetPatientGroups: profileData.targetPatientGroups || [],
      mainCompetitors: profileData.mainCompetitors || [],
      rankingAreas: profileData.rankingAreas || [],
      rankingKeywords: profileData.rankingKeywords || [],
      currentMarketingChallenges: profileData.currentMarketingChallenges || [],
      preferredCta: profileData.preferredCta || ""
    },
    contentIntelligence: {
      tone: profileData.tone || "",
      uniqueSellingPoints: profileData.uniqueSellingPoints || [],
      patientQuestions: profileData.patientQuestions || [],
      authoritySignals: [
        profileData.yearsServingCommunity ? `${profileData.yearsServingCommunity} years serving the community` : "",
        profileData.gphcNumber ? `GPhC registered pharmacy: ${profileData.gphcNumber}` : "",
        profileData.gphcPremisesUrl ? `GPhC premises register: ${profileData.gphcPremisesUrl}` : "",
        profileData.nhsProfileUrl ? `NHS profile: ${profileData.nhsProfileUrl}` : "",
        profileData.independentPharmacy ? "Independent community pharmacy" : "",
        profileData.consultationRoomAvailable ? "Private consultation room available" : "",
        profileData.homeDeliveryAvailable ? "Home delivery available" : "",
        ...(profileData.accreditations || []),
        profileData.localAuthority ? `Serving patients in ${profileData.localAuthority}` : "",
        profileData.icb ? `Located within ${profileData.icb}` : ""
      ].filter(Boolean)
    },
    nextContentAssets: {
      recommendedServicePages: selectedServices.map(s => ({
        serviceId: s.id,
        title: `${s.label} in ${profileData.townCity || "your area"}`,
        primaryKeyword: (s.keywords || [])[0] || s.label
      })),
      recommendedLocalPages: (profileData.nearbyAreas || []).map((area: string) => ({
        area,
        title: `Pharmacy services near ${area}`,
        primaryKeyword: `pharmacy near ${area}`
      }))
    }
  };

  const outFile = path.join(INTEL_DIR, `${slug}.json`);
  fs.writeFileSync(outFile, JSON.stringify(intelligence, null, 2));

  res.json({ ok: true, generated: true, intelligence });
});

router.get("/pharmacy/intelligence/:slug", (req, res) => {
  const slug = safeSlug(req.params.slug);
  const file = path.join(INTEL_DIR, `${slug}.json`);

  if (!fs.existsSync(file)) {
    return res.json({ ok: true, exists: false, intelligence: null });
  }

  res.json({ ok: true, exists: true, intelligence: readJson(file) });
});

export default router;
