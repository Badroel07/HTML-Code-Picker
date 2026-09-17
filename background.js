const MENU_ITEMS = [
  { id: "copy-html", title: "Copy HTML code", contexts: ["all"] },
  { id: "copy-html-css", title: "Copy HTML with CSS (Inline)", contexts: ["all"] },
  { id: "separator-1", type: "separator", contexts: ["all"] },
  { id: "copy-full-page", title: "Copy Full Page HTML", contexts: ["all"] },
  { id: "copy-full-page-css", title: "Copy Full Page HTML (with CSS)", contexts: ["all"] },
];

function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    for (const item of MENU_ITEMS) {
      chrome.contextMenus.create(item, () => void chrome.runtime.lastError);
    }
  });
}

chrome.runtime.onInstalled.addListener(setupContextMenus);
chrome.runtime.onStartup.addListener(setupContextMenus);

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "PING" });
  } catch {
    // Tab was opened before the extension was installed/reloaded.
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ["content.js"]
    });
  }
}

async function togglePicker(tab) {
  if (!tab?.id || !/^https?:/.test(tab.url ?? "")) return;
  await ensureContentScript(tab.id);
  chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_PICKER" }, () => void chrome.runtime.lastError);
}

chrome.action.onClicked.addListener(togglePicker);

chrome.commands.onCommand.addListener((command) => {
  if (command !== "toggle-picker") return;
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => togglePicker(tab));
});

const MENU_ACTIONS = {
  "copy-html": "COPY_HTML",
  "copy-html-css": "COPY_HTML_CSS",
  "copy-full-page": "COPY_FULL_PAGE",
  "copy-full-page-css": "COPY_FULL_PAGE_CSS",
};

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const actionType = MENU_ACTIONS[info.menuItemId];
  if (!actionType || !tab?.id) return;
  await ensureContentScript(tab.id);
  chrome.tabs.sendMessage(tab.id, { type: actionType }, () => void chrome.runtime.lastError);
});
