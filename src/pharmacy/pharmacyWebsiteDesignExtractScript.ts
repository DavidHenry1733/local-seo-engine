/**
 * Browser-side design extraction script (plain JS string for Playwright evaluate).
 * Captures structured component models, layout DNA, and typography DNA.
 */
export const PAGE_DESIGN_EXTRACT_SCRIPT = String.raw`(function() {
  function pick(el) {
    if (!el) return null;
    var st = getComputedStyle(el);
    var rect = el.getBoundingClientRect();
    return {
      selector: el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className ? "." + String(el.className).split(/\s+/).slice(0, 2).join(".") : ""),
      backgroundColor: st.backgroundColor,
      color: st.color,
      fontFamily: st.fontFamily,
      fontSize: st.fontSize,
      fontWeight: st.fontWeight,
      fontStyle: st.fontStyle,
      lineHeight: st.lineHeight,
      letterSpacing: st.letterSpacing,
      textTransform: st.textTransform,
      paddingTop: st.paddingTop,
      paddingBottom: st.paddingBottom,
      paddingLeft: st.paddingLeft,
      paddingRight: st.paddingRight,
      marginTop: st.marginTop,
      marginBottom: st.marginBottom,
      borderRadius: st.borderRadius,
      boxShadow: st.boxShadow,
      maxWidth: st.maxWidth,
      width: st.width,
      height: st.height,
      minHeight: st.minHeight,
      gap: st.gap,
      display: st.display,
      flexDirection: st.flexDirection,
      justifyContent: st.justifyContent,
      alignItems: st.alignItems,
      gridTemplateColumns: st.gridTemplateColumns,
      borderBottom: st.borderBottom,
      borderTop: st.borderTop,
      position: st.position,
      top: rect.top,
      left: rect.left,
      rectWidth: rect.width,
      rectHeight: rect.height
    };
  }
  function pickHeading(level) {
    var sel = "h" + level;
    var el = document.querySelector(sel);
    if (!el && level === 1) {
      el = document.querySelector(".entry-title, .page-title, .hero-title, .banner-title, .elementor-heading-title, main h2");
    }
    return pick(el);
  }
  function componentModel(type, el) {
    if (!el) return null;
    var st = pick(el);
    var children = Array.from(el.children || []).slice(0, 12).map(function(c) {
      return { tag: c.tagName.toLowerCase(), className: String(c.className || "").split(/\s+/).slice(0, 2).join(" ") };
    });
    return { type: type, selector: st.selector, styles: st, childCount: el.children ? el.children.length : 0, children: children };
  }
  var header = document.querySelector("header") || document.querySelector('[role="banner"]') || document.querySelector(".site-header, .main-header, #masthead");
  var footer = document.querySelector("footer") || document.querySelector('[role="contentinfo"]') || document.querySelector(".site-footer, #colophon");
  var topBar = document.querySelector(".site-top-bar, .top-bar, .topbar, .announcement-bar, .header-top, .header-bar, .elementor-location-header .top");
  var logoImg = (header && header.querySelector("img[src*='logo' i], .logo img, .brand img, .navbar-brand img, .custom-logo")) || document.querySelector("img[src*='logo' i], .logo img, .brand img, .custom-logo");
  var navRoot = (header && header.querySelector("nav, .nav, .navbar-nav, .navigation, .main-navigation, .menu, .header-nav")) || document.querySelector("nav, .main-navigation, .header-nav");
  function cssPath(el) {
    if (!el) return "";
    var id = el.id ? "#" + el.id : "";
    var cls = el.className ? "." + String(el.className).split(/\s+/).filter(Boolean).slice(0, 2).join(".") : "";
    return el.tagName.toLowerCase() + id + cls;
  }
  function visibleBg(el, skipWhite) {
    if (!el) return "";
    var nodes = [el].concat(Array.from(el.querySelectorAll ? el.querySelectorAll(".e-con, .elementor-section, .elementor-widget-wrap, .footer-widgets, .widget, section, div") : []).slice(0, 40));
    var found = "";
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!node) continue;
      var bg = getComputedStyle(node).backgroundColor;
      var hex = normHex(bg);
      if (!hex || hex === "transparent") {
        var inline = node.getAttribute && node.getAttribute("style");
        if (inline && /background/i.test(inline)) {
          var m = inline.match(/background-color\s*:\s*(#[0-9a-f]{3,8}|rgb[a]?\([^)]+\))/i);
          if (m) hex = normHex(m[1]);
        }
      }
      if (hex && hex !== "#ffffff" && hex !== "#fff") return hex;
      if (!skipWhite && hex) found = hex;
    }
    return found;
  }
  function parseFooterCssColours(footerEl) {
    var colours = [];
    if (!footerEl) return colours;
    var styles = Array.from(footerEl.querySelectorAll("style")).map(function(s){ return s.textContent || ""; }).join("\n");
    var re = /background-color\s*:\s*(#[0-9a-f]{3,8}|rgb[a]?\([^)]+\))/gi;
    var m;
    while ((m = re.exec(styles))) {
      var hex = normHex(m[1]);
      if (hex) colours.push(hex);
    }
    return colours;
  }
  function normHex(value) {
    var v = String(value || "").trim().toLowerCase();
    if (!v) return "";
    if (/^#[0-9a-f]{6}$/i.test(v)) return v;
    var rgba = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
    if (rgba) {
      var alpha = rgba[4] !== undefined ? parseFloat(rgba[4]) : 1;
      if (alpha === 0) return "";
      var r = Number(rgba[1]).toString(16).padStart(2, "0");
      var g = Number(rgba[2]).toString(16).padStart(2, "0");
      var b = Number(rgba[3]).toString(16).padStart(2, "0");
      return "#" + r + g + b;
    }
    return v;
  }
  var navIdCounter = 0;
  function nextNavId() { navIdCounter += 1; return "nav-" + navIdCounter; }
  var navigationTree = [];
  function pushNavNode(node) { navigationTree.push(node); return node.id; }
  function walkNavList(ul, parentId, depth, defaultRole) {
    if (!ul) return;
    var items = Array.from(ul.children || []).filter(function(c){ return c.tagName === "LI"; });
    items.forEach(function(li, order) {
      var directA = li.querySelector(":scope > a");
      if (!directA) return;
      var label = (directA.textContent || "").replace(/\s+/g, " ").trim();
      var href = directA.href || "";
      if (!label || !href || /^javascript:/i.test(href)) return;
      var sub = li.querySelector(":scope > ul.sub-menu, :scope > ul.dropdown-menu, :scope > ul.children, :scope > ul");
      var isServices = /^(all services|services)$/i.test(label);
      var role = isServices && sub ? "dropdown-parent" : (depth === 0 ? defaultRole : "dropdown-child");
      var id = nextNavId();
      pushNavNode({
        id: id,
        parentId: parentId,
        depth: depth,
        role: role,
        order: order,
        selector: cssPath(directA),
        href: href,
        text: label,
        visibility: getComputedStyle(li).display === "none" ? "hidden" : "visible",
        breakpointVisibility: { desktop: true, tablet: true, mobile: true }
      });
      if (sub) walkNavList(sub, id, depth + 1, "dropdown-child");
    });
  }
  if (navRoot) {
    pushNavNode({ id: "nav-root", parentId: null, depth: -1, role: "header", order: 0, selector: cssPath(navRoot), href: "", text: "Navigation Root", visibility: "visible", breakpointVisibility: { desktop: true, tablet: true, mobile: true } });
    var navUl = navRoot.tagName === "UL" ? navRoot : navRoot.querySelector("ul.nav, ul.navbar-nav, ul.menu, ul");
    if (navUl) walkNavList(navUl, "nav-root", 0, "primary-navigation");
  }
  var headerCtaEls = header ? Array.from(header.querySelectorAll("a.btn, a.theme-btn, a.elementor-button, .nav-cta, .header-cta, a[class*='btn']")).filter(function(a){
    return a.href && !a.closest("footer") && (a.textContent || "").trim();
  }) : [];
  headerCtaEls.forEach(function(a, order){
    pushNavNode({
      id: nextNavId(),
      parentId: "nav-root",
      depth: 0,
      role: "cta",
      order: 100 + order,
      selector: cssPath(a),
      href: a.href,
      text: (a.textContent || "").replace(/\s+/g, " ").trim(),
      visibility: "visible",
      breakpointVisibility: { desktop: true, tablet: true, mobile: true }
    });
  });
  var navLinks = navigationTree.filter(function(n){ return n.role !== "header"; }).map(function(n){
    return { label: n.text, href: n.href, level: n.depth + 1, isDropdown: n.role === "dropdown-parent" || n.role === "dropdown-child", children: [] };
  });
  var buttons = Array.from(document.querySelectorAll("a.btn, button, .theme-btn, .nav-cta, .cta, a[class*='btn'], .elementor-button")).slice(0, 12).map(function(el) { return pick(el); });
  var h1El = document.querySelector("h1") || document.querySelector(".entry-title, .page-title, .hero-title, .banner-title, .elementor-heading-title");
  var hero = document.querySelector(".hero, .banner, .page-banner, section.hero, .elementor-section:first-of-type")
    || (h1El ? h1El.closest(".elementor-section, .e-con, .elementor, section") : null)
    || document.querySelector("main section, .site-content section, .elementor-6434, div.elementor:not(.elementor-location-header):not(.elementor-location-footer)");
  var container = document.querySelector(".container, .wrap, main .container, .site-container, .elementor-container, #content .container, .content-area") || document.body;
  var sections = Array.from(document.querySelectorAll("main section, .site-content section, .elementor-section, .e-con, article section, .entry-content > div, .wp-block-group, div.elementor:not(.elementor-location-header):not(.elementor-location-footer)")).slice(0, 16);
  var sectionSpacing = sections.map(function(s) { return pick(s); }).filter(Boolean);
  var cards = Array.from(document.querySelectorAll(".card, .service-card, .elementor-column, .wp-block-column, article, .e-con-inner, .elementor-widget-wrap")).slice(0, 12).map(function(el) { return pick(el); });
  var footerCols = footer ? Array.from(footer.querySelectorAll(".footer-column, .footer-col, .widget, .col, .elementor-column")).slice(0, 8) : [];
  var mapEmbed = document.querySelector("iframe[src*='google.com/maps'], iframe[src*='maps.google']");
  var copyrightEl = footer ? Array.from(footer.querySelectorAll("*")).find(function(el){
    if (el.tagName === "STYLE" || el.tagName === "SCRIPT") return false;
    var t = (el.textContent || "").trim();
    return (/©|all rights reserved/i.test(t) && el.children.length === 0) || (/^copyright/i.test(t) && t.length < 200);
  }) : null;
  var footerHeading = footer ? footer.querySelector("h2,h3,h4,h5,.widget-title,.footer-title") : null;
  var hoursBlock = Array.from(document.querySelectorAll("footer .opening-hours, footer .hours, footer .opening_times, footer table, footer .elementor-widget-wrap, footer .widget")).find(function(el) {
    if (!el || el.tagName === "STYLE" || el.tagName === "SCRIPT") return false;
    var t = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!t || t.length > 600 || /--display:flex|elementor-element/.test(t)) return false;
    return /monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(t) && /\d/.test(t);
  });
  if (!hoursBlock) {
    hoursBlock = Array.from(document.querySelectorAll("footer *")).find(function(el) {
      if (!el || el.tagName === "STYLE" || el.tagName === "SCRIPT") return false;
      if (el.children && el.children.length > 6) return false;
      var t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!t || t.length > 400 || /--display:flex|elementor-element/.test(t)) return false;
      return /monday|tuesday|opening hours/i.test(t) && /\d/.test(t);
    });
  }
  var fontLinks = Array.from(document.querySelectorAll('link[href*="fonts.googleapis"], link[href*="font"]')).map(function(l) { return l.href; });
  function classifyImageRole(el) {
    if (!el) return "decorative";
    if (el.closest("header")) return "header";
    if (el.closest("footer")) return "footer";
    if (el.closest(".hero, .banner, .page-banner, #hero, [data-image-slot='hero']")) return "hero";
    if (el.closest(".trust, [data-image-slot='trust'], .trust-section")) return "trust";
    if (el.closest(".conversion, [data-image-slot='conversion'], .cta-band")) return "conversion";
    if (el.closest(".team, .staff, .pharmacist")) return "team";
    if (el.closest(".map, .location, iframe[src*='maps']")) return "location";
    if (el.closest(".gallery, .slider, .carousel, .swiper")) return "gallery";
    if (el.closest("article, .blog, .entry-content, .editorial")) return "editorial";
    if (el.closest(".support, [data-image-slot='support'], .service-definition, .section-media")) return "supporting";
    var rect = el.getBoundingClientRect();
    if (rect.top < 900 && rect.width > 200) return "hero";
    return "supporting";
  }
  function collectImageCandidates() {
    var seen = new Set();
    var out = [];
    function addFromEl(el, url, roleOverride) {
      var u = String(url || "").trim();
      if (!u || u.indexOf("data:") === 0 || seen.has(u)) return;
      seen.add(u);
      var role = roleOverride || classifyImageRole(el);
      var lazy = el ? (el.getAttribute("loading") === "lazy" || Boolean(el.getAttribute("data-src") || el.getAttribute("data-lazy-src"))) : false;
      var bg = "";
      if (el && el.getAttribute("style") && /background-image/i.test(el.getAttribute("style"))) {
        var m = String(el.getAttribute("style")).match(/url\(['"]?([^'")]+)['"]?\)/i);
        if (m) bg = m[1];
      }
      out.push({
        url: u,
        role: role,
        width: el && el.naturalWidth ? el.naturalWidth : 0,
        height: el && el.naturalHeight ? el.naturalHeight : 0,
        alt: el ? (el.getAttribute("alt") || "") : "",
        lazyLoad: lazy,
        backgroundImage: bg,
        selector: el ? cssPath(el) : "",
        visibility: el && (el.offsetParent === null || getComputedStyle(el).display === "none") ? "hidden" : "visible"
      });
    }
    Array.from(document.querySelectorAll("img")).forEach(function(el) {
      addFromEl(el, el.currentSrc || el.src, null);
      var srcset = el.getAttribute("srcset") || "";
      srcset.split(",").forEach(function(part) { addFromEl(el, part.trim().split(/\s+/)[0], null); });
      ["data-src", "data-lazy-src", "data-original", "data-bg"].forEach(function(attr) { addFromEl(el, el.getAttribute(attr), null); });
    });
    Array.from(document.querySelectorAll("source[srcset], source[src]")).forEach(function(el) {
      var srcset = el.getAttribute("srcset") || el.getAttribute("src") || "";
      srcset.split(",").forEach(function(part) { addFromEl(null, part.trim().split(/\s+/)[0], "supporting"); });
    });
    Array.from(document.querySelectorAll("[style*='background']")).forEach(function(el) {
      var m = String(el.getAttribute("style") || "").match(/url\(['"]?([^'")]+)['"]?\)/i);
      if (m) addFromEl(el, m[1], classifyImageRole(el));
    });
    return out.slice(0, 80);
  }
  var images = collectImageCandidates();
  var imageIntelligence = images.map(function(img, idx){
    return {
      id: "img-" + (idx + 1),
      role: img.role,
      selector: img.selector,
      asset: img.url,
      width: img.width,
      height: img.height,
      aspectRatio: img.width && img.height ? (img.width + "/" + img.height) : "",
      alt: img.alt,
      lazyLoad: img.lazyLoad,
      backgroundImage: img.backgroundImage || "",
      visibility: img.visibility
    };
  });
  function footerLinksFromRoot(root) {
    if (!root) return [];
    return Array.from(root.querySelectorAll("a")).map(function(a) {
      return { label: (a.textContent || "").replace(/\s+/g, " ").trim(), href: a.href || "" };
    }).filter(function(l) { return l.label && l.href && !/^javascript:/i.test(l.href); });
  }
  var allFooterLinks = footerLinksFromRoot(footer);
  var legalPattern = /terms|privacy|cookie|gdpr|legal/i;
  var socialPattern = /facebook|twitter|youtube|instagram|linkedin|\bx\b/i;
  var footerLegalLinks = allFooterLinks.filter(function(l) { return legalPattern.test(l.label); });
  var footerSocialLinks = allFooterLinks.filter(function(l) { return socialPattern.test(l.label) && l.href; });
  var footerQuickLinks = allFooterLinks.filter(function(l) {
    return !legalPattern.test(l.label) && !socialPattern.test(l.label);
  });
  footerQuickLinks.forEach(function(l, order){
    pushNavNode({
      id: nextNavId(),
      parentId: null,
      depth: 0,
      role: "footer-navigation",
      order: order,
      selector: "footer a",
      href: l.href,
      text: l.label,
      visibility: "visible",
      breakpointVisibility: { desktop: true, tablet: true, mobile: true }
    });
  });
  footerLegalLinks.forEach(function(l, order){
    pushNavNode({
      id: nextNavId(),
      parentId: null,
      depth: 0,
      role: "legal-navigation",
      order: order,
      selector: "footer a",
      href: l.href,
      text: l.label,
      visibility: "visible",
      breakpointVisibility: { desktop: true, tablet: true, mobile: true }
    });
  });
  footerSocialLinks.forEach(function(l, order){
    pushNavNode({
      id: nextNavId(),
      parentId: null,
      depth: 0,
      role: "social-navigation",
      order: order,
      selector: "footer a",
      href: l.href,
      text: l.label,
      visibility: "visible",
      breakpointVisibility: { desktop: true, tablet: true, mobile: true }
    });
  });
  var footerCssColours = parseFooterCssColours(footer);
  var footerUpperEl = footer ? (footer.querySelector("#colophon, footer.site-footer, footer") || footer) : null;
  var footerLowerEl = footer ? (Array.from(footer.querySelectorAll("p, div, span, .elementor-heading-title, .copyright, .site-info")).find(function(el){
    if (!el || el.tagName === "STYLE" || el.tagName === "SCRIPT") return false;
    var t = (el.textContent || "").replace(/\s+/g, " ").trim();
    return (/©|copyright/i.test(t) && t.length < 220 && el.children.length <= 2);
  }) || footer.querySelector(".footer-bottom, .site-info, .copyright")) : null;
  if (footerLowerEl && footerUpperEl && footerLowerEl === footerUpperEl) {
    footerLowerEl = footer.querySelector(".footer-width-fixer > div:last-child, .e-con:last-of-type, .elementor-widget-container:last-of-type") || footerLowerEl;
  }
  var footerUpperBg = visibleBg(footerUpperEl || footer, true) || footerCssColours[0] || visibleBg(footerUpperEl || footer, false) || "#ffffff";
  var footerLowerBg = visibleBg(footerLowerEl || footer, true) || footerCssColours[footerCssColours.length - 1] || visibleBg(footerLowerEl || footer, false) || footerUpperBg;
  var footerLayers = {
    upperLayer: {
      selector: cssPath(footerUpperEl || footer),
      backgroundColour: normHex(footerUpperBg),
      textColour: normHex(footerUpperEl ? getComputedStyle(footerUpperEl).color : (footer ? getComputedStyle(footer).color : "")),
      linkColour: normHex(footer ? getComputedStyle(footer.querySelector("a") || footer).color : ""),
      paddingTop: footerUpperEl ? getComputedStyle(footerUpperEl).paddingTop : "",
      paddingBottom: footerUpperEl ? getComputedStyle(footerUpperEl).paddingBottom : ""
    },
    lowerLayer: {
      selector: cssPath(footerLowerEl || footer),
      backgroundColour: normHex(footerLowerBg),
      textColour: normHex(footerLowerEl ? getComputedStyle(footerLowerEl).color : ""),
      linkColour: normHex(footerLowerEl && footerLowerEl.querySelector("a") ? getComputedStyle(footerLowerEl.querySelector("a")).color : ""),
      paddingTop: footerLowerEl ? getComputedStyle(footerLowerEl).paddingTop : "",
      paddingBottom: footerLowerEl ? getComputedStyle(footerLowerEl).paddingBottom : ""
    },
    groups: [],
    mobileStackOrder: ["logo", "company", "customerCare", "legal", "social", "copyright"]
  };
  if (footer) {
    var groupHeadings = Array.from(footer.querySelectorAll("h2,h3,h4,h5,.widget-title,.footer-title,.footer-heading")).slice(0, 8);
    groupHeadings.forEach(function(h, idx){
      var heading = (h.textContent || "").replace(/\s+/g, " ").trim();
      var container = h.closest(".widget, .footer-column, .footer-col, .elementor-column, .footer-widget, .elementor-widget-wrap, .elementor-element") || h.parentElement;
      var links = container ? Array.from(container.querySelectorAll("a, .elementor-icon-list-item a")).map(function(a){
        return { text: (a.textContent || "").replace(/\s+/g, " ").trim(), href: a.href || "", selector: cssPath(a) };
      }).filter(function(l){ return l.text && l.href && !/^javascript:/i.test(l.href); }) : [];
      var role = /company|about/i.test(heading) ? "company" : /customer|care|support/i.test(heading) ? "customerCare" : /social/i.test(heading) ? "social" : /legal|policy|terms/i.test(heading) ? "legal" : /hour|opening/i.test(heading) ? "hours" : /contact/i.test(heading) ? "contact" : "company";
      footerLayers.groups.push({
        id: "footer-group-" + idx,
        role: role,
        selector: cssPath(container || h),
        heading: heading,
        links: links.slice(0, 12),
        backgroundColour: normHex(visibleBg(container || footer)),
        textColour: normHex(getComputedStyle(h).color)
      });
    });
    if (!footerLayers.groups.length) {
      footerLayers.groups.push({
        id: "footer-group-company",
        role: "company",
        selector: cssPath(footer),
        heading: "Company",
        links: footerQuickLinks.slice(0, 8).map(function(l){ return { text: l.label, href: l.href, selector: "footer a" }; }),
        backgroundColour: footerLayers.upperLayer.backgroundColour,
        textColour: footerLayers.upperLayer.textColour
      });
      footerLayers.groups.push({
        id: "footer-group-legal",
        role: "legal",
        selector: cssPath(footer),
        heading: "Legal",
        links: footerLegalLinks.map(function(l){ return { text: l.label, href: l.href, selector: "footer a" }; }),
        backgroundColour: footerLayers.lowerLayer.backgroundColour,
        textColour: footerLayers.lowerLayer.textColour
      });
    }
  }
  var footerContactEl = footer ? Array.from(footer.querySelectorAll("*")).find(function(el) {
    if (!el || el.tagName === "STYLE" || el.tagName === "SCRIPT") return false;
    if (el.children && el.children.length > 4) return false;
    var t = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!t || t.length > 300 || /--display:flex|elementor-element/.test(t)) return false;
    return (/@|tel:|phone|\+\d{2}/i.test(t) || /call us|contact us/i.test(t)) && !/monday|tuesday/i.test(t);
  }) : null;
  var footerContactText = footerContactEl ? (footerContactEl.textContent || "").replace(/\s+/g, " ").trim().slice(0, 400) : "";
  var cssVars = {};
  var rootStyles = getComputedStyle(document.documentElement);
  for (var i = 0; i < rootStyles.length; i++) {
    var prop = rootStyles[i];
    if (prop.indexOf("--") === 0) cssVars[prop] = rootStyles.getPropertyValue(prop).trim();
  }
  function resolveBackground(el) {
    var node = el;
    while (node) {
      var bg = getComputedStyle(node).backgroundColor;
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return bg;
      node = node.parentElement;
    }
    return "";
  }
  var headerRect = header ? header.getBoundingClientRect() : null;
  var heroRect = hero ? hero.getBoundingClientRect() : null;
  var colourRoles = [];
  function pushColour(role, el, layer) {
    if (!el) return;
    var st = getComputedStyle(el);
    colourRoles.push({ role: role, selector: cssPath(el), computedColour: st.backgroundColor || st.color, hex: normHex(st.backgroundColor || st.color), layer: layer });
    if (st.color) colourRoles.push({ role: role + "-text", selector: cssPath(el), computedColour: st.color, hex: normHex(st.color), layer: layer });
  }
  pushColour("header-background", header, "header");
  pushColour("header-text", header, "header");
  pushColour("navigation-text", navRoot, "navigation");
  if (headerCtaEls[0]) pushColour("cta-background", headerCtaEls[0], "cta");
  if (headerCtaEls[0]) pushColour("cta-text", headerCtaEls[0], "cta");
  if (h1El) pushColour("heading-text", h1El, "body");
  pushColour("body-text", document.body, "body");
  pushColour("upper-footer-background", footerUpperEl || footer, "footer-upper");
  pushColour("lower-footer-background", footerLowerEl || footer, "footer-lower");
  pushColour("footer-text", footerUpperEl || footer, "footer-upper");
  if (footer && footer.querySelector("a")) pushColour("footer-link", footer.querySelector("a"), "footer-upper");
  if (buttons[0] && buttons[0].selector) {
    var btnEl = document.querySelector(String(buttons[0].selector).split(".")[0] === buttons[0].selector ? buttons[0].selector : buttons[0].selector);
    if (!btnEl && headerCtaEls[0]) btnEl = headerCtaEls[0];
    pushColour("button-background", btnEl, "button");
  }
  var headerHierarchy = {
    rowCount: topBar ? 2 : 1,
    announcementBar: topBar ? {
      selector: cssPath(topBar),
      backgroundColour: normHex(getComputedStyle(topBar).backgroundColor),
      textColour: normHex(getComputedStyle(topBar).color),
      paddingTop: getComputedStyle(topBar).paddingTop,
      paddingBottom: getComputedStyle(topBar).paddingBottom,
      paddingLeft: getComputedStyle(topBar).paddingLeft,
      paddingRight: getComputedStyle(topBar).paddingRight,
      alignment: getComputedStyle(topBar).textAlign,
      sticky: getComputedStyle(topBar).position === "sticky" || getComputedStyle(topBar).position === "fixed"
    } : null,
    logoBlock: {
      selector: logoImg ? cssPath(logoImg.closest(".logo, .brand, .navbar-brand, a") || logoImg) : "",
      backgroundColour: normHex(header ? getComputedStyle(header).backgroundColor : ""),
      textColour: normHex(header ? getComputedStyle(header).color : ""),
      paddingTop: header ? getComputedStyle(header).paddingTop : "",
      paddingBottom: header ? getComputedStyle(header).paddingBottom : "",
      paddingLeft: header ? getComputedStyle(header).paddingLeft : "",
      paddingRight: header ? getComputedStyle(header).paddingRight : "",
      alignment: "left",
      sticky: false,
      logoUrl: logoImg ? (logoImg.currentSrc || logoImg.src) : "",
      logoMaxHeight: logoImg ? (Math.round(logoImg.getBoundingClientRect().height) + "px") : "",
      logoPosition: "left"
    },
    navigationBlock: {
      selector: cssPath(navRoot),
      backgroundColour: normHex(navRoot ? getComputedStyle(navRoot).backgroundColor : ""),
      textColour: normHex(navRoot ? getComputedStyle(navRoot).color : ""),
      paddingTop: navRoot ? getComputedStyle(navRoot).paddingTop : "",
      paddingBottom: navRoot ? getComputedStyle(navRoot).paddingBottom : "",
      paddingLeft: navRoot ? getComputedStyle(navRoot).paddingLeft : "",
      paddingRight: navRoot ? getComputedStyle(navRoot).paddingRight : "",
      alignment: navRoot ? getComputedStyle(navRoot).justifyContent : "flex-start",
      sticky: false,
      navPlacement: "inline",
      mobileMenuBehaviour: "stacked"
    },
    ctaBlock: {
      selector: headerCtaEls[0] ? cssPath(headerCtaEls[0]) : "",
      backgroundColour: headerCtaEls[0] ? normHex(getComputedStyle(headerCtaEls[0]).backgroundColor) : "",
      textColour: headerCtaEls[0] ? normHex(getComputedStyle(headerCtaEls[0]).color) : "",
      paddingTop: headerCtaEls[0] ? getComputedStyle(headerCtaEls[0]).paddingTop : "",
      paddingBottom: headerCtaEls[0] ? getComputedStyle(headerCtaEls[0]).paddingBottom : "",
      paddingLeft: headerCtaEls[0] ? getComputedStyle(headerCtaEls[0]).paddingLeft : "",
      paddingRight: headerCtaEls[0] ? getComputedStyle(headerCtaEls[0]).paddingRight : "",
      alignment: "right",
      sticky: false,
      labels: headerCtaEls.map(function(a){ return (a.textContent || "").replace(/\s+/g, " ").trim(); }),
      hrefs: headerCtaEls.map(function(a){ return a.href; })
    },
    spacing: {
      paddingY: header ? getComputedStyle(header).paddingTop : "",
      paddingX: header ? getComputedStyle(header).paddingLeft : "",
      gap: navRoot ? getComputedStyle(navRoot).gap : ""
    },
    alignment: { logo: "left", nav: "center", cta: "right" },
    sticky: header ? (getComputedStyle(header).position === "sticky" || getComputedStyle(header).position === "fixed") : false,
    responsive: { desktopBreakpoint: "980px", mobileMenuBehaviour: "stacked" }
  };
  return {
    url: location.href,
    title: document.title,
    cssVars: cssVars,
    fontLinks: fontLinks,
    header: pick(header),
    footer: pick(footer),
    footerBackgroundColor: normHex(footerUpperBg || visibleBg(footerUpperEl || footer, false) || resolveBackground(footer)),
    topBar: pick(topBar),
    topBarText: topBar ? (topBar.textContent || "").replace(/\s+/g, " ").trim().slice(0, 500) : "",
    logo: logoImg ? { src: logoImg.currentSrc || logoImg.src, width: logoImg.naturalWidth, height: logoImg.naturalHeight, selector: logoImg.tagName.toLowerCase(), displayWidth: logoImg.getBoundingClientRect().width, displayHeight: logoImg.getBoundingClientRect().height } : null,
    navLinks: navLinks,
    navigationTree: navigationTree,
    headerHierarchy: headerHierarchy,
    footerLayers: footerLayers,
    colourRoles: colourRoles,
    imageIntelligence: imageIntelligence,
    buttons: buttons,
    typography: {
      h1: pickHeading(1),
      h2: pickHeading(2),
      h3: pickHeading(3),
      h4: pickHeading(4),
      h5: pickHeading(5),
      h6: pickHeading(6),
      body: pick(document.body),
      nav: pick(navRoot),
      button: buttons[0] || null,
      footer: pick(footer),
      label: pick(document.querySelector("label, .label"))
    },
    hero: pick(hero),
    container: pick(container),
    sections: sectionSpacing,
    cards: cards,
    images: images,
    map: mapEmbed ? { src: mapEmbed.src, selector: "iframe", height: mapEmbed.getBoundingClientRect().height } : null,
    footerColumnCount: footerCols.length || (footer ? Math.max(1, Math.round(footer.querySelectorAll(".widget, .footer-widget, .menu, .footer-column, .col-md-3, .col-lg-3").length / 2)) : 0),
    footerColumns: footerCols.map(function(c) { return pick(c); }),
    copyrightText: copyrightEl ? (copyrightEl.textContent || "").replace(/\s+/g, " ").trim().slice(0, 300) : (footer ? (footer.textContent || "").match(/©[^\n]{0,200}/i)?.[0] || "" : ""),
    footerHeadingFontSize: footerHeading ? getComputedStyle(footerHeading).fontSize : "",
    hoursText: hoursBlock ? (hoursBlock.textContent || "").replace(/\s+/g, " ").trim().slice(0, 800) : "",
    footerQuickLinks: footerQuickLinks,
    footerLegalLinks: footerLegalLinks,
    footerSocialLinks: footerSocialLinks,
    footerContactText: footerContactText,
    footerBorderColour: footer ? getComputedStyle(footer).borderTopColor : "",
    components: [
      componentModel("announcementBar", topBar),
      componentModel("header", header),
      componentModel("navigation", navRoot),
      componentModel("logoBlock", logoImg ? logoImg.closest(".logo, .brand, .navbar-brand, a") : null),
      componentModel("hero", hero),
      componentModel("footer", footer)
    ].filter(Boolean),
    layoutMeta: {
      containerMaxWidth: container ? getComputedStyle(container).maxWidth : "",
      containerWidth: container ? getComputedStyle(container).width : "",
      sectionCount: sections.length,
      avgSectionPaddingY: sectionSpacing.length ? sectionSpacing.map(function(s) { return parseFloat(s.paddingTop) || 0; }).reduce(function(a,b){return a+b;},0) / sectionSpacing.length + "px" : "",
      heroWidth: heroRect ? heroRect.width : 0,
      heroHeight: heroRect ? heroRect.height : 0,
      headerHeight: headerRect ? headerRect.height : 0,
      heroDisplay: hero ? getComputedStyle(hero).display : "",
      heroGridTemplate: hero ? getComputedStyle(hero).gridTemplateColumns : "",
      heroGap: hero ? getComputedStyle(hero).gap : "",
      heroPaddingY: hero ? getComputedStyle(hero).paddingTop : "",
      cardShadow: cards[0] ? cards[0].boxShadow : "",
      cardPadding: cards[0] ? cards[0].paddingTop : "",
      whitespaceDensity: sections.length > 8 ? "spacious" : sections.length > 4 ? "balanced" : "compact"
    },
    responsive: {
      desktop: { width: window.innerWidth, height: window.innerHeight },
      breakpoints: { desktop: "1440px", tablet: "768px", mobile: "390px" }
    }
  };
})()`;
