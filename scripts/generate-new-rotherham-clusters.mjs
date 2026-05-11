/**
 * generate-new-rotherham-clusters.mjs
 *
 * Uses the running rollout API to generate 6 new cluster pages.
 *
 * Strategy:
 *   1. Back up existing selected-area-defs.json
 *   2. Write ONLY the 6 new defs to it (so rollout only processes new pages)
 *   3. Call POST /api/rollout and stream SSE until complete
 *   4. Fix canonical/schema domain to local subdomain on new pages
 *   5. Inject money page links into CTA section on new pages
 *   6. Restore full defs (original 5 + new 6)
 *
 * Run: node scripts/generate-new-rotherham-clusters.mjs
 */

import fs   from "node:fs";
import http from "node:http";

const SLUG        = "rotherham-proof";
const LOCAL_DOMAIN= "https://local.inboxingproweb.com";
const MONEY_URL   = "https://inboxingproweb.com/web-design-3/";
const HUB_URL     = `${LOCAL_DOMAIN}/web-design-rotherham/`;
const HUB_ANCHOR  = "Web Design Rotherham";
const DEFS_FILE   = `output/${SLUG}/selected-area-defs.json`;

// ── 6 new area defs ───────────────────────────────────────────────────────────

const NEW_DEFS = [
  {
    area: "Rawmarsh",
    city: "Rotherham",
    service: "Web Design",
    tier: "priority",
    primaryKeyword: "Web Design Rawmarsh",
    supportingKeywords: [
      "website design Rawmarsh",
      "local web design Rawmarsh",
      "professional web design Rawmarsh",
    ],
    hubUrl: HUB_URL,
    hubAnchor: HUB_ANCHOR,
    relatedPages: "Web Design Rotherham, Web Design Parkgate, Web Design Bramley",
    remotePath: "/web-design-rawmarsh/",
    configPath: `config/clusters/${SLUG}-web-design-rawmarsh.json`,
    signals: {
      area: "Rawmarsh",
      postcode: "S62",
      city: "Rotherham",
      character: "busy urban area immediately north of Rotherham town centre",
      knownFor: "retail, trades and businesses serving a broad local customer base",
      businessType: "high-street, trade and service-led businesses",
      landmarks: ["Rawmarsh High Street", "Rawmarsh Community School", "Parkgate Retail World (nearby)"],
      nearbyAreas: ["Parkgate", "Rotherham", "Swinton"],
      affluence: "mixed",
      competitionNote: "Web design demand in Rawmarsh is driven by trades and local retailers who need straightforward sites that generate enquiries quickly.",
      demandNote: "Search demand is steady — Rawmarsh businesses are value-conscious and respond well to clear ROI messaging.",
      localContext: "Rawmarsh is a busy urban area north of Rotherham. Its business community is dominated by trades, retail and practical service providers who prioritise clear results over aesthetics.",
      competitorAngle: "Compete on speed, simplicity and measurable lead generation. Rawmarsh clients want evidence a site will work, not a brochure.",
      messagingRegister: "Direct and practical. Lead with results, speed and cost-effectiveness. Rawmarsh business owners are no-nonsense buyers.",
    },
  },
  {
    area: "Parkgate",
    city: "Rotherham",
    service: "Web Design",
    tier: "priority",
    primaryKeyword: "Web Design Parkgate",
    supportingKeywords: [
      "website design Parkgate",
      "local web design Parkgate Rotherham",
      "professional web design Parkgate",
    ],
    hubUrl: HUB_URL,
    hubAnchor: HUB_ANCHOR,
    relatedPages: "Web Design Rotherham, Web Design Rawmarsh, Web Design Wickersley",
    remotePath: "/web-design-parkgate/",
    configPath: `config/clusters/${SLUG}-web-design-parkgate.json`,
    signals: {
      area: "Parkgate",
      postcode: "S62",
      city: "Rotherham",
      character: "commercially active retail and business hub north of Rotherham",
      knownFor: "shopping, retail parks and customer-facing businesses serving a wide catchment",
      businessType: "retail-led, competitive local service and commercial businesses",
      landmarks: ["Parkgate Retail World", "Asda Parkgate", "Aldwarke"],
      nearbyAreas: ["Rawmarsh", "Rotherham", "Wath-upon-Dearne"],
      affluence: "mixed",
      competitionNote: "Parkgate has high commercial activity — businesses here face strong online competition from both local and national providers.",
      demandNote: "Search demand is high, particularly from retail and service businesses wanting to capture the volume of local searchers in the area.",
      localContext: "Parkgate is a commercially active retail and business hub north of Rotherham. High footfall and strong local competition make a professional web presence essential for businesses to stand out.",
      competitorAngle: "Lead with visibility, conversion and competitive positioning. Parkgate clients need to outrank neighbouring businesses in a busy market.",
      messagingRegister: "Commercial and results-driven. Parkgate business owners understand competition — lead with market positioning and lead generation outcomes.",
    },
  },
  {
    area: "Aston",
    city: "Rotherham",
    service: "Web Design",
    tier: "secondary",
    primaryKeyword: "Web Design Aston",
    supportingKeywords: [
      "website design Aston Rotherham",
      "local web design Aston",
      "professional web design Aston",
    ],
    hubUrl: HUB_URL,
    hubAnchor: HUB_ANCHOR,
    relatedPages: "Web Design Rotherham, Web Design Wickersley, Web Design Dinnington",
    remotePath: "/web-design-aston/",
    configPath: `config/clusters/${SLUG}-web-design-aston.json`,
    signals: {
      area: "Aston",
      postcode: "S26",
      city: "Rotherham",
      character: "well-connected village area with strong road links between Rotherham and Sheffield",
      knownFor: "local services, trades and established community businesses",
      businessType: "local service providers and growing independent businesses",
      landmarks: ["Aston village centre", "Aughton", "Swallownest (adjacent)"],
      nearbyAreas: ["Swallownest", "Rotherham", "Dinnington"],
      affluence: "mixed",
      competitionNote: "Aston has a growing number of local businesses competing for the same residential customer base — online visibility is increasingly important.",
      demandNote: "Search demand is moderate and growing as more Aston residents search online for local trades and services.",
      localContext: "Aston is a well-connected village between Rotherham and Sheffield. Its local business community serves a residential population that increasingly searches online before choosing a provider.",
      competitorAngle: "Compete on local credibility and trust signals. Aston clients want to know they are dealing with a locally-aware provider who understands their community.",
      messagingRegister: "Community-focused and credible. Lead with local knowledge, reliability and tangible outcomes for village businesses.",
    },
  },
  {
    area: "Dinnington",
    city: "Rotherham",
    service: "Web Design",
    tier: "secondary",
    primaryKeyword: "Web Design Dinnington",
    supportingKeywords: [
      "website design Dinnington",
      "local web design Dinnington",
      "professional web design Dinnington",
    ],
    hubUrl: HUB_URL,
    hubAnchor: HUB_ANCHOR,
    relatedPages: "Web Design Rotherham, Web Design Aston, Web Design Maltby",
    remotePath: "/web-design-dinnington/",
    configPath: `config/clusters/${SLUG}-web-design-dinnington.json`,
    signals: {
      area: "Dinnington",
      postcode: "S25",
      city: "Rotherham",
      character: "large local centre with a self-contained high street and strong trade economy",
      knownFor: "trades, everyday retail and customer-facing service businesses serving the surrounding villages",
      businessType: "practical local businesses serving Dinnington and the surrounding rural communities",
      landmarks: ["Dinnington Main Road", "Anston", "Wales (village)"],
      nearbyAreas: ["Anston", "Wales", "Rotherham"],
      affluence: "mixed",
      competitionNote: "Dinnington serves a wide rural catchment — local businesses that rank online can capture searchers from multiple surrounding villages.",
      demandNote: "Search demand is moderate but consistent — Dinnington's rural catchment means online search is often the first port of call for residents.",
      localContext: "Dinnington is a large local centre serving its own high street and surrounding villages. Businesses here benefit from capturing both the town and the broader rural catchment through strong search visibility.",
      competitorAngle: "Emphasise catchment reach — a Dinnington business website can attract customers from Anston, Wales and surrounding villages, not just the town.",
      messagingRegister: "Practical and community-aware. Lead with catchment reach, local trust and the value of being the go-to provider for a wide rural area.",
    },
  },
  {
    area: "Thurcroft",
    city: "Rotherham",
    service: "Web Design",
    tier: "secondary",
    primaryKeyword: "Web Design Thurcroft",
    supportingKeywords: [
      "website design Thurcroft",
      "local web design Thurcroft",
      "professional web design Thurcroft",
    ],
    hubUrl: HUB_URL,
    hubAnchor: HUB_ANCHOR,
    relatedPages: "Web Design Rotherham, Web Design Maltby, Web Design Wickersley",
    remotePath: "/web-design-thurcroft/",
    configPath: `config/clusters/${SLUG}-web-design-thurcroft.json`,
    signals: {
      area: "Thurcroft",
      postcode: "S66",
      city: "Rotherham",
      character: "community-led village area with a close-knit local business network",
      knownFor: "trades, local services and independent small businesses operating on strong word-of-mouth referrals",
      businessType: "service-led and referral-driven businesses that benefit from expanding their online reach",
      landmarks: ["Thurcroft village", "Thurcroft Junior School", "Wickersley (adjacent)"],
      nearbyAreas: ["Wickersley", "Maltby", "Rotherham"],
      affluence: "mixed",
      competitionNote: "Thurcroft businesses rely heavily on word-of-mouth but face increasing competition from nearby areas with stronger digital presence.",
      demandNote: "Search demand is emerging — Thurcroft businesses that invest in web visibility now can establish early dominance before competition intensifies.",
      localContext: "Thurcroft is a close-knit village community near Wickersley and Maltby. Local businesses have historically relied on referrals, but online search is becoming the primary discovery channel for new customers.",
      competitorAngle: "Position web design as the next step beyond referrals — a Thurcroft business with a strong site captures both existing reputation and new organic search traffic.",
      messagingRegister: "Warm and trust-led. Thurcroft business owners respond to relationship-based messaging — lead with reliability, community reputation and steady growth.",
    },
  },
  {
    area: "Swallownest",
    city: "Rotherham",
    service: "Web Design",
    tier: "secondary",
    primaryKeyword: "Web Design Swallownest",
    supportingKeywords: [
      "website design Swallownest",
      "local web design Swallownest",
      "professional web design Swallownest",
    ],
    hubUrl: HUB_URL,
    hubAnchor: HUB_ANCHOR,
    relatedPages: "Web Design Rotherham, Web Design Aston, Web Design Wickersley",
    remotePath: "/web-design-swallownest/",
    configPath: `config/clusters/${SLUG}-web-design-swallownest.json`,
    signals: {
      area: "Swallownest",
      postcode: "S26",
      city: "Rotherham",
      character: "established residential area between Rotherham and Sheffield with a growing independent business base",
      knownFor: "independent local businesses, trades and practical service providers serving a commuter residential community",
      businessType: "community-focused and service-based businesses catering to a residential population",
      landmarks: ["Swallownest village", "Aston (adjacent)", "Crystal Peaks (nearby Sheffield)"],
      nearbyAreas: ["Aston", "Rotherham", "Sheffield"],
      affluence: "mixed",
      competitionNote: "Swallownest sits between two major cities — local businesses can capture search from Rotherham and Sheffield overspill if they have strong local page visibility.",
      demandNote: "Search demand is growing as the residential population expands and residents increasingly search locally for services.",
      localContext: "Swallownest is a well-established residential community between Rotherham and Sheffield. Its proximity to both cities makes it attractive for service businesses that can capture cross-city search traffic.",
      competitorAngle: "Lead with the dual-city opportunity — a Swallownest business can rank for both Rotherham and Sheffield-adjacent searches from a single site.",
      messagingRegister: "Credible and opportunity-focused. Swallownest business owners are often commuters who appreciate professionalism — lead with credibility and growth potential.",
    },
  },
];

