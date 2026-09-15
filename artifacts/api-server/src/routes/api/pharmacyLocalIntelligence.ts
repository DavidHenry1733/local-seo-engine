import { Router } from "express";
import fs from "node:fs";
import path from "node:path";

import {
  countGroupTotals,
  generateProfileLocalIntelligence,
} from "../../../../../src/pharmacy/pharmacyProfileLocalIntelligenceSelection.ts";

const router = Router();

const ROOT = process.env.WORKSPACE_ROOT ?? "/home/inboxingproweb/pharmaconnect-growth-engine";
const DIR = path.join(ROOT, "data", "pharmacy-local-intelligence");

function safeSlug(v: string) {
  return String(v || "pharmaconnect")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "pharmaconnect";
}

function radiusToMeters(v: any) {
  const n = parseInt(String(v || "5").replace(/[^0-9]/g, ""), 10);
  return Math.max(1000, Math.min((Number.isFinite(n) ? n : 5) * 1609, 8045));
}

function unique(items: string[]) {
  return Array.from(new Set(items.map(x => String(x || "").trim()).filter(Boolean))).slice(0, 40);
}

async function lookupPostcode(postcode: string) {
  const pc = encodeURIComponent(String(postcode || "").trim());
  if (!pc) return null;

  const res = await fetch(`https://api.postcodes.io/postcodes/${pc}`);
  if (!res.ok) return null;

  const json: any = await res.json();
  return json.result || null;
}


function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Local research timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function fallbackLocalIntel(town: string) {
  const baseTown = town || "the local area";

  return {
    localAreas: [
      `${baseTown} town centre`,
      "Nearby residential areas",
      "Surrounding villages",
      "Local neighbourhoods",
      "Main shopping areas",
      "Nearby estates"
    ],
    localLandmarks: [
      `${baseTown} town centre`,
      "Local parks",
      "Shopping areas",
      "Community facilities",
      "Main transport routes"
    ],
    localHealthcareLocations: [
      "Local GP surgeries",
      "Local health centres",
      "Nearby hospitals",
      "Care homes",
      "Community healthcare services"
    ],
    localGps: [
      "Local GP surgeries",
      "Nearby health centres"
    ],
    localHospitals: [
      "Nearby hospitals",
      "Urgent care services"
    ],
    localDentists: [
      "Local dental practices"
    ],
    localPharmacies: [
      "Nearby pharmacies"
    ],
    localCommunityLocations: [
      "Schools",
      "Community centres",
      "Retail areas",
      "Housing developments",
      "Retirement communities"
    ],
    localSchools: [
      "Local schools",
      "Nearby colleges"
    ],
    localCareHomes: [
      "Local care homes",
      "Residential care settings"
    ],
    localEmployers: [
      "Local employers",
      "Business parks",
      "Industrial estates",
      "Retail employers"
    ],
    localRetailCentres: [
      "Shopping areas",
      "Retail parks",
      "Supermarkets"
    ],
    localResidentialAreas: [
      "Residential neighbourhoods",
      "Housing estates",
      "Retirement communities"
    ]
  };
}

async function overpass(lat: number, lon: number, radius: number) {
  const query = `[out:json][timeout:18];
(
  node(around:${radius},${lat},${lon})["place"~"suburb|village|neighbourhood|town|hamlet"];
  node(around:${radius},${lat},${lon})["amenity"~"hospital|clinic|doctors|dentist|pharmacy|school|college|university|community_centre|library|place_of_worship|care_home|nursing_home"];
  node(around:${radius},${lat},${lon})["healthcare"];
  node(around:${radius},${lat},${lon})["tourism"~"attraction|museum"];
  node(around:${radius},${lat},${lon})["leisure"~"park|sports_centre|fitness_centre|stadium"];
  node(around:${radius},${lat},${lon})["shop"~"mall|supermarket"];
  node(around:${radius},${lat},${lon})["office"];
  node(around:${radius},${lat},${lon})["industrial"];
  node(around:${radius},${lat},${lon})["landuse"~"industrial|retail|residential"];
);
out tags 120;`;

  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];

  let lastError = "";

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "User-Agent": "PharmaConnectGrowthEngine/1.0 support@pharmaconnect.uk"
        },
        body: new URLSearchParams({ data: query }).toString()
      });

      if (!res.ok) {
        const text = await res.text();
        lastError = `HTTP ${res.status}: ${text.slice(0, 120)}`;
        continue;
      }

      return await res.json() as any;
    } catch (err: any) {
      lastError = err?.message || "Overpass request failed";
    }
  }

  throw new Error(`Overpass failed: ${lastError}`);
}

