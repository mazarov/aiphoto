// ─── Config ──────────────────────────────────────────────────────────────────
const MIN_RENDERED_SIZE = 200;
const BUTTON_OFFSET = 8;
/** Pull button slightly over the image so the cursor path img→button doesn’t cross a “dead” gap. */
const BUTTON_OVERLAP_IMG_PX = 6;
/** Pinterest / grid UIs: many nested elements fire mouseout; hide only after pointer leaves padded zone. */
const HIDE_DELAY_MS = 900;
const HOVER_PAD_MIN_PX = 32;
const HOVER_PAD_MAX_PX = 56;
const HOVER_PAD_RATIO = 0.14;
const POINTER_MOVE_THROTTLE_MS = 20;
const OBSERVER_DEBOUNCE_MS = 200;
/** Shown image narrower than this → compact label (fits small tiles). */
const COMPACT_IMG_WIDTH = 280;

/**
 * Floating button copy (content script has no access to side panel localStorage).
 * Lang from navigator; aligns with vibe DE/RU expansion.
 */
const OVERLAY_I18N = {
  en: {
    line: "Steal this vibe",
    short: "Steal vibe",
    aria: "Steal this vibe with Prompt To Image — send this image to the extension side panel",
  },
  de: {
    line: "Stil übernehmen",
    short: "Stil",
    aria: "Stil mit Prompt To Image übernehmen — Bild an die Erweiterung senden",
  },
  ru: {
    line: "Снять стиль с фото",
    short: "Снять стиль",
    aria: "Снять стиль с фото в Prompt To Image — отправить изображение в расширение",
    reload_hint:
      "Расширение обновилось или перезагрузилось — обновите страницу (F5 или Cmd+R), затем снова наведите на фото.",
  },
};
OVERLAY_I18N.en.reload_hint =
  "The extension was updated — refresh this page (F5 or Cmd+R), then hover the image again.";
OVERLAY_I18N.de.reload_hint =
  "Die Erweiterung wurde aktualisiert — Seite neu laden (F5), dann erneut über das Bild fahren.";

function getOverlayLang() {
  const nav = (typeof navigator !== "undefined" && navigator.language) || "en";
  const low = nav.toLowerCase();
  if (low.startsWith("de")) return "de";
  if (low.startsWith("ru")) return "ru";
  return "en";
}

// ─── Shadow root container ────────────────────────────────────────────────────
// Button lives in Shadow DOM to avoid polluting React's virtual DOM tree.
// This fixes React hydration error #418 on Pinterest/Next.js sites.
let shadowHost = null;
let shadowRoot = null;
let overlayBtn = null;

