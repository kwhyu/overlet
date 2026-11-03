# Privacy Policy

Effective 3 November 2026.

Overlet does not collect personal data and does not send anything to the author. It has no accounts, analytics, telemetry, ads or update checks, and the app makes no network requests of its own.

## What stays on your device

The app reads the media files you choose and shows them on your screen. It does not copy, upload or change them.

It stores these under `%APPDATA%\overlet`:

- `config.json`: your settings and widgets, including the full path of each media file. A path can include your Windows user name. A `config.damaged-<time>.json` copy is kept if this file ever cannot be read.
- Browser data that Electron creates, such as caches.

If you turn on **Start with Windows**, the app also adds a startup entry for your Windows account. Turning the option off removes it.

If you used this app under its old name, its settings are copied once from `%APPDATA%\desktop-mate-wannabe` or `%APPDATA%\Desktop Mate Wannabe`. The old folder stays until you delete it.

Other administrators of the device can read these files. Uninstalling the app does not delete them. To remove them, delete the `%APPDATA%\overlet` folder.

## When something else uses the network

- **Downloads.** GitHub receives normal request data, such as your IP address, when you download a release. See the [GitHub Privacy Statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement).
- **Installing from source.** `npm install` downloads packages from the npm registry and Electron from GitHub.

## If you share files

Your configuration stays private unless you share it. Check it for personal details, such as your user name, before you attach it to a GitHub issue. GitHub issues are public.

## Children

The app is a general desktop utility and is not directed at children. It collects no data from anyone.

## Changes

Any change to this policy is published in this repository before the release it applies to.

## Contact

https://github.com/kwhyu/overlet/issues
