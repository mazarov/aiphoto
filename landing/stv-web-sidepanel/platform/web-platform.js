const LS_PREFIX = "stv:ls:";
const SESS_PREFIX = "stv:session:";

/** @returns {import('./types.js').StvPlatform} */
export function createWebPlatform() {
  return {
    id: "web",
    storage: {
      local: {
        get: async (keys) => {
          const keyList = typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : [];
          const out = {};
          for (const k of keyList) {
            const raw = localStorage.getItem(LS_PREFIX + k);
            if (raw != null) {
              try {
                out[k] = JSON.parse(raw);
              } catch {
                out[k] = raw;
              }
            }
          }
          return out;
        },
        set: async (obj) => {
          for (const [k, v] of Object.entries(obj)) {
            localStorage.setItem(LS_PREFIX + k, JSON.stringify(v));
          }
        },
        remove: async (keys) => {
          const keyList = typeof keys === "string" ? [keys] : keys;
          for (const k of keyList) {
            localStorage.removeItem(LS_PREFIX + k);
          }
        }
      },
      session: {
        get: async (keys) => {
          const keyList = typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : [];
          const out = {};
          for (const k of keyList) {
            const raw = sessionStorage.getItem(SESS_PREFIX + k);
            if (raw != null) {
              try {
                out[k] = JSON.parse(raw);
              } catch {
                out[k] = raw;
              }
            }
          }
          return out;
        },
        remove: async (keys) => {
          const keyList = typeof keys === "string" ? [keys] : keys;
          for (const k of keyList) {
            sessionStorage.removeItem(SESS_PREFIX + k);
          }
        }
      }
    },
    runtime: {},
    openOAuthUrl: (url) => {
      const w = window.top || window;
      w.location.assign(url);
    },
    getOAuthCallbackUrl: () => {
      const origin = window.location.origin;
      const next = `/embed/stv${window.location.search}`;
      return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
    }
  };
}
