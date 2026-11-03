# Security Policy

## Reporting a vulnerability

Do not open a public issue. Use [private vulnerability reporting](https://github.com/kwhyu/overlet/security/advisories/new) on GitHub and include the steps to reproduce, the affected version and the possible impact.

This is a volunteer project, so response times are not guaranteed. Reports are handled as quickly as possible.

## Supported versions

Only the latest release receives fixes.

## Verifying a download

Releases after `v0.1.0-beta` include a SHA-256 checksum for the installer. To check it:

```powershell
Get-FileHash .\Overlet-Setup-<version>.exe -Algorithm SHA256
```

Compare the result with the matching `.sha256` file from the same release. Releases are not code signed at this time. Download only from this repository.
