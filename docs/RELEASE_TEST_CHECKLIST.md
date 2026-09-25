# FyFlade 1.0 release test checklist

This is the final release gate for the Windows installer and portable ZIP. A public build is **not release-ready** until every automated check passes, every relevant manual box is checked on a clean Windows user account, and both public artifacts have valid signatures.

## Automated gate

- [x] TypeScript and Vite production build: `npm run build`
- [x] Rust unit and integration tests: `cargo test --manifest-path src-tauri/Cargo.toml`
- [x] Cloudflare Kick relay type check
- [x] Distribution metadata agrees on FyFlade and technical version 1.0.0
- [x] Portable marker behavior has a Rust regression test
- [x] Re-run the complete gate on 2026-09-25: `scripts/test-fyflade-release.ps1 -IncludeDesktopBuild`

## Clean install and first start

- [ ] Install the signed NSIS build on a Windows account that has never run FyFlade.
- [ ] Confirm the title, icon, Start menu entry, installer, and uninstall entry all say FyFlade 1.0.
- [ ] Confirm the first-start tutorial is readable in Norwegian and English, can move backward/forward, scrolls to targets, and can be skipped and restarted.
- [ ] Confirm reduced-motion mode removes animated tutorial transitions.
- [ ] Restart Windows and confirm settings persist without FyFlade starting unexpectedly.

## Accounts and privacy

- [ ] Sign in to Twitch, Kick, and YouTube separately and restart FyFlade after each sign-in.
- [ ] Confirm the user remains signed in and tokens/secrets are absent from localStorage, exported backups, logs, screenshots, crash messages, and the portable folder.
- [ ] Confirm credentials appear only as protected generic entries in Windows Credential Manager.
- [ ] Confirm signing out removes the corresponding credential and does not disconnect other platforms.
- [ ] Confirm anonymous usage reporting is off by default and contains no account, channel, message, IP, token, or device identity.
- [ ] Confirm clearing temporary caches does not remove accounts, profiles, layouts, or intentional chat history.

## Twitch, Kick, and YouTube chat

- [ ] Receive and send messages in live Twitch, Kick, and YouTube channels.
- [ ] Send a message to an offline Twitch channel and an offline Kick channel; confirm the sent message appears locally without duplication.
- [ ] Confirm reconnecting does not duplicate recent messages.
- [ ] Confirm native badges, moderator/VIP/subscriber badges, and 7TV cosmetics render on the correct platform.
- [ ] Confirm Twitch, Kick, YouTube, 7TV, and BTTV emotes render without changing typed text such as `:D` into another token.
- [ ] Confirm `/t `, `/k `, and `/y ` route a combined-tab message to the selected platform.
- [ ] Confirm quota/status views explain YouTube and Kick behavior without exposing secrets.

## Channels, windows, and profiles

- [ ] Add, remove, reorder, group, favorite, combine, and separate channels; restart and confirm the order remains.
- [ ] Open multiple user-card popouts, move them outside the main window, and confirm platform/channel badges identify each one.
- [ ] Move and resize the Settings window on multiple monitors; restart and confirm it returns on-screen.
- [ ] Save, switch, rename, export, import, and delete profiles; confirm active profile changes auto-save.
- [ ] Confirm channel-specific settings inherit global values, override independently, survive reorder/restart, and reset to global defaults.

## Highlights, inbox, sounds, and history

- [ ] Confirm direct mentions, replies, and configured highlight words enter Smart inbox once; ordinary messages do not.
- [ ] Confirm YouTube paid events are labelled as events and not falsely labelled as direct mentions.
- [ ] Confirm muted channels/users, notification settings, sound settings, cooldown, volume, and test sound behave correctly.
- [ ] Confirm optional text-to-speech respects enablement, cooldown, platform/channel rules, and Windows voice availability.
- [ ] Confirm disabled history saves nothing new; enabled live history follows retention and appears in user cards.

## OBS and accessibility

- [ ] Add the local FyFlade OBS dock URL, restart FyFlade and OBS, and confirm the dock reconnects without exposing credentials.
- [ ] Confirm OBS inclusion/exclusion follows global and per-channel settings.
- [ ] Check keyboard-only navigation, visible focus, Escape behavior, Ctrl+K, global search, high contrast, font scaling, and reduced motion.
- [ ] Check the smallest supported window size, 100/125/150/200% Windows scaling, and at least a two-monitor setup.

## Appearance and Party / Rave Mode

- [ ] Confirm Party / Rave Mode is off by default and remains off after a clean first start.
- [ ] Test every visual style, scope, sensitivity, bass sensitivity, glow, and movement control.
- [ ] Enable React to system audio while Spotify or another Windows audio source plays; confirm the full UI reacts and stops reacting when disabled.
- [ ] Confirm audio capture is released when Party / Rave Mode or FyFlade closes.
- [ ] Confirm normal themes, text readability, controls, and reduced-motion behavior remain usable after Party / Rave Mode is disabled.

## Backup, language, translation, and recovery

- [ ] Export and import a backup; confirm secrets and temporary caches are excluded and undo-import restores the earlier state.
- [ ] Switch Norwegian/English and confirm the entire visible settings/tutorial context changes consistently.
- [ ] Confirm translation opens only after the one-time privacy disclosure and sends only the chosen message text to the selected provider.
- [ ] Simulate network loss and platform/API errors; confirm FyFlade remains usable and displays safe, understandable errors.

## Installer, portable, and updates

- [x] Validate the existing updater key locally with `scripts/validate-fyflade-updater-key.ps1`; the password was not saved in the repository or chat.
- [ ] Build the installer with `scripts/build-fyflade-release.ps1`; verify it with `scripts/verify-fyflade-release.ps1`.
- [x] Confirm the Tauri updater `.sig` is present for the current installer.
- [ ] Confirm the installer EXE has a valid Windows Authenticode signature.
- [ ] Install an older signed test version and complete a real signed in-app update without losing data.
- [ ] Build the portable ZIP with `scripts/build-fyflade-portable.ps1`; verify it with `scripts/verify-fyflade-portable.ps1`.
- [ ] Confirm portable FyFlade starts from an extracted writable folder, identifies itself as portable in Settings, and disables installer-based automatic updates.
- [ ] Copy the portable folder to another Windows account and confirm credentials do not travel with it.
- [ ] Confirm both published SHA-256 hashes match the downloadable artifacts.

## Final approval

- [ ] No blocker or critical defect remains open.
- [ ] The Cloudflare relay/update endpoint and FyFlade website have been tested from a network outside the developer's home network.
- [ ] The privacy/security text and download links match the exact published artifacts.
- [ ] A rollback copy of the previous public release and update metadata exists.
- [ ] The developer records the date, artifact hashes, signer identity, and tester name before publishing.
