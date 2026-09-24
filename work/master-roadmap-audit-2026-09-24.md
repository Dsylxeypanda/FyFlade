# FyFlade master-roadmap audit — 2026-09-24

## Architecture today

- React/TypeScript UI with a large compatibility-focused `App.tsx` and extracted feature modules for profiles, layout, OBS, onboarding, reliability, settings, translation, highlights, history, and local user tools.
- Tauri/Rust desktop shell for Windows credentials, OAuth callbacks, YouTube gRPC `liveChatMessages.streamList`, OBS local HTTP views, Kick viewer bridges, detached windows, and updater integration.
- Cloudflare Worker plus Durable Object for Kick OAuth exchange, verified Kick webhooks, authenticated WebSocket relay/fan-out, updater metadata, and opt-in anonymous usage counting.
- Local persisted settings use stable legacy keys where renaming would lose existing data. Refresh tokens and supported secrets use Windows Credential Manager.

## Already working

- Twitch/Kick/YouTube login, combined chat, send routing, moderation, badges, 7TV/BTTV, tabs, channel settings, profiles, layouts, docking, popouts, OBS dock/overlay, highlights, sounds, basic local TTS, history retention, per-channel history controls, Smart inbox, tutorial, warning banners, Settings search/reorder, installer updater configuration, and portable packaging.
- YouTube passive chat already uses the official gRPC stream with continuation and capped reconnect backoff.
- YouTube offline discovery already uses a local negative cache, progressive ten-minute-to-one-hour checks, size bounds, and per-channel in-flight deduplication.
- Temporary channel/emote/profile caches are bounded and can be cleared without deleting accounts or intentional history.

## Missing or incomplete

- Existing YouTube cache/single-flight behavior is not fully visible in diagnostics; cache hits/misses and avoided duplicates need counters.
- There is no reusable request-cache abstraction for stable metadata.
- TTS only exposes system speech synthesis, Norwegian/English/manual auto mode, and cancels prior speech instead of maintaining a bounded priority queue.
- Party/Rave Mode does not exist.
- OBS overlay has core display/fade/font options, but lacks bot/command filters and entrance-animation choice.
- Translation is a privacy-gated one-message Google Translate handoff, not automatic live translation. A fully automatic provider still needs a privacy/cost contract and server-side credentials.
- Public release remains blocked by production YouTube OAuth configuration, Windows Authenticode signing, a real signed updater transition, and clean-machine manual testing.

## YouTube API map

- OAuth token endpoint: authorization-code exchange and refresh, only for the signed-in user.
- `channels.list`: signed-in profile and explicit channel lookup.
- `playlistItems.list`: recent upload IDs used for low-cost live discovery.
- batched `videos.list`: live status, active live-chat ID, and explicit video lookup.
- `liveChatMessages.streamList`: passive live-chat read, one stream per local open live chat.
- `liveChatMessages.insert`: explicit send action.
- `liveChatBans.insert/delete` and `liveChatMessages.delete`: explicit moderation actions.

The historical quota spike was consistent with repeated discovery/polling and duplicate metadata requests. Chat itself no longer polls once per second. Remaining quota is primarily discovery, login/profile metadata, user sends, and moderation.

## Cache and backend decision

- Safe local cache candidates: channel metadata (hours), video metadata (seconds/minutes while live), offline results (minutes with progressive backoff), avatars/emote metadata (hours), and diagnostics (bounded daily counters).
- User-specific actions and all OAuth refresh/send/moderation operations must remain per-user and must never be shared.
- A shared YouTube chat fan-out is **not being implemented** without written policy clearance. YouTube policies restrict aggregation/redistribution and require stored API data to be deleted or refreshed within 30 days; streaming also accepts a user OAuth token or project API key. Moving that stream to the FyFlade backend would expand privacy, credential, abuse, and policy risk.
- The existing Kick fan-out is appropriate because it consumes verified Kick webhook events and routes them only to subscribed clients through short-lived authenticated relay tickets.
- A future shared public-metadata service needs a server-held restricted API key, authenticated/rate-limited clients, 30-day hard expiry, delete controls, and legal/policy approval before deployment.

## Settings today

Settings contains Profiles, General/accessibility/TTS, Accounts, Quota & API Usage, OBS, Kick status, Emotes, Chat/history, Channel tabs/layout, Highlights, Ignores, Privacy, Appearance, and Help. Categories are searchable, reorderable, persisted, and Settings can be detached to another monitor. Some grouping remains broad because migrating the current single-file UI is higher risk than adding focused panels.

## Risk areas

- `App.tsx` remains very large; use extracted modules and narrow integrations rather than a broad rewrite.
- Audio capture support varies by WebView2/Windows configuration; Party Mode must fail safely and never record/upload audio.
- Automatic translation cannot be enabled responsibly until a provider, privacy terms, limits, billing, and credential storage are selected.
- Release artifacts must not be published unsigned or with development OAuth configuration.

## Implementation phases for this roadmap

1. Preserve the completed branding/YouTube/settings/history/highlight/profile/tutorial/distribution work and add this audit baseline.
2. Add reusable local request cache/single-flight metrics; expose YouTube cache hits, misses, and avoided duplicates.
3. Upgrade TTS to a provider-ready local engine with bounded priority queue, language detection, per-language voices, pitch, message/username choices, filters, and queue controls.
4. Add opt-in local Party/Rave Mode with safe system-audio capture where supported, bounded analysis FPS, centralized CSS variables, reduced-motion rules, and photosensitivity warning.
5. Extend OBS overlay filters/animation controls and retain privacy-gated translation architecture.
6. Run security/performance/data-size checks, update release documentation, run full automated builds/tests, and record external/manual blockers honestly.
