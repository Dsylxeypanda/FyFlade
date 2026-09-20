# Channel settings — 2026-09-08

Reviewed and completed the existing channel settings implementation in the current `outputs/Chatnest-7TV` project.

## Changed files

- `src/App.tsx`: channel context menu/dialog, effective settings, stable identity lookup, migration on authentication, backup integration, notification inheritance correction, highlight sound inheritance and inbox highlight filtering, OBS dock platform visibility.
- `src/features/channels/channelSettings.ts`: validated local overrides, effective-value resolver, stable Twitch identity aliases and migration, reuse of existing local-settings writer, boolean return type correction.
- `work/ui-correction-test/bootstrap.ts`: expose settings module only inside the isolated test entry.
- `work/ui-correction-test/run.mjs`: channel dialog tests, restart/reorder/reset/inheritance tests, identity and platform separation checks, screenshot.
- This report. Build output and isolated test reports/screenshots were regenerated.

## Storage and inheritance

Overrides live in localStorage at `fyflate.channels.settings.v1`. Missing properties inherit the current global value; explicit false is preserved. Selecting Use global deletes that property, and Reset removes the channel's overrides.

Twitch uses its numeric broadcaster ID once known. `fyflate.channels.identities.v1` maps the existing `cached:<login>` placeholder to that ID, so startup before authentication resolves the same overrides. Changes made before first authentication migrate to the numeric ID. Kick retains `kick:<user ID>` and YouTube retains `youtube-channel:<channel ID>`. Display names and tab positions are not settings keys. The two local settings keys are included in the existing settings backup mechanism.

## Supported controls

- Save live chat: resolves against the existing global save-live-history switch and still saves only eligible live-channel messages through the existing Rust history command.
- Notifications and mentions: controls new smart-inbox capture and channel mention-sound eligibility. Use global preserves the existing inbox and sound settings separately. Existing sound mute/volume controls remain applicable.
- Highlights: enables/suppresses configured custom highlights, their feedback, and highlight tagging for new inbox entries. It does not invent highlight rules.
- Highlight sound: inherits each matched global highlight rule's soundEnabled value; channel on/off can override it. The whole highlights group must be enabled for feedback.
- Platforms: independently shows/hides Twitch, Kick and YouTube messages in the channel and OBS dock/overlay. Unattached platforms are disabled in the dialog. Default is visible; connections and subscriptions are not disabled by a visibility filter.
- OBS inclusion: can exclude the channel from overlay messages. Global OBS enablement and overlay platform filters still apply.

## Verification

- `npm run build`: passed (TypeScript and Vite). Existing bundle-size warning remains.
- `cargo check --manifest-path src-tauri/Cargo.toml`: passed.
- `node work/ui-correction-test/run.mjs`: passed all 21 reported cases with no page errors, including the prior 19 UI checks.
- New UI checks cover right-click opening the correct channel, explicit override, global changes, removal/reset, reload persistence, reordering and isolation from another channel.
- Identity checks cover cached-to-authenticated Twitch migration, cached startup resolving numeric IDs, numeric IDs surviving a login rename, platform ID separation, three independent platform filters and persistence round trips.
- Reviewed `work/ui-correction-test/results/channel-settings.png`; dialog fits the viewport with scrolling for its lower sections.

## Limits

UI and storage tests use isolated fixture data and mocked Tauri/network access. Real Twitch/Kick/YouTube traffic, audible playback, native popout synchronization and a connected OBS instance were not exercised in this run. Existing history and inbox entries are not erased when disabling future capture. Combined tabs share the host tab's settings; platform visibility remains independent within that tab. No installer or remote release was published.
