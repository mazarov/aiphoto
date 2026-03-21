// ─── Config ──────────────────────────────────────────────────────────────────
const MIN_RENDERED_SIZE = 120;
const BUTTON_OFFSET = 10;
/** Pull button slightly over the image so the cursor path img→button doesn’t cross a “dead” gap. */
const BUTTON_OVERLAP_IMG_PX = 4;
const HIDE_DELAY_MS = 450;
const OBSERVER_DEBOUNCE_MS = 200;
/** Shown image narrower than this → compact label (fits small tiles). */
const COMPACT_IMG_WIDTH = 260;

/**
 * Floating button copy (content script has no access to side panel localStorage).
 * Lang from navigator; aligns with vibe DE/RU expansion.
 */
const OVERLAY_I18N = {
  en: {
    line: "Steal this vibe",
    short: "Steal vibe",
    aria: "Steal this vibe with PromptShot — send this image to the extension side panel",
  },
  de: {
    line: "Stil übernehmen",
    short: "Stil",
    aria: "Stil mit PromptShot übernehmen — Bild an die Erweiterung senden",
  },
  ru: {
    line: "Снять стиль с фото",
    short: "Снять стиль",
    aria: "Снять стиль с фото в PromptShot — отправить изображение в расширение",
  },
};

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
  style.textContent = `
    button {
      position: fixed;
      padding: 0;
      margin: 0;
      border-radius: 9999px;
      border: 1px solid rgba(255, 255, 255, 0.42);
      background: linear-gradient(135deg, #6366f1 0%, #5b5cf0 50%, #8b5cf6 100%);
      color: #fff;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      cursor: pointer;
      pointer-events: all;
      user-select: none;
      transition: filter 0.15s, box-shadow 0.15s, opacity 0.15s, transform 0.12s;
      opacity: 0;
      /* Legibility on busy / similar-hue photos */
      box-shadow:
        0 0 0 1px rgba(0, 0, 0, 0.45),
        0 0 0 2px rgba(255, 255, 255, 0.14),
        0 2px 18px rgba(0, 0, 0, 0.35),
        0 2px 16px rgba(99, 102, 241, 0.42);
    }
    button.visible {
      opacity: 1;
    }
    button:hover {
      filter: brightness(1.06);
      box-shadow:
        0 0 0 1px rgba(0, 0, 0, 0.5),
        0 0 0 2px rgba(255, 255, 255, 0.2),
        0 4px 22px rgba(0, 0, 0, 0.38),
        0 4px 20px rgba(99, 102, 241, 0.5);
    }
    button:active:not(:disabled) {
      transform: scale(0.98);
    }
    button:focus {
      outline: none;
    }
    button:focus-visible {
      outline: 2px solid #fff;
      outline-offset: 3px;
    }
    .stv-ob-inner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 12px 5px 5px;
      white-space: nowrap;
    }
    .stv-ob-mark {
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 14px;
      letter-spacing: -0.04em;
      color: #fff;
      background: rgba(255, 255, 255, 0.22);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
    }
    .stv-ob-text {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      text-align: left;
      line-height: 1.15;
    }
    .stv-ob-line {
      font-size: 12px;
      font-weight: 600;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
    }
    .stv-ob-brand {
      font-size: 10px;
      font-weight: 500;
      opacity: 0.9;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    }
    button.compact .stv-ob-brand {
      display: none;
    }
    button.compact .stv-ob-inner {
      padding-right: 10px;
      gap: 6px;
    }
    button.compact .stv-ob-mark {
      width: 24px;
      height: 24px;
      font-size: 12px;
      border-radius: 8px;
    }
    button.compact .stv-ob-line {
      font-size: 11px;
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

function isEligible(img) {
  if (!img || img.tagName !== "IMG") return false;
  const rect = img.getBoundingClientRect();
  const w = Math.max(rect.width, img.naturalWidth, img.clientWidth || 0);
  const h = Math.max(rect.height, img.naturalHeight, img.clientHeight || 0);
  if (w < MIN_RENDERED_SIZE || h < MIN_RENDERED_SIZE) return false;
  const src = getBestImageUrl(img);
  if (!src || !src.startsWith("http")) return false;
  if (img.closest("nav,header,footer,[role=navigation]")) return false;
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
    mark.textContent = "P";
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
  const bw = btn.offsetWidth || 168;
  const bh = btn.offsetHeight || 36;

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

function handleButtonClick(e) {
  e.preventDefault();
  e.stopPropagation();
  if (!activeImg) return;
  const imageUrl = getBestImageUrl(activeImg);
  if (!imageUrl || !imageUrl.startsWith("http")) return;
  chrome.runtime.sendMessage({
    type: "STEAL_VIBE",
    imageUrl,
    pageUrl: window.location.href,
    pageTitle: document.title,
  });
  scheduleHide();
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

document.addEventListener(
  "mouseout",
  (e) => {
    const to = e.relatedTarget;
    if (!to || !(to instanceof Element)) {
      scheduleHide();
      return;
    }
    if (to === activeImg || isStvOverlayTarget(to)) {
      cancelHide();
      return;
    }
    scheduleHide();
  },
  { capture: true, passive: true }
);

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