// ── Money page anchors (unique per page) ──────────────────────────────────────

const MONEY_ANCHORS = {
  "Rawmarsh":    "see our web design work",
  "Parkgate":    "explore our website packages",
  "Aston":       "view our full web design service",
  "Dinnington":  "our professional web design team",
  "Thurcroft":   "discover our web design packages",
  "Swallownest": "find out about our web design services",
};

// ── Post-process: fix canonical + inject money link ───────────────────────────

function postProcess(htmlPath, area, remotePath) {
  let html = fs.readFileSync(htmlPath, "utf8");

  // Fix canonical to local subdomain
  html = html.replace(
    /(<link rel="canonical" href=")https:\/\/inboxingproweb\.com\//,
    `$1${LOCAL_DOMAIN}/`
  );
  const slug = remotePath.replace(/\//g, "");
  html = html.replace(
    new RegExp(`("url"\\s*:\\s*")https:\\/\\/inboxingproweb\\.com\\/${slug}\\/`, "g"),
    `$1${LOCAL_DOMAIN}/${slug}/`
  );

  // Inject money page link into CTA section
  const anchor = MONEY_ANCHORS[area] ?? "our web design service";
  const suffix = ` Discover more — <a href="${MONEY_URL}" style="color:rgba(255,255,255,0.9);text-decoration:underline">${anchor}</a>.`;
  html = html.replace(
    /(<p class="cta-close">)([\s\S]*?)(<\/p>)/,
    (_, open, body, close) => `${open}${body.trim()}${suffix}${close}`
  );

  fs.writeFileSync(htmlPath, html, "utf8");
  console.log(`  ✓ Post-processed: canonical fixed + money link injected`);
}

// ── SSE stream reader ─────────────────────────────────────────────────────────

function callRolloutApi() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      clientSlug: SLUG,
      options: { includeSecondary: true, deferTertiary: false, dryRun: false },
    });

    const req = http.request({
      hostname: "localhost",
      port: 8080,
      path: "/api/rollout",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    }, (res) => {
      let buffer = "";
      const results = [];

      res.on("data", (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "progress") {
                const icon = event.status === "done" ? "✓" :
                             event.status === "failed" ? "✗" :
                             event.status === "deferred" ? "⟳" : "…";
                console.log(`  ${icon} ${event.area || ""} — ${event.step || ""} [${event.status || ""}]`);
                if (event.status === "done" || event.status === "failed") {
                  results.push(event);
                }
              } else if (event.type === "complete") {
                console.log(`\n  Rollout complete: ${event.summary?.succeeded ?? "?"} succeeded, ${event.summary?.failed ?? "?"} failed`);
                resolve(results);
              } else if (event.type === "error") {
                reject(new Error(event.message || "Rollout error"));
              }
            } catch {
              // ignore non-JSON lines
            }
          }
        }
      });

      res.on("end", () => resolve(results));
      res.on("error", reject);
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Backup existing defs
  const existingDefs = JSON.parse(fs.readFileSync(DEFS_FILE, "utf8"));
  const existingPaths = new Set(existingDefs.map((d) => d.remotePath));

  const toGenerate = NEW_DEFS.filter((d) => !existingPaths.has(d.remotePath));
  if (toGenerate.length === 0) {
    console.log("All 6 areas already exist in defs. Nothing to do.");
    return;
  }

  console.log(`Generating ${toGenerate.length} new cluster pages:\n`);
  toGenerate.forEach((d) => console.log(`  • ${d.area} (${d.tier}) → ${d.remotePath}`));
  console.log();

  // 2. Temporarily write ONLY the new defs (so rollout only processes these)
  fs.writeFileSync(DEFS_FILE, JSON.stringify(toGenerate, null, 2), "utf8");
  console.log(`Wrote ${toGenerate.length} new defs to ${DEFS_FILE}\n`);

  let rolloutOk = false;
  try {
    console.log("Starting rollout (AI content + render + FTP upload)...\n");
    await callRolloutApi();
    rolloutOk = true;
  } catch (err) {
    console.error("Rollout error:", err.message);
  }

  // 3. Always restore full defs (existing + new)
  const fullDefs = [...existingDefs, ...toGenerate];
  fs.writeFileSync(DEFS_FILE, JSON.stringify(fullDefs, null, 2), "utf8");
  console.log(`\nRestored full defs (${fullDefs.length} total entries)`);

  if (!rolloutOk) {
    console.error("Rollout failed — check API server logs.");
    process.exit(1);
  }

  // 4. Post-process each new page
  console.log("\nPost-processing new pages...");
  for (const def of toGenerate) {
    const slug = def.remotePath.replace(/\//g, "");
    const htmlPath = `output/${SLUG}/${slug}/index.html`;
    if (fs.existsSync(htmlPath)) {
      console.log(`\n  ${def.area} (${htmlPath})`);
      postProcess(htmlPath, def.area, def.remotePath);
    } else {
      console.warn(`  ⚠ No HTML found for ${def.area} at ${htmlPath}`);
    }
  }

  // 5. Re-upload post-processed pages via FTP
  console.log("\nRe-uploading post-processed pages...");
  const { default: ftpLib } = await import("basic-ftp");

  for (const def of toGenerate) {
    const slug     = def.remotePath.replace(/\//g, "");
    const htmlPath = `output/${SLUG}/${slug}/index.html`;
    if (!fs.existsSync(htmlPath)) continue;

    const client = new ftpLib.Client(60000);
    client.ftp.verbose = false;
    try {
      await client.access({
        host: "inboxingproweb.com", port: 21,
        user: process.env.DEPLOY_USERNAME, password: process.env.DEPLOY_PASSWORD,
        secure: false,
      });
      await client.ensureDir(`/${slug}`);
      await client.uploadFrom(htmlPath, `/${slug}/index.html`);
      console.log(`  ✓ Re-uploaded ${def.area}`);
    } catch (e) {
      console.error(`  ✗ FTP failed for ${def.area}:`, e.message);
    } finally {
      client.close();
    }
  }

  console.log("\n══ All done ══\n");
  console.log("Live URLs:");
  for (const def of toGenerate) {
    const slug = def.remotePath.replace(/\//g, "");
    console.log(`  ${LOCAL_DOMAIN}/${slug}/`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
