import { configureStv } from "./stv-config.js";
import { createChromePlatform } from "./platform/chrome-platform.js";
import { createSupabaseForExtension } from "./supabase-extension.js";
import { boot } from "./stv-core.js";

configureStv({
  platform: createChromePlatform(),
  createSupabaseClient: createSupabaseForExtension,
  getApiOrigin: () => localStorage.getItem("stv_api_origin") || "https://promptshot.ru"
});

boot();
