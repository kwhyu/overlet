# Changelog

## 1.0.0

### Renamed

- The app is now called Overlet. It was called Desktop Mate Wannabe, which was too close to another product's name. Settings are copied from the old folder on first start. Uninstall the old version yourself, because Windows treats the two as separate apps.

### Removed

- MP4 and OGV are no longer offered. The installer leaves out patented H.264 and AAC decoders, and Electron no longer plays OGV. Convert these files to WebM.

### Fixed

- The tray icon now appears. The old embedded image was damaged and showed as blank.
- File names with characters such as `#` now load.
- A damaged settings file is now kept, and you are told about it, instead of being overwritten. Settings are also written safely, so a crash cannot leave a half-written file.
- A widget stranded off screen, for example after unplugging a monitor, now comes back to the primary monitor.
- A hotkey must now include Ctrl, Alt or Win, or be a function key, so it cannot block normal typing. Hotkeys already taken by another app are now reported.
- A delayed save after deleting a widget no longer creates an empty widget, and changes made just before quitting are no longer lost.
- A file that is missing or unsupported now shows a message instead of an invisible window that blocks clicks.
- The position and size fields in the manager now follow changes made on screen.
- **Start with Windows** now works when running from source.
- A locked widget no longer shifts when clicked near a screen edge, and a snap distance of 0 now turns off the pull to the edge.
- Saved values out of range, such as a width of 0, are now corrected on load.

### Security

- Updated Electron from 32 to 45 and electron-builder from 24 to 26.
- Removed the default app menu and turned off developer tools outside `--dev`.
- The windows can no longer navigate away from the app or open new windows, and permission requests are denied.
- Each window can now use only its own app functions, and all settings are validated.

### Added

- Placement options: full width at the bottom or top, full height at the left or right, fill the screen, and the four corners, with an option to cover the taskbar.
- Drop files on the manager to add them, and an **Add widget** option in the tray menu.
- AVIF, SVG, BMP and ICO support.
- A new app icon.
- Privacy policy, security policy, third-party notices, contributing guide and changelog.
- The installed app now includes the project license and third-party notices.

### Changed

- The interface text no longer claims that widgets snap to the screen centre, which was never implemented.
- Reorganized the main process into smaller modules and removed unused code.
- Removed inline styles from the interface, which allows a stricter content security policy.
- The installer file name is now `Overlet-Setup-<version>.exe`.

## 0.1.0-beta

- Initial version.
