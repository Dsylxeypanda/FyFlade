# FyFlade 1.0 release readiness report

Date: 2026-09-20

## Decision

The codebase passes its automated production, Rust, relay, and desktop-build gates. FyFlade is ready for controlled hands-on testing, but it is **not ready for a public download yet**. Public release remains blocked by a Windows Authenticode certificate, the official production YouTube OAuth client configuration, a real signed updater test, and the clean-machine/manual platform matrix in `RELEASE_TEST_CHECKLIST.md`.

## 1. What changed

- Product-facing branding, metadata, onboarding, Settings structure, banners, chat retention, highlights, sounds, local TTS, profiles, docking, detached Settings, security diagnostics, bounded caches, translation disclosure, and portable distribution were completed in phased commits.
- YouTube sign-in now uses a build-time official FyFlade OAuth client ID in public builds. The old per-user Google Cloud setup panel and guide were removed from the active application source.
- YouTube chat reading uses `liveChatMessages.streamList` instead of rapid message polling.
- A separate portable Windows packaging/verification path now exists. The app detects its portable marker and disables installer-based updating.
- A repeatable automated release gate and a clean-machine manual release checklist were added.

## 2. What was preserved

Combined Twitch/Kick/YouTube chat, `/t` `/k` `/y` routing, platform and 7TV badges/cosmetics, channel tabs and reordering, per-channel settings, profiles, layout/split panes/docking, user-card popouts, moderation, local nicknames, ignores, Smart inbox, highlights, OBS dock/browser view, and existing saved user data remain supported.

## 3. Migrations and compatibility

- Existing localStorage keys beginning with `chatnest.` are intentionally retained. Renaming them without a migration would reset channels, layouts, profiles, themes, and chat settings.
- The Windows credential service name `ChatNest` is intentionally retained internally so existing refresh tokens do not disappear. It is not shown as product branding.
- The Tauri identifier `com.stigm.chatnest` is intentionally retained so Windows and WebView storage continue to identify the existing application.
- The deployed relay/updater hostname contains `chatnest-kick-relay`; changing it requires a coordinated endpoint and updater migration and is not visible as the product name.
- Old backup-import files with `app: "ChatNest"` remain accepted so users can restore older backups.

## 4. ChatNest branding status

No known active user-facing screen uses ChatNest as the product name. Remaining references are internal compatibility identifiers, an existing Cloudflare hostname, or tracked historical source backups. The physical repository folder still has the old name; it is not included as the installed or portable product name.

## 5. YouTube architecture

Public users click **Log in with YouTube** and use FyFlade's configured OAuth client. They do not create a Google Cloud project or paste credentials.

The implementation uses:

- `channels.list` for the signed-in profile and channel lookup;
- `playlistItems.list` plus a batched `videos.list` to discover an active stream;
- `videos.list` for an explicitly supplied video;
- `liveChatMessages.streamList` for passive live-chat reading;
- `liveChatMessages.insert` only when the user sends a message;
- `liveChatBans.insert/delete` and `liveChatMessages.delete` only for explicit moderation actions;
- Google's OAuth token endpoint for authorization-code exchange and refresh.

## 6. Quota and reconnect improvements

- Passive chat uses the supported gRPC stream and a continuation token instead of one-second REST polling.
- Offline discovery starts at a ten-minute interval and backs off up to one hour.
- Channel/live metadata is cached and requests are batched where practical.
- Streams stop when the tab generation is no longer current or YouTube reports the broadcast offline.
- Transient reconnects use capped exponential backoff up to 30 seconds, preventing tight retry loops.
- API calls, endpoints/actions, errors, reconnect state, rate-limit/quota events, and known unit costs are recorded locally. Unknown costs are not invented.
- Twitch, Kick, and YouTube status is consolidated in Settings under Quota & Usage.

## 7. Security and privacy

- Refresh tokens and supported client secrets use Windows Credential Manager and are excluded from backups.
- Sensitive diagnostics are redacted, temporary caches are bounded, and OBS output is kept separate from credentials/settings UI.
- Anonymous usage is opt-in and is not needed for the app to work.
- Portable folders do not contain credentials; copying a portable ZIP does not copy account access.
- Translation requires a one-time disclosure before selected message text is sent to an external provider.

This is defense in depth, not a guarantee against a malicious process already running as the same Windows user. Windows malware with the user's permissions may be able to request that Windows return that user's stored credentials.

## 8. Automated tests run

- `npm run build`: passed.
- `cargo test --manifest-path src-tauri/Cargo.toml`: passed, 3 tests.
- Cloudflare Kick relay TypeScript check: passed.
- `npx tauri build --no-bundle`: passed and produced `fyflade.exe` with product name FyFlade and version 1.0.0.
- Portable packaging and verification: passed in explicit unsigned-development mode; marker, product metadata, archive structure, and SHA-256 were verified.
- The combined release gate script passed.

The Vite build reports a non-blocking large-chunk warning (about 749 kB before gzip, about 216 kB gzipped). It is a future startup optimization, not a build failure.

## 9. Manual tests still required

The full matrix is in `RELEASE_TEST_CHECKLIST.md`. It includes real Twitch/Kick/YouTube OAuth and live/offline chat, badges/emotes, restart persistence, Windows restart, multi-monitor/detached windows, OBS, tutorial, accessibility/scaling, backup recovery, installed update, uninstall, and portable behavior on a second Windows account.

These cannot be truthfully replaced by source inspection because they depend on real accounts, live platform responses, OBS, Windows shell integration, and signed artifacts.

## 10. Installer, portable, and updater status

- Installer configuration and updater signing-key checks exist, but no current public installer was approved in this run.
- Portable development ZIP works structurally and is available locally under the ignored `release/portable` directory.
- The current machine has the Tauri updater key but no usable Windows code-signing certificate.
- The current workspace does not contain the production YouTube OAuth environment file.
- The portable development executable is unsigned and must not be uploaded.
- A real update from an older signed installed build to the new signed build remains mandatory.

## 11. Known limitations

- The main frontend bundle should eventually be split to improve cold-start loading.
- Historical backup source files remain tracked in the repository but are not part of the compiled UI.
- Live translation currently uses an external-provider handoff with disclosure; a fully embedded translation engine is not included.
- Actual Google project-wide quota cannot be read reliably by every end user, so FyFlade reports observed local calls/status and labels unknown values rather than guessing.

## 12. Next release actions

1. Configure the official production YouTube OAuth client ID locally for the release build.
2. Obtain/configure a trusted Windows Authenticode code-signing certificate.
3. Build and verify signed installer and portable artifacts.
4. Run every clean-machine/manual checkbox and fix any failure.
5. Test one real signed updater transition.
6. Publish exact SHA-256 hashes, privacy/security text, and only the verified artifacts.

Until those steps pass, FyFlade should be described as ready for controlled testing, not as a finished public release.
