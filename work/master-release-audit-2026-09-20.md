# FyFlade release audit — 2026-09-20

## Scope

This began as the non-destructive audit requested by the FyFlade master plan and is now the living release-hardening record. Phase 1 is complete and Phase 2 is in progress.

## Implementation progress

### Phase 1 complete

- A local Git baseline and separate Phase 1 commit provide rollback points.
- User-visible and build-time product branding now uses FyFlade while compatibility-critical storage, credentials, app identity, relay, and updater identifiers remain unchanged.
- npm, Rust crate/binary, logo asset, backup metadata, and release-script names were updated safely.
- TypeScript/Vite, Rust tests, Worker typecheck, and a native no-bundle release build passed.

### Phase 2 in progress

- Public builds now read one official FyFlade Google Desktop OAuth Client ID from `VITE_YOUTUBE_OAUTH_CLIENT_ID`; end users no longer need their own Google Cloud project.
- Desktop OAuth keeps the browser + loopback listener + state + PKCE flow. Google documents `client_secret` as optional for installed apps, so FyFlade supports but does not require it.
- Existing local per-user OAuth configuration remains available only in development builds as a compatibility fallback. It is ignored by public production builds.
- Public release builds now fail safely when the official FyFlade Client ID has not been configured in `.env.production.local` or the release environment.
- The user-facing account controls no longer open the old Google Cloud setup guide. They expose a single Log in action when the official integration is present.
- YouTube live discovery now has per-channel in-memory caching, in-flight request deduplication, and adaptive offline backoff from 10 to 60 minutes. A one-minute scheduler only performs calls for channels whose next check is due.
- The local YouTube diagnostics now record request count, error count, rate-limit responses, last error, and per-endpoint call counts in addition to estimated units.
- Remaining release blocker: the dedicated FyFlade Google OAuth project/client must be configured for production and submitted for Google verification before broad public distribution.

### Phase 3 in progress

- Settings categories can now be dragged into a custom order. The order uses stable section IDs, persists locally, synchronizes with detached Settings windows, and has a one-click reset.
- The previous YouTube-only usage view is now a combined Quota & API Usage dashboard for Twitch, Kick, and YouTube.
- Twitch and Kick report real connection/channel/subscription state instead of invented daily percentages. YouTube retains its local shared-project usage estimate and endpoint/error counters.
- Reusable dismissible status banners now support session dismissal, persisted `Don't show again`, detached-window synchronization, and a reset-hidden-warnings control.
- Remaining Phase 3 work includes deeper retry/reconnect history, timestamps/latency, broader contextual help, and a final settings-category grouping review.

### Phase 4 in progress

- Local chat history retention is selectable: 24 hours, 48 hours, 1 week, 30 days, or unlimited/manual deletion.
- The selected retention is applied consistently by the React view, native Rust save/load/cleanup commands, profile history, and global search. Existing installs default to the previous 24-hour behavior.
- Data & Privacy now reports per-platform/channel message counts and disk usage from the real local history files, with refresh, per-channel deletion, and confirmed clear-all controls.
- Unlimited retention is explicitly labelled as a manual-cleanup option that may use significant disk space.
- The retention and navigation/warning preferences are included in safe settings backups; tokens and secrets remain excluded.
- Emote autocomplete retains the existing suggestion-only behavior: short ASCII faces such as `:D` are excluded and Enter sends the typed text; only Tab accepts a highlighted suggestion.
- The send button now exposes the current destination with Twitch/Kick/YouTube color and a `T`, `K`, or `Y` label, complementing the existing `/t`, `/k`, and `/y` shortcuts.

## Current architecture

- Desktop application: React 19 + TypeScript + Vite, hosted in Tauri 2.
- Native layer: Rust/Tauri commands in `src-tauri/src/lib.rs`.
- Cloud service: Cloudflare Worker + Durable Object in `cloudflare/kick-relay` for Kick OAuth/webhooks, updater metadata, and optional anonymous usage totals.
- Main frontend: most application behavior and UI still lives in `src/App.tsx` (about 1.2 MB / roughly 49,000 lines).
- Native backend: most native behavior still lives in `src-tauri/src/lib.rs` (about 86 KB / roughly 3,100 lines).
- Extracted feature modules already exist for channel settings, commands, highlights, inbox, layout/docking, OBS, onboarding, profiles, reliability, global search, settings help/search, undo, and local user tools.
- This directory now has a local Git history with explicit baseline and Phase 1 checkpoints.

## Baseline verification

