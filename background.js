const MENU_ID = "copy-html";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Copy HTML code",
      contexts: ["page", "selection", "frame"]
    });
  });
});

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

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;
  await ensureContentScript(tab.id);
  chrome.tabs.sendMessage(tab.id, { type: "COPY_HTML" }, () => void chrome.runtime.lastError);
});
