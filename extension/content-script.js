// ─── Config ──────────────────────────────────────────────────────────────────
const MIN_RENDERED_SIZE = 120;
const BUTTON_OFFSET = 10;
const HIDE_DELAY_MS = 350;
const OBSERVER_DEBOUNCE_MS = 200;

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
      padding: 6px 11px;
      border-radius: 9999px;
      border: 1px solid rgba(255,255,255,0.35);
      background: rgba(15,15,20,0.92);
      color: #fff;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 12px;
      line-height: 1;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0,0,0,0.35);
      backdrop-filter: blur(8px);
      pointer-events: all;
      white-space: nowrap;
      user-select: none;
      transition: background 0.15s, opacity 0.15s;
      opacity: 0;
    }
    button.visible {
      opacity: 1;
    }
    button:hover {
      background: rgba(30,30,40,0.97);
    }
  `;
  shadowRoot.appendChild(style);
}

// ─── State ────────────────────────────────────────────────────────────────────
let activeImg = null;
let hideTimer = null;

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
    overlayBtn.textContent = "✨ Steal this vibe";
    overlayBtn.addEventListener("mouseenter", cancelHide);
    overlayBtn.addEventListener("mouseleave", scheduleHide);
    overlayBtn.addEventListener("click", handleButtonClick);
    shadowRoot.appendChild(overlayBtn);
  }
  return overlayBtn;
}

function positionButton(img) {
  const btn = getOrCreateButton();
  const rect = img.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const bw = btn.offsetWidth || 145;
  const bh = btn.offsetHeight || 28;

  const left = Math.min(
    rect.right - bw - BUTTON_OFFSET,
    vw - bw - BUTTON_OFFSET
  );
  const top = Math.min(
    rect.top + BUTTON_OFFSET,
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
  img.addEventListener("mouseleave", scheduleHide, { passive: true });
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
    if (!to) { scheduleHide(); return; }
    if (!(to instanceof Element)) { scheduleHide(); return; }
    if (
      to === activeImg ||
      (overlayBtn && (to === overlayBtn || overlayBtn.contains(to)))
    ) {
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
