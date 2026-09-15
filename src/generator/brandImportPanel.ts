/**
 * Shared Website Analysis & Profile Import panel — Local SEO Engine master implementation.
 * Used by LSE dashboard and PharmaConnect Profile Dashboard.
 */
export type BrandImportPanelMode = "lse" | "pharmacy";

export interface BrandImportPanelOptions {
  mode: BrandImportPanelMode;
  /** Initial website URL shown in the import field */
  websiteUrl?: string;
}

export function renderBrandImportPanelHtml(options: BrandImportPanelOptions): string {
  const urlValue = options.websiteUrl || "";
  const importLabel = options.mode === "pharmacy" ? "Analyse Existing Website" : "Import Brand";
  const panelTitle = options.mode === "pharmacy" ? "Website Analysis & Profile Import" : "Website Branding Import";

  return `<div class="brand-import-panel" data-brand-import-mode="${options.mode}">
<div class="bi-url-box">
<div class="bi-url-title">${panelTitle}</div>
<p class="bi-url-desc">${options.mode === "pharmacy"
    ? "Enter your pharmacy website URL. PharmaConnect analyses identity, branding, navigation, contact, location and services — then populates your profile for review."
    : "Enter a website URL to extract branding for page generation."}</p>
<div class="bi-url-row">
<input id="bi-url" type="url" placeholder="https://www.yourpharmacy.co.uk" value="${esc(urlValue)}"
onkeydown="if(event.key==='Enter')biRun()"/>
<button class="bi-run-btn" type="button" onclick="biRun()" id="bi-run-btn">${importLabel}</button>
</div>
<div id="bi-status" class="bi-status"></div>
<div id="bi-error" class="bi-error" style="display:none" role="alert"></div>
</div>

<div id="bi-analysis-summary" class="bi-analysis-summary" style="display:none">
<div class="bi-summary-header">
<strong id="bi-summary-title">Imported Website Summary</strong>
<span id="bi-overall-score" class="bi-overall-score"></span>
</div>
<div id="bi-phase-scores" class="bi-phase-scores"></div>
<div id="bi-checklist" class="bi-checklist"></div>
<div id="bi-merge-preview" class="bi-merge-preview"></div>
</div>

<div id="bi-results" class="bi-results" style="display:none">
<div id="bi-warnings" class="bi-warnings" style="display:none"></div>
<div id="bi-confidence" class="bi-confidence"></div>

<div class="bi-grid-2">
<div class="bi-card">
<div class="bi-card-label">Logo</div>
<div id="bi-logo-preview" class="bi-logo-preview"></div>
<input id="bi-logo-url" type="url" placeholder="Logo URL (optional override)" class="bi-input"/>
<label class="bi-upload-label" for="bi-logo-file">Logo upload</label><input type="file" id="bi-logo-file" accept="image/png,image/jpeg,image/webp,image/svg+xml"/>
</div>
<div class="bi-card">
<div class="bi-card-label">Business Name</div>
<input id="bi-business-name" type="text" placeholder="Business name" class="bi-input bi-input-bold"/>
<div class="bi-card-label" style="margin-top:10px">Favicon</div>
<input id="bi-favicon-url" type="url" placeholder="Favicon URL" class="bi-input"/>
<div class="bi-card-label" style="margin-top:10px">Source</div>
<div id="bi-source-url" class="bi-meta"></div>
<div id="bi-fetched-at" class="bi-meta-muted"></div>
</div>
</div>

<div class="bi-card bi-card-block">
<div class="bi-card-label">Brand Colours</div>
<div id="bi-colour-grid" class="bi-colour-grid"></div>
</div>

<div class="bi-card bi-card-block">
<div class="bi-card-label">Typography</div>
<div class="bi-grid-2">
<div>
<label class="bi-field-label">Heading Font</label>
<input id="bi-heading-font" type="text" placeholder="e.g. Montserrat" class="bi-input"/>
</div>
<div>
<label class="bi-field-label">Body Font</label>
<input id="bi-body-font" type="text" placeholder="e.g. Open Sans" class="bi-input"/>
</div>
</div>
<div id="bi-font-preview" class="bi-font-preview"></div>
</div>

<div class="bi-grid-2">
<div class="bi-card">
<div class="bi-card-label">Header Navigation (detected)</div>
<div id="bi-nav-links" class="bi-link-list"></div>
</div>
<div class="bi-card">
<div class="bi-card-label">Footer Navigation (detected)</div>
<div id="bi-footer-links" class="bi-link-list"></div>
</div>
</div>

<div class="bi-card bi-card-block">
<div class="bi-card-label">Contact (detected)</div>
<div id="bi-contact-info" class="bi-link-list"></div>
</div>

<div id="bi-detected-services" class="bi-card bi-card-block" style="display:none">
<div class="bi-card-label">Detected Services (not auto-enabled)</div>
<div id="bi-services-list" class="bi-link-list"></div>
</div>

<div class="bi-action-bar">
<button class="bi-btn bi-btn-primary" type="button" onclick="biApplyToProfile()" id="bi-apply-profile-btn">${options.mode === "pharmacy" ? "Apply to Profile" : "Apply Brand to Profile"}</button>
<button class="bi-btn bi-btn-secondary" type="button" onclick="biSave(false)">Save Brand Draft</button>
<button class="bi-btn bi-btn-ghost" type="button" onclick="biRun()">Re-Analyse</button>
<div id="bi-action-status" class="bi-action-status"></div>
</div>
</div>
</div>`;
}