- `npm run build`: passed. TypeScript and Vite completed successfully.
- Existing Vite warning: the main JavaScript bundle is about 720 KB minified and exceeds the 500 KB warning threshold.
- `cargo test --manifest-path src-tauri/Cargo.toml`: passed, 2 tests passed and 0 failed.
- The Rust tests cover the local OBS dock and bounded/read-only history search.
- Cloudflare Worker `tsc --noEmit`: passed as the first part of `npm run check`.
- Wrangler dry-run could not complete in the managed environment because Wrangler tried to write its log outside the workspace and scan a denied parent path. This is an environment limitation, not a detected TypeScript failure.
- There is no root lint script and the automated native test coverage is currently small.

## Branding audit

The visible product name is already `FyFlade` in the Tauri product name and window title. Several legacy ChatNest names remain.

### Safe to rename after targeted checks

- npm package display metadata (`chatnest`).
- Rust crate/function names such as `chatnest`, `chatnest_lib`, and internal function names.
- comments, console messages, script names, documentation, GraphQL operation names, and backup file names.
- the public asset filename `chatnest-logo.png` can be migrated with a compatibility copy or coordinated code update.
- user-visible backup metadata can move from `ChatNest` to `FyFlade` while the importer continues accepting both names.

### Must not be blindly renamed

- `com.stigm.chatnest`: changing the Tauri identifier can move the application data directory and make Windows treat the program as a separate app.
- `chatnest.*` localStorage keys: these hold channels, appearance, language, emotes, login configuration, history settings, and other user preferences.
- `ChatNest` as the Windows Credential Manager service name: changing it without copying credentials would log users out of Twitch, Kick, and YouTube.
- `chatnest-kick-relay.sabryna91.workers.dev`: this is the deployed Kick relay and updater endpoint. It needs a deployed replacement/alias and staged client migration before removal.
- Cloudflare binding names, Durable Object IDs, headers, secret names, and updater environment variables: changing them requires a deployment migration.
- updater public key/endpoints and Windows application identity: changing these can break automatic updates.

Recommended migration pattern: read old and new keys, write the new key, verify, and retain fallback reads for at least one public release. Credential migration should copy rather than delete first. The app-data identity and updater endpoint should remain stable until installer/updater migration is tested on an installed older build.

## YouTube implementation today

### OAuth and quota ownership

Development builds can still read the old per-user Client ID and optional Client Secret as a compatibility fallback. Public production builds use the official FyFlade Google Desktop OAuth Client ID supplied at build time and ignore legacy per-user client configuration. Refresh tokens remain local in Windows Credential Manager.

The master plan changes this to one official FyFlade integration. Under that design every user still signs into their own YouTube account and grants access only to that account, but YouTube Data API quota is charged to the shared FyFlade Google Cloud project. The login identity is personal; the API project/quota pool is shared. Public release will require the FyFlade OAuth consent screen and requested YouTube scope to be prepared for production/verification.

### API calls found

- `channels.list` with `mine=true` after login to load the authenticated channel.
- `channels.list` by ID or handle when adding/resolving a channel.
- `videos.list` when resolving a pasted video/live URL.
- `playlistItems.list` followed by `videos.list` to discover whether a saved channel is currently live and obtain `activeLiveChatId`.
- `liveChatMessages.streamList` over gRPC for passive live-chat reading.
- `liveChatMessages.insert` for user-initiated sending.
- `liveChatBans.insert`, `liveChatBans.delete`, and `liveChatMessages.delete` for user-initiated moderation.
- OAuth token exchange, refresh, and revoke endpoints.

### Why quota can rise

- Every connected app immediately checks saved standalone and linked YouTube channels that are not already marked live.
- A lightweight scheduler runs once per minute, but each offline channel has an independent next-check time and backs off from 10 to 60 minutes.
- Each offline channel normally causes two list requests: `playlistItems.list` and `videos.list`.
- The scan is sequential and now has a per-channel next-check cache, in-flight deduplication, and adaptive offline backoff. Visibility/interest priority and cross-device/server-side result sharing are not implemented.
- A 401 retry performs the same Data API request again after token refresh.
- Adding or resolving a channel adds more channel/video/list calls.
- The local quota counter records generic list calls as one unit and action calls as hard-coded values. It is an estimate, not authoritative Google quota reporting.

### What is already efficient

- Passive chat reading already uses `liveChatMessages.streamList`; it does not poll chat every second.
- The Rust stream keeps `nextPageToken`, stops when the chat reports offline, and uses capped exponential reconnect backoff.
- A generation token prevents stale streams from updating a replaced/stopped tab.
- Connected live tabs are skipped by the 10-minute live-discovery scan.
- Sending and moderation calls happen only in response to a user action.

### Observability gaps

