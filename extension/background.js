const STORAGE_KEY = "pendingVibe";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "STEAL_VIBE") return false;

  const tabId = sender.tab?.id;
  if (!tabId || typeof message.imageUrl !== "string" || !message.imageUrl.startsWith("http")) {
    sendResponse({ ok: false, error: "invalid_payload" });
    return false;
  }

  chrome.storage.session.set(
    {
      [STORAGE_KEY]: {
        imageUrl: message.imageUrl,
        pageUrl: message.pageUrl || "",
        pageTitle: message.pageTitle || "",
        at: Date.now()
      }
    },
    () => {
      chrome.sidePanel
        .open({ tabId })
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
    }
  );

  return true;
});
