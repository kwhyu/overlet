'use strict';

const { app, session } = require('electron');

function lockDownWebContents() {
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (event) => event.preventDefault());
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  });
}

function denyPermissions() {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, respond) => {
    respond(false);
  });
}

module.exports = { denyPermissions, lockDownWebContents };
