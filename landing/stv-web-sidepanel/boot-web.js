import { configureStv } from "./stv-config.js";
import { createWebPlatform } from "./platform/web-platform.js";
import { createSupabaseForWeb } from "./supabase-web.js";
import { boot } from "./stv-core.js";

configureStv({
  platform: createWebPlatform(),
  createSupabaseClient: createSupabaseForWeb,
  getApiOrigin: () => window.location.origin
});

boot();
