import { widgetCopy } from "./foto-v-promt-copy";
import type { GenerateComposeMode } from "./generate-compose-mode";

export type ComposeToolGuideCopy = {
  title: string;
  lead: string;
  hint: string;
  visual: "source-to-tiles" | "prompt-from-photo";
};

/** Empty-plate explainer when Фотосессии is selected. Same beat as «Какое фото добавить». */
export const COMPOSE_PHOTOSHOOT_GUIDE: ComposeToolGuideCopy = {
  title: "Снимите серию с одного фото",
  lead: "Сначала одно фото. Потом четыре кадра: разные позы, одно лицо.",
  hint: "Нужно одно фото. Лицо крупно, без групп и очков.",
  visual: "source-to-tiles",
};

/** Empty-plate explainer when Промт по фото is selected — same copy as /foto-v-promt. */
export const COMPOSE_PHOTO_PROMPT_GUIDE: ComposeToolGuideCopy = {
  title: widgetCopy("emptyTitle"),
  lead: widgetCopy("emptyLead"),
  hint: widgetCopy("emptyHint"),
  visual: "prompt-from-photo",
};

export function composeToolGuideCopy(
  mode: GenerateComposeMode,
): ComposeToolGuideCopy | null {
  if (mode === "photoshoot") return COMPOSE_PHOTOSHOOT_GUIDE;
  if (mode === "photo_prompt") return COMPOSE_PHOTO_PROMPT_GUIDE;
  return null;
}

export function composeToolGuideVisible(input: {
  composeMode: GenerateComposeMode;
  showResultChrome: boolean;
  dockExpanded: boolean;
  busy?: boolean;
}): boolean {
  if (input.showResultChrome || input.dockExpanded || input.busy) return false;
  return input.composeMode === "photoshoot" || input.composeMode === "photo_prompt";
}

/** Prompt strip is unused in these tools — the empty plate is the explainer. */
export function composeToolGuideHidesPromptStrip(input: {
  composeMode: GenerateComposeMode;
  promptExpanded: boolean;
}): boolean {
  if (input.promptExpanded) return false;
  return input.composeMode === "photoshoot" || input.composeMode === "photo_prompt";
}
