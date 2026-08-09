export const CLIENT_SOURCE_LABELS: Record<string, string> = {
  site: "Сайт", embed_stv: "Web STV", extension_stv: "Extension STV",
  extension_lite: "Extension Lite", promptshot: "PromptShot", admin: "Admin", unknown: "Unknown",
};
export const CLIENT_SOURCE_COLORS: Record<string, string> = {
  site: "#4f46e5", embed_stv: "#7c3aed", extension_stv: "#16a34a",
  extension_lite: "#0d9488", promptshot: "#d97706", admin: "#db2777", unknown: "#71717a",
};
export const CLIENT_SOURCES_ORDER = [
  "site", "embed_stv", "extension_stv", "extension_lite", "promptshot", "admin", "unknown",
] as const;
export const clientSourceLabel = (source: string) => CLIENT_SOURCE_LABELS[source] || source;
export const clientSourceColor = (source: string) => CLIENT_SOURCE_COLORS[source] || "#71717a";
