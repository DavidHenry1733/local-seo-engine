/** Typography enforcement for locked local page-type contracts. */
export function localPageTypeTypographyStyleBlock(): string {
  return `<style>
body[data-local-page-contract="local-hub-v1"],
body[data-local-page-contract="local-cluster-v1"],
body[data-local-page-contract="local-area-v1"] {
  --local-page-body-size: 17px;
}
body[data-local-page-contract="local-hub-v1"] main,
body[data-local-page-contract="local-cluster-v1"] main,
body[data-local-page-contract="local-area-v1"] main {
  font-size: var(--local-page-body-size, 17px);
}
body[data-local-page-contract="local-hub-v1"] main section p,
body[data-local-page-contract="local-cluster-v1"] main section p,
body[data-local-page-contract="local-area-v1"] main section p,
body[data-local-page-contract="local-hub-v1"] .local-intro-lead,
body[data-local-page-contract="local-cluster-v1"] .local-intro-lead,
body[data-local-page-contract="local-area-v1"] .local-intro-lead,
body[data-local-page-contract="local-hub-v1"] .section-copy p,
body[data-local-page-contract="local-cluster-v1"] .section-copy p,
body[data-local-page-contract="local-area-v1"] .section-copy p,
body[data-local-page-contract="local-hub-v1"] .local-access-details-list li,
body[data-local-page-contract="local-cluster-v1"] .local-access-details-list li,
body[data-local-page-contract="local-area-v1"] .local-access-details-list li {
  font-size: var(--local-page-body-size, 17px);
  line-height: 1.7;
}
body[data-local-page-contract="local-hub-v1"] h1,
body[data-local-page-contract="local-cluster-v1"] h1,
body[data-local-page-contract="local-area-v1"] h1 {
  font-size: var(--h1-scale, clamp(2.2rem, 5vw, 3.5rem));
  text-transform: none;
}
body[data-local-page-contract="local-hub-v1"] h2,
body[data-local-page-contract="local-cluster-v1"] h2,
body[data-local-page-contract="local-area-v1"] h2 {
  font-size: var(--h2-scale, clamp(1.75rem, 3.5vw, 2.5rem));
  text-transform: none;
}
body[data-local-page-contract="local-hub-v1"] h3,
body[data-local-page-contract="local-cluster-v1"] h3,
body[data-local-page-contract="local-area-v1"] h3 {
  font-size: var(--h3-size, 22px);
  text-transform: none;
}
body[data-local-page-contract="local-hub-v1"] .section-head h2,
body[data-local-page-contract="local-cluster-v1"] .section-head h2,
body[data-local-page-contract="local-area-v1"] .section-head h2 {
  letter-spacing: -0.02em;
}
body[data-local-page-contract="local-hub-v1"] .tag:not(.nhs),
body[data-local-page-contract="local-cluster-v1"] .tag:not(.nhs),
body[data-local-page-contract="local-area-v1"] .tag:not(.nhs) {
  text-transform: none;
  letter-spacing: 0.02em;
  font-weight: 700;
}
body[data-local-page-contract="local-hub-v1"] .nearby-area-card,
body[data-local-page-contract="local-cluster-v1"] .nearby-area-card,
body[data-local-page-contract="local-area-v1"] .nearby-area-card,
body[data-local-page-contract="local-hub-v1"] .area-card,
body[data-local-page-contract="local-cluster-v1"] .area-card,
body[data-local-page-contract="local-area-v1"] .area-card {
  font-size: var(--local-page-body-size, 17px);
}
.areas-grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin-top:24px}
.area-card{display:block;border:1px solid var(--line);border-radius:var(--brand-radius-card,var(--radius));padding:20px;background:#fff;text-decoration:none;color:inherit;box-shadow:var(--shadow2)}
.area-card:hover{background:color-mix(in srgb,var(--brand-primary) 8%,white);text-decoration:none}
.area-card h3{margin:0 0 8px;color:var(--brand-heading);font-size:var(--h3-size,22px);text-transform:none}
.area-card p{margin:0;font-size:var(--body-size,17px);color:var(--brand-muted);line-height:1.6}
.cluster-link-band{padding:32px 0}
.cluster-link-band ul.clean li{font-size:var(--body-size,17px);line-height:1.65}
/* Shared locality narrative alignment — headings/subtitles/body use section-head.center contract */
body[data-local-page-contract="local-cluster-v1"] main section .section-head.center p,
body[data-local-page-contract="local-cluster-v1"] main section p.narrative-center,
body[data-local-page-contract="local-cluster-v1"] main section .section-copy.narrative-center p,
body[data-local-page-contract="local-area-v1"] main section .section-head.center p,
body[data-local-page-contract="local-area-v1"] main section p.narrative-center {
  text-align:center;
  margin-left:auto;
  margin-right:auto;
  max-width:72ch;
}
body[data-local-page-contract="local-cluster-v1"] main section[data-template-block="service-definition"] .wrap > p,
body[data-local-page-contract="local-cluster-v1"] main section[data-template-block="consultation"] .wrap > p,
body[data-local-page-contract="local-cluster-v1"] main section[data-template-block="local-relevance"] .section-copy p,
body[data-local-page-contract="local-cluster-v1"] main section[data-template-block="trust-split"] .trust-prose p {
  text-align:center;
  margin-left:auto;
  margin-right:auto;
  max-width:72ch;
}
</style>`;
}
