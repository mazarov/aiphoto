import {
  reachYandexMetrikaGoal,
  YM_GOAL_FOTO_V_PROMT_BANNER_CLICK,
  YM_GOAL_FOTO_V_PROMT_BANNER_IMPRESSION,
} from "@/lib/yandex-metrika";
import type { FotoVPromtBannerPlacement } from "@/lib/foto-v-promt-banner-copy";

const impressionSessionKey = (placement: FotoVPromtBannerPlacement) =>
  `ps_foto_v_promt_banner_impression_v1_${placement}`;

export function trackFotoVPromtBannerClick(placement: FotoVPromtBannerPlacement): void {
  reachYandexMetrikaGoal(YM_GOAL_FOTO_V_PROMT_BANNER_CLICK, { placement });
}

/** Once per placement per browser tab session (not on every filter remount). */
export function trackFotoVPromtBannerImpressionOnce(placement: FotoVPromtBannerPlacement): void {
  try {
    const key = impressionSessionKey(placement);
    if (sessionStorage.getItem(key) === "1") return;
    sessionStorage.setItem(key, "1");
  } catch {
    return;
  }
  reachYandexMetrikaGoal(YM_GOAL_FOTO_V_PROMT_BANNER_IMPRESSION, { placement });
}
