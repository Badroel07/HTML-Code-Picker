(() => {
  if (window.__copyHtmlLoaded) return;
  window.__copyHtmlLoaded = true;

  const IS_TOP = window === window.top;
  const ACCENT = "#34d399";

  let lastRightClicked = null;

  // Capture phase so pages that stopPropagation() on contextmenu can't hide the target.
  window.addEventListener("contextmenu", (e) => {
    lastRightClicked = e.target;
  }, true);

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
      // Fall back to the active element (rare: contextmenu event was never seen,
      // e.g. the page was already loaded when the extension was installed).
      const el = lastRightClicked instanceof Element ? lastRightClicked : document.activeElement;
      if (!el) {
        sendResponse({ ok: false });
        return;
      }
      copyToClipboard(el.outerHTML);
      showToast("✓ HTML copied!");
      sendResponse({ ok: true });
    }
  });

  // Injected while picker mode is active so the crosshair cursor wins over
  // any page CSS (inline cursor styles on the html element would not).
  const PICK_CURSOR_STYLE_ID = "__copy-html-cursor-style";

  function copyToClipboard(text) {
    // execCommand is deprecated but still the reliable path from a content
    // script: a context-menu click grants no user activation, so
    // navigator.clipboard.writeText() usually rejects here.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";
    document.body.appendChild(ta);
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
    document.documentElement.appendChild(makeHost((shadow) => {
      const style = document.createElement("style");
      style.textContent = `
        .toast {
          font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          font-size: 13px;
          color: #fff;
          background: #1f2937;
          border: 1px solid rgba(255,255,255,.15);
          border-radius: 8px;
          padding: 8px 14px;
          box-shadow: 0 4px 16px rgba(0,0,0,.35);
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
      }, 1500);
    }));
  }

  // Creates a top-level host element with a Shadow DOM root; `build(root)` fills it.
  // The host is registered so Picker can ignore it when hit-testing page elements.
  const UI_HOSTS = new Set();

  function makeHost(build) {
    const host = document.createElement("div");
    host.dataset.copyHtmlUi = "";
    // Host spans the viewport but never catches events; interactive parts
    // (the toolbar) re-enable pointer-events inside the shadow root.
    host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
    const shadow = host.attachShadow({ mode: "closed" });
    build(shadow);
    UI_HOSTS.add(host);
    document.documentElement.appendChild(host);
    return host;
  }

  function isOwnUi(target) {
    return target instanceof Element && target.closest("[data-copy-html-ui]");
  }

  // Shadow DOM hides the host from Element.closest(), so detect our own UI
  // through the event path instead (it includes the host element).
  function eventHitsOwnUi(e) {
    return (e.composedPath?.() ?? []).some((n) => UI_HOSTS.has(n));
  }

  // ------------------------------------------------------------------
  // Picker mode: hover highlight + click-to-toggle multi-select + toolbar
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
        }
      };
      window.addEventListener("click", this.handlers.click, true);
      window.addEventListener("mousemove", this.handlers.mousemove, true);
      document.documentElement.addEventListener("mouseleave", this.handlers.mouseleave);
      window.addEventListener("keydown", this.handlers.keydown, true);

      // Keep overlay boxes glued to their elements (scroll, resize, animations).
      const reposition = () => {
        if (!this.active) return;
        this.reposition();
        this.rafId = requestAnimationFrame(reposition);
      };
      this.rafId = requestAnimationFrame(reposition);

      const cursorStyle = document.createElement("style");
      cursorStyle.id = PICK_CURSOR_STYLE_ID;
      cursorStyle.textContent =
        `html, body, * { cursor: crosshair !important; }`;
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
          background: #10b981; color: #06281e;
          font: bold 11px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          border-radius: 9px;
          box-shadow: 0 1px 4px rgba(0,0,0,.4);
        }
        .toolbar {
          position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%);
          display: flex; align-items: center; gap: 8px;
          pointer-events: auto;
          background: #1f2937;
          border: 1px solid rgba(255,255,255,.15);
          border-radius: 10px;
          padding: 8px 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,.4);
          font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          color: #fff;
        }
        .count { font-size: 13px; padding: 0 6px; white-space: nowrap; }
        .count b { color: ${ACCENT}; }
        button {
          font: 600 12.5px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          color: #fff; background: #374151;
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 7px; padding: 7px 12px; cursor: pointer;
        }
        button:hover { background: #4b5563; }
        button.primary { background: #10b981; border-color: #10b981; color: #06281e; }
        button.primary:hover { background: #34d399; }
        button.primary:disabled { background: #374151; color: #9ca3af; border-color: rgba(255,255,255,.12); cursor: not-allowed; }
        .hint { font-size: 11px; color: #9ca3af; padding: 0 6px; white-space: nowrap; }
      `;
      const hoverBox = document.createElement("div");
      hoverBox.className = "box";
      const selLayer = document.createElement("div");
      const toolbar = document.createElement("div");
      toolbar.className = "toolbar";
      toolbar.innerHTML = `
        <span class="count"><b>0</b> selected</span>
        <button class="primary" disabled>Copy HTML</button>
        <button class="clear">Clear</button>
        <span class="hint">Esc to exit</span>
      `;
      shadow.append(style, hoverBox, selLayer, toolbar);

      this.refs = {
        hoverBox,
        selLayer,
        count: toolbar.querySelector(".count b"),
        copyBtn: toolbar.querySelector("button.primary"),
        clearBtn: toolbar.querySelector("button.clear"),
      };
      this.refs.copyBtn.addEventListener("click", () => this.copySelection());
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
      this.refs.copyBtn.textContent = n > 1 ? `Copy HTML (${n})` : "Copy HTML";
      // Rebuild selection overlay boxes (one per selected element, numbered).
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
      // Hover box
      const h = this.hovered;
      if (h instanceof Element && h.isConnected && !isOwnUi(h)) {
        placeBox(hoverBox, h.getBoundingClientRect());
        hoverBox.style.display = "block";
      } else {
        hoverBox.style.display = "none";
      }
      // Selection boxes
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

    async copySelection() {
      const els = this.selected.filter((el) => el.isConnected);
      if (!els.length) return;
      // Sort by position in the document so the pasted markup reads in order.
      els.sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      );
      const html = els.map((el) => el.outerHTML).join("\n");
      copyToClipboard(html);
      showToast(`✓ ${els.length} element${els.length > 1 ? "s" : ""} copied!`);
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
