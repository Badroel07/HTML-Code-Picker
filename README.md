# Copy HTML Code

A Chrome extension that makes copying HTML from any website effortless — no more right-click → Inspect → hunt for the element → Copy element.

## Features

- **Right-click Context Menu**:
  - **Copy HTML code** — instantly copies the clean `outerHTML` of the element you clicked.
  - **Copy HTML with CSS (Inline)** — copies the element with all its computed CSS inlined into `style="..."` attributes, preserving exact layout, fonts, colors, and graphics.
  - **Copy Full Page HTML** — copies the full rendered page HTML (`<!DOCTYPE html>` + `<html>...</html>`) with `<base href>` injected so all external assets load properly when pasted or saved.
  - **Copy Full Page HTML (with CSS)** — copies the full rendered page with accessible stylesheets embedded into `<style>` tags.
- **Interactive Multi-Select Picker** — click the extension icon (or press `Alt+Shift+S`):
  - Hover to highlight elements like DevTools inspect mode.
  - Click to select one or multiple elements across the page.
  - Floating toolbar with action buttons:
    - **Copy HTML** — copies standard HTML of selected elements.
    - **Copy with CSS** — copies selected elements with inline CSS styles.
    - **Full Page** — one-click copy of the complete page HTML.
    - **Clear** — reset selections.
    - Press `Esc` to exit picker mode.
- **True-to-Design Inline CSS Engine**:
  - **Smart Diffing**: Strips 300+ browser-default properties using an isolated iframe benchmark, keeping inline code clean and compact.
  - **Absolute URLs**: Automatically converts relative URLs in `src`, `srcset`, `href`, and CSS `background-image: url(...)` to absolute `https://...` links so images, icons, and backgrounds never break.
  - **Pseudo-Elements**: Preserves visual `::before` and `::after` content and badges as inline styled elements.
  - **SVG & Canvas Support**: Retains SVG strokes/fills and converts `<canvas>` graphics to data URLs.
  - **Live Form State**: Captures current input values, textareas, checkboxes, and select options.
- **Document-order output** — copied elements are ordered by their natural document position.
- Page clicks and navigation are suppressed while picking to prevent accidental redirects.

## Installation (Developer Mode)

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select this folder.
5. (Optional) If `Alt+Shift+S` doesn't respond, set the shortcut manually at `chrome://extensions/shortcuts`.

Works in any Chromium-based browser (Chrome, Edge, Brave, Opera, Arc).

## Usage

| Action | How |
|---|---|
| Copy element HTML | Right-click element → **Copy HTML code** |
| Copy element with Inline CSS | Right-click element → **Copy HTML with CSS (Inline)** |
| Copy full page HTML | Right-click anywhere → **Copy Full Page HTML** |
| Pick & copy multiple elements | Toggle picker (icon click or `Alt+Shift+S`) → select elements → **Copy HTML** or **Copy with CSS** |
| One-click full page copy in picker | Toggle picker → click **Full Page** on toolbar |

## Project Structure

```
├── manifest.json    # Manifest V3 configuration & permissions
├── background.js    # Service worker: context menus & messaging
├── content.js       # Style inliner, full-page exporter, picker UI, toast
└── icons/           # 16 / 48 / 128 px icons
```
