(() => {
  if (window.__copyHtmlLoaded) return;
  window.__copyHtmlLoaded = true;

  const IS_TOP = window === window.top;
  const ACCENT = "#34d399";
  const ACCENT_DARK = "#06281e";

  let lastRightClicked = null;

  // Capture phase so pages that stopPropagation() on contextmenu can't hide the target.
  window.addEventListener(
    "contextmenu",
    (e) => {
      lastRightClicked = e.target;
    },
    true
  );

  // ------------------------------------------------------------------
  // Message dispatcher
  // ------------------------------------------------------------------
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "PING") {
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === "TOGGLE_PICKER") {
      if (IS_TOP) Picker.toggle();
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === "COPY_HTML") {
      const el = getTargetElement();
      if (!el) {
        sendResponse({ ok: false });
        return;
      }
      copyToClipboard(el.outerHTML);
      showToast("✓ HTML copied!");
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === "COPY_HTML_CSS") {
      const el = getTargetElement();
      if (!el) {
        sendResponse({ ok: false });
        return;
      }
      const html = getInlineStyledHtml(el);
      copyToClipboard(html);
      showToast("✓ HTML with inline CSS copied!");
      sendResponse({ ok: true });
      return;
    }
    if (msg?.type === "COPY_FULL_PAGE") {
      getFullPageHtml(false).then((html) => {
        copyToClipboard(html);
        showToast("✓ Full page HTML copied!");
        sendResponse({ ok: true });
      });
      return true;
    }
    if (msg?.type === "COPY_FULL_PAGE_CSS") {
      getFullPageHtml(true).then((html) => {
        copyToClipboard(html);
        showToast("✓ Full page with embedded CSS copied!");
        sendResponse({ ok: true });
      });
      return true;
    }
  });

  function getTargetElement() {
    return lastRightClicked instanceof Element
      ? lastRightClicked
      : document.activeElement instanceof Element
      ? document.activeElement
      : document.body;
  }

  // Injected while picker mode is active so the crosshair cursor wins over
  // any page CSS (inline cursor styles on the html element would not).
  const PICK_CURSOR_STYLE_ID = "__copy-html-cursor-style";

  function copyToClipboard(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";
    (document.body || document.documentElement).appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    try {
      document.execCommand("copy");
    } catch (_) {
      navigator.clipboard?.writeText(text).catch(() => {});
    }
    ta.remove();
  }

  function showToast(message) {
    document.documentElement.appendChild(
      makeHost((shadow) => {
        const style = document.createElement("style");
        style.textContent = `
          .toast {
            font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
            font-size: 13px;
            font-weight: 500;
            color: #fff;
            background: #111827;
            border: 1px solid rgba(255,255,255,.18);
            border-radius: 8px;
            padding: 9px 16px;
            box-shadow: 0 6px 20px rgba(0,0,0,.45);
            opacity: 0;
            transform: translateY(8px);
            transition: opacity .18s ease, transform .18s ease;
          }
          .toast.visible { opacity: 1; transform: translateY(0); }
        `;
        const toast = document.createElement("div");
        toast.className = "toast";
        toast.textContent = message;
        shadow.append(style, toast);
        requestAnimationFrame(() => toast.classList.add("visible"));
        setTimeout(() => {
          toast.classList.remove("visible");
          setTimeout(() => toast.parentElement?.parentElement?.remove(), 250);
        }, 1600);
      })
    );
  }

  const UI_HOSTS = new Set();

  function makeHost(build) {
    const host = document.createElement("div");
    host.dataset.copyHtmlUi = "";
    host.style.cssText =
      "position:fixed;inset:0;width:100%;height:100%;z-index:2147483647;pointer-events:none;background:transparent;margin:0;padding:0;border:0;";
    const shadow = host.attachShadow({ mode: "closed" });
    build(shadow);
    UI_HOSTS.add(host);
    document.documentElement.appendChild(host);
    return host;
  }

  function isOwnUi(target) {
    return target instanceof Element && target.closest("[data-copy-html-ui]");
  }

  function eventHitsOwnUi(e) {
    return (e.composedPath?.() ?? []).some((n) => UI_HOSTS.has(n));
  }

  // ------------------------------------------------------------------
  // CSS Inlining Engine
  // ------------------------------------------------------------------
  const INLINE_PROPERTIES = [
    // Box Model & Layout
    "box-sizing", "display", "position", "top", "right", "bottom", "left", "z-index",
    "width", "min-width", "max-width", "height", "min-height", "max-height",
    "margin-top", "margin-right", "margin-bottom", "margin-left",
    "padding-top", "padding-right", "padding-bottom", "padding-left",

    // Flexbox
    "flex-direction", "flex-wrap", "flex-flow", "justify-content", "align-items",
    "align-content", "align-self", "justify-items", "justify-self",
    "flex-grow", "flex-shrink", "flex-basis", "order", "gap", "row-gap", "column-gap",

    // Grid
    "grid-template-columns", "grid-template-rows", "grid-template-areas",
    "grid-auto-columns", "grid-auto-rows", "grid-auto-flow",
    "grid-column-start", "grid-column-end", "grid-row-start", "grid-row-end",

    // Borders & Radius
    "border-top-width", "border-top-style", "border-top-color",
    "border-right-width", "border-right-style", "border-right-color",
    "border-bottom-width", "border-bottom-style", "border-bottom-color",
    "border-left-width", "border-left-style", "border-left-color",
    "border-top-left-radius", "border-top-right-radius",
    "border-bottom-right-radius", "border-bottom-left-radius",
    "outline-width", "outline-style", "outline-color", "outline-offset",

    // Typography
    "color", "font-family", "font-size", "font-weight", "font-style", "font-variant",
    "line-height", "letter-spacing", "word-spacing", "text-align",
    "text-decoration-line", "text-decoration-color", "text-decoration-style",
    "text-transform", "text-indent", "text-overflow", "text-shadow",
    "white-space", "word-break", "overflow-wrap", "vertical-align",

    // Background & Visual Effects
    "background-color", "background-image", "background-size", "background-position",
    "background-repeat", "background-origin", "background-clip", "background-attachment",
    "box-shadow", "opacity", "visibility", "overflow", "overflow-x", "overflow-y",
    "transform", "transform-origin", "clip-path", "filter", "backdrop-filter",

    // Media
    "object-fit", "object-position", "aspect-ratio",

    // Tables & Lists
    "list-style-type", "list-style-position", "list-style-image",
    "border-collapse", "border-spacing", "table-layout",

    // SVG
    "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width",
    "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "stroke-dashoffset", "stroke-opacity"
  ];

  const INTRINSIC_MEDIA_TAGS = new Set([
    "IMG", "SVG", "CANVAS", "VIDEO", "AUDIO", "IFRAME", "EMBED", "OBJECT", "INPUT"
  ]);

  const TEXT_CONTAINER_TAGS = new Set([
    "P", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "LI", "UL", "OL", "TABLE", "TBODY", "TR"
  ]);

  let defaultStyleCache = Object.create(null);
  let defaultIframe = null;

  function getDefaultStyle(tagName) {
    const tag = (tagName || "DIV").toUpperCase();
    if (defaultStyleCache[tag]) return defaultStyleCache[tag];

    if (!defaultIframe) {
      defaultIframe = document.createElement("iframe");
      defaultIframe.src = "about:blank";
      defaultIframe.setAttribute("aria-hidden", "true");
      defaultIframe.style.cssText =
        "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;visibility:hidden;pointer-events:none;";
      (document.body || document.documentElement).appendChild(defaultIframe);
    }

    try {
      const doc = defaultIframe.contentDocument || defaultIframe.contentWindow?.document;
      if (!doc || !doc.body) return null;
      const el = doc.createElement(tag);
      doc.body.appendChild(el);
      const computed = defaultIframe.contentWindow.getComputedStyle(el);
      const map = Object.create(null);
      for (let i = 0; i < computed.length; i++) {
        const prop = computed[i];
        map[prop] = computed.getPropertyValue(prop);
      }
      el.remove();
      defaultStyleCache[tag] = map;
      return map;
    } catch (_) {
      return null;
    }
  }

  function resolveCssUrls(cssValue) {
    if (!cssValue || !cssValue.includes("url(")) return cssValue;
    return cssValue.replace(/url\((['"]?)(.*?)\1\)/g, (match, quote, url) => {
      if (
        url.startsWith("data:") ||
        url.startsWith("blob:") ||
        url.startsWith("http://") ||
        url.startsWith("https://")
      ) {
        return match;
      }
      try {
        const resolved = new URL(url, document.baseURI).href;
        return `url("${resolved}")`;
      } catch {
        return match;
      }
    });
  }

  function getElementInlineStyles(origEl, isRoot = false) {
    const computed = window.getComputedStyle(origEl);
    const tagName = origEl.tagName.toUpperCase();
    const defaultStyles = getDefaultStyle(tagName);
    const styleRules = [];

    const propSet = new Set(INLINE_PROPERTIES);
    if (origEl.style) {
      for (let i = 0; i < origEl.style.length; i++) {
        propSet.add(origEl.style[i]);
      }
    }

    for (const prop of propSet) {
      let val = computed.getPropertyValue(prop);
      if (!val) continue;

      if (prop === "cursor" && val === "crosshair") continue;

      const defVal = defaultStyles ? defaultStyles[prop] : null;

      if (prop === "height") {
        const isMedia = INTRINSIC_MEDIA_TAGS.has(tagName);
        const hasExplicitStyle = Boolean(origEl.style && origEl.style.height);
        const isClipped = computed.overflow !== "visible" && computed.overflow !== "";
        if (!isMedia && !hasExplicitStyle && !isClipped && TEXT_CONTAINER_TAGS.has(tagName)) {
          continue;
        }
      }

      if (prop === "width") {
        const isMedia = INTRINSIC_MEDIA_TAGS.has(tagName);
        const hasExplicitStyle = Boolean(origEl.style && origEl.style.width);
        const isInlineBlock =
          computed.display.includes("inline-block") || computed.display.includes("flex");
        if (!isMedia && !hasExplicitStyle && !isInlineBlock && !isRoot) {
          if (origEl.parentElement && origEl.clientWidth === origEl.parentElement.clientWidth) {
            continue;
          }
        }
      }

      if (val !== defVal) {
        if (val.includes("url(")) {
          val = resolveCssUrls(val);
        }
        styleRules.push(`${prop}: ${val};`);
      }
    }

    return styleRules.join(" ");
  }

  function attachPseudoElement(origEl, cloneEl, pseudo) {
    const pseudoStyle = window.getComputedStyle(origEl, pseudo);
    const content = pseudoStyle.getPropertyValue("content");
    if (!content || content === "none" || content === "normal") return;

    const hasWidth = pseudoStyle.width && pseudoStyle.width !== "0px" && pseudoStyle.width !== "auto";
    const hasHeight = pseudoStyle.height && pseudoStyle.height !== "0px" && pseudoStyle.height !== "auto";
    const hasBg =
      pseudoStyle.backgroundColor !== "rgba(0, 0, 0, 0)" ||
      (pseudoStyle.backgroundImage && pseudoStyle.backgroundImage !== "none");
    const hasBorder =
      pseudoStyle.borderTopWidth !== "0px" || pseudoStyle.borderBottomWidth !== "0px";
    const hasText = content !== '""' && content !== "''" && content.trim() !== "";

    if (!hasWidth && !hasHeight && !hasBg && !hasBorder && !hasText) return;

    let text = "";
    if (content !== '""' && content !== "''") {
      try {
        text = JSON.parse(content);
      } catch {
        text = content.replace(/^["']|["']$/g, "");
      }
    }

    const span = document.createElement("span");
    span.setAttribute("aria-hidden", "true");
    span.dataset.copiedPseudo = pseudo.replace(/:/g, "");
    if (text) span.textContent = text;

    const defaultSpanStyles = getDefaultStyle("SPAN");
    const cssList = [];
    for (const prop of INLINE_PROPERTIES) {
      if (prop === "content") continue;
      let val = pseudoStyle.getPropertyValue(prop);
      if (!val) continue;
      const def = defaultSpanStyles ? defaultSpanStyles[prop] : null;
      if (val !== def) {
        if (val.includes("url(")) val = resolveCssUrls(val);
        cssList.push(`${prop}: ${val};`);
      }
    }
    if (cssList.length > 0) {
      span.setAttribute("style", cssList.join(" "));
    }

    if (pseudo === "::before") {
      cloneEl.insertBefore(span, cloneEl.firstChild);
    } else {
      cloneEl.appendChild(span);
    }
  }

  function collectRelevantFontLinks() {
    const links = [];
    const linkTags = document.querySelectorAll(
      'link[rel="stylesheet"], link[rel="preload"][as="style"]'
    );
    for (const link of linkTags) {
      const href = link.href || "";
      if (
        href.includes("fonts.googleapis.com") ||
        href.includes("fonts.gstatic.com") ||
        href.includes("typekit.net")
      ) {
        links.push(link.outerHTML);
      }
    }
    return links.join("\n");
  }

  function isValidSrcsetDescriptor(desc) {
    if (!desc) return true;
    return /^\d+w$/.test(desc) || /^\d+(\.\d+)?x$/.test(desc);
  }

  function resolveSrcset(rawSrcset) {
    if (!rawSrcset || typeof rawSrcset !== "string") return "";
    if (rawSrcset.includes("[object")) return "";

    const candidates = rawSrcset.split(",").map((s) => s.trim()).filter(Boolean);
    const resolved = [];

    for (const candidate of candidates) {
      if (candidate.includes("[object")) continue;

      const parts = candidate.split(/\s+/);
      const urlPart = parts[0];
      const descPart = parts[1] || "";

      if (descPart && !isValidSrcsetDescriptor(descPart)) {
        continue;
      }

      if (!urlPart || urlPart.includes("[object")) continue;

      try {
        const resolvedUrl = new URL(urlPart, document.baseURI).href;
        resolved.push(descPart ? `${resolvedUrl} ${descPart}` : resolvedUrl);
      } catch {
        if (!urlPart.includes("[object")) {
          resolved.push(candidate);
        }
      }
    }

    return resolved.join(", ");
  }

  function getInlineStyledHtml(rootEl) {
    if (!(rootEl instanceof Element)) return "";

    const origList = [];
    const cloneList = [];

    function cloneNodeWithMapping(orig) {
      if (orig.nodeType === Node.TEXT_NODE) {
        return document.createTextNode(orig.nodeValue);
      }
      if (orig.nodeType === Node.COMMENT_NODE) {
        return document.createComment(orig.nodeValue);
      }
      if (orig.nodeType !== Node.ELEMENT_NODE) {
        return orig.cloneNode(true);
      }
      if (isOwnUi(orig) || orig.dataset.copyHtmlUi !== undefined) {
        return null;
      }

      const isSvg = Boolean(orig.namespaceURI && orig.namespaceURI !== "http://www.w3.org/1999/xhtml");
      const clone = isSvg
        ? document.createElementNS(orig.namespaceURI, orig.tagName)
        : document.createElement(orig.tagName);

      for (let i = 0; i < orig.attributes.length; i++) {
        const attr = orig.attributes[i];
        // Skip broken attributes produced by website/framework bugs (e.g. srcset="[object Object]")
        if (typeof attr.value === "string" && attr.value.includes("[object")) {
          continue;
        }
        try {
          if (attr.namespaceURI) {
            clone.setAttributeNS(attr.namespaceURI, attr.name, attr.value);
          } else {
            clone.setAttribute(attr.name, attr.value);
          }
        } catch (_) {}
      }

      origList.push(orig);
      cloneList.push(clone);

      for (let child = orig.firstChild; child; child = child.nextSibling) {
        const clonedChild = cloneNodeWithMapping(child);
        if (clonedChild) {
          clone.appendChild(clonedChild);
        }
      }
      return clone;
    }

    const rootClone = cloneNodeWithMapping(rootEl);
    if (!rootClone) return "";

    for (let i = 0; i < origList.length; i++) {
      const orig = origList[i];
      const clone = cloneList[i];
      const isRoot = orig === rootEl;

      // 1. Resolve URLs safely
      if (
        orig.tagName === "IMG" ||
        orig.tagName === "VIDEO" ||
        orig.tagName === "AUDIO" ||
        orig.tagName === "SOURCE"
      ) {
        const rawSrc = orig.getAttribute ? orig.getAttribute("src") : orig.src;
        if (rawSrc && !rawSrc.includes("[object")) {
          try {
            clone.setAttribute("src", new URL(rawSrc, document.baseURI).href);
          } catch {
            clone.setAttribute("src", rawSrc);
          }
        } else if (rawSrc && rawSrc.includes("[object")) {
          clone.removeAttribute("src");
        }

        const rawSrcset = orig.getAttribute ? orig.getAttribute("srcset") : orig.srcset;
        if (rawSrcset) {
          const resolvedSrcset = resolveSrcset(rawSrcset);
          if (resolvedSrcset) {
            clone.setAttribute("srcset", resolvedSrcset);
          } else {
            clone.removeAttribute("srcset");
          }
        }
      } else if (orig.tagName === "A" || orig.tagName === "a") {
        let rawHref = "";
        if (typeof orig.href === "string") {
          rawHref = orig.href;
        } else if (orig.href && typeof orig.href.baseVal === "string") {
          rawHref = orig.href.baseVal;
        } else if (orig.getAttribute) {
          rawHref = orig.getAttribute("href") || orig.getAttribute("xlink:href") || "";
        }

        if (rawHref && !rawHref.includes("[object")) {
          try {
            clone.setAttribute("href", new URL(rawHref, document.baseURI).href);
          } catch {
            clone.setAttribute("href", rawHref);
          }
        } else if (rawHref && rawHref.includes("[object")) {
          clone.removeAttribute("href");
        }
      }

      // 2. Form state sync
      if (orig instanceof HTMLInputElement) {
        if (orig.type === "checkbox" || orig.type === "radio") {
          if (orig.checked) clone.setAttribute("checked", "");
          else clone.removeAttribute("checked");
        } else {
          clone.setAttribute("value", orig.value);
        }
      } else if (orig instanceof HTMLTextAreaElement) {
        clone.textContent = orig.value;
      } else if (orig instanceof HTMLSelectElement) {
        const opts = clone.querySelectorAll("option");
        opts.forEach((opt, idx) => {
          if (idx === orig.selectedIndex) opt.setAttribute("selected", "");
          else opt.removeAttribute("selected");
        });
      }

      // 3. Canvas snapshot to dataURL
      if (orig instanceof HTMLCanvasElement) {
        try {
          const dataUrl = orig.toDataURL();
          const img = document.createElement("img");
          img.src = dataUrl;
          img.alt = "Canvas snapshot";
          const origStyle = getElementInlineStyles(orig, isRoot);
          if (origStyle) img.setAttribute("style", origStyle);
          clone.replaceWith(img);
          continue;
        } catch (_) {}
      }

      // 4. Inlined styles
      const inlineCss = getElementInlineStyles(orig, isRoot);
      if (inlineCss) {
        clone.setAttribute("style", inlineCss);
      }

      // 5. Attach pseudo elements (::before and ::after)
      attachPseudoElement(orig, clone, "::before");
      attachPseudoElement(orig, clone, "::after");
    }

    const fontLinks = collectRelevantFontLinks();
    let result = rootClone.outerHTML;
    if (fontLinks) {
      result = fontLinks + "\n" + result;
    }
    return result;
  }

  // ------------------------------------------------------------------
  // Full Page HTML Extraction
  // ------------------------------------------------------------------
  async function getFullPageHtml(withEmbeddedCss = false) {
    const docClone = document.documentElement.cloneNode(true);

    // Sync input and form elements state
    const origInputs = document.querySelectorAll("input, textarea, select");
    const cloneInputs = docClone.querySelectorAll("input, textarea, select");
    origInputs.forEach((orig, i) => {
      const clone = cloneInputs[i];
      if (!clone) return;
      if (orig instanceof HTMLInputElement) {
        if (orig.type === "checkbox" || orig.type === "radio") {
          if (orig.checked) clone.setAttribute("checked", "");
          else clone.removeAttribute("checked");
        } else {
          clone.setAttribute("value", orig.value);
        }
      } else if (orig instanceof HTMLTextAreaElement) {
        clone.textContent = orig.value;
      } else if (orig instanceof HTMLSelectElement) {
        const opts = clone.querySelectorAll("option");
        opts.forEach((opt, idx) => {
          if (idx === orig.selectedIndex) opt.setAttribute("selected", "");
          else opt.removeAttribute("selected");
        });
      }
    });

    // Ensure <base href="..."> is in <head> so all relative URLs resolve cleanly
    let head = docClone.querySelector("head");
    if (!head) {
      head = document.createElement("head");
      docClone.insertBefore(head, docClone.firstChild);
    }
    const existingBase = head.querySelector("base");
    if (!existingBase) {
      const base = document.createElement("base");
      base.href = document.baseURI || window.location.href;
      head.insertBefore(base, head.firstChild);
    }

    // Clean extension UI hosts or cursor tags if present
    docClone.querySelectorAll("[data-copy-html-ui]").forEach((el) => el.remove());
    docClone.querySelectorAll(`#${PICK_CURSOR_STYLE_ID}`).forEach((el) => el.remove());

    // Clean any broken [object attributes from website/framework bugs
    docClone.querySelectorAll("[srcset]").forEach((el) => {
      const val = el.getAttribute("srcset");
      if (val && val.includes("[object")) el.removeAttribute("srcset");
    });
    docClone.querySelectorAll("[src]").forEach((el) => {
      const val = el.getAttribute("src");
      if (val && val.includes("[object")) el.removeAttribute("src");
    });

    // If requested, embed accessible CSS stylesheets into <style> tags
    if (withEmbeddedCss) {
      const styleBlocks = [];
      for (const sheet of document.styleSheets) {
        try {
          if (sheet.cssRules) {
            const rules = [];
            for (let r = 0; r < sheet.cssRules.length; r++) {
              rules.push(sheet.cssRules[r].cssText);
            }
            if (rules.length > 0) {
              styleBlocks.push(
                `<style data-source="${sheet.href || "inline"}">\n${rules.join("\n")}\n</style>`
              );
            }
          }
        } catch (_) {
          // Cross-origin stylesheet rules blocked by CORS, base tag handles loading it
        }
      }
      if (styleBlocks.length > 0) {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = styleBlocks.join("\n");
        while (tempDiv.firstChild) {
          head.appendChild(tempDiv.firstChild);
        }
      }
    }

    return "<!DOCTYPE html>\n" + docClone.outerHTML;
  }

  // ------------------------------------------------------------------
  // Picker mode: hover highlight + multi-select + toolbar
  // ------------------------------------------------------------------
  const Picker = {
    active: false,
    hovered: null,
    selected: [],
    host: null,
    refs: null,
    handlers: {},
    rafId: 0,

    toggle() {
      this.active ? this.stop() : this.start();
    },

    start() {
      if (this.active) return;
      this.active = true;
      this.hovered = null;
      this.selected = [];

      this.host = makeHost((shadow) => this.buildUi(shadow));

      this.handlers = {
        click: (e) => this.onClick(e),
        mousemove: (e) => {
          this.hovered = isOwnUi(e.target) ? null : e.target;
        },
        mouseleave: () => {
          this.hovered = null;
        },
        keydown: (e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            this.stop();
          }
        },
      };
      window.addEventListener("click", this.handlers.click, true);
      window.addEventListener("mousemove", this.handlers.mousemove, true);
      document.documentElement.addEventListener("mouseleave", this.handlers.mouseleave);
      window.addEventListener("keydown", this.handlers.keydown, true);

      const reposition = () => {
        if (!this.active) return;
        this.reposition();
        this.rafId = requestAnimationFrame(reposition);
      };
      this.rafId = requestAnimationFrame(reposition);

      const cursorStyle = document.createElement("style");
      cursorStyle.id = PICK_CURSOR_STYLE_ID;
      cursorStyle.textContent = `html, body, * { cursor: crosshair !important; }`;
      document.documentElement.appendChild(cursorStyle);
      document.body && (document.body.style.userSelect = "none");
    },

    buildUi(shadow) {
      const style = document.createElement("style");
      style.textContent = `
        :host { all: initial; }
        * { box-sizing: border-box; }
        .box {
          position: fixed; pointer-events: none;
          border: 2px solid ${ACCENT};
          background: rgba(52, 211, 153, .12);
          border-radius: 2px;
        }
        .box.selected {
          background: rgba(52, 211, 153, .18);
          border-color: #10b981;
        }
        .badge {
          position: fixed; pointer-events: none;
          min-width: 18px; height: 18px; padding: 0 4px;
          display: flex; align-items: center; justify-content: center;
          background: #10b981; color: ${ACCENT_DARK};
          font: bold 11px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          border-radius: 9px;
          box-shadow: 0 1px 4px rgba(0,0,0,.4);
        }
        .toolbar {
          position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%);
          display: flex; align-items: center; gap: 7px;
          pointer-events: auto;
          background: #111827;
          border: 1px solid rgba(255,255,255,.18);
          border-radius: 10px;
          padding: 8px 10px;
          box-shadow: 0 10px 28px rgba(0,0,0,.5);
          font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          color: #fff;
          white-space: nowrap;
        }
        .count { font-size: 13px; padding: 0 4px; }
        .count b { color: ${ACCENT}; }
        button {
          font: 600 12.5px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          color: #fff; background: #374151;
          border: 1px solid rgba(255,255,255,.14);
          border-radius: 7px; padding: 7px 11px; cursor: pointer;
          transition: background .15s ease, border-color .15s ease, transform .05s ease;
        }
        button:hover { background: #4b5563; }
        button:active { transform: translateY(1px); }
        button.primary { background: #2563eb; border-color: #3b82f6; color: #fff; }
        button.primary:hover { background: #1d4ed8; }
        button.primary:disabled { background: #374151; color: #9ca3af; border-color: rgba(255,255,255,.1); cursor: not-allowed; }
        button.accent { background: #10b981; border-color: #10b981; color: #06281e; font-weight: 700; }
        button.accent:hover { background: #34d399; }
        button.accent:disabled { background: #374151; color: #9ca3af; border-color: rgba(255,255,255,.1); cursor: not-allowed; }
        button.page { background: #4b5563; border-color: rgba(255,255,255,.2); color: #fff; }
        button.page:hover { background: #6b7280; }
        button.clear { background: transparent; border-color: rgba(255,255,255,.15); color: #d1d5db; }
        button.clear:hover { background: rgba(255,255,255,.08); }
        .hint { font-size: 11px; color: #9ca3af; padding: 0 4px; }
      `;
      const hoverBox = document.createElement("div");
      hoverBox.className = "box";
      const selLayer = document.createElement("div");
      const toolbar = document.createElement("div");
      toolbar.className = "toolbar";
      toolbar.innerHTML = `
        <span class="count"><b>0</b> selected</span>
        <button class="primary copy-html" disabled title="Copy standard HTML of selected elements">Copy HTML</button>
        <button class="accent copy-css" disabled title="Copy HTML with all styles inlined">Copy with CSS</button>
        <button class="page copy-page" title="Copy entire page HTML">Full Page</button>
        <button class="clear">Clear</button>
        <span class="hint">Esc</span>
      `;
      shadow.append(style, hoverBox, selLayer, toolbar);

      this.refs = {
        hoverBox,
        selLayer,
        count: toolbar.querySelector(".count b"),
        copyBtn: toolbar.querySelector("button.copy-html"),
        copyCssBtn: toolbar.querySelector("button.copy-css"),
        copyPageBtn: toolbar.querySelector("button.copy-page"),
        clearBtn: toolbar.querySelector("button.clear"),
      };
      this.refs.copyBtn.addEventListener("click", () => this.copySelection(false));
      this.refs.copyCssBtn.addEventListener("click", () => this.copySelection(true));
      this.refs.copyPageBtn.addEventListener("click", () => this.copyFullPage());
      this.refs.clearBtn.addEventListener("click", () => this.clearSelection());
    },

    onClick(e) {
      if (eventHitsOwnUi(e)) return;
      const el = e.composedPath?.()[0] ?? e.target;
      if (!(el instanceof Element)) return;
      e.preventDefault();
      e.stopPropagation();

      const idx = this.selected.indexOf(el);
      if (idx >= 0) {
        this.selected.splice(idx, 1);
      } else {
        this.selected.push(el);
      }
      this.syncToolbar();
    },

    syncToolbar() {
      const n = this.selected.length;
      this.refs.count.textContent = n;
      this.refs.copyBtn.disabled = n === 0;
      this.refs.copyCssBtn.disabled = n === 0;
      this.refs.copyBtn.textContent = n > 1 ? `Copy HTML (${n})` : "Copy HTML";
      this.refs.copyCssBtn.textContent = n > 1 ? `Copy with CSS (${n})` : "Copy with CSS";

      this.refs.selLayer.replaceChildren(
        ...this.selected.map((el) => {
          const wrap = document.createElement("div");
          wrap.className = "box selected";
          const badge = document.createElement("div");
          badge.className = "badge";
          badge.textContent = String(this.selected.indexOf(el) + 1);
          wrap._badge = badge;
          return wrap;
        })
      );
      this.reposition();
    },

    reposition() {
      const { hoverBox, selLayer } = this.refs;
      const h = this.hovered;
      if (h instanceof Element && h.isConnected && !isOwnUi(h)) {
        placeBox(hoverBox, h.getBoundingClientRect());
        hoverBox.style.display = "block";
      } else {
        hoverBox.style.display = "none";
      }

      [...selLayer.children].forEach((wrap, i) => {
        const el = this.selected[i];
        if (!el || !el.isConnected) {
          wrap.style.display = "none";
          wrap._badge.style.display = "none";
          return;
        }
        const r = el.getBoundingClientRect();
        placeBox(wrap, r);
        const b = wrap._badge;
        b.style.left = `${Math.max(0, r.left - 4)}px`;
        b.style.top = `${Math.max(0, r.top - 20)}px`;
        b.style.display = "flex";
      });
    },

    clearSelection() {
      this.selected = [];
      this.syncToolbar();
    },

    async copySelection(withCss = false) {
      const els = this.selected.filter((el) => el.isConnected);
      if (!els.length) return;

      els.sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      );

      const html = withCss
        ? els.map((el) => getInlineStyledHtml(el)).join("\n\n")
        : els.map((el) => el.outerHTML).join("\n\n");

      copyToClipboard(html);
      showToast(
        withCss
          ? `✓ ${els.length} element${els.length > 1 ? "s" : ""} copied with inline CSS!`
          : `✓ ${els.length} element${els.length > 1 ? "s" : ""} copied!`
      );
      this.stop();
    },

    async copyFullPage() {
      const html = await getFullPageHtml(false);
      copyToClipboard(html);
      showToast("✓ Full page HTML copied!");
      this.stop();
    },

    stop() {
      if (!this.active) return;
      this.active = false;
      cancelAnimationFrame(this.rafId);
      window.removeEventListener("click", this.handlers.click, true);
      window.removeEventListener("mousemove", this.handlers.mousemove, true);
      document.documentElement.removeEventListener("mouseleave", this.handlers.mouseleave);
      window.removeEventListener("keydown", this.handlers.keydown, true);
      document.getElementById(PICK_CURSOR_STYLE_ID)?.remove();
      document.body && (document.body.style.userSelect = "");
      this.host?.remove();
      UI_HOSTS.delete(this.host);
      this.host = null;
      this.refs = null;
      this.selected = [];
      this.hovered = null;
    },
  };

  function placeBox(box, r) {
    box.style.left = `${r.left - 2}px`;
    box.style.top = `${r.top - 2}px`;
    box.style.width = `${r.width + 4}px`;
    box.style.height = `${r.height + 4}px`;
  }
})();
