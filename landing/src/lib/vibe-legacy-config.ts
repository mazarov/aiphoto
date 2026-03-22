/**
 * Steal-This-Vibe uses only the legacy chain (9-field extract incl. pose; historical 3-accent expand + merge).
 * `vibes.prompt_chain` = {@link VIBE_PROMPT_CHAIN_LEGACY_2C23} for new rows.
 */

/** `photo_app_config` key (historical); extract no longer reads this flag — behavior is always legacy. */
export const PHOTO_APP_CONFIG_KEY_VIBE_LEGACY_PROMPT_CHAIN_2C23 = "vibe_legacy_prompt_chain_2c23ce94";

export const VIBE_PROMPT_CHAIN_LEGACY_2C23 = "legacy_2c23" as const;