function ensureShadowContainer() {
  if (shadowHost) return;

  shadowHost = document.createElement("div");
  shadowHost.id = "stv-shadow-host";
  Object.assign(shadowHost.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "0",
    height: "0",
    overflow: "visible",
    pointerEvents: "none",
    zIndex: "2147483647",
  });
  document.documentElement.appendChild(shadowHost);

  shadowRoot = shadowHost.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  /* Tokens aligned with extension sidepanel styles.css (--stv-*) */
  style.textContent = `
    button {
      position: fixed;
      padding: 0;
      margin: 0;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(24, 24, 27, 0.94);
      color: #fafafa;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      cursor: pointer;
      pointer-events: all;
      user-select: none;
      -webkit-font-smoothing: antialiased;
      min-height: 46px;
      transition: border-color 0.15s, box-shadow 0.15s, opacity 0.2s ease-out, transform 0.12s;
      opacity: 0;
      box-shadow:
        0 0 0 1px rgba(99, 102, 241, 0.22),
        0 1px 0 rgba(255, 255, 255, 0.06) inset,
        0 8px 28px rgba(0, 0, 0, 0.45),
        0 4px 16px rgba(99, 102, 241, 0.18);
    }
    button.visible {
      opacity: 1;
    }
    button:hover {
      border-color: rgba(99, 102, 241, 0.45);
      box-shadow:
        0 0 0 1px rgba(99, 102, 241, 0.35),
        0 1px 0 rgba(255, 255, 255, 0.08) inset,
        0 10px 32px rgba(0, 0, 0, 0.5),
        0 6px 22px rgba(99, 102, 241, 0.28);
    }
    button:active:not(:disabled) {
      transform: scale(0.98);
    }
    button:focus {
      outline: none;
    }
    button:focus-visible {
      outline: 2px solid #a5b4fc;
      outline-offset: 3px;
    }
    .stv-ob-inner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 14px 8px 8px;
      white-space: nowrap;
    }
    .stv-ob-mark {
      flex-shrink: 0;
      width: 34px;
      height: 34px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      box-shadow: 0 2px 12px rgba(99, 102, 241, 0.4);
    }
    .stv-ob-mark svg {
      width: 17px;
      height: 17px;
      display: block;
      fill: currentColor;
    }
    .stv-ob-text {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      text-align: left;
      line-height: 1.2;
      gap: 1px;
    }
    .stv-ob-line {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: -0.02em;
      color: #fafafa;
    }
    .stv-ob-brand {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #a1a1aa;
    }
    button.compact .stv-ob-brand {
      display: none;
    }
    button.compact .stv-ob-inner {
      padding: 7px 12px 7px 7px;
      gap: 8px;
    }
    button.compact .stv-ob-mark {
      width: 30px;
      height: 30px;
      border-radius: 9px;
    }
    button.compact .stv-ob-mark svg {
      width: 15px;
      height: 15px;
    }
    button.compact .stv-ob-line {
      font-size: 12px;
    }
  `;
  shadowRoot.appendChild(style);
}

// ─── State ────────────────────────────────────────────────────────────────────
let activeImg = null;
let hideTimer = null;

/**
 * True if the pointer moved to our floating UI (light DOM host or shadow tree).
 * Fixes: mouseleave on <img> + relatedTarget retargeting to #stv-shadow-host when entering Shadow DOM.
 */
function isStvOverlayTarget(el) {
  if (!el || !(el instanceof Element)) return false;
  if (shadowHost && el === shadowHost) return true;
  if (shadowRoot && shadowRoot.contains(el)) return true;
  return false;
}

function getHoverPadPx(rect) {
  const m = Math.min(rect.width, rect.height);
  return Math.min(
    HOVER_PAD_MAX_PX,
    Math.max(HOVER_PAD_MIN_PX, Math.round(m * HOVER_PAD_RATIO))
  );
}

/** True if pointer is still “over” the active pin: padded img rect or near the floating button. */
function pointerNearActiveUi(clientX, clientY) {
  if (!activeImg) return false;
  const r = activeImg.getBoundingClientRect();
  const pad = getHoverPadPx(r);
  const inPaddedImg =
    clientX >= r.left - pad &&
    clientX <= r.right + pad &&
    clientY >= r.top - pad &&
    clientY <= r.bottom + pad;
  if (inPaddedImg) return true;
  if (overlayBtn?.classList.contains("visible")) {
    const b = overlayBtn.getBoundingClientRect();
    const bp = 14;
    if (
      clientX >= b.left - bp &&
      clientX <= b.right + bp &&
      clientY >= b.top - bp &&
      clientY <= b.bottom + bp
    ) {
      return true;
    }
  }
  return false;
}

let lastPointerMoveTs = 0;