- Total estimated units, request count, error count, rate-limit count, last action/error, and per-endpoint counts are stored locally per day.
- Timestamp history, latency, retry count, reconnect count, and a bounded event log are still missing.
- The UI currently reports estimated quota as though it were a daily tracker, even though it only measures calls made by this app instance and cannot see other users of a future shared project.
- `streamList` emits a locally assumed cost on each connection. Costs must be verified against current official documentation before public reporting; unknown values should be displayed as `Unknown / Not reported`.

## Settings and existing feature status

### Already present

- Settings search with Norwegian and English keywords.
- Simple/Advanced toggle.
- Separate settings popout window with cross-window synchronization.
- Accounts, quota/usage, OBS, Kick, emotes, chat, channel tabs, highlights, ignores, privacy, appearance, help/tutorial, and profiles sections.
- Per-channel overrides with global inheritance for live-chat saving, notifications, highlights, highlight sound, OBS inclusion, and Twitch/Kick/YouTube visibility.
- Stable channel identities and migration from cached Twitch login to numeric broadcaster ID.
- Profiles with built-in fallback profiles, custom create/rename/delete/reset, and stored layouts.
- Drag/drop layout editor, split panes, resize, channel/inbox panes, persistence per profile, undo/reset flows.
- OBS dock and transparent overlay with platform filters, channel choice, badges, username, fade, font size, outline, and message limit.
- Global search, quick command palette, local nicknames, ignores, user notes, user cards/popouts, inbox, mentions, and moderation tools.
- Twitch/Kick/YouTube combined chat, `/t`, `/k`, `/y`, platform badges, 7TV/BTTV, and emote autocomplete behavior that no longer captures short text smileys such as `:D`.
- Highlight color, three built-in sounds, enable/disable pulse, and three pulse strengths per highlighted user.
- First-run setup plus a basic 9-step tour and five small focused tours.
- Local chat history with a global on/off switch, per-channel overrides, clear controls, and storage status.
- Automatic updater UI and release-build script exist, but signed update installation is not yet verified.

### Present but incomplete for the master plan

- Settings are detachable, but settings categories are not user-reorderable.
- Quota is centralized in one page, but it is not full multi-platform API observability.
- Tutorial exists, but does not cover the full requested feature set.
- Highlights have per-user color/sound/pulse, but lack the full effect list, speed, volume, custom sound picker, groups, and richer accessibility controls.
- Chat history is fixed at 24 hours; it lacks 48 hours, 1 week, 30 days, unlimited/manual retention, a central per-channel storage matrix, and an aggregate clear-all flow.
- Profiles are flexible but need a final check for explicit duplicate/save-current semantics and all requested layout persistence cases.
- Status/reliability UI exists, but there is no reusable dismissible banner system with persisted `Don't show again` and reset.
- Startup intro setting exists; the final animation and reduced-motion behavior require visual/manual verification.
- OBS features exist; native OBS and installed-build tests remain outstanding.
- Security uses Windows Credential Manager for refresh tokens and the YouTube client secret, but release logging and every stream-visible surface still need a complete audit.

### Not found

- TTS/hover TTS/chat TTS.
- Live translation.
- Reorderable Settings category list.
- A complete portable distribution with defined portable data paths.
- A verified signed updater release path.

## Chat history/data findings

- Retention is hard-coded to 24 hours in both TypeScript and Rust.
- History is stored under the Tauri application data directory in per-platform/per-channel `recent_chat.log` files.
- Cleanup and bounded search exist. Search reads at most 5,000 recent rows and skips malformed/oversized records.
- The storage path follows the Tauri application identity. Changing `com.stigm.chatnest` without migration risks making existing history appear missing.
- Portable mode needs an explicit decision: store beside the executable for true portability, or use the normal app-data directory for safer credentials and Windows behavior. Login secrets should remain in Windows Credential Manager by default; copying a portable folder must not copy account tokens to another PC.

## Main risks

1. The 49,000-line `App.tsx` makes broad UI changes conflict-prone and hard to review.
2. The project is not version-controlled, so rollback and exact release provenance are weak.
3. Shared YouTube integration changes quota from per-user projects to one FyFlade project and requires production OAuth preparation.
4. Renaming the Tauri identifier, Credential Manager service, storage keys, relay hostname, or updater metadata can lose user-visible state or login continuity.
5. The updater has a public key configured, but the last NSIS build could not produce updater artifacts without the private signing key.
6. Automated coverage is thin compared with the feature surface; real OAuth, platform traffic, OBS, installed update, Windows restart, and portable behavior require manual tests.
7. Current quota UI is a local estimate and cannot represent total shared-project quota after the new YouTube architecture.
8. The main frontend bundle is already large; TTS, translation, diagnostics, and expanded settings should be added in extracted modules and loaded only when needed.

