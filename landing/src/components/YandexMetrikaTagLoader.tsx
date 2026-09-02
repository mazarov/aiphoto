"use client";

import { useEffect } from "react";
import {
  YANDEX_METRIKA_IDLE_TIMEOUT_MS,
  YANDEX_METRIKA_LOAD_EVENTS,
  YANDEX_METRIKA_TAG_SRC,
} from "@/lib/yandex-metrika-loader";

function injectMetrikaTag(): void {
  if (document.querySelector(`script[src="${YANDEX_METRIKA_TAG_SRC}"]`)) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = YANDEX_METRIKA_TAG_SRC;
  document.head.appendChild(script);
}

/**
 * Queue + `ym('init')` stay `beforeInteractive` in layout. Heavy `tag.js`
 * waits for first input or idle — otherwise PSI attributes LCP/TBT to Metrika.
 */
export function YandexMetrikaTagLoader() {
  useEffect(() => {
    let done = false;
    const load = () => {
      if (done) return;
      done = true;
      injectMetrikaTag();
    };

    for (const event of YANDEX_METRIKA_LOAD_EVENTS) {
      window.addEventListener(event, load, { capture: true, once: true, passive: true });
    }

    let idleId = 0;
    let timeoutId = 0;
    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(load, {
        timeout: YANDEX_METRIKA_IDLE_TIMEOUT_MS,
      });
    } else {
      timeoutId = window.setTimeout(load, YANDEX_METRIKA_IDLE_TIMEOUT_MS);
    }

    return () => {
      done = true;
      for (const event of YANDEX_METRIKA_LOAD_EVENTS) {
        window.removeEventListener(event, load, true);
      }
      if (idleId && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  return null;
}
