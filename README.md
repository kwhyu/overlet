# Desktop Mate Wannabe

An **always-on-top** desktop overlay for images, GIFs, and video — it floats above
the taskbar and over borderless/windowed games. Inspired by Desktop Mate & Wallpaper
Engine, with **Rainmeter-style** direct interaction.

## Features

- 🖼️ Show transparent **PNG / JPG / WebP / GIF / MP4 / WebM** on screen.
- 📌 **Always-on-top** (highest level) — sits over the taskbar and borderless games.
- 🖱️ **Rainmeter-style** per widget: **drag** to move, **scroll** to resize, **right-click** for options.
- 🧩 **Multi-widget** — many run at once, each in its own window.
- 📥 **Import many files** at once (multi-select) — each becomes a widget.
- 🖥️ **Multi-monitor** picker + **snap** to monitor edges/centre while dragging.
- 🔒 Per-widget **Lock position** and **Click-through**; global toggles + hotkeys.
- ⌨️ Configurable **global hotkeys**.
- 🔁 **Start with Windows** (launches minimized to tray).
- 🗂️ **System tray** menu; never shows a taskbar button.
- 🎛️ A polished **manager GUI** (white + sea-blue): position, size, opacity, rotation, fit, flip, volume, monitor, etc.

## Run (from source)

```bash
npm install
npm start
```

Config is stored at `%APPDATA%/desktop-mate-wannabe/config.json`.

## Build installer (.exe)

```bash
npm run dist
```

Output: `dist-installer/Desktop Mate Wannabe Setup <version>.exe` — an NSIS installer
(choose folder, desktop & start-menu shortcuts). It also creates an **uninstaller**
(in the install folder and in Windows *Settings → Apps*). Per-user default install
location: `%LOCALAPPDATA%\Programs\desktop-mate-wannabe\`.

## How to use

1. Click **＋ Import Media** → pick one or many images/GIFs/videos.
2. On screen: **drag** a widget to move it, **scroll** over it to resize,
   **right-click** it for options (Lock position, Click-through, Bigger/Smaller,
   Flip, Widget settings, Hide, Quit).
3. Going to game? Tray → **Make all click-through** (or the hotkey) so the mouse
   passes through; **Make all interactive** to grab them again.

### Default hotkeys

| Action | Hotkey |
|---|---|
| Toggle click-through (all) | `Ctrl+Alt+L` |
| Show / hide all | `Ctrl+Alt+H` |
| Open Settings | `Ctrl+Alt+S` |

All editable in the **Global** tab.

## Notes / limitations

- True **exclusive-fullscreen** games can cover the overlay (a Windows limitation).
  Set the game to **Borderless / Windowed Fullscreen** and the overlay shows through.
- A **click-through** widget can't be dragged or right-clicked — use the tray’s
  *Make all interactive* (or `Ctrl+Alt+L`) to get control back.

## Structure

```
src/
  main/        Electron main process (lifecycle, tray, window manager, config, menus)
  preload/     secure renderer <-> main bridges (contextBridge)
  renderer/
    overlay/   transparent media window (drag / scroll / right-click)
    settings/  manager GUI
```

## Roadmap

- [ ] Live2D/Spine animated "mate" characters.
- [ ] Import/export presets.
- [ ] Snap-to-grid, per-widget hotkeys.
