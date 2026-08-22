export type GenerateComposeJobPhase =
  | "idle"
  | "uploading"
  | "generating"
  | "done"
  | "error";

/**
 * Job phase drives FAB progress and desktop plate collapse.
 * Library «Добавить» is not a job — do not set compose phase for it.
 */
export function isGenerateComposeJobBusy(phase: GenerateComposeJobPhase): boolean {
  return phase === "uploading" || phase === "generating";
}

/** Overlay dismiss: ignore non-primary buttons. File-picker leftovers are `click`, not pointerdown. */
export function isPrimaryOverlayDismissPointer(event: { button: number }): boolean {
  return event.button === 0;
}
