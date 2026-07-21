<h1 align="center">◐ Desktop Mate Wannabe</h1>

<p align="center">
  An <b>always-on-top desktop overlay</b> for images, GIFs and video — it floats above
  the taskbar and over borderless/windowed games, with <b>Rainmeter-style</b> interaction.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-0077b6" alt="MIT License" />
  <img src="https://img.shields.io/badge/platform-Windows%2010%2F11-0078D6" alt="Windows" />
  <img src="https://img.shields.io/badge/Electron-32-47848F" alt="Electron" />
  <a href="https://github.com/kwhyu/desktop-mate-wannabe/releases/latest"><img src="https://img.shields.io/badge/download-beta-12a150" alt="Download" /></a>
</p>

<p align="center">
  <img src="docs/manager.png" alt="Manager UI" width="820" />
</p>

---

## ✨ Features

- 🖼️ Show transparent **PNG / JPG / WebP / GIF / MP4 / WebM** anywhere on screen.
- 📌 **Always-on-top** (highest level) — sits over the taskbar and borderless games.
- 🖱️ **Rainmeter-style** per widget: **drag** to move, **scroll** to resize, **right-click** for options.
- 🧩 **Multi-widget** — run many at once, each in its own transparent window.
- 📥 **Import many files** at once (multi-select) — each becomes its own widget.
- 🖥️ **Multi-monitor** aware + **snap** to monitor edges while dragging.
- 🔒 Per-widget **Lock position** and **Click-through**, plus global toggles & hotkeys.
- ⌨️ Configurable **global hotkeys** (work even inside games).
- 🔁 **Start with Windows** (launches minimized to the tray).
- 🗂️ Lives in the **system tray** — never clutters the taskbar.
- 🎛️ A clean **manager GUI** for position, size, opacity, rotation, fit, flip, volume, monitor…

## 📸 Screenshots

| Manager | Right-click menu |
| :-----: | :--------------: |
| <img src="docs/manager.png" width="420" /> | <img src="docs/menu.png" width="300" /> |

## ⬇️ Install

### Option 1 — Download the installer (recommended)

1. Go to the [**latest release**](https://github.com/kwhyu/desktop-mate-wannabe/releases/latest)
   and download **`Desktop-Mate-Wannabe-Setup-<version>.exe`**.
2. Run it. Windows SmartScreen may warn because the app isn't code-signed —
   click **More info → Run anyway**.
3. Launch it from the Start Menu or the desktop shortcut.

> Uninstall any time via **Settings → Apps**, or the uninstaller in the install folder.

### Option 2 — Run from source

```bash
git clone https://github.com/kwhyu/desktop-mate-wannabe.git
cd desktop-mate-wannabe
npm install
npm start
```

## 🚀 Usage

1. Open the manager (tray icon → **Open Settings**) and click **＋ Import Media** to add
   one or many images / GIFs / videos.
2. On the desktop, interact with a widget directly:
   - **Left-drag** → move it (snaps to monitor edges).
   - **Scroll wheel** → resize (scales proportionally).
   - **Right-click** → menu: Size, Opacity, Position, Flip, Lock position, Click-through,
     Snap to edges, Widget settings, Hide, Add widget, and more.
3. Going into a fullscreen-ish app or game? Use the tray → **Make all click-through**
   (or the hotkey) so the mouse passes straight through your widgets.

### Default hotkeys

| Action | Hotkey |
| --- | --- |
| Toggle click-through (all widgets) | `Ctrl + Alt + L` |
| Show / hide all widgets | `Ctrl + Alt + H` |
| Open the manager | `Ctrl + Alt + S` |

All hotkeys are editable in the **Global** tab.

## 🛠️ Build the installer yourself

```bash
npm run dist
```

Produces `dist-installer/Desktop Mate Wannabe Setup <version>.exe` (an NSIS installer with
an uninstaller). Config is stored per-user at `%APPDATA%/desktop-mate-wannabe/config.json`.

## ⚠️ Notes & limitations

- Works over **borderless / windowed** games. A true **exclusive-fullscreen** game can
  cover the overlay (a Windows limitation) — set the game to *Borderless / Windowed Fullscreen*.
- A **click-through** widget can't be dragged or right-clicked — use the tray’s
  *Make all interactive* (or `Ctrl+Alt+L`) to get control back.

## 🧱 Tech & structure

Built with **Electron**. No build step for the UI — plain HTML/CSS/JS.

```
src/
  main/        Electron main process (lifecycle, tray, window manager, config, menus)
  preload/     secure renderer <-> main bridges (contextBridge)
  renderer/
    overlay/   transparent media window (drag / scroll / right-click)
    settings/  manager GUI
```

## 🤝 Contributing

This is an open-source hobby project — issues and pull requests are welcome!
Ideas on the roadmap: Live2D/Spine animated characters, preset import/export,
snap-to-grid, and per-widget hotkeys.

## 📄 License

[MIT](LICENSE) © kwhyu
