# FyFlade — Profiles / Presets

Completed 2026-09-08 in `outputs/Chatnest-7TV`.

## Behavior

Settings → Profiles manages built-in and custom profiles. Ctrl+K supports “Switch to Normal”, “Switch to Streamer”, “Switch to Moderator”, “Switch to Minimal” and custom profile names, with Norwegian equivalents. Global Search and Settings search navigate to Profiles without applying a preset.

| Built-in | Font size | Tabs | Inbox |
| --- | --- | --- | --- |
| Normal | Current value at first migration | Current position and size at first migration | Current open/closed state at first migration |
| Streamer | 15 | Right, compact | Open |
| Moderator | 12 | Left, compact | Open |
| Minimal | 13 | Top, compact | Closed |

These are initial/reset values, not locked values. Changes through existing controls become part of the active profile. Normal always exists, keeps its name, and resets to the user's captured migration baseline, not a factory layout. All built-ins are protected from rename/delete and can be duplicated. Streamer does not start OBS or change overlays; Moderator does not grant permissions or change moderation actions. Minimal retains tabs, input, Settings, connection indicators and Ctrl+K.

Custom profiles can be created from the current view or duplicated from any profile. Names are trimmed and limited to 60 characters; stable UUID-based IDs keep names separate from identity. Creating/duplicating does not silently switch profiles. Rename preserves the ID. Delete asks for confirmation; deleting the active custom profile applies Normal. Custom reset is deliberately omitted because there is no separate custom baseline.

Switch, reset and delete use the existing Undo toast. Undo is scoped to the affected profile and preserves other custom profiles created in the meantime.

## Explicit allowlist and storage

Key: `fyflate.profiles.v1`, JSON:

```json
{
  "version": 1,
  "activeId": "normal",
  "normalBaseline": { "fontSize": 13, "tabPosition": "right", "tabSize": "compact", "inboxOpen": false },
  "profiles": [{ "id": "normal", "name": "normal", "view": { "fontSize": 13, "tabPosition": "right", "tabSize": "compact", "inboxOpen": false } }]
}
```

The example abbreviates the profiles list; all four built-ins are always present in validated storage. The loader copies only the four explicitly allowed view fields, validates enum/boolean values, clamps font size to the existing 10–24 range, repairs missing built-ins and falls back to Normal for an invalid active ID.

Only existing chat font size, channel-tab position, channel-tab size and Inbox open/closed state are profile-scoped. The profile hook applies those through existing setters/persistence; it does not replace the general settings system. Main and detached Settings windows synchronize via browser storage events. User-card windows do not initialize or auto-save profile state.

On first migration, existing values seed Normal before any preset is applied, preserving the current layout. Later launches restore the active profile. The existing backup allowlist now includes this versioned profile key; no new backup system was introduced.

## Deliberately excluded

Accounts, OAuth credentials, tokens, connections, auto-reconnect, channels and order, platform identities, channel-specific overrides, nicknames, ignores, highlight users/rules/sounds/pulse, chat/Inbox content, retained history, moderation actions/history, quota, OBS sources/scenes/overlay configuration, updater state, tutorial completion, language, reduced motion, high contrast and other accessibility protections remain independent.

The four selected view fields do not overlap the existing channel-override settings. Consequently, channel overrides continue through their existing resolution path and are neither copied nor rewritten by profiles. There is no artificial three-layer override model for settings that do not need it.

## Integration

- Existing Quick Commands registry extended with Profiles navigation and dynamic switch actions.
- Existing Settings search registry extended; Global Search consumes that same registry.
- Existing Help explains profiles without a mandatory tutorial step.
- Existing What's New includes a Profiles entry and “Show profiles” action, using the existing once-per-version completion mechanism. This task does not bump the release version or force previously dismissed announcements to reappear.
- Ctrl+Shift+F now hides Settings before showing Global Search, fixing an observed case where Settings intercepted clicks over the search dialog.

## Files changed

- `src/features/profiles/profiles.ts` — schema, strict allowlist, defaults, validation/migration and names.
- `src/features/profiles/useProfiles.ts` — active-profile tracking, persistence, custom operations, scoped Undo and cross-window synchronization.
- `src/features/profiles/ProfilesPanel.tsx` — localized management UI using existing theme colors.
- `src/App.tsx` — existing setters, Settings page, Undo, commands, Help, What's New and backup integration.
- `src/features/commands/quickCommands.ts` — profile action type and navigation command.
- `src/features/settings/settingsSearch.ts` — Profiles destination/search entry.
- `src/features/onboarding/WhatsNew.tsx` — optional Profiles discovery.
- `work/ui-correction-test/bootstrap.ts` — isolated test exposure of profile validation.
- `work/ui-correction-test/profiles.mjs` — profile regression cases.
- `work/ui-correction-test/run.mjs` — run profile tests and account for the new Settings route.
- `work/ui-correction-test/results/` — updated report and screenshots.
- `dist/` — regenerated production frontend.
- `work/profiles-report.md` — this report.

## Verification

**39 grouped interface cases passed; zero uncaught browser errors.** This includes all 33 previous channel-settings, Global Search, Quick Commands and interface regression groups, plus six profile groups:

1. Migration preserves current Normal, missing built-ins are repaired and unallowlisted fields are stripped.
2. Built-in protection, immediate switching and existing Undo.
3. Custom creation, stable-ID rename, duplication, confirmed deletion and active deletion fallback.
4. Ctrl+K switching, reload persistence, reset, Minimal navigation and unchanged protected fixture storage.
5. Existing controls update only the active profile, customization survives switching/reload, scoped reset and search navigation without applying profiles.
6. Bidirectional synchronization between main and detached Settings browser views.

The suite also verifies the Profiles panel fits a 480-pixel-wide viewport without horizontal overflow. Screenshots `profiles-top.png` and `profiles-narrow.png` were visually inspected.

- `npm run build`: TypeScript and production Vite build passed. Existing main-bundle >500 kB warning remains.
- `cargo check --manifest-path src-tauri/Cargo.toml`: passed, with the existing user-directory canonicalization warning.

## Manual checks / limitations

Tests use isolated browser storage and mocked Tauri/platform services. Live authenticated Twitch/Kick/YouTube messaging, real OBS, native Windows window focus/placement, real backup import/export and What's New release gating were not exercised end-to-end. The main/detached synchronization test uses two same-origin browser views, not real native WebViews. Native visual testing with actual channel layouts and accessibility preferences is still recommended.

No new moderation toolbar, sidebar hiding or OBS-control layout was invented: presets use the four existing safe view controls listed above. No new installer was built, installed or published for this task.
