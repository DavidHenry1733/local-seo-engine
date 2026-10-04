/**
 * Component DNA layout CSS — canonical presentation geometry.
 * Renderers assemble markup; Component DNA owns layout dimensions.
 */
import type { ComponentDna } from "./pharmacyComponentDnaTypes.ts";
import { componentDnaRootVariables } from "./pharmacyComponentDnaResolver.ts";
import { brandDnaFooterLayoutCss } from "./pharmacyBrandDnaFooterRenderer.ts";
import { heroContactTreatmentCss } from "./pharmacyComponentDnaContactRenderer.ts";

export function componentDnaLayoutCss(dna: ComponentDna): string {
  const bp = dna.header.desktopBreakpoint;
  return `${componentDnaRootVariables(dna)}
.site-header .brand img{max-height:min(var(--component-header-logo-max,48px),56px);width:auto}
.site-header .nav{min-height:calc(var(--component-header-logo-max,51px) + 24px);display:flex;align-items:center;justify-content:space-between;gap:var(--component-header-cta-gap,10px);font-size:14px}
.site-header{color:var(--header-text,var(--brand-nav-text,var(--brand-heading)));font-size:14px}
.site-header[data-nav-style="multi-link"] .nav-links{gap:var(--component-header-nav-gap,16px);font-size:${dna.header.navFontSize}}
.site-header--white-nav{background:var(--header-bg,#fff);color:var(--header-text,var(--brand-heading))}
.site-header--white-nav .nav-links a{color:var(--header-text,var(--brand-heading))}
.site-header--white-nav .brand{color:var(--header-text,var(--brand-heading))}
.nav-links{display:flex;flex-wrap:nowrap;align-items:center;max-width:100%;gap:var(--component-header-nav-gap,16px);overflow:visible}
.nav-links>a,.nav-dropdown{flex-shrink:0;white-space:nowrap}
.nav-dropdown{position:relative;display:inline-flex;align-items:center}
.nav-dropdown-trigger{background:none;border:none;padding:0;font:inherit;color:inherit;cursor:pointer;font-weight:inherit}
.nav-dropdown-menu{display:none;position:absolute;top:100%;left:0;min-width:220px;padding:12px 0;background:var(--header-bg,#fff);border:1px solid color-mix(in srgb,var(--header-text,#334155) 12%,transparent);border-radius:8px;box-shadow:0 12px 28px rgba(15,23,42,.12);z-index:40;flex-direction:column;gap:0}
.nav-dropdown:hover .nav-dropdown-menu,.nav-dropdown:focus-within .nav-dropdown-menu{display:flex}
.nav-dropdown-item{display:block;padding:8px 16px;color:var(--header-text,var(--brand-heading));text-decoration:none;font-size:inherit;white-space:nowrap}
.nav-dropdown-item:hover{background:color-mix(in srgb,var(--brand-cta,var(--brand-primary)) 8%,transparent)}
.site-header[data-header-rows="1"] .nav-links{flex-wrap:nowrap}
.nav-cta-group{display:inline-flex;align-items:center;gap:var(--component-header-cta-gap,10px);flex-wrap:wrap;flex-shrink:0}
.nav-links a.nav-cta,.nav-links a.nav-cta-secondary{background:var(--component-cta-header-primary-bg,var(--brand-cta,var(--brand-secondary)));color:var(--component-cta-header-primary-fg,#fff)!important;border:var(--component-cta-header-primary-border,none);box-shadow:none;font-weight:var(--component-cta-header-primary-weight,700);padding:var(--component-cta-spacing,8px 14px);border-radius:var(--component-cta-radius,var(--brand-radius-button,14px));text-decoration:none;white-space:nowrap;font-size:${dna.header.navFontSize}}
.nav-links a.nav-cta-secondary{background:var(--component-cta-header-secondary-bg,var(--component-cta-header-primary-bg,var(--brand-cta)));color:var(--component-cta-header-secondary-fg,var(--component-cta-header-primary-fg,#fff))!important;border:var(--component-cta-header-secondary-border,none);font-weight:var(--component-cta-header-secondary-weight,700)}
.nav-links a.nav-cta[data-cta-style="outline"],.nav-links a.nav-cta-secondary[data-cta-style="outline"]{background:var(--component-cta-header-secondary-bg,transparent)!important;color:var(--component-cta-header-secondary-fg,var(--brand-cta))!important;border:var(--component-cta-header-secondary-border,2px solid var(--brand-cta))}
.nav-links a.nav-cta:hover,.nav-links a.nav-cta-secondary:hover{filter:brightness(.95)}
.hero-grid,.grid-2{display:grid;grid-template-columns:var(--component-hero-text-ratio,1fr) var(--component-hero-image-ratio,1fr);gap:var(--component-hero-gap,48px);align-items:center}
.grid-3{display:grid;grid-template-columns:repeat(var(--component-card-columns,3),minmax(0,1fr));gap:var(--component-card-gap,22px)}
.grid-4{display:grid;grid-template-columns:repeat(var(--component-process-columns,4),minmax(0,1fr));gap:var(--component-process-gap,18px)}
.definition-split-row,.grid-2.trust-split-row,.grid-2.safety-split{display:grid;grid-template-columns:var(--component-split-text-ratio,1fr) var(--component-split-image-ratio,1fr);gap:var(--component-split-gap,32px);align-items:start}
.trust-split-row{align-items:center;gap:var(--component-trust-gap,20px)}
.safety-split{gap:var(--component-trust-gap,20px)}
.safety-media{margin:0;border-radius:var(--component-image-radius,16px);overflow:hidden}
.safety-media img,.safety-media .image-panel{width:100%;height:100%;min-height:22rem;object-fit:cover;display:block}
.conditions-authority-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:14px}
.conditions-authority-grid .condition-track-card{display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;padding:22px 12px}
.conditions-authority-grid .condition-track-icon{width:2.5rem;height:2.5rem;color:var(--brand-heading,#005EB8);display:flex;align-items:center;justify-content:center}
.conditions-authority-grid .condition-track-icon svg{width:1.75rem;height:1.75rem}
.conditions-authority-grid .condition-track-card h3{margin:0;font-size:15px;line-height:1.35}
.definition-split-continuation{max-width:var(--component-split-max-width,920px);margin-left:auto;margin-right:auto}
section[data-layout="media-float-flow"]::after{content:"";display:table;clear:both}
section[data-layout="media-float-flow"] .section-media,
section[data-layout="media-float-flow"] .definition-split-media{float:right;width:min(48%,520px);max-width:50%;margin:0 0 var(--component-split-gap,32px) var(--component-split-gap,32px)}
section[data-layout="media-float-flow"] .section-copy,
section[data-layout="media-float-flow"] .definition-split-copy,
section[data-layout="media-float-flow"] .section-opening-copy{display:block}
section[data-layout="balanced-split"] .balanced-split-row,
section[data-layout="balanced-split"] .definition-split-row{display:grid;grid-template-columns:var(--component-split-text-ratio,1fr) var(--component-split-image-ratio,1fr);gap:var(--component-split-gap,32px);align-items:start}
section[data-layout="full-width-editorial"] .section-media,
section[data-layout="full-width-editorial"] .definition-split-media{display:none}
section[data-layout="full-width-editorial"] .section-opening-copy,
section[data-layout="full-width-editorial"] .definition-split-copy{max-width:var(--component-split-max-width,920px);margin-left:auto;margin-right:auto}
body[data-split-composition="media-float-flow"] .definition-split-row{display:block}
body[data-split-composition="media-float-flow"] .definition-split-media{float:right;width:min(48%,520px);margin:0 0 24px 32px}
body[data-split-composition="media-float-flow"] .definition-split-copy{display:block}
body[data-split-composition="media-float-flow"] .definition-split-row::after{content:"";display:block;clear:both}
body[data-split-composition="media-float-flow"] .definition-split-continuation{max-width:none;margin-left:0;margin-right:0;width:100%;clear:both}
/* Section layout wins over body composition defaults — balanced-split must stay side-by-side. */
body[data-split-composition="media-float-flow"] section[data-layout="balanced-split"] .balanced-split-row,
body[data-split-composition="media-float-flow"] section[data-layout="balanced-split"] .definition-split-row{display:grid;grid-template-columns:var(--component-split-text-ratio,1fr) var(--component-split-image-ratio,1fr);gap:var(--component-split-gap,32px);align-items:start}
body[data-split-composition="media-float-flow"] section[data-layout="balanced-split"] .definition-split-media,
body[data-split-composition="media-float-flow"] section[data-layout="balanced-split"] .section-media{float:none;width:auto;max-width:none;margin:0}
body[data-split-composition="media-float-flow"] section[data-layout="balanced-split"] .definition-split-row::after{content:none;display:none}
section[data-media-layout="media-float-flow"] .definition-split-row{display:block}
section[data-media-layout="media-float-flow"] .definition-split-media{float:right;width:min(48%,520px);margin:0 0 24px 32px}
section[data-media-layout="media-float-flow"] .definition-split-copy{display:block}
section[data-media-layout="media-float-flow"] .definition-split-row::after{content:"";display:block;clear:both}
section[data-media-layout="media-float-flow"] .definition-split-continuation{max-width:none;margin-left:0;margin-right:0;width:100%;clear:both}
section[data-media-layout="balanced-split"] .definition-split-row{display:grid;grid-template-columns:var(--component-split-text-ratio,1fr) var(--component-split-image-ratio,1fr);gap:var(--component-split-gap,32px);align-items:start}
section[data-media-layout="full-width-editorial"] .definition-split-media{display:none}
section[data-media-layout="full-width-editorial"] .definition-split-copy{max-width:var(--component-split-max-width,920px);margin-left:auto;margin-right:auto}
body[data-split-composition="fixed-split"] .definition-split-row{display:grid;grid-template-columns:var(--component-split-text-ratio,1fr) var(--component-split-image-ratio,1fr);gap:var(--component-split-gap,32px);align-items:start}
.hero-image-wrap{aspect-ratio:var(--component-image-hero-aspect,4/3);max-height:var(--component-image-hero-max-height,520px);width:100%}
.image-panel{aspect-ratio:var(--component-image-inline-aspect,4/3);max-height:var(--component-image-support-max-height,480px);width:100%}
.image-panel img,.hero-image-wrap img{object-fit:var(--component-image-object-fit,cover);width:100%;height:100%}
.definition-split-media .image-panel,.trust-media .trust-block-media{max-height:var(--component-image-support-max-height,480px)}
.conversion-image-section .image-panel,.support-image-band .support-band-media{aspect-ratio:var(--component-image-conversion-aspect,21/9);max-height:var(--component-image-conversion-max-height,560px);width:100%}
.conversion-image-section .wrap,.support-image-band .wrap{max-width:var(--component-split-max-width,1180px)}
.pharmacy-local-grid{display:grid;grid-template-columns:var(--component-map-details-ratio,1fr) var(--component-map-column-ratio,1.6fr);gap:var(--component-map-gap,32px);align-items:stretch;margin-top:var(--component-map-gap,28px)}
.card h3{min-height:calc(var(--component-card-heading-spacing,16px)*3.25);display:flex;align-items:flex-start;color:var(--brand-heading-primary,var(--brand-heading))}
.card-grid-equal{align-items:stretch}
.card-grid-equal .equal-height-card{display:flex;flex-direction:column;height:100%}
.card-grid-equal .card-title-block{margin-bottom:var(--component-card-heading-spacing,4px)}
.card-grid-equal .card-body{flex:1;margin-bottom:0;min-height:calc(var(--component-card-heading-spacing,16px)*4.5);font-size:16px;line-height:1.6}
.card-grid-equal h3.card-title-line-1{min-height:calc(var(--component-card-heading-spacing,16px)*2.65);display:flex;align-items:flex-start;line-height:1.25;margin:0 0 var(--component-card-heading-spacing,12px)}
.card-grid-equal h3.card-title-line-2{min-height:calc(var(--component-card-heading-spacing,16px)*5.3);display:flex;align-items:flex-start;line-height:1.25;margin:0 0 var(--component-card-heading-spacing,12px)}
.card-grid-equal .step-icon{font-size:var(--component-card-heading-spacing,18px)}
.process-steps .equal-height-card{role:listitem}
.process-steps .step-icon{display:inline-flex;align-items:center;justify-content:center;width:2rem;height:2rem;border-radius:999px;background:var(--brand-primary,#005eb8);color:#fff;font-weight:800;margin:0 0 .65rem}
.process-steps .step-number{line-height:1}
.process-steps .card-title-block{display:flex;flex-direction:column;align-items:flex-start;gap:.35rem}
.visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.coverage-tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.coverage-tag{display:inline-block}
#pharmacy-trust-cards .card-grid-equal h3.card-title-line-2{min-height:calc(var(--component-card-heading-spacing,16px)*4.8)}
.conditions-grid .equal-height-card h3,.safety-grid .equal-height-card h3{min-height:auto!important}
.conditions-grid .card-body{min-height:calc(var(--component-card-heading-spacing,16px)*3.5)}
.trust-grid{display:grid;grid-template-columns:repeat(var(--component-trust-columns,3),minmax(0,1fr));gap:var(--component-trust-gap,16px);margin-top:var(--component-trust-gap,24px)}
.support-image-band{padding:var(--brand-section-spacing,72px) 0}
.about-card{padding:var(--component-card-padding,42px)}
.nearby-areas-section{padding:var(--brand-section-spacing,72px) 0}
.nearby-areas-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(calc(var(--component-card-padding,28px)*var(--component-trust-columns,3)*2.5),1fr));gap:var(--component-card-gap,16px);margin-top:var(--component-card-gap,28px)}
.nearby-area-card{display:flex;align-items:center;min-height:calc(var(--component-card-padding,28px)*2);padding:var(--component-card-padding,16px);border-radius:var(--brand-radius-card,var(--radius));border:1px solid var(--line);background:#fff;color:var(--brand-primary);font-weight:800;text-decoration:none;box-shadow:var(--shadow2)}
.nearby-area-card:hover{background:color-mix(in srgb,var(--brand-primary) 8%,white)}
.nearby-main-link{margin-top:var(--component-card-gap,24px);text-align:center;font-weight:700}
.nearby-main-link a{color:var(--brand-primary);text-decoration:none}
.pharmacy-map-card{background:#fff;border:1px solid var(--line);border-radius:var(--component-map-radius,10px);box-shadow:var(--shadow2);overflow:hidden;min-height:var(--component-map-min-height,440px);height:100%;display:flex;flex-direction:column;width:100%}
.pharmacy-map-card iframe{width:100%;height:100%;min-height:var(--component-map-min-height,440px);flex:1;border:0;border-radius:var(--component-map-radius,10px)}
.pharmacy-local-grid{align-items:stretch}
.pharmacy-local-details{display:flex;flex-direction:column;height:100%}
.local-structured-blocks{display:grid;gap:var(--component-card-gap,24px);margin-bottom:var(--component-map-gap,28px)}
.local-healthcare-context.card,.local-safety-note{background:#fff;border:1px solid var(--line);border-radius:var(--brand-radius-card,var(--radius));padding:var(--component-card-padding,24px);box-shadow:var(--shadow2)}
.local-healthcare-context h3,.local-access-details h3{margin:0 0 12px;font-size:20px;color:var(--brand-heading)}
.local-healthcare-list li,.local-access-details-list li{font-size:16px;line-height:1.6;color:var(--brand-muted)}
.local-safety-note p{margin:0;font-size:16px;line-height:1.65;color:var(--brand-muted)}
.local-intro-lead{max-width:72ch;margin:0 auto 24px;font-size:17px;line-height:1.65;color:var(--brand-muted)}
${brandDnaFooterLayoutCss(dna)}
.site-footer .footer-grid--four{grid-template-columns:var(--footer-column-widths,var(--component-footer-columns,2.2fr 1fr 1.15fr 1.5fr));gap:var(--component-footer-column-gap,40px)}
.site-footer .footer-grid--three{grid-template-columns:var(--component-footer-columns,2fr 1fr 1.2fr)}
.site-footer .footer-grid--compact{grid-template-columns:var(--component-footer-columns,1fr 1fr);gap:var(--component-footer-column-gap,24px)}
.site-footer,.site-footer p,.site-footer a,.site-footer h3{font-size:14px}
.site-footer .footer-grid,.site-footer .wrap.footer-grid{padding-top:20px;padding-bottom:21px}
.footer-hours-row{border-bottom:var(--component-table-row-border);padding:var(--component-table-cell-padding)}
body[data-hero-variant="split-text-left-image-right"] .hero-grid--split-left,
body[data-hero-variant="split-text-left-image-right"] .hero .hero-grid{grid-template-columns:var(--component-hero-text-ratio,1.05fr) var(--component-hero-image-ratio,.95fr);align-items:center;gap:var(--component-hero-gap,48px)}
body[data-hero-variant="split-image-left-text-right"] .hero-grid--reverse{grid-template-columns:var(--component-hero-image-ratio,.95fr) var(--component-hero-text-ratio,1.05fr);align-items:center;gap:var(--component-hero-gap,48px)}
body[data-hero-variant="centred-contained"] .hero-grid{grid-template-columns:1fr;justify-items:center;text-align:center}
body[data-image-treatment="rounded-balanced"] .hero-image-wrap,
body[data-image-treatment="rounded-balanced"] .image-panel{border-radius:var(--component-image-radius,var(--brand-radius-image,10px))}
body[data-image-treatment="rounded-soft"] .hero-image-wrap,
body[data-image-treatment="rounded-soft"] .image-panel{border-radius:var(--component-image-radius,32px)}
body[data-image-treatment="square-contained"] .hero-image-wrap,
body[data-image-treatment="square-contained"] .image-panel{border-radius:0}
body[data-map-contact-variant="split-map-details"] .pharmacy-local-grid{grid-template-columns:var(--component-map-details-ratio,1fr) var(--component-map-column-ratio,1.6fr);gap:var(--component-map-gap,32px)}
body[data-map-contact-variant="stacked-map"] .pharmacy-local-grid{grid-template-columns:1fr;gap:var(--component-map-gap,24px)}
body[data-map-contact-variant="details-only"] .pharmacy-map-card{display:none}
${heroContactTreatmentCss()}
body[data-card-variant="card-grid-two"] .conditions-grid.grid-3{grid-template-columns:repeat(2,minmax(0,1fr))}
body[data-card-variant="card-led-band"] .conditions-grid.grid-3{grid-template-columns:1fr}
body[data-process-variant="numbered-cards"] .process-grid.grid-4{grid-template-columns:repeat(4,minmax(0,1fr))}
body[data-process-variant="timeline"] .process-grid.grid-4{grid-template-columns:repeat(2,minmax(0,1fr))}
body[data-process-variant="compact-list"] .process-grid.grid-4{grid-template-columns:1fr}
@media(max-width:${bp}){
  .site-header .nav{height:auto;padding:14px 0;align-items:flex-start;flex-direction:column;max-height:none}
  .site-header .nav-links{width:100%;white-space:normal}
  header[data-mobile-header="stacked-nav"] .nav{flex-direction:column;align-items:flex-start}
  header[data-mobile-header="stacked-nav"] .nav-links{width:100%;flex-wrap:wrap;white-space:normal}
  .hero-grid,.grid-2,.grid-3,.grid-4,.definition-split-row,.grid-2.trust-split-row,.grid-2.safety-split,.pharmacy-local-grid{grid-template-columns:1fr;gap:var(--component-split-gap,28px)}
  .conditions-authority-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  section[data-layout="media-float-flow"] .section-media,
  section[data-layout="media-float-flow"] .definition-split-media{float:none;width:100%;max-width:none;margin:0 0 var(--component-split-gap,24px) 0}
  body[data-split-composition="media-float-flow"] .definition-split-media{float:none;width:100%;margin:0 0 24px 0}
  .hero-image-wrap,.image-panel,.definition-split-media .image-panel{min-height:0;max-height:var(--component-image-max-height,320px)}
  .nav-cta{width:100%;justify-content:center}
  .hero-grid>*,.hero-copy{min-width:0;max-width:100%}
  .btns,.local-access-cta,.cta-actions{max-width:100%}
  .btn,.btn.secondary,.btn-white,.btn-white-outline{max-width:100%;min-width:0;white-space:normal;overflow-wrap:anywhere;box-sizing:border-box}
}
@media(max-width:640px){
  .site-footer .footer-grid--four,
  .site-footer .footer-grid--three,
  .site-footer .footer-grid--compact{grid-template-columns:1fr;gap:var(--component-footer-column-gap,28px)}
  .btns>.btn,.local-access-cta .btn,.cta-actions .btn,.cta-actions .btn-white,.cta-actions .btn-white-outline{width:100%;flex:1 1 100%;max-width:100%}
}
`;
}
