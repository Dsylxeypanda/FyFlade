# Global Search — 2026-09-08

## Entry point and behavior

The existing magnifying-glass button beside the channel-list controls now opens Search FyFlade. The existing Ctrl+Shift+F shortcut is preserved. Settings search remains separate inside Settings. No Ctrl+K actions were added.

Search updates while typing and groups matching channels, users/nicknames, settings, messages and help. Empty queries show a few existing channels plus Settings and Inbox shortcuts. Empty results have a plain-language message. Existing platform/channel filters are retained. Eight results per category are shown initially; Show more expands the limit. Case-insensitive, partial and prefix matching use both Norwegian and English settings/tutorial labels, with yt as a YouTube alias. Exact and prefix identity matches rank above weaker matches within each category; channels/users and settings precede chat messages. No fuzzy-search dependency was introduced.

## Local sources and navigation

- Channels come from the existing configured/preloaded tabs, including attached Kick and YouTube identities. Selection activates the existing tab and does not add duplicates. Cached Twitch IDs are resolved using the existing channel-identity mapping if authentication changes the ID while search is open.
- Users are deduplicated by the existing platform + user ID/login key. Both original identity and nickname are indexed from current/retained messages and the existing nickname map. Nickname-only users remain findable. Selection calls the existing user-card function. A user without an available channel opens the same profile in local-only mode with moderation disabled.
- Settings entries reuse SETTINGS_SEARCH_ENTRIES. Selection opens the existing Settings section, clears the Settings query and enables its existing Advanced setting when necessary.
- Help titles/descriptions/step titles reuse TUTORIALS. Selection starts the existing tutorial.
- Message selection activates the source channel if it still exists and shows the chosen message, author, date/time, channel and platform in a closable context panel. It explicitly says that the chat was not scrolled to the historical message. Removed/unavailable channels use context-only display.

## History and performance

`load_search_chat_history` reads existing platform/channel `recent_chat.log` files using a background Rust worker. It does not rewrite logs, call remote APIs or create another database. Existing CHAT_HISTORY_MAX_AGE_MS (24 hours) remains the retention rule. Expired, future-dated, malformed and non-chat rows are excluded. Payload rows over 16 KiB are skipped. A bounded heap keeps at most 5,000 newest saved messages.

The local snapshot loads once each time search opens. Typing does not issue further history reads. Search indexes the snapshot plus recent in-memory messages, deduplicates them and caps the combined message index at 5,000. In-memory channel snapshots refresh at most once per second while search is open; the query only filters the index. Closing search releases its snapshot. Expired messages are pruned while it remains open; the selected-message context expires at the same retention boundary. The shared frontend retention constant is used by both the existing reader and Global Search.

Normal search typing uses no network APIs. Existing user-profile navigation can fetch ordinary platform profile details after an explicit user selection when a channel is available; that is the existing profile behavior, not remote search. Queries, nicknames and chat history are not transmitted to an external search service or persisted by search.

## Files changed

- `src/App.tsx`: integration, entry point, snapshot lifecycle, result navigation, message context, existing profile local-only option.
- `src/features/search/globalSearch.ts`: local index, matching/ranking, history parsing, platform/channel resolution.
- `src/features/search/GlobalSearchDialog.tsx`: grouped results, filters, keyboard/focus handling, responsive dialog.
- `src/lib/chatHistory.ts`: shared frontend retention constant.
- `src-tauri/src/lib.rs`: read-only background history snapshot command and registration.
- `src-tauri/src/search_history_tests.rs`: real filesystem retention/bounds/read-only test.
- `work/ui-correction-test/bootstrap.ts`: isolated history fixture and test instrumentation.
- `work/ui-correction-test/run.mjs`: Global Search and regression coverage.
- This report. Frontend build output, isolated UI reports and screenshots were regenerated.

## Verification

- `npm run build`: passed (TypeScript and production Vite build). Existing large-bundle warning remains.
- `cargo check --manifest-path src-tauri/Cargo.toml`: passed.
- `cargo test --manifest-path src-tauri/Cargo.toml search_history_tests --lib`: 1 passed. Confirms latest-message limit, 24-hour retention, exclusion of future/system/malformed rows and unchanged source log contents.
- `node work/ui-correction-test/run.mjs`: all 28 cases passed, no uncaught browser errors. Includes the existing 21 channel-settings/UI regressions and 7 Global Search test groups.
- New checks cover channel search/selection without duplication; nickname and real-name equivalence; stored-message context; no per-keystroke history/HTTP calls; nickname-only profile navigation; arrows/Enter/Escape; Settings destination; Settings search independence; persistence; retention and result caps; bilingual aliases; Help opening the actual tutorial; narrow Norwegian layout.
- Visually reviewed `work/ui-correction-test/results/global-search.png` and `global-search-narrow-no.png`.

## Manual validation / limits

The browser tests use isolated data and mocked Tauri/profile/network access. The Rust test uses a temporary real history file. Real authenticated Twitch/Kick/YouTube traffic, profile fetching, prolonged very busy multi-channel sessions and OBS were not tested live. No installer or remote release was published.

Search is bounded to recent messages, not a full-history archive. A retained message from a channel no longer configured can show the stored platform/channel identifier rather than a friendly channel name. Exact scroll-to-message is intentionally not claimed. Users with neither retained/current messages nor a local nickname are not part of the user index. Existing ignores continue to exclude messages as they did in the original chat search.