export function brandImportPanelCss(): string {
  return `.brand-import-panel{font-size:14px}
.bi-url-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px 20px;margin-bottom:16px}
.bi-url-title{font-weight:700;font-size:14px;color:#1e3a5f;margin-bottom:6px}
.bi-url-desc{font-size:13px;color:#64748b;margin:0 0 12px;line-height:1.45}
.bi-url-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.bi-url-row input{flex:1;min-width:220px;padding:10px 14px;border:1px solid #d1d5db;border-radius:7px;font-size:14px}
.bi-run-btn,.bi-btn{border:0;border-radius:8px;padding:10px 18px;font-weight:700;cursor:pointer;white-space:nowrap}
.bi-run-btn,.bi-btn-primary{background:#005eb8;color:#fff}
.bi-btn-secondary{background:#374151;color:#fff}
.bi-btn-ghost{background:#e2e8f0;color:#334155}
.bi-status{margin-top:10px;font-size:12px;color:#6b7280;min-height:18px}
.bi-error{margin-top:10px;padding:12px 14px;border-radius:8px;background:#fef2f2;border:1px solid #fecaca;color:#991b1b;font-size:13px;line-height:1.45}
.bi-analysis-summary{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px;margin-bottom:16px}
.bi-summary-header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.bi-overall-score{background:#ecfdf5;color:#065f46;border-radius:999px;padding:6px 14px;font-size:13px;font-weight:800}
.bi-phase-scores{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;margin-bottom:12px}
.bi-phase-row{display:flex;justify-content:space-between;gap:8px;padding:8px 10px;background:#f8fafc;border-radius:8px;font-size:12px}
.bi-phase-row.complete{color:#065f46}
.bi-phase-row.partial{color:#854d0e}
.bi-phase-row.needs{color:#991b1b}
.bi-checklist{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}
.bi-check-item{font-size:12px;padding:6px 0;border-bottom:1px solid #f1f5f9}
.bi-check-item.done{color:#065f46}
.bi-check-item.warn{color:#854d0e}
.bi-check-item.required{color:#991b1b}
.bi-merge-preview{font-size:12px;color:#475569}
.bi-merge-row{display:flex;gap:8px;padding:4px 0;border-bottom:1px solid #f8fafc}
.bi-merge-row .skip{color:#9ca3af}
.bi-results{display:block}
.bi-warnings{background:#fffbeb;border:1px solid #fbbf24;border-radius:8px;padding:12px 16px;margin-bottom:14px;font-size:13px;color:#92400e}
.bi-confidence{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.bi-grid-2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:14px}
.bi-card{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:14px}
.bi-card-block{margin-bottom:14px}
.bi-card-label{font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
.bi-input{width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px}
.bi-input-bold{font-weight:600}
.bi-logo-preview{min-height:48px;display:flex;align-items:center;gap:10px;margin-bottom:10px}
.bi-upload-label{display:inline-block;margin-top:8px;font-size:12px;font-weight:700;color:#005eb8;cursor:pointer}
.bi-meta{font-size:12px;color:#4b5563;word-break:break-all}
.bi-meta-muted{font-size:11px;color:#9ca3af;margin-top:4px}
.bi-colour-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px}
.bi-field-label{font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px}
.bi-font-preview{font-size:12px;color:#6b7280;margin-top:8px}
.bi-link-list{font-size:13px;color:#374151}
.bi-action-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px}
.bi-action-status{font-size:12px;color:#6b7280;margin-left:auto}
@media(max-width:900px){.bi-grid-2{grid-template-columns:1fr}}`;
}

