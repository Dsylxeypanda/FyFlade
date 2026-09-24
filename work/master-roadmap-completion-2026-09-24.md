# FyFlade master roadmap completion — 2026-09-24

## Outcome

The expanded roadmap has been implemented on top of the completed public-release foundation. Existing Twitch, Kick, YouTube, 7TV, chat history, profiles, layouts, channel overrides, OBS dock, updater, onboarding, portable packaging, credential storage, and security work was preserved.

## New work in this pass

### Shared request/cache foundation

- Added a reusable bounded single-flight TTL cache.
- Added positive, negative, and stale-while-revalidate caching.
- Added cache hit, miss, and duplicate-request diagnostics to YouTube quota status.
- Added bounded metadata caches for YouTube channel and video discovery.
- Preserved the existing adaptive offline/live discovery schedule.

### TTS

- Added a bounded priority queue instead of cancelling every previous message.
- Added automatic language detection for Norwegian, English, Spanish, German, and French.
- Added language-specific voice selection with system voice fallback.
- Added speed, pitch, volume, queue size, username/message inclusion, and platform controls.
- Added bot and command filtering.
- Kept the provider boundary local/system-only so chat text is not sent to a remote TTS provider.

### Party / Rave Mode

- Added Rainbow Flow, Bass Pulse, Neon Waves, Spectrum, Disco, Chill Ambient, and Full Chaos styles.
- Added intensity, movement, glow, color speed, target-area, and FPS controls.
- Added optional system-audio reactivity through local Web Audio analysis.
- Audio is not recorded, saved, or uploaded.
- Capture begins only after an explicit user action and stops when disabled.
- Reduced-motion mode pauses Party Mode.

### OBS

- Added bot and command filtering for the browser overlay.
- Added None, Fade, Slide, and Pop entrance animations.
- Preserved channel/platform filters, badges, emotes, username, transparent background, text outline, message lifetime, preview, and test messages.

### Translation

- Added a persisted target-language preference.
- Added per-platform visibility for the translate action.
- Kept translation user-triggered with first-use consent.
- No automatic external transmission of chat text was introduced.

## YouTube shared fan-out decision

A shared server-side YouTube chat fan-out was not added. The current official YouTube developer policies place restrictions on aggregation, redistribution, storage, and use of API data. FyFlade therefore continues to use the signed-in user's own OAuth/API context for YouTube operations. The cache and single-flight improvements reduce duplicate local requests without changing data ownership or silently moving user chat through a shared backend.

Before a shared YouTube relay is ever added, written policy/legal approval and a complete abuse, OAuth, privacy, retention, deletion, and quota design are required.

## Verification

- `npm run build`: passed (TypeScript + Vite production build).
- `cargo check --manifest-path src-tauri/Cargo.toml`: passed.
- `cargo test --manifest-path src-tauri/Cargo.toml --lib`: passed, 3/3 tests.
  - portable distribution marker
  - clean local OBS dock/state
  - bounded read-only history search
- `npm run tauri build -- --no-bundle`: passed.
- Release executable produced at `src-tauri/target/release/fyflade.exe`.
- Cloudflare Worker TypeScript check: passed.
- Wrangler dry-run bundling could not complete in the Codex filesystem sandbox because Wrangler/esbuild attempted to enumerate outside the permitted workspace. This was an environment restriction, not a TypeScript failure. The existing deployed Worker was not modified in this pass.

## Remaining manual release checks

These require the real Windows desktop, platform accounts, or OBS and cannot be proven by compilation alone:

1. Sign in to Twitch, Kick, and YouTube with test accounts and verify receive/send/moderation/logout.
2. Verify 7TV badges, paints, animated emotes, and offline channel behavior on all three platforms.
3. Add the local Browser Source URL to OBS and check transparency, filters, animation, and reconnect behavior.
4. Start Party Mode system-audio analysis, explicitly share PC audio, and confirm stopping capture removes the Windows share indicator.
5. Test TTS with installed Windows voices and a burst of messages to confirm queue preference.
6. Run installer and portable editions on a clean Windows user and verify updater behavior differs correctly.
7. Re-run the Cloudflare Worker dry-run/deploy from the normal project terminal before publishing backend changes.

## Build note

The Vite build reports that the main JavaScript chunk is larger than 500 kB. This is a performance warning, not a failed build. Code splitting can be a later optimization after the release behavior is manually verified.
