# Third-party notices

Overlet is built with the following components. Each stays under its own license.

## Included in the app

- **Electron**, OpenJS Foundation and Electron contributors, MIT License. https://github.com/electron/electron
- **Chromium**, The Chromium Authors, BSD 3-Clause License and other licenses. https://www.chromium.org
- **FFmpeg**, FFmpeg developers, GNU Lesser General Public License 2.1 or later, as the separate library `ffmpeg.dll`. https://ffmpeg.org. The installer uses Electron's alternate FFmpeg build, which leaves out decoders for patented formats such as H.264 and AAC.
- **Node.js**, OpenJS Foundation and Node.js contributors, MIT License. https://github.com/nodejs/node

The installed app includes `LICENSE.electron.txt` and `LICENSES.chromium.html`, which contain the full license text for Electron, Chromium and the components they include.

## Used to build the app

- **electron-builder**, Loopline Systems and contributors, MIT License. https://github.com/electron-userland/electron-builder

Its dependencies are used only during the build and are not included in the app. They use permissive licenses: MIT, ISC, BSD, Apache 2.0, BlueOak 1.0.0, Python 2.0 and WTFPL.

## Trademarks

Windows, Electron and other names belong to their owners. They are used only for identification or description. Overlet is not affiliated with or endorsed by any of them.
