import { configureStv } from "./stv-config.js";
import { createWebPlatform } from "./platform/web-platform.js";
import { createSupabaseForWeb, isWebGuestModeEnabled } from "./supabase-web.js";
import { boot } from "./stv-core.js";

document.documentElement.dataset.stvPlatform = "web";

configureStv({
  platform: createWebPlatform(),
  createSupabaseClient: createSupabaseForWeb,
  getApiOrigin: () => window.location.origin,
  isGuestModeEnabled: isWebGuestModeEnabled
});

boot();