function classify(elements: any[]) {
  const areas: string[] = [];
  const landmarks: string[] = [];
  const healthcare: string[] = [];
  const gps: string[] = [];
  const hospitals: string[] = [];
  const dentists: string[] = [];
  const pharmacies: string[] = [];
  const community: string[] = [];
  const schools: string[] = [];
  const careHomes: string[] = [];
  const employers: string[] = [];
  const retail: string[] = [];
  const residential: string[] = [];

  for (const el of elements || []) {
    const t = el.tags || {};
    const name = t.name;
    if (!name) continue;

    if (t.place) areas.push(name);

    if (
      t.tourism ||
      t.historic ||
      ["park", "sports_centre", "fitness_centre", "stadium"].includes(t.leisure) ||
      ["mall", "supermarket"].includes(t.shop)
    ) {
      landmarks.push(name);
    }

    if (["hospital"].includes(t.amenity) || t.healthcare === "hospital") {
      hospitals.push(name);
      healthcare.push(name);
    }

    if (["clinic", "doctors"].includes(t.amenity) || ["clinic", "doctor"].includes(t.healthcare)) {
      gps.push(name);
      healthcare.push(name);
    }

    if (t.amenity === "dentist" || t.healthcare === "dentist") {
      dentists.push(name);
      healthcare.push(name);
    }

    if (t.amenity === "pharmacy" || t.healthcare === "pharmacy") {
      pharmacies.push(name);
      healthcare.push(name);
    }

    if (["care_home", "nursing_home"].includes(t.amenity) || ["care_home"].includes(t.healthcare)) {
      careHomes.push(name);
      healthcare.push(name);
    }

    if (["school", "college", "university"].includes(t.amenity)) {
      schools.push(name);
      community.push(name);
    }

    if (["community_centre", "library", "place_of_worship"].includes(t.amenity)) {
      community.push(name);
    }

    if (t.office || t.industrial || t.landuse === "industrial") {
      employers.push(name);
    }

    if (["mall", "supermarket"].includes(t.shop) || t.landuse === "retail") {
      retail.push(name);
    }

    if (t.landuse === "residential") {
      residential.push(name);
    }
  }

  return {
    localAreas: unique(areas),
    localLandmarks: unique(landmarks),
    localHealthcareLocations: unique(healthcare),
    localGps: unique(gps),
    localHospitals: unique(hospitals),
    localDentists: unique(dentists),
    localPharmacies: unique(pharmacies),
    localCommunityLocations: unique(community),
    localSchools: unique(schools),
    localCareHomes: unique(careHomes),
    localEmployers: unique(employers),
    localRetailCentres: unique(retail),
    localResidentialAreas: unique(residential)
  };
}

