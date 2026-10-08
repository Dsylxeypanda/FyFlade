# FyFlade

FyFlade is an open-source Windows multistream chat application for Twitch, Kick, and YouTube. It combines supported platform chats, badges, emotes, channel tools, profiles, popouts, highlights, moderation, local OBS views, and optional local chat history in one desktop app.

The desktop application uses React, TypeScript, Vite, Tauri, and Rust. The Kick relay and update-metadata service are included under `cloudflare/kick-relay`.

## Privacy and security

- Account passwords are entered only on the official Twitch, Kick, or Google sign-in pages.
- Refresh tokens and supported client secrets are stored through Windows Credential Manager, not in this repository or ordinary app settings.
- Anonymous usage counting is optional and off by default.
- Optional chat history stays on the user's PC.
- Official updates require a valid Tauri updater signature.

Read [PRIVACY.md](PRIVACY.md), [SECURITY.md](SECURITY.md), and [CODE_SIGNING_POLICY.md](CODE_SIGNING_POLICY.md) before distributing a build.

## Code signing policy

FyFlade does not currently have a trusted Windows Authenticode certificate. Early public beta packages may therefore be unsigned and can trigger a Microsoft Defender SmartScreen warning. An unsigned beta is published only from the official GitHub repository, is clearly labelled, and includes a SHA-256 checksum so users can verify the exact downloaded file.

The project intends to add trusted code signing after it has established enough public adoption to qualify for an open-source signing program, or when another sustainable signing route is available. Updater metadata remains cryptographically signed with the separate protected Tauri updater key; that signature does not remove the Windows SmartScreen warning.

The project roles, privacy commitments, release-origin rules, and complete policy are documented in [CODE_SIGNING_POLICY.md](CODE_SIGNING_POLICY.md).

## Local development

Requirements:

- Windows 10 or 11
- Node.js and npm
- Rust with the MSVC Windows target
- Microsoft Edge WebView2

Install dependencies and start FyFlade:

```powershell
npm install
npm run tauri dev
```

Run the complete automated release gate:

```powershell
.\scripts\test-fyflade-release.ps1 -IncludeDesktopBuild
```

## Windows distribution

- Installed edition: `scripts/build-fyflade-release.ps1`
- Portable edition: `scripts/build-fyflade-portable.ps1`
- Release verification: `scripts/verify-fyflade-release.ps1` and `scripts/verify-fyflade-portable.ps1`

Unsigned development packages must not be presented as stable signed releases. A public unsigned beta must follow the warnings, origin checks, hashes, and approval rules in [CODE_SIGNING_POLICY.md](CODE_SIGNING_POLICY.md). See [PORTABLE.md](PORTABLE.md), [docs/RELEASE_TEST_CHECKLIST.md](docs/RELEASE_TEST_CHECKLIST.md), and [docs/RELEASE_READINESS_REPORT.md](docs/RELEASE_READINESS_REPORT.md).

## License and official branding

The source code is licensed under [GNU GPL version 3 or later](LICENSE). Distributed modified versions must follow that license and provide their corresponding source code.

The FyFlade name, logo, and official release identity are not granted by the source-code license. Forks and modified builds must use distinct branding unless the FyFlade project gives written permission. See [TRADEMARKS.md](TRADEMARKS.md) and [ASSETS_LICENSE.md](ASSETS_LICENSE.md).

## Contributing

Bug reports and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first. Security issues must be reported privately as described in [SECURITY.md](SECURITY.md).