function onGlobalPointerMove(e) {
  if (!activeImg) return;
  const now = Date.now();
  if (now - lastPointerMoveTs < POINTER_MOVE_THROTTLE_MS) return;
  lastPointerMoveTs = now;
  if (pointerNearActiveUi(e.clientX, e.clientY)) {
    cancelHide();
  } else {
    scheduleHide();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseSrcset(srcset) {
  return srcset
    .split(",")
    .map((p) => p.trim())
    .map((candidate) => {
      const parts = candidate.split(/\s+/);
      const url = parts[0];
      const w = Number((parts[1] || "0w").replace(/[^\d]/g, ""));
      return { url, width: Number.isFinite(w) ? w : 0 };
    })
    .filter((v) => !!v.url);
}

function getBestImageUrl(img) {
  if (img.srcset) {
    const sorted = parseSrcset(img.srcset).sort((a, b) => b.width - a.width);
    if (sorted[0]?.url) return sorted[0].url;
  }
  return img.currentSrc || img.src || null;
}

/** Reject SVG rasters in <img> (icons, logos); compare path without query/hash. */
function isSvgImageUrl(url) {
  if (!url) return false;
  const pathOnly = url.split("#")[0].split("?")[0].toLowerCase();
  return pathOnly.endsWith(".svg");
}

function isEligible(img) {
  if (!img || img.tagName !== "IMG") return false;
  const rect = img.getBoundingClientRect();
  // Layout box only (not naturalWidth): tiny on-screen avatars/icons can still decode
  // to 128px+ intrinsic and used to pass a 120px threshold via Math.max.
  const w = Math.ceil(rect.width);
  const h = Math.ceil(rect.height);
  if (w < MIN_RENDERED_SIZE || h < MIN_RENDERED_SIZE) return false;
  const src = getBestImageUrl(img);
  if (!src || !src.startsWith("http")) return false;
  if (isSvgImageUrl(src)) return false;
  if (
    img.closest(
      "nav,header,footer,[role=navigation],[role=banner],[role=contentinfo]"
    )
  )
    return false;
  return true;
}

// ─── Button lifecycle ─────────────────────────────────────────────────────────
function getOrCreateButton() {
  ensureShadowContainer();
  if (!overlayBtn) {
    overlayBtn = document.createElement("button");
    overlayBtn.type = "button";
    overlayBtn.setAttribute("tabindex", "0");

    const inner = document.createElement("span");
    inner.className = "stv-ob-inner";
    const mark = document.createElement("span");
    mark.className = "stv-ob-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.656-1.077 2.104 0l2.052 4.96 5.35.434c1.161.094 1.548 1.603.748 2.384l-4.09 3.941 1.14 5.348c.25 1.17-1.036 2.017-2.1 1.51l-4.828-2.29-4.827 2.29c-1.064.507-2.35-.34-2.1-1.51l1.14-5.348-4.09-3.941c-.8-.781-.413-2.384.748-2.384l5.35-.434 2.052-4.96Z" clip-rule="evenodd"/></svg>';
    const textWrap = document.createElement("span");
    textWrap.className = "stv-ob-text";
    const line = document.createElement("span");
    line.className = "stv-ob-line";
    const brand = document.createElement("span");
    brand.className = "stv-ob-brand";
    brand.textContent = "PromptShot";
    textWrap.append(line, brand);
    inner.append(mark, textWrap);
    overlayBtn.append(inner);

    overlayBtn.addEventListener("mouseenter", cancelHide);
    overlayBtn.addEventListener("mouseleave", scheduleHide);
    overlayBtn.addEventListener("click", handleButtonClick);
    shadowRoot.appendChild(overlayBtn);
  }
  return overlayBtn;
}

/** Sync label + compact mode from image width and browser language. */
function syncOverlayButton(btn, imgCssWidth) {
  const lang = getOverlayLang();
  const copy = OVERLAY_I18N[lang] || OVERLAY_I18N.en;
  const compact = imgCssWidth < COMPACT_IMG_WIDTH;
  btn.classList.toggle("compact", compact);
  const line = btn.querySelector(".stv-ob-line");
  if (line) line.textContent = compact ? copy.short : copy.line;
  btn.setAttribute("aria-label", copy.aria);
}

function positionButton(img) {
  const btn = getOrCreateButton();
  const rect = img.getBoundingClientRect();
  syncOverlayButton(btn, rect.width);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const bw = btn.offsetWidth || 200;
  const bh = btn.offsetHeight || 48;

  const left = Math.min(
    rect.right - bw - BUTTON_OFFSET + BUTTON_OVERLAP_IMG_PX,
    vw - bw - BUTTON_OFFSET
  );
  const top = Math.min(
    rect.top + BUTTON_OFFSET - BUTTON_OVERLAP_IMG_PX,
    vh - bh - BUTTON_OFFSET
  );

  btn.style.left = `${Math.max(BUTTON_OFFSET, left)}px`;
  btn.style.top  = `${Math.max(BUTTON_OFFSET, top)}px`;
}

function showButton(img) {
  if (!isEligible(img)) return;
  cancelHide();
  activeImg = img;
  const btn = getOrCreateButton();
  positionButton(img);
  btn.classList.add("visible");
}

function scheduleHide() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hideButton, HIDE_DELAY_MS);
}

