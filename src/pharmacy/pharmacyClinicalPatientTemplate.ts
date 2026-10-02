/**
 * Clinical patient-page presentation — visual only.
 * Does not change copy fields, data models, or section order.
 */
export const CLINICAL_PATIENT_TEMPLATE_ATTR = 'data-clinical-patient-template="v1"';

function esc(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function clinicalPatientTemplateHeadAssets(): string {
  return `${clinicalPatientTemplateStyleBlock()}
<script data-clinical-tailwind="config">
  window.tailwind = window.tailwind || {};
  tailwind.config = { corePlugins: { preflight: false } };
</script>
<script src="https://cdn.tailwindcss.com"></script>`;
}

export function clinicalPatientTemplateStyleBlock(): string {
  return `<style data-clinical-patient-template="css">
body[data-clinical-patient-template="v1"]{
  --page-bg:#ffffff;
  --brand-heading:#1E293B;
  --brand-heading-primary:#1E293B;
  --brand-cta:#10B981;
  --brand-button-text:#ffffff;
  --text:#475569;
  --brand-muted:#64748b;
  background:#ffffff;
  color:#475569;
}
body[data-clinical-patient-template="v1"] h1,
body[data-clinical-patient-template="v1"] h2,
body[data-clinical-patient-template="v1"] h3,
body[data-clinical-patient-template="v1"] .section-head h2{
  color:#1E293B;
}
body[data-clinical-patient-template="v1"] .btn,
body[data-clinical-patient-template="v1"] .btn-white,
body[data-clinical-patient-template="v1"] a.nav-cta,
body[data-clinical-patient-template="v1"] .nav-links a.nav-cta{
  background:#10B981 !important;
  color:#ffffff !important;
  border:0 !important;
  box-shadow:0 12px 28px rgba(16,185,129,.28);
}
body[data-clinical-patient-template="v1"] .btn.secondary,
body[data-clinical-patient-template="v1"] .btn.bg-white{
  background:#ffffff !important;
  color:#1E293B !important;
  border:1px solid #e2e8f0 !important;
  box-shadow:none;
}
body[data-clinical-patient-template="v1"] .blue-band,
body[data-clinical-patient-template="v1"] .soft,
body[data-clinical-patient-template="v1"] section.about{
  background:#ffffff;
}
body[data-clinical-patient-template="v1"] .hero{
  background:#ffffff;
  padding:48px 0 32px;
}
body[data-clinical-patient-template="v1"] .hero-grid,
body[data-clinical-patient-template="v1"] .hero .grid{
  display:grid;
  grid-template-columns:1fr;
  gap:2.5rem;
  align-items:center;
}
@media (min-width:768px){
  body[data-clinical-patient-template="v1"] .hero-grid,
  body[data-clinical-patient-template="v1"] .hero .md\\:grid-cols-2{
    grid-template-columns:1.05fr .95fr;
  }
}
body[data-clinical-patient-template="v1"] .hero h1{
  color:#1E293B;
  letter-spacing:-.03em;
  font-weight:650;
}
body[data-clinical-patient-template="v1"] .hero .eyebrow,
body[data-clinical-patient-template="v1"] .hero .tag{
  background:rgba(16,185,129,.12);
  color:#047857;
  text-transform:uppercase;
  letter-spacing:.06em;
  font-weight:700;
  font-size:12px;
}
body[data-clinical-patient-template="v1"] .rounded-2xl{border-radius:1rem;}
body[data-clinical-patient-template="v1"] .overflow-hidden{overflow:hidden;}
body[data-clinical-patient-template="v1"] .shadow-xl{box-shadow:0 20px 40px -18px rgba(15,23,42,.28);}
body[data-clinical-patient-template="v1"] .shadow-sm{box-shadow:0 1px 2px rgba(15,23,42,.06),0 8px 24px rgba(15,23,42,.06);}
body[data-clinical-patient-template="v1"] .ring-1{box-shadow:0 0 0 1px rgba(15,23,42,.08);}
body[data-clinical-patient-template="v1"] .bg-white{background:#ffffff;}
body[data-clinical-patient-template="v1"] .bg-slate-50{background:#f8fafc;}
body[data-clinical-patient-template="v1"] .bg-\\[\\#10B981\\]{background:#10B981;}
body[data-clinical-patient-template="v1"] .text-\\[\\#1E293B\\]{color:#1E293B;}
body[data-clinical-patient-template="v1"] .text-\\[\\#10B981\\]{color:#10B981;}
body[data-clinical-patient-template="v1"] .text-white{color:#ffffff;}
body[data-clinical-patient-template="v1"] .text-slate-600{color:#475569;}
body[data-clinical-patient-template="v1"] .border{border:1px solid #e2e8f0;}
body[data-clinical-patient-template="v1"] .border-slate-200{border-color:#e2e8f0;}
body[data-clinical-patient-template="v1"] .border-l-4{border-left:4px solid #10B981;}
body[data-clinical-patient-template="v1"] .border-\\[\\#10B981\\]{border-color:#10B981;}
body[data-clinical-patient-template="v1"] .p-6{padding:1.5rem;}
body[data-clinical-patient-template="v1"] .p-8{padding:2rem;}
body[data-clinical-patient-template="v1"] .px-6{padding-left:1.5rem;padding-right:1.5rem;}
body[data-clinical-patient-template="v1"] .py-10{padding-top:2.5rem;padding-bottom:2.5rem;}
body[data-clinical-patient-template="v1"] .gap-3{gap:.75rem;}
body[data-clinical-patient-template="v1"] .gap-6{gap:1.5rem;}
body[data-clinical-patient-template="v1"] .gap-8{gap:2rem;}
body[data-clinical-patient-template="v1"] .flex{display:flex;}
body[data-clinical-patient-template="v1"] .inline-flex{display:inline-flex;}
body[data-clinical-patient-template="v1"] .flex-wrap{flex-wrap:wrap;}
body[data-clinical-patient-template="v1"] .items-center{align-items:center;}
body[data-clinical-patient-template="v1"] .items-start{align-items:flex-start;}
body[data-clinical-patient-template="v1"] .justify-center{justify-content:center;}
body[data-clinical-patient-template="v1"] .rounded-full{border-radius:9999px;}
body[data-clinical-patient-template="v1"] .w-10{width:2.5rem;}
body[data-clinical-patient-template="v1"] .h-10{height:2.5rem;min-height:2.5rem;}
body[data-clinical-patient-template="v1"] .font-semibold{font-weight:650;}
body[data-clinical-patient-template="v1"] .text-sm{font-size:.875rem;}
body[data-clinical-patient-template="v1"] .text-lg{font-size:1.125rem;}
body[data-clinical-patient-template="v1"] .leading-relaxed{line-height:1.75;}
body[data-clinical-patient-template="v1"] .uppercase{text-transform:uppercase;}
body[data-clinical-patient-template="v1"] .tracking-wide{letter-spacing:.06em;}
body[data-clinical-patient-template="v1"] .grid{display:grid;}
body[data-clinical-patient-template="v1"] .grid-cols-1{grid-template-columns:1fr;}
@media (min-width:768px){
  body[data-clinical-patient-template="v1"] .md\\:grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr));}
  body[data-clinical-patient-template="v1"] .md\\:py-16{padding-top:4rem;padding-bottom:4rem;}
}
body[data-clinical-patient-template="v1"] .clinical-hero-frame.rounded-2xl img,
body[data-clinical-patient-template="v1"] .clinical-hero-frame .hero-image-wrap,
body[data-clinical-patient-template="v1"] .clinical-hero-frame .hero-image-wrap img{
  border-radius:1rem;
  width:100%;
  height:100%;
  object-fit:cover;
}
body[data-clinical-patient-template="v1"] .clinical-hero-frame .hero-image-wrap{
  aspect-ratio:4/3;
  max-height:420px;
  background:#f1f5f9;
}
body[data-clinical-patient-template="v1"] .clinical-callout{
  background:#f8fafc;
  border-left:4px solid #10B981;
  border-radius:1rem;
  padding:2rem;
}
body[data-clinical-patient-template="v1"] .clinical-callout p{margin:0 0 1rem;color:#334155;}
body[data-clinical-patient-template="v1"] .clinical-callout p:last-child{margin-bottom:0;}
body[data-clinical-patient-template="v1"] .clinical-service-card{
  background:#ffffff;
  border:1px solid #e2e8f0;
  border-radius:1rem;
  box-shadow:0 10px 30px -18px rgba(15,23,42,.25);
  padding:1.5rem;
}
body[data-clinical-patient-template="v1"] .clinical-service-card h3{
  color:#1E293B;
  font-size:1.05rem;
  margin:0 0 .6rem;
}
body[data-clinical-patient-template="v1"] .clinical-service-card p{margin:0;color:#475569;}
body[data-clinical-patient-template="v1"] .clinical-timeline{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:1.25rem;}
body[data-clinical-patient-template="v1"] .clinical-timeline-item{
  display:flex;
  gap:1rem;
  align-items:flex-start;
  background:#ffffff;
  border:1px solid #e2e8f0;
  border-radius:1rem;
  padding:1.25rem 1.4rem;
}
body[data-clinical-patient-template="v1"] .clinical-step-badge{
  flex:0 0 2.5rem;
  width:2.5rem;
  height:2.5rem;
  border-radius:9999px;
  background:#10B981;
  color:#ffffff;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  font-weight:700;
  line-height:1;
}
body[data-clinical-patient-template="v1"] .clinical-timeline-body h3{
  margin:0 0 .35rem;
  color:#1E293B;
  font-size:1.05rem;
}
body[data-clinical-patient-template="v1"] .clinical-timeline-body p{margin:0;color:#475569;}
body[data-clinical-patient-template="v1"] .clinical-section-head{margin:0 0 1.5rem;}
body[data-clinical-patient-template="v1"] .clinical-section-head h2{margin:0;}
</style>`;
}

export type ClinicalHeroInput = {
  eyebrow: string;
  headline: string;
  intro: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  heroImageHtml: string;
  componentVariant?: string;
};

export function renderClinicalHero(input: ClinicalHeroInput): string {
  const secondary =
    input.secondaryCtaLabel && input.secondaryCtaHref
      ? `<a class="btn secondary bg-white text-[#1E293B] rounded-full px-6" href="${esc(input.secondaryCtaHref)}">${esc(input.secondaryCtaLabel)}</a>`
      : "";
  return `<section class="hero bg-white py-12 md:py-16" id="hero-section" data-template-block="hero" data-component-variant="${esc(input.componentVariant || "clinical-split")}">
<div class="wrap grid grid-cols-1 md:grid-cols-2 gap-10 items-center hero-grid hero-grid--split-left">
<div class="hero-copy">
<div class="eyebrow text-[#10B981] font-semibold tracking-wide uppercase text-sm">${esc(input.eyebrow)}</div>
<h1 class="text-[#1E293B]">${esc(input.headline)}</h1>
<p class="text-slate-600 text-lg leading-relaxed">${esc(input.intro)}</p>
<div class="btns flex flex-wrap gap-3">
<a class="btn bg-[#10B981] text-white rounded-full shadow-xl" href="${esc(input.primaryCtaHref)}">${esc(input.primaryCtaLabel)}</a>
${secondary}
</div>
</div>
<div class="hero-media">
<div class="clinical-hero-frame rounded-2xl overflow-hidden shadow-xl ring-1">${input.heroImageHtml}</div>
</div>
</div>
</section>`;
}

export function renderClinicalLocalIntroduction(bodyParagraphs: string[], evidence: string[] = []): string {
  if (!bodyParagraphs.length) return "";
  const evidenceAttr = evidence.length ? ` data-locality-evidence="${esc(evidence.join("|"))}"` : "";
  return `<section id="cluster-local-introduction" class="local-introduction py-10" data-template-block="local-introduction" data-content-field="localIntroduction"${evidenceAttr}>
<div class="wrap px-6">
<div class="local-introduction-wrapper clinical-callout bg-slate-50 rounded-2xl border-l-4 border-[#10B981] p-8 shadow-sm">
${bodyParagraphs.map((p) => `<p class="text-slate-600 leading-relaxed">${esc(p)}</p>`).join("\n")}
</div>
</div>
</section>`;
}

export function renderClinicalServiceDefinitionSection(input: {
  heading: string;
  intro?: string;
  paragraphs: string[];
  bullets?: string[];
}): string {
  const cards: Array<{ title: string; body: string }> = [];
  if (input.intro?.trim()) cards.push({ title: "", body: input.intro.trim() });
  for (const paragraph of input.paragraphs) {
    if (paragraph.trim()) cards.push({ title: "", body: paragraph.trim() });
  }
  for (const bullet of input.bullets || []) {
    if (bullet.trim()) cards.push({ title: "", body: bullet.trim() });
  }
  if (!cards.length && !input.heading.trim()) return "";
  const cardHtml = cards
    .map(
      (card, index) => `<article class="clinical-service-card bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
${card.title ? `<h3 class="text-[#1E293B] font-semibold">${esc(card.title)}</h3>` : `<h3 class="text-[#10B981] text-sm font-semibold uppercase tracking-wide">Point ${index + 1}</h3>`}
<p class="text-slate-600 leading-relaxed">${esc(card.body)}</p>
</article>`,
    )
    .join("\n");
  return `<section id="cluster-context" class="py-10" data-template-block="service-definition">
<div class="wrap px-6">
<div class="clinical-section-head"><h2 class="text-[#1E293B]">${esc(input.heading)}</h2></div>
<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
${cardHtml}
</div>
</div>
</section>`;
}

export type ClinicalTimelineStep = {
  title?: string;
  body?: string;
  bullets?: string[];
};

export function renderClinicalProcessTimeline(input: {
  heading: string;
  introHtml?: string;
  markerHoldHtml?: string;
  steps: ClinicalTimelineStep[];
  extraHtml?: string;
  evidenceAttr?: string;
}): string {
  const items = input.steps
    .map((step) => ({
      title: String(step.title || "").trim(),
      body: String(step.body || "").trim(),
      bullets: (step.bullets || []).map((b) => String(b || "").trim()).filter(Boolean),
    }))
    .filter((step) => step.title || step.body || step.bullets.length);
  const timeline = items.length
    ? `<ol class="clinical-timeline" data-clinical-timeline="true">
${items
  .map((step, index) => {
    const body = step.body ? `<p class="text-slate-600 leading-relaxed">${esc(step.body)}</p>` : "";
    const list = step.bullets.length
      ? `<ul class="clean">${step.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
      : "";
    return `<li class="clinical-timeline-item">
<span class="clinical-step-badge inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#10B981] text-white font-semibold" aria-hidden="true">${index + 1}</span>
<div class="clinical-timeline-body">
${step.title ? `<h3 class="text-[#1E293B] font-semibold">${esc(step.title)}</h3>` : ""}
${body}
${list}
</div>
</li>`;
  })
  .join("\n")}
</ol>`
    : "";
  return `<section class="soft py-10" id="child-areas" data-template-block="child-areas"${input.evidenceAttr || ""}>
<div class="wrap px-6">
<div class="clinical-section-head"><h2 class="text-[#1E293B]">${esc(input.heading)}</h2></div>
${input.introHtml || ""}
${input.markerHoldHtml || ""}
${timeline}
${input.extraHtml || ""}
</div>
</section>`;
}
