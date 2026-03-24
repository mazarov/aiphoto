/** @returns {import('./types.js').StvPlatform} */
export function createChromePlatform() {
  return {
    id: "chrome",
    storage: {
      local: {
        get: (key) =>
          new Promise((resolve) => {
            chrome.storage.local.get(key, (result) => resolve(result));
          }),
        set: (obj) =>
          new Promise((resolve) => {
            chrome.storage.local.set(obj, resolve);
          }),
        remove: (key) =>
          new Promise((resolve) => {
            chrome.storage.local.remove(key, resolve);
          })
      },
      session: {
        get: (key) =>
          new Promise((resolve) => {
            chrome.storage.session.get(key, (result) => resolve(result));
          }),
        remove: (key) =>
          new Promise((resolve) => {
            chrome.storage.session.remove(key, resolve);
          }),
        onChanged: (cb) => {
          chrome.storage.session.onChanged.addListener(cb);
        }
      }
    },
    runtime: {
      onMessage: (cb) => {
        chrome.runtime.onMessage.addListener(cb);
      }
    },
    openOAuthUrl: (url) => {
      chrome.tabs.create({ url });
    },
    getOAuthCallbackUrl: () => chrome.runtime.getURL("sidepanel/auth-callback.html")
  };
}
