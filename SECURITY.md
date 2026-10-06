# FyFlade security and privacy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Send a concise report to [sabryna91@live.no](mailto:sabryna91@live.no) with affected versions, reproduction steps, impact, and any suggested mitigation. Do not include real user credentials or private chat data.

The project will acknowledge a usable report as soon as practical, investigate it privately, and coordinate a fix before public disclosure when the report is valid.

## Trust model

FyFlade uses the official OAuth pages for Twitch, Kick, and Google. FyFlade must
never ask for or receive a user's account password. Refresh tokens and locally
configured client secrets are stored through Windows Credential Manager. Access
tokens are kept in memory while the app is running.

Kick token exchange and refresh requests pass over HTTPS through the FyFlade
Cloudflare relay because the private Kick application secret remains on the
server. The relay does not persist tokens or log request bodies. Signed-in Kick
identity and live webhook messages are handled transiently to authorize and
deliver chat, but are not stored as server-side chat history.

Settings, channel lists, nicknames, ignores, and optional chat history stay on
the user's PC. Backups intentionally exclude OAuth data, tokens, client IDs,
client secrets, webhook values, and quota credentials.

Anonymous usage counting is optional and off by default. When enabled, the app
sends at most one empty signal per UTC day. The FyFlade Worker stores only a day
and a count. It does not store an account, user ID, channel, chat message, IP
address, or persistent installation ID. Cloudflare still necessarily processes
network metadata while delivering the HTTPS request; its own platform policies
apply to that processing.

## Protection boundaries

- A Content Security Policy blocks injected or remote scripts in the desktop
  WebView. Network access from Tauri's HTTP plugin remains limited to the
  explicitly approved platform and emote service domains.
- Kick relay clients receive short-lived signed tickets. Kick webhooks are
  signature-verified before messages are relayed.
- Automatic updates require a valid Tauri updater signature. Controlling the
  download server alone is not sufficient to publish an accepted update.
- Cloudflare secrets belong in `wrangler secret`, never in `wrangler.jsonc`.
- Updater private keys and certificate files are ignored by source control.

No desktop application can prevent the owner of a PC from modifying their own
local copy. The security goal is instead that a modified copy cannot become an
official signed update or take control of other installations. Do not share the
updater private key, its password, Cloudflare credentials, or administrator
secrets.

## Release checklist

1. Build releases only on a trusted, fully updated Windows PC.
2. Keep the updater private key backed up offline and never upload it.
3. Build with `scripts/build-fyflade-release.ps1`; do not bypass updater
   signing.
4. Verify the generated updater signature before publishing the release URL.
5. Store Cloudflare values with `npx wrangler secret put`.
6. Use the approved SignPath Foundation workflow for Authenticode signing before
   public distribution. Tauri updater signing protects updates but does not
   replace Windows code signing or SmartScreen reputation.
7. Publish a user-facing privacy notice matching the behavior above before a
   public release.
8. Run `scripts/verify-fyflade-release.ps1` against the final installer. It
   refuses an installer without both a Tauri updater signature and a valid
   Windows Authenticode signature.