## Recommended implementation phases

The master plan's order is broadly correct, with two safety adjustments: establish rollback/release provenance first, and complete the shared YouTube architecture before presenting quota numbers as authoritative.

### Phase 1 — safety baseline and compatible branding cleanup

- Preserve a restorable snapshot/version history before code changes.
- Add a release checklist and record the current baseline outputs.
- Remove user-visible ChatNest branding.
- Introduce dual-read/single-write migration helpers for storage and backup metadata.
- Keep the current Tauri identifier, Credential Manager service, relay hostname, and updater endpoint until explicit migrations are tested.
- Extract new work from `App.tsx` into focused modules instead of expanding the monolith.

### Phase 2 — official FyFlade YouTube integration and quota control

- Replace per-user Google setup UI with one FyFlade OAuth client flow.
- Remove the Google Cloud/Client ID/Client Secret guide only when shared login is functional.
- Preserve existing refresh-token storage and migrate/remove legacy local credentials safely.
- Add per-channel live-discovery cache, in-flight deduplication, cancellation, adaptive offline backoff, and priority for visible/active channels.
- Keep `streamList` for passive chat and preserve reconnect generation/backoff.
- Build endpoint-level diagnostics with known/unknown cost labels.
- Treat the shared Google project as one shared quota pool while keeping each user's tokens/account data local.

### Phase 3 — settings structure, usage dashboard, banners, and help

- Reorganize categories around the master plan while retaining search aliases and old deep links.
- Add persisted drag/drop order for category navigation.
- Expand Quota & API Usage for YouTube, Kick, and Twitch with endpoint counts, errors, retries/reconnects, timestamps, and rate-limit status.
- Add reusable dismissible banners, `Don't show again`, and reset-dismissed-warnings.
- Expand contextual HelpTip use.

### Phase 4 — chat history and emotes

- Make retention configurable and pass it to Rust cleanup/load commands instead of using a fixed constant.
- Add central per-channel storage overview and clear-all/size reporting.
- Keep per-channel overrides and existing history files compatible.
- Finish channel-emote filters and regression-test suggestion-only autocomplete.
- Add destination color/text to the send button and test combined tabs.

### Phase 5 — highlights, sounds, accessibility, and TTS

- Extend highlight effects/sounds through normalized versioned settings.
- Add sound volume/test/custom file handling with bounded local storage.
- Add groups without replacing existing per-user rules.
- Implement async/cancellable TTS with hover delay, filters, voices, language, and accessibility overrides.

### Phase 6 — profiles, layout, docking, and detached Settings hardening

- Complete profile duplicate/save-current flows.
- Test layout restoration across restart, profile switch, resize, popout, and detached Settings.
- Verify live cross-window settings updates and multi-monitor positioning.

### Phase 7 — onboarding, startup, mentions, and polish

- Expand the tutorial to the requested complete tour while keeping restart/skip/back/next/finish.
- Verify spotlight clipping for every target and window size.
- Finish startup animation with reduced-motion behavior.
- Regression-test that Mentions matches only authenticated user IDs/names.

### Phase 8 — security, performance, cache, and translation foundation

- Audit logs, UI, OBS responses, backups, and diagnostics for tokens/secrets.
- Add bounded caches, expiry, cleanup, cancellation, and queue limits.
- Split/lazy-load heavy feature code where practical.
- Design translation behind a provider-neutral interface with explicit privacy/cost behavior before enabling it.

### Phase 9 — installer, portable build, signing, and updater

- Keep NSIS installer as the primary distribution.
- Create a distinct portable package and define its settings/history/cache paths.
- Keep account tokens in OS credential storage unless a separately designed encrypted portable-token option is explicitly added.
- Decide and document portable updater behavior; it must not silently run the installer updater.
- Restore the updater private-key release process and verify an installed old build updates without losing data.
- Test install/uninstall/shortcuts/identity and portable extraction/run separately.

### Phase 10 — full release regression

- Run automated build/typecheck/Rust/Worker/UI tests.
- Test the actual installed and portable binaries with real Twitch, Kick, YouTube, OBS, offline/live channels, Windows restart, and update path.
- Publish only after OAuth production readiness, signing, updater, privacy text, and the complete checklist pass.

## Immediate next action

Begin Phase 1 with a restorable project snapshot and a compatibility table for every legacy identifier. Then implement visible branding cleanup and migration helpers in small, tested changes. Do not change the Tauri identifier, credential service, relay hostname, updater endpoint, or existing localStorage keys in the first patch.
