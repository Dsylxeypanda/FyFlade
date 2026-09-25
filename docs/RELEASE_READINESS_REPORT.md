# FyFlade 1.0 release readiness report

Date: 2026-09-25

## Decision

The current source passes every automated release gate and fresh unsigned Windows test artifacts have been produced. FyFlade is ready for controlled hands-on testing, but it is **not ready for public download yet**. Public release is still blocked by release signing and the clean-machine/manual platform test matrix in `RELEASE_TEST_CHECKLIST.md`.

No unsigned artifact should be uploaded to the FyFlade website or update endpoint.

## Current product state

- Product name: FyFlade
- Display version: 1.0
- Technical version: 1.0.0
- Twitch, Kick, and YouTube chat are integrated, including combined chat and `/t`, `/k`, and `/y` routing.
- Settings opens as its own movable window.
- User-card popouts, profiles, per-channel settings, Smart inbox, moderation, OBS dock/browser view, portable mode, automatic updater support, chat history, highlights, TTS, and Party / Rave Mode are present.
- The removed Move/Edit Layout feature and Settings-section reordering are intentionally not release requirements.
- Party / Rave Mode uses native Windows system-audio capture and can animate the whole application. It remains off by default.

## Cache and resource protection

FyFlade has real cache and rate-protection mechanisms:

- Shared requests use a bounded single-flight TTL cache with positive and negative caching, stale-while-revalidate behavior, duplicate-request suppression, and a default maximum of 200 entries.
- Channel/live metadata is deduplicated and the persisted channel cache is bounded.
- YouTube passive chat uses `liveChatMessages.streamList`; offline discovery starts around ten minutes and backs off up to one hour.
- Emote, profile, and 7TV data use bounded caches, and Settings includes a temporary-cache clearing action.
- Optional chat history is stored locally with 24-hour, 48-hour, 7-day, 30-day, or unlimited retention. The default is 24 hours and expired data is cleaned automatically.

This means an offline channel is not repeatedly queried like a live channel, and repeated lookups do not continuously consume avoidable network/API work.

## Security and privacy

- Refresh tokens and supported client secrets are stored through Windows Credential Manager via the native keyring integration.
- Secrets are excluded from backups and portable packages.
- Sensitive diagnostics are redacted.
- Anonymous usage reporting is opt-in and is not required for FyFlade to work.
- Portable folders do not carry account access to another PC.
- Translation requires a disclosure before selected message text is sent to an external provider.

This is defense in depth, not protection against malware already running as the same Windows user. A malicious same-user process may be able to ask Windows for credentials belonging to that user.

## YouTube configuration

The official public OAuth client identifier is embedded in the current application build. It is a public identifier, not a secret. Users click **Log in** and do not create their own Google Cloud project or paste credentials.

Before public release, the Google OAuth consent configuration must still be confirmed as production-ready and tested from a clean Google account that has never used FyFlade.

## Compatibility kept intentionally

- Existing local-storage keys beginning with `chatnest.` remain so upgrades do not erase user settings.
- The Windows Credential Manager service name `ChatNest` remains internally so existing sign-ins continue to work.
- The Tauri identifier `com.stigm.chatnest` remains to preserve Windows/WebView storage identity.
- The existing relay/updater hostname contains `chatnest-kick-relay`; it is infrastructure, not visible product branding.
- Older backup files with `app: "ChatNest"` remain importable.

## Automated verification on 2026-09-25

- `npm run build`: passed.
- Rust tests: passed, 3 of 3.
- Cloudflare Kick relay TypeScript check: passed.
- Full optimized Windows desktop build: passed.
- Combined release gate with desktop build: passed.
- Fresh portable ZIP: structure, portable marker, product metadata, and SHA-256 verification passed in explicit unsigned-development mode.
- Fresh NSIS installer: built successfully; updater signing stopped because the release-key password was not supplied to the non-interactive build.

The frontend build has one non-blocking large-bundle warning (about 771 kB before gzip and 222 kB gzipped). This is a future startup optimization, not a correctness failure.

## Local unsigned test artifacts

These files are for local testing only and must not be published:

- Portable ZIP: `release/portable/FyFlade-1.0.0-windows-x64-portable.zip`
  - SHA-256: `E9D4ABA48D3D704831AFE43CEC741F0BB91D8ECC0B8520C3E2E5D3F8A202ECC5`
- NSIS installer: `src-tauri/target/release/bundle/nsis/FyFlade_1.0.0_x64-setup.exe`
  - SHA-256: `E75FF9F8DB672FA73726D35A08BBA379FA02ED3DAD52797998DEB26385EA6F8F`

Both executable builds are currently `NotSigned`. Old artifacts were moved into timestamped folders under `release/archive` rather than overwritten.

## Remaining public-release blockers

1. Enter the existing Tauri updater-key password locally and validate it with `scripts/validate-fyflade-updater-key.ps1`. The matching private/public key files are present and Git-ignored; the password must never be committed or sent in chat.
2. Obtain/configure a trusted Windows Authenticode code-signing certificate.
3. Build both public artifacts, verify the updater `.sig`, verify Authenticode, and publish new hashes.
4. Complete every relevant manual checkbox on a clean Windows user/PC with real Twitch, Kick, YouTube, OBS, multi-monitor, portable, install/uninstall, and update testing.
5. Confirm the Google OAuth consent screen and official client work for an unrelated clean account.
6. Test one genuine signed update from an older signed build without losing data.

Until these pass, FyFlade should be described as a test candidate rather than a finished public release.
