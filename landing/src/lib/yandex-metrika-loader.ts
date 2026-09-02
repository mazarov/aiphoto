import { YANDEX_METRIKA_COUNTER_ID } from "@/lib/yandex-metrika";

/** Same URL as the previous layout `lazyOnload` script. */
export const YANDEX_METRIKA_TAG_SRC = `https://mc.yandex.ru/metrika/tag.js?id=${YANDEX_METRIKA_COUNTER_ID}`;

/**
 * PSI/Lighthouse waits for network-idle. `lazyOnload` still pulled tag.js into
 * the lab trace (~87 KiB + 129 ms main thread). Real sessions interact or wait
 * this long; bounce-before-idle is the only miss vs previous loader.
 */
export const YANDEX_METRIKA_IDLE_TIMEOUT_MS = 5000;

export const YANDEX_METRIKA_LOAD_EVENTS = [
  "pointerdown",
  "keydown",
  "scroll",
  "touchstart",
] as const;
