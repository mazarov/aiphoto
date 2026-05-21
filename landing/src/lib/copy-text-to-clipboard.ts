/** Универсальное копирование простого текста (листинг, карточка, партнёрские CTA). */

function execFromTextarea(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.readOnly = false;
    ta.style.position = "fixed";
    ta.style.left = "-99999px";
    ta.style.top = "0";
    ta.style.width = "50px";
    ta.style.height = "50px";
    ta.style.opacity = "1";
    ta.style.border = "0";
    ta.style.padding = "0";
    ta.style.margin = "0";
    ta.style.pointerEvents = "none";
    document.body.appendChild(ta);

    ta.focus({ preventScroll: true });
    ta.select();
    const len = ta.value.length;
    if (typeof ta.setSelectionRange === "function") {
      ta.setSelectionRange(0, len);
    }

    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Fallback для WebKit: exec на contenteditable надёжнее, чем у полностью «съехавшего» textarea. */
function execFromContentEditable(text: string): boolean {
  try {
    const el = document.createElement("div");
    el.contentEditable = "true";
    el.textContent = text;
    el.style.position = "fixed";
    el.style.left = "-99999px";
    el.style.top = "0";
    el.style.opacity = "1";
    el.style.pointerEvents = "none";
    document.body.appendChild(el);

    const sel = window.getSelection();
    if (!sel) {
      document.body.removeChild(el);
      return false;
    }
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);

    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    sel.removeAllRanges();
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

/** Синхронно в том же user gesture — до любых await. */
export function copyTextSyncFallback(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return execFromTextarea(t) || execFromContentEditable(t);
}

/**
 * 1) Синхронный exec fallback.
 * 2) Clipboard API.
 * 3) Повтор exec (textarea → contenteditable).
 */
export async function copyTextUniversal(text: string): Promise<boolean> {
  const t = text.trim();
  if (!t) return false;

  if (copyTextSyncFallback(t)) return true;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(t);
      return true;
    }
  } catch {
    /* NotAllowedError, не secure context и т.п. */
  }

  return execFromTextarea(t) || execFromContentEditable(t);
}
