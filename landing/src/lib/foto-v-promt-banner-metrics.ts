import {
  reachYandexMetrikaGoal,
  YM_GOAL_FOTO_V_PROMT_BANNER_CLICK,
  YM_GOAL_FOTO_V_PROMT_BANNER_CLICK_CARD,
} from "@/lib/yandex-metrika";
import type { FotoVPromtBannerPlacement } from "@/lib/foto-v-promt-banner-copy";

const BANNER_CLICK_GOAL: Record<FotoVPromtBannerPlacement, string> = {
  listing: YM_GOAL_FOTO_V_PROMT_BANNER_CLICK,
  card: YM_GOAL_FOTO_V_PROMT_BANNER_CLICK_CARD,
};

export function trackFotoVPromtBannerClick(placement: FotoVPromtBannerPlacement): void {
  reachYandexMetrikaGoal(BANNER_CLICK_GOAL[placement]);
}
