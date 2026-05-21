/**
 * LexyGPT image playground with partner attribution.
 * Prompt goes to clipboard (not in URL); user pastes if copy succeeds.
 */

import {
  copyTextSyncFallback,
  copyTextUniversal,
} from "@/lib/copy-text-to-clipboard";

export const LEXYGPT_IMAGE_PLAYGROUND_URL =
  "https://lexygpt.com/playground/image/nano-banana-pro?ref=T25A8Y_add";

/** Вызов из `onClick`: только синхронно — иначе pop-up режется и теряется user activation. */
export function openLexyGptPlaygroundTab(): Window | null {
  return window.open(
    LEXYGPT_IMAGE_PLAYGROUND_URL,
    "_blank",
    "noopener,noreferrer"
  );
}

/** Синхронно в том же пользовательском жесте. */
export function copyLexyPromptSyncExec(prompt: string): boolean {
  return copyTextSyncFallback(prompt);
}

export async function copyLexyPromptToClipboard(
  prompt: string
): Promise<boolean> {
  return copyTextUniversal(prompt);
}
