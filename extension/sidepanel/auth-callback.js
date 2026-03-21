import { exchangeOAuthInThisTab } from "./supabase-extension.js";

const msg = document.getElementById("msg");

async function main() {
  try {
    await exchangeOAuthInThisTab();
    if (msg) msg.textContent = "Done. You can close this tab.";
    try {
      chrome.runtime.sendMessage({ type: "PROMPTSHOT_AUTH_DONE" });
    } catch {
      /* ignore */
    }
    window.close();
  } catch (err) {
    const text = err?.message || String(err);
    if (msg) msg.textContent = `Sign-in failed: ${text}`;
  }
}

main();