/** Client-side brand import script — pharmacy mode uses full website analysis workflow. */
export function renderBrandImportClientScript(mode: BrandImportPanelMode): string {
  const isPharmacy = mode === "pharmacy";
  const runLabel = isPharmacy ? "Analyse Existing Website" : "Import Brand";

  // Mode-specific blocks as plain strings — esbuild breaks nested template ${var} inside returned templates.
  const biRunPharmacy = [
    "        endpoint = '/api/pharmacy/profile/'+biSlug()+'/analyze-website';",
    "        var payload = { websiteUrl: url, url: url };",
    "        var r = await fetch(endpoint, { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json','Accept':'application/json'}, body: JSON.stringify(payload) });",
    "        var data = await r.json().catch(function(){ return {}; });",
    "        if (!r.ok) throw new Error('POST '+endpoint+' → HTTP '+r.status+': '+(data.error || r.statusText || 'Analysis failed'));",
    "        if (!data.analysis || !data.analysis.brand) throw new Error('POST '+endpoint+' → invalid response (missing analysis.brand)');",
    "        biAnalysis = data.analysis;",
    "        biRender(data.analysis.brand);",
    "        renderAnalysisSummary(data.analysis);",
    "        renderDetectedServices(data.analysis.detectedServices);",
    "        if (results) results.style.display = 'block';",
    "        if (summary) { summary.style.display = 'block'; try { summary.scrollIntoView({ behavior:'smooth', block:'nearest' }); } catch(_e){} }",
    "        clearBiError();",
    "        biStatus('Analysis complete. Review imported values, then click Apply to Profile.');",
  ].join("\n");

  const biRunLse = [
    "        endpoint = '/api/brand-import/'+slug;",
    "        var r2 = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ url }) });",
    "        var data2 = await r2.json().catch(function(){ return {}; });",
    "        if (!r2.ok) throw new Error('POST '+endpoint+' → HTTP '+r2.status+': '+(data2.error || 'Import failed'));",
    "        biRender(data2);",
    "        clearBiError();",
    "        biStatus('Import complete. Review values, then apply.');",
  ].join("\n");

  const biApplyPharmacy = [
    "      var applyEndpoint = '/api/pharmacy/profile/'+biSlug()+'/apply-brand-import';",
    "      var data = await fetch(applyEndpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(Object.assign({}, biCollect(), biAnalysis && biAnalysis.profilePatch ? { analysisPatch: biAnalysis.profilePatch } : {}))}).then(function(r){ return r.json().then(function(j){ if(!r.ok) throw new Error('POST '+applyEndpoint+' → HTTP '+r.status+': '+(j.error||'Apply failed')); return j; }); });",
  ].join("\n");

  const biApplyLse = [
    "      var data = await fetch('/api/brand-import/'+biSlug()+'/apply',{method:'POST'}).then(function(r){ return r.json(); });",
  ].join("\n");

  const common = [
    "(function(){",
    "  var biProfile = null;",
    "  var biAnalysis = null;",
    "  var BI_MODE = " + JSON.stringify(mode) + ";",
    "  var RUN_LABEL = " + JSON.stringify(runLabel) + ";",
    "  var COLOUR_FIELDS = [",
    "    { key: 'primaryColour', label: 'Primary' },",
    "    { key: 'secondaryColour', label: 'Secondary' },",
    "    { key: 'accentColour', label: 'Accent' },",
    "    { key: 'buttonColour', label: 'Button BG' },",
    "    { key: 'buttonTextColour', label: 'Button Text' },",
    "    { key: 'headingColour', label: 'Heading' },",
    "    { key: 'bodyTextColour', label: 'Body Text' },",
    "    { key: 'backgroundColour', label: 'Background' },",
    "    { key: 'headerBackgroundColour', label: 'Header BG' },",
    "    { key: 'headerTextColour', label: 'Header Text' },",
    "    { key: 'footerBackgroundColour', label: 'Footer BG' },",
    "    { key: 'footerTextColour', label: 'Footer Text' },",
    "    { key: 'footerLinkColour', label: 'Footer Link' },",
    "    { key: 'footerAccentColour', label: 'Footer Accent' }",
    "  ];",
    "",
    "  function biSlug(){",
    "    if (BI_MODE === 'pharmacy') return typeof SLUG !== 'undefined' ? SLUG : (document.body.dataset.slug || 'pharmaconnect');",
    "    var sel = document.getElementById('project-select');",
    "    return sel ? sel.value : '';",
    "  }",
    "",
    "  function biStatus(msg,isError){",
    "    var el = document.getElementById('bi-status');",
    "    if (!el) return;",
    "    el.textContent = msg;",
    "    el.style.color = isError ? '#dc2626' : '#6b7280';",
    "  }",
    "",
    "  function clearBiError(){",
    "    var el = document.getElementById('bi-error');",
    "    if (el) { el.style.display = 'none'; el.textContent = ''; }",
    "  }",
    "",
    "  function showBiError(err, endpoint){",
    "    var msg = err && err.message ? err.message : String(err);",
    "    biStatus(msg, true);",
    "    var el = document.getElementById('bi-error');",
    "    if (el) {",
    "      el.style.display = 'block';",
    "      el.innerHTML = '<strong>Analysis failed</strong>'+(endpoint ? '<div>Endpoint: '+endpoint+'</div>' : '')+'<div>'+msg+'</div>';",
    "    }",
    "  }",
    "",
    "  function biActionStatus(msg,isSuccess){",
    "    var el = document.getElementById('bi-action-status');",
    "    if (!el) return;",
    "    el.textContent = msg;",
    "    el.style.color = isSuccess ? '#059669' : '#6b7280';",
    "    if (isSuccess) setTimeout(function(){ el.textContent = ''; }, 4000);",
    "  }",
    "",
    "  function confBadge(label,score){",
    "    var color = score >= 70 ? '#d1fae5' : score >= 40 ? '#fef9c3' : '#fee2e2';",
    "    var text = score >= 70 ? '#065f46' : score >= 40 ? '#854d0e' : '#991b1b';",
    "    return '<span style=\"display:inline-flex;align-items:center;gap:5px;background:'+color+';color:'+text+';border-radius:12px;padding:4px 12px;font-size:11px;font-weight:700\">'+label+': '+score+'%</span>';",
    "  }",
    "",
    "  function colourField(key,label,value){",
    "    var safeVal = (value && value.match(/^#[0-9a-fA-F]{3,6}$/)) ? value : '#888888';",
    "    return '<div><div class=\"bi-card-label\">'+label+'</div><div style=\"display:flex;align-items:center;gap:8px\">'",
    "      +'<input type=\"color\" id=\"bi-col-'+key+'\" value=\"'+safeVal+'\" style=\"width:38px;height:32px;border:1px solid #d1d5db;border-radius:5px;cursor:pointer;padding:1px\">'",
    "      +'<input type=\"text\" id=\"bi-coltxt-'+key+'\" value=\"'+(value||'')+'\" maxlength=\"7\" placeholder=\"#rrggbb\" class=\"bi-input\" style=\"font-family:monospace\"></div></div>';",
    "  }",
    "",
    "  function phaseIcon(status){",
    "    if (status === 'complete') return '\\u2713';",
    "    if (status === 'partial') return '\\u26a0';",
    "    return '\\u25cb';",
    "  }",
    "",
    "  function renderAnalysisSummary(analysis){",
    "    var box = document.getElementById('bi-analysis-summary');",
    "    if (!box || !analysis) return;",
    "    box.style.display = 'block';",
    "    var scoreEl = document.getElementById('bi-overall-score');",
    "    if (scoreEl && analysis.projectedCompleteness){",
    "      scoreEl.textContent = 'Profile Completion: '+analysis.projectedCompleteness.score+'%';",
    "    }",
    "    var phasesEl = document.getElementById('bi-phase-scores');",
    "    if (phasesEl && analysis.phases){",
    "      phasesEl.innerHTML = analysis.phases.map(function(p){",
    "        var cls = p.status === 'complete' ? 'complete' : p.status === 'partial' ? 'partial' : 'needs';",
    "        return '<div class=\"bi-phase-row '+cls+'\"><span>'+phaseIcon(p.status)+' '+p.label+'</span><strong>'+(p.status==='complete'?'Complete':p.status==='partial'?'Partial':'Needs input')+'</strong></div>';",
    "      }).join('');",
    "    }",
    "    var checklistEl = document.getElementById('bi-checklist');",
    "    if (checklistEl && analysis.checklist){",
    "      checklistEl.innerHTML = analysis.checklist.map(function(item){",
    "        var icon = item.status === 'done' ? '\\u2713' : item.status === 'warn' ? '\\u26a0' : '\\u25cf';",
    "        return '<div class=\"bi-check-item '+item.status+'\">'+icon+' '+item.label+'</div>';",
    "      }).join('');",
    "    }",
    "    var mergeEl = document.getElementById('bi-merge-preview');",
    "    if (mergeEl && analysis.mergePreview){",
    "      var rows = analysis.mergePreview.filter(function(r){ return r.action === 'skip'; });",
    "      if (rows.length){",
    "        mergeEl.innerHTML = '<strong>Existing values preserved:</strong> '+rows.map(function(r){",
    "          return r.label+' (keeping: '+r.existing+')';",
    "        }).join(' \\u00b7 ');",
    "      } else {",
    "        mergeEl.textContent = 'All imported values will fill empty profile fields.';",
    "      }",
    "    }",
    "  }",
    "",
    "  window.biCollect = function(){",
    "    var p = JSON.parse(JSON.stringify(biProfile || {}));",
    "    p.logoUrl = (document.getElementById('bi-logo-url')||{}).value || p.logoUrl || '';",
    "    p.faviconUrl = (document.getElementById('bi-favicon-url')||{}).value || p.faviconUrl || '';",
    "    p.businessName = (document.getElementById('bi-business-name')||{}).value || p.businessName || '';",
    "    p.headingFont = (document.getElementById('bi-heading-font')||{}).value || '';",
    "    p.bodyFont = (document.getElementById('bi-body-font')||{}).value || '';",
    "    COLOUR_FIELDS.forEach(function(f){",
    "      var txt = document.getElementById('bi-coltxt-'+f.key);",
    "      if (txt && txt.value.match(/^#[0-9a-fA-F]{3,6}$/)) p[f.key] = txt.value;",
    "    });",
    "    return p;",
    "  };",
    "",
    "  window.biCollectProfilePatch = function(){",
    "    var p = biCollect();",
    "    var heading = p.headingColour || p.bodyTextColour || '';",
    "    var body = p.bodyTextColour || '';",
    "    var muted = body && body !== heading ? body : '#5F6C7B';",
    "    return {",
    "      logoUrl: p.logoUrl || '', faviconUrl: p.faviconUrl || '',",
    "      pharmacyName: p.businessName || '', tradingName: p.businessName || '',",
    "      brandPrimaryColor: p.primaryColour || '', brandSecondaryColor: p.secondaryColour || '',",
    "      brandCtaColor: p.buttonColour || '', brandAccentColor: p.accentColour || '',",
    "      brandBackgroundColor: p.backgroundColour || '', brandTextColor: heading, brandMutedTextColor: muted,",
    "      brandHeaderBackgroundColor: p.headerBackgroundColour || '', brandHeaderTextColor: p.headerTextColour || '',",
    "      brandFooterBackgroundColor: p.footerBackgroundColour || '', brandFooterTextColor: p.footerTextColour || '',",
    "      brandFooterLinkColor: p.footerLinkColour || '', brandFooterAccentColor: p.footerAccentColour || '',",
    "      fontHeading: p.headingFont || '', fontBody: p.bodyFont || '',",
    "      headerLogoUrl: p.logoUrl || '', footerLogoUrl: p.logoUrl || '',",
    "      website: p.sourceUrl || (document.getElementById('bi-url')||{}).value || '',",
    "      phone: (p.contact && p.contact.phone) || '', businessEmail: (p.contact && p.contact.email) || '',",
    "      headerCtaText: p.ctaText || '', headerCtaUrl: p.ctaUrl || p.sourceUrl || '#contact', preferredCta: p.ctaText || '',",
    "      headerNavLinks: (p.navigationLinks||[]).map(function(l,i){ return { label:l.label, url:l.href, order:i+1, visible:true }; }),",
    "      footerLinks: (p.footerLinks||[]).map(function(l,i){ return { label:l.label, url:l.href, order:i+1 }; })",
    "    };",
    "  };",
    "",
    "  function applyBrandPatchToForm(patch){",
    "    Object.keys(patch).forEach(function(key){",
    "      if (key === 'headerNavLinks' || key === 'footerLinks') return;",
    "      var el = document.querySelector('[data-field=\"'+key+'\"]') || document.getElementById(key);",
    "      if (el && patch[key] != null && patch[key] !== '') el.value = patch[key];",
    "    });",
    "    if (patch.headerNavLinks && patch.headerNavLinks.length){",
    "      var tbody = document.getElementById('headerNavBody');",
    "      if (tbody){",
    "        tbody.innerHTML = patch.headerNavLinks.map(function(l,i){",
    "          return '<tr data-nav-row=\"'+i+'\"><td><input type=\"text\" class=\"nav-label\" value=\"'+String(l.label||'').replace(/\"/g,'&quot;')+'\"/></td>'",
    "            +'<td><input type=\"text\" class=\"nav-url\" value=\"'+String(l.url||'#').replace(/\"/g,'&quot;')+'\"/></td>'",
    "            +'<td><input type=\"number\" class=\"nav-order\" value=\"'+(l.order||i+1)+'\" min=\"1\"/></td>'",
    "            +'<td><label class=\"check-row\"><input type=\"checkbox\" class=\"nav-visible\" '+(l.visible!==false?'checked':'')+'/> Show</label></td></tr>';",
    "        }).join('');",
    "      }",
    "    }",
    "    if (patch.footerLinks && patch.footerLinks.length){",
    "      var ft = document.getElementById('footerLinks');",
    "      if (ft) ft.value = patch.footerLinks.map(function(l){ return l.label+' | '+l.url; }).join('\\n');",
    "    }",
    "    if (typeof updateLivePreview === 'function') updateLivePreview();",
    "  }",
    "",
    "  function updateDashboardCompleteness(completeness){",
    "    if (!completeness) return;",
    "    var headerScore = document.getElementById('headerScore');",
    "    if (headerScore){ headerScore.textContent = 'Profile completeness: '+completeness.score+'%'; headerScore.className = 'score-badge'+(completeness.score>=80?'':' warn'); }",
    "    var sectionScores = document.getElementById('sectionScores');",
    "    if (sectionScores){ sectionScores.innerHTML = completeness.sections.map(function(s){ var st = s.status==='complete'?'\\u2713':s.status==='partial'?'\\u26a0':'\\u25cb'; return '<div class=\"score-row\"><span>'+st+' '+s.label+'</span><strong>'+Math.round((s.score/s.maxScore)*100)+'%</strong></div>'; }).join(''); }",
    "    var missingList = document.getElementById('missingList');",
    "    if (missingList){ missingList.innerHTML = (completeness.missingItems||[]).slice(0,12).map(function(m){ return '<li>'+m+'</li>'; }).join('') || '<li>Profile looks complete.</li>'; }",
    "  }",
    "",
    "  window.biApplyToProfile = async function(){",
    "    var patch = biCollectProfilePatch();",
    "    applyBrandPatchToForm(patch);",
    "    if (BI_MODE !== 'pharmacy') return;",
    "    biActionStatus('Applying to profile\\u2026');",
    "    try {",
    isPharmacy ? biApplyPharmacy : biApplyLse,
    "      if (!data.ok) throw new Error(data.error || 'Apply failed');",
    "      biActionStatus('Analysis applied \\u2014 review fields and save profile.', true);",
    "      clearBiError();",
    "      if (typeof updateLivePreview === 'function') updateLivePreview();",
    "      var status = document.getElementById('saveStatus');",
    "      if (status) status.textContent = 'Website analysis applied \\u2014 review and save profile';",
    "      if (data.completeness) updateDashboardCompleteness(data.completeness);",
    "      if (data.skipped && data.skipped.length) biStatus('Preserved existing values for: '+data.skipped.slice(0,5).join(', '));",
    "    } catch(e) { biActionStatus('Apply failed: '+e.message, false); showBiError(e); }",
    "  };",
    "",
    "  function biRender(profile){",
    "    biProfile = profile;",
    "    var results = document.getElementById('bi-results');",
    "    if (results) results.style.display = 'block';",
    "    var warnEl = document.getElementById('bi-warnings');",
    "    if (warnEl){ if (profile.warnings && profile.warnings.length){ warnEl.innerHTML = '<strong>Notes:</strong> '+profile.warnings.join(' \\u00b7 '); warnEl.style.display = 'block'; } else warnEl.style.display = 'none'; }",
    "    var conf = profile.confidence || {};",
    "    var confEl = document.getElementById('bi-confidence');",
    "    if (confEl) confEl.innerHTML = confBadge('Logo', conf.logo||0)+' '+confBadge('Colours', conf.colours||0)+' '+confBadge('Fonts', conf.fonts||0)+' '+confBadge('Contact', conf.contact||0);",
    "    var logoEl = document.getElementById('bi-logo-preview');",
    "    if (logoEl) logoEl.innerHTML = profile.logoUrl ? '<img src=\"'+profile.logoUrl+'\" alt=\"Logo\" style=\"max-height:60px;max-width:180px;object-fit:contain;border:1px solid #f1f5f9;border-radius:4px;background:#f8fafc;padding:4px\">' : '<span style=\"color:#9ca3af;font-size:12px\">No logo detected</span>';",
    "    var logoInput = document.getElementById('bi-logo-url'); if (logoInput) logoInput.value = profile.logoUrl || '';",
    "    var favInput = document.getElementById('bi-favicon-url'); if (favInput) favInput.value = profile.faviconUrl || '';",
    "    var nameInput = document.getElementById('bi-business-name'); if (nameInput) nameInput.value = profile.businessName || '';",
    "    var srcEl = document.getElementById('bi-source-url'); if (srcEl) srcEl.textContent = profile.sourceUrl || '';",
    "    var fetchedEl = document.getElementById('bi-fetched-at');",
    "    if (fetchedEl) fetchedEl.textContent = profile.fetchedAt ? 'Analysed: '+new Date(profile.fetchedAt).toLocaleString('en-GB') : '';",
    "    var colGrid = document.getElementById('bi-colour-grid');",
    "    if (colGrid){ colGrid.innerHTML = COLOUR_FIELDS.map(function(f){ return colourField(f.key,f.label,profile[f.key]); }).join(''); }",
    "    var hf = document.getElementById('bi-heading-font'); if (hf) hf.value = profile.headingFont || '';",
    "    var bf = document.getElementById('bi-body-font'); if (bf) bf.value = profile.bodyFont || '';",
    "    var fp = document.getElementById('bi-font-preview');",
    "    if (fp) fp.innerHTML = (profile.headingFont||profile.bodyFont) ? '<span style=\"font-weight:700\">Heading: '+(profile.headingFont||'(system)')+'</span> \\u00b7 <span>Body: '+(profile.bodyFont||'(system)')+'</span>' : '<span style=\"color:#9ca3af\">No custom fonts detected.</span>';",
    "    function renderLinks(elId, links){",
    "      var el = document.getElementById(elId); if (!el) return;",
    "      if (links && links.length) el.innerHTML = links.map(function(l){ return '<div style=\"padding:4px 0;border-bottom:1px solid #f1f5f9\"><a href=\"'+l.href+'\" target=\"_blank\" rel=\"noopener\" style=\"color:#1d4ed8;text-decoration:none\">'+l.label+'</a></div>'; }).join('');",
    "      else el.innerHTML = '<span style=\"color:#9ca3af\">None detected</span>';",
    "    }",
    "    renderLinks('bi-nav-links', profile.navigationLinks);",
    "    renderLinks('bi-footer-links', profile.footerLinks);",
    "    var contactEl = document.getElementById('bi-contact-info');",
    "    if (contactEl){ var c = profile.contact || {}; contactEl.innerHTML = [c.phone?'<div><strong>Phone:</strong> '+c.phone+'</div>':'',c.email?'<div><strong>Email:</strong> '+c.email+'</div>':'',c.address?'<div><strong>Address:</strong> '+c.address+'</div>':''].filter(Boolean).join('') || '<span style=\"color:#9ca3af\">None detected</span>'; }",
    "    if (profile.ctaText){ contactEl.innerHTML += '<div><strong>Primary CTA:</strong> '+profile.ctaText+(profile.ctaUrl?' \\u2192 '+profile.ctaUrl:'')+'</div>'; }",
    "  }",
    "",
    "  function renderDetectedServices(services){",
    "    var box = document.getElementById('bi-detected-services'); var list = document.getElementById('bi-services-list');",
    "    if (!box || !list) return;",
    "    if (!services || !services.length){ box.style.display = 'none'; return; }",
    "    box.style.display = 'block';",
    "    list.innerHTML = services.map(function(s){ return '<div style=\"padding:4px 0\">'+s.serviceName+' <span style=\"color:#64748b\">('+s.confidence+'% confidence)</span></div>'; }).join('');",
    "  }",
    "",
    "  window.biLoad = async function(){",
    "    var slug = biSlug(); if (!slug){ biStatus('No project selected.', true); return; }",
    "    biStatus('Loading saved analysis\\u2026');",
    "    try {",
    "      var r = await fetch('/api/brand-import/'+slug);",
    "      if (r.status === 404){",
    "        if (typeof INITIAL_BRAND !== 'undefined' && (INITIAL_BRAND.logoUrl || INITIAL_BRAND.primaryColour)){ biRender(INITIAL_BRAND); biStatus('Profile branding loaded. Enter a website URL to run full analysis.'); }",
    "        else biStatus('Enter a website URL above to analyse and import your pharmacy profile.');",
    "        return;",
    "      }",
    "      if (!r.ok) throw new Error('HTTP '+r.status);",
    "      biRender(await r.json()); biStatus('Previous analysis loaded. Re-analyse to refresh.');",
    "    } catch(e){ biStatus('Could not load profile: '+e.message, true); }",
    "  };",
    "",
    "  window.biRun = async function(){",
    "    var slug = biSlug();",
    "    if (!slug){ biStatus('No slug configured.', true); return; }",
    "    var urlEl = document.getElementById('bi-url');",
    "    var url = urlEl ? urlEl.value.trim() : '';",
    "    if (!url){ biStatus('Enter a website URL first.', true); return; }",
    "    if (!url.startsWith('http')) url = 'https://'+url;",
    "    var btn = document.getElementById('bi-run-btn');",
    "    if (btn){ btn.disabled = true; btn.textContent = 'Analysing\\u2026'; }",
    "    clearBiError();",
    "    biStatus('Analysing website \\u2014 identity, branding, navigation, contact, location and services\\u2026');",
    "    var results = document.getElementById('bi-results');",
    "    var summary = document.getElementById('bi-analysis-summary');",
    "    if (results) results.style.display = 'none';",
    "    if (summary) summary.style.display = 'none';",
    "    var endpoint = '';",
    "    try {",
    "      if (BI_MODE === 'pharmacy'){",
    biRunPharmacy,
    "      } else {",
    biRunLse,
    "      }",
    "    } catch(e){ showBiError(e, endpoint); }",
    "    finally { if (btn){ btn.disabled = false; btn.textContent = RUN_LABEL; } }",
    "  };",
    "",
    "  window.biSave = async function(){",
    "    var slug = biSlug(); if (!slug || !biProfile){ biActionStatus('No profile loaded.', false); return; }",
    "    biActionStatus('Saving\\u2026');",
    "    try {",
    "      var r = await fetch('/api/brand-import/'+slug, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(biCollect()) });",
    "      var data = await r.json(); if (!r.ok) throw new Error(data.error || 'Save failed');",
    "      biProfile = data; biActionStatus('Brand draft saved.', true);",
    "    } catch(e){ biActionStatus(e.message, false); }",
    "  };",
    "",
    "  var logoFile = document.getElementById('bi-logo-file');",
    "  if (logoFile){ logoFile.addEventListener('change', async function(e){",
    "    var file = e.target.files && e.target.files[0]; if (!file || BI_MODE !== 'pharmacy') return;",
    "    var fd = new FormData(); fd.append('logo', file);",
    "    var res = await fetch('/api/pharmacy/profile/'+biSlug()+'/logo', { method:'POST', credentials:'same-origin', body: fd });",
    "    var json = await res.json();",
    "    if (json.ok && json.logoUrl){ document.getElementById('bi-logo-url').value = json.logoUrl; if (biProfile) biProfile.logoUrl = json.logoUrl; biRender(biProfile||biCollect()); if (typeof updateLivePreview==='function') updateLivePreview(); }",
    "  }); }",
    "",
    "  if (BI_MODE === 'pharmacy') biLoad();",
    "})();",
  ];

  return common.join("\n");
}

function esc(v: string): string {
  return v.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}
