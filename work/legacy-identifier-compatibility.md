# FyFlade legacy identifier compatibility

This table records the old identifiers that intentionally remain after the first branding cleanup. They must not be renamed without a tested migration.

| Legacy identifier | Current purpose | Phase 1 decision | Required migration before removal |
| --- | --- | --- | --- |
| `com.stigm.chatnest` | Tauri/Windows app identity and app-data location | Keep | Install an older signed build, migrate data to the new identity, verify install/update/uninstall and rollback |
| `chatnest.*` localStorage keys | Existing settings, channels, emotes, appearance, accounts, and UI state | Keep | Dual-read old/new keys, write new keys, verify all settings and backups, retain fallback for at least one public release |
| `ChatNest` Credential Manager service | Twitch, Kick, and YouTube refresh tokens plus locally configured secrets | Keep as `LEGACY_CREDENTIAL_SERVICE` | Copy each credential to the new service, read back and verify it, retain old fallback, never delete on the first migration |
| `chatnest-kick-relay.sabryna91.workers.dev` | Kick relay, anonymous usage summary, and updater metadata | Keep | Deploy the replacement endpoint, support both URLs, test Kick/OAuth/webhooks/updater, then phase out the old hostname |
| updater public key and endpoint | Verifies trusted automatic updates | Keep | Prove an installed old FyFlade build can update to a new build without losing data |
| `chatnest-updater-secure.key` | Existing local updater private-key filename | Keep | Filename can change only after the release script supports the existing key or it has been securely copied and verified |
| `ChatNest` backup metadata | Import of backups exported by older builds | Accept on import | New exports use `FyFlade`; keep accepting `ChatNest`, `Fyflate`, and `Fy Flate` backups |
| `public/chatnest-logo.png` | Compatibility copy of the former public asset | Keep temporarily | New UI uses `fyflade-logo.png`; remove only after all built/test fixtures and cached references use the new path |
| Cloudflare `CHATNEST_*`, Durable Object names, internal URLs/headers | Deployed Worker bindings and stored Durable Object identity | Keep | Add parallel bindings/routes and migrate deployed state before changing names |

Safe names changed in Phase 1:

- npm package metadata: `fyflade`
- Rust package/crate: `fyflade` / `fyflade_lib`
- native executable build name: `fyflade.exe`
- release script: `build-fyflade-release.ps1`
- current logo references: `/fyflade-logo.png`
- update/backup function names and diagnostic text
- new backup metadata: `FyFlade`