router.post("/pharmacy/local-intelligence/:slug/build", async (req, res) => {
  fs.mkdirSync(DIR, { recursive: true });

  const slug = safeSlug(req.params.slug);
  const body = req.body || {};

  const postcode = String(body.postcode || "").trim();
  const radiusMeters = radiusToMeters(body.coverageRadius || "5 miles");

  try {
    const pc = await lookupPostcode(postcode);

    if (!pc?.latitude || !pc?.longitude) {
      return res.status(400).json({
        ok: false,
        error: "Valid postcode is required before building local intelligence"
      });
    }

    let classified;
    let researchStatus = "live";

    try {
      const raw = await withTimeout(overpass(pc.latitude, pc.longitude, radiusMeters), 12000);
      classified = classify(raw.elements || []);

      const total =
        (classified.localAreas || []).length +
        (classified.localLandmarks || []).length +
        (classified.localHealthcareLocations || []).length +
        (classified.localCommunityLocations || []).length;

      if (total < 5) {
        researchStatus = "fallback-low-results";
        classified = fallbackLocalIntel(body.townCity || pc.admin_district || "");
      }
    } catch (_err) {
      researchStatus = "fallback-timeout";
      classified = fallbackLocalIntel(body.townCity || pc.admin_district || "");
    }

    const data = {
      slug,
      generatedAt: new Date().toISOString(),
      source: "postcodes.io + openstreetmap-overpass",
      researchStatus,
      postcode: pc.postcode || postcode,
      town: body.townCity || pc.admin_district || "",
      radius: body.coverageRadius || "5 miles",
      radiusMeters,
      latitude: pc.latitude,
      longitude: pc.longitude,
      localAuthority: body.localAuthority || pc.admin_district || "",
      icb: body.icb || pc.ccg || "",
      nhsRegion: body.nhsRegion || pc.nhs_ha || "",
      ...classified
    };

    fs.writeFileSync(path.join(DIR, `${slug}.json`), JSON.stringify(data, null, 2));

    res.json({ ok: true, generated: true, localIntelligence: data });
  } catch (err: any) {
    res.status(500).json({
      ok: false,
      error: err?.message || "Local intelligence build failed"
    });
  }
});

router.get("/pharmacy/local-intelligence/:slug", (req, res) => {
  const slug = safeSlug(req.params.slug);
  const file = path.join(DIR, `${slug}.json`);

  if (!fs.existsSync(file)) {
    return res.json({ ok: true, exists: false, localIntelligence: null });
  }

  res.json({
    ok: true,
    exists: true,
    localIntelligence: JSON.parse(fs.readFileSync(file, "utf8")),
  });
});

async function handleGenerateLocalIntelligence(
  slug: string,
  body: Record<string, unknown>,
  res: import("express").Response,
) {
  fs.mkdirSync(DIR, { recursive: true });

  const postcode = String(body.postcode || "").trim();
  let latitude = body.latitude != null && body.latitude !== "" ? Number(body.latitude) : null;
  let longitude = body.longitude != null && body.longitude !== "" ? Number(body.longitude) : null;

  if ((!latitude || !longitude) && postcode) {
    const pc = await lookupPostcode(postcode);
    if (pc?.latitude && pc?.longitude) {
      latitude = pc.latitude;
      longitude = pc.longitude;
    }
  }

  const demoMode = Boolean(body.demoMode);
  const generated = await generateProfileLocalIntelligence({
    slug,
    address: String(body.address || body.addressLine1 || ""),
    postcode,
    townCity: String(body.townCity || ""),
    latitude: latitude ?? undefined,
    longitude: longitude ?? undefined,
    demoMode,
  });

  const payload = {
    slug,
    generatedAt: generated.generatedAt,
    source: generated.source,
    researchStatus: generated.researchStatus,
    town: generated.town,
    postcode: generated.postcode,
    latitude: generated.latitude,
    longitude: generated.longitude,
    totals: generated.totals,
    ...generated.groups,
  };

  fs.writeFileSync(path.join(DIR, `${slug}.json`), JSON.stringify(payload, null, 2));

  res.json({
    ok: true,
    generated: true,
    localIntelligence: payload,
    groups: generated.groups,
    totals: countGroupTotals(generated.groups),
  });
}

router.post("/pharmacy-local-intelligence/:slug/generate", async (req, res) => {
  try {
    await handleGenerateLocalIntelligence(safeSlug(req.params.slug), req.body || {}, res);
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Local intelligence generation failed" });
  }
});

router.post("/pharmacy/local-intelligence/:slug/generate", async (req, res) => {
  try {
    await handleGenerateLocalIntelligence(safeSlug(req.params.slug), req.body || {}, res);
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Local intelligence generation failed" });
  }
});

export default router;
