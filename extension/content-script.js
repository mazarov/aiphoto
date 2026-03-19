const MIN_SIZE = 200;
const BUTTON_OFFSET = 8;
const HIDE_DELAY_MS = 300;

let currentImage = null;
let currentButton = null;
let hideTimer = null;

function parseSrcset(srcset) {
  return srcset
    .split(",")
    .map((part) => part.trim())
    .map((candidate) => {
      const [url, widthPart] = candidate.split(/\s+/);
      const width = Number((widthPart || "0w").replace(/[^\d]/g, ""));
      return { url, width: Number.isFinite(width) ? width : 0 };
    })
    .filter((v) => !!v.url);
}

function shouldShowButton(img) {
  return (
    img &&
    img.tagName === "IMG" &&
    img.naturalWidth >= MIN_SIZE &&
    img.naturalHeight >= MIN_SIZE &&
    img.src &&
    img.src.startsWith("http") &&
    !img.closest("nav,header,footer")
  );
}

function getImageUrl(img) {
  if (img.srcset) {
    const candidates = parseSrcset(img.srcset).sort((a, b) => b.width - a.width);
    if (candidates[0]?.url) return candidates[0].url;
  }
  return img.currentSrc || img.src;
}

function removeButton() {
  if (currentButton) {
    currentButton.remove();
    currentButton = null;
  }
}

function scheduleHide() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    currentImage = null;
    removeButton();
  }, HIDE_DELAY_MS);
}

function showButtonForImage(img) {
  if (!shouldShowButton(img)) return;
  clearTimeout(hideTimer);
  currentImage = img;

  if (!currentButton) {
    currentButton = document.createElement("button");
    currentButton.className = "stv-overlay-btn";
    currentButton.textContent = "✨ Steal this vibe";
    currentButton.addEventListener("mouseenter", () => clearTimeout(hideTimer));
    currentButton.addEventListener("mouseleave", scheduleHide);
    currentButton.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const imageUrl = getImageUrl(currentImage);
      if (!imageUrl || !imageUrl.startsWith("http")) return;
      chrome.runtime.sendMessage({
        type: "STEAL_VIBE",
        imageUrl,
        pageUrl: window.location.href,
        pageTitle: document.title
      });
      scheduleHide();
    });
    document.body.appendChild(currentButton);
  }

  const rect = img.getBoundingClientRect();
  currentButton.style.left = `${window.scrollX + rect.right - currentButton.offsetWidth - BUTTON_OFFSET}px`;
  currentButton.style.top = `${window.scrollY + rect.top + BUTTON_OFFSET}px`;
}

document.addEventListener(
  "mouseover",
  (event) => {
    const img = event.target instanceof HTMLImageElement ? event.target : null;
    if (!img) return;
    showButtonForImage(img);
  },
  true
);

document.addEventListener(
  "mouseout",
  (event) => {
    const related = event.relatedTarget;
    if (related === currentButton || related === currentImage) return;
    scheduleHide();
  },
  true
);
