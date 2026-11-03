# Contributing

Contributions are welcome. By contributing, you agree that your contribution is licensed under the [MIT License](LICENSE). You keep the copyright to your own work. Be respectful to everyone involved.

## Ways to help

- **Bug reports:** open an issue with your Windows version, the file type you used, what you did and what you saw. Check `config.json` for personal details such as your user name before you attach it.
- **Testing:** report results from Windows versions and monitor setups you tried.
- **Fixes and documentation:** open a pull request. For a large change or a new feature, open an issue first so we can agree on the approach.

Report security problems privately, as described in [SECURITY.md](SECURITY.md).

## What will not be accepted

- Telemetry, ads, or bundled software.
- Downloading or running code from the internet inside the app.
- Characters, images, videos or other media that you do not have the right to share.
- Turning off Electron's process isolation, or giving the windows direct access to Node.js.
- Bundling decoders for patented formats such as H.264, H.265 or AAC.

## Branches

```text
your branch  ->  snapshot  ->  main
```

- `main` holds released code. It only accepts pull requests from `snapshot`.
- `snapshot` collects changes that are being prepared for release. It only accepts pull requests.
- Your work goes on a new branch named `feature/short-name` or `bugfix/short-name`.

Direct pushes to `main` and `snapshot` are blocked.

## Pull requests

1. Fork the repository and create a branch from `snapshot`.
2. Keep the change small and focused on one thing.
3. Complete the checks below.
4. Open a pull request into `snapshot` that explains what changed, why, and how you tested it.

## Code style

- Keep the code short and clear. Names should explain what the code does.
- Do not add code comments. Explanations belong in the pull request.
- Use the settings in `.editorconfig`.
- Use plain HTML, CSS and JavaScript, with no inline styles or scripts.

## Checks

The project has no automated tests yet. Run `npm start` and check that:

1. Importing an image, a GIF and a WebM video creates a widget for each, and so does dropping them on the manager.
2. Dragging moves a widget, and scrolling resizes it. Both are kept after a restart.
3. The right-click menu options work, including each option under **Position**.
4. The tray icon appears, and its menu options work.
5. Click-through works, and the hotkey brings back control.
6. Closing the manager keeps the app running in the tray, and **Quit** closes it.

To keep your own settings safe while testing, run `npx electron . --user-data-dir=<temporary folder>`.

## Publishing a release

This section is for the maintainer.

1. Update `version` in `package.json` and add a `CHANGELOG.md` entry.
2. Complete the checks above on the `snapshot` branch.
3. Open a pull request from `snapshot` into `main` and merge it.
4. Run `npm run dist` from `main`. This replaces Electron's `ffmpeg.dll` with the build that has no patented decoders. `npm start` still uses the full build, so test video in the packaged app.
5. Save the installer's checksum in a `.sha256` file:

   ```powershell
   $name = 'Overlet-Setup-<version>.exe'
   (Get-FileHash ".\dist-installer\$name" -Algorithm SHA256).Hash | Set-Content ".\dist-installer\$name.sha256"
   ```

6. Create a GitHub release tagged `v<version>` and attach both files.
