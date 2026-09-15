# Copy HTML Code

A Chrome extension that makes copying HTML from any website effortless — no more right-click → Inspect → hunt for the element → Copy element.

## Features

- **Right-click → Copy HTML code** — instantly copies the `outerHTML` of the element you clicked.
- **Multi-select picker** — click the extension icon (or press `Alt+Shift+S`) to enter picker mode:
  - Hover to highlight elements like DevTools inspect mode
  - Click to toggle-select as many components as you want
  - Floating toolbar shows the selection count, with **Copy HTML** and **Clear** buttons
  - Press `Esc` to exit
- **Document-order output** — copied elements are joined in their original document order, not click order.
- Page clicks are suppressed while picking, so you never accidentally navigate away.

## Installation (Developer Mode)

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the cloned folder.
5. (Optional) If `Alt+Shift+S` doesn't respond, set the shortcut manually at `chrome://extensions/shortcuts`.

Works in any Chromium-based browser (Chrome, Edge, Brave).

## Usage

| Action | How |
|---|---|
| Copy a single element | Right-click it → **Copy HTML code** |
| Copy multiple elements | Toggle picker (icon click or `Alt+Shift+S`) → click elements → **Copy HTML** |

## Project Structure

```
├── manifest.json    # Manifest V3
├── background.js    # Service worker: context menu + picker toggle
├── content.js       # Element capture, clipboard, picker UI, toast
└── icons/           # 16 / 48 / 128 px icons
```
