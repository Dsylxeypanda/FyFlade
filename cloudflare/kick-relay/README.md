# FyFlade Kick Relay

This Cloudflare Worker keeps the Kick Client Secret out of the desktop app,
exchanges OAuth tokens, verifies Kick webhook signatures, and relays chat events
to signed-in FyFlade clients over hibernating Durable Object WebSockets.

Required Cloudflare secrets:

- `KICK_CLIENT_ID`
- `KICK_CLIENT_SECRET`
- `CHATNEST_SESSION_SECRET`

Optional private administrator secret:

- `ANALYTICS_ADMIN_SECRET` protects the anonymous daily usage summary. Set it
  with `npx wrangler secret put ANALYTICS_ADMIN_SECRET`; never add it to
  `wrangler.jsonc` or source control.

`POST /usage` only increments the current UTC day's counter. The Worker does
not send request headers to the Durable Object and does not store an IP address,
account, channel, chat message, or installation identifier. The public endpoint
is deliberately anonymous, so its total is approximate and cannot be treated as
an authenticated unique-user count.
An account-level Cloudflare Rate Limiting binding caps anonymous usage writes per
Cloudflare location without creating a user or installation identifier.

`GET /usage/summary` returns the latest 31 daily totals only when called with
`Authorization: Bearer <ANALYTICS_ADMIN_SECRET>`. It returns 404 until that
secret has been configured.

From the project root, `scripts/setup-anonymous-usage-admin.ps1` creates a
random administrator secret, sends it to Wrangler through standard input, and
stores the local copy with Windows DPAPI. The value is never printed. After the
Worker has been deployed, `scripts/show-anonymous-usage.ps1` displays the daily
totals without placing the secret in PowerShell history.

The registered Kick redirect URL must remain:

`http://localhost:17171/kick/callback`

The Kick Developer webhook URL is:

`https://chatnest-kick-relay.sabryna91.workers.dev/kick/webhook`
