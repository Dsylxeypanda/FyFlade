# FyFlade

FyFlade is a Windows multistream chat application for Twitch, Kick, and YouTube. It combines supported platform chats, badges, emotes, channel tools, profiles, layouts, popouts, and local OBS views in one desktop app.

The desktop application uses React, TypeScript, Vite, Tauri, and Rust. The Kick relay and update metadata service live under `cloudflare/kick-relay`.

## Local development

Run `npm run tauri dev` from this directory. Production installers must use the signed release workflow described in `SECURITY.md`.

## Windows distribution

- Installed edition: build with `scripts/build-fyflade-release.ps1`. It supports FyFlade's signed in-app updater.
- Portable edition: build with `scripts/build-fyflade-portable.ps1`. It runs without installation and deliberately uses manual ZIP updates.
- Both public editions require a valid Windows Authenticode signature. Development-only unsigned portable packages must never be published.

See `PORTABLE.md` for portable behavior, `docs/RELEASE_TEST_CHECKLIST.md` for the release gate, and `docs/RELEASE_READINESS_REPORT.md` for the current verified status and remaining blockers.