function cancelHide() {
  clearTimeout(hideTimer);
}

function hideButton() {
  activeImg = null;
  if (overlayBtn) overlayBtn.classList.remove("visible");
}

function showExtensionReloadHint() {
  const copy = OVERLAY_I18N[getOverlayLang()] || OVERLAY_I18N.en;
  const msg = copy.reload_hint || OVERLAY_I18N.en.reload_hint;
  try {
    window.alert(msg);
  } catch {
    /* ignore */
  }
}

function handleButtonClick(e) {
  e.preventDefault();
  e.stopPropagation();
  if (!activeImg) return;
  const imageUrl = getBestImageUrl(activeImg);
  if (!imageUrl || !imageUrl.startsWith("http")) return;
  /* After extension reload/update, old injected script loses chrome.runtime — throws or lastError */
  try {
    chrome.runtime.sendMessage(
      {
        type: "STEAL_VIBE",
        imageUrl,
        pageUrl: window.location.href,
        pageTitle: document.title,
      },
      () => {
        if (chrome.runtime.lastError) {
          const m = String(chrome.runtime.lastError.message || "");
          if (m.includes("invalidated") || m.includes("Extension context")) {
            showExtensionReloadHint();
          }
          return;
        }
        scheduleHide();
      }
    );
  } catch {
    showExtensionReloadHint();
  }
}

// ─── Per-image listeners ──────────────────────────────────────────────────────
// Attach directly to each <img> so we catch events under overlays (Pinterest)
const listenedImgs = new WeakSet();

function attachToImg(img) {
  if (listenedImgs.has(img)) return;
  listenedImgs.add(img);

  img.addEventListener("mouseenter", () => showButton(img), { passive: true });
  img.addEventListener(
    "mouseleave",
    (e) => {
      if (isStvOverlayTarget(e.relatedTarget)) return;
      scheduleHide();
    },
    { passive: true }
  );
}

// ─── Global fallback: mouseover on document ───────────────────────────────────
// Handles sites where overlay elements swallow events before <img> gets them.
document.addEventListener(
  "mouseover",
  (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;

    // direct hit on img
    if (target instanceof HTMLImageElement) {
      showButton(target);
      return;
    }

    // find img under cursor using element order
    const img = target.closest("img") || target.querySelector("img");
    if (img instanceof HTMLImageElement) {
      showButton(img);
    }
  },
  { capture: true, passive: true }
);

/* Do NOT hide on document mouseout — Pinterest/listings fire it on every nested boundary and the
   button vanished mid-hover. Visibility is driven by throttled mousemove + padded img zone. */
document.addEventListener("mousemove", onGlobalPointerMove, { capture: true, passive: true });

// Update position on scroll/resize
window.addEventListener("scroll", () => {
  if (activeImg) positionButton(activeImg);
}, { capture: true, passive: true });

window.addEventListener("resize", () => {
  if (activeImg) positionButton(activeImg);
}, { passive: true });

// ─── MutationObserver: watch for new <img> in dynamic pages ──────────────────
let mutationTimer = null;

function processNewImages(nodes) {
  for (const node of nodes) {
    if (node instanceof HTMLImageElement) {
      attachToImg(node);
    } else if (node instanceof Element) {
      node.querySelectorAll("img").forEach(attachToImg);
    }
  }
}

const mutationObserver = new MutationObserver((mutations) => {
  clearTimeout(mutationTimer);
  mutationTimer = setTimeout(() => {
    const added = [];
    for (const m of mutations) {
      for (const n of m.addedNodes) added.push(n);
    }
    processNewImages(added);
  }, OBSERVER_DEBOUNCE_MS);
});

mutationObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

// ─── Initial scan ─────────────────────────────────────────────────────────────
document.querySelectorAll("img").forEach(attachToImg);
