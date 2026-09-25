# FyFlade YouTube release setup

This is a developer/release-owner checklist. It must never be shown as setup work for FyFlade users.

## One-time Google configuration

1. Use one Google Cloud project owned by FyFlade.
2. Enable YouTube Data API v3.
3. Configure the OAuth consent screen with the public FyFlade name, support email, verified homepage, and privacy-policy links.
4. Create an OAuth client with application type **Desktop app**.
5. Request only the scope FyFlade currently needs: `https://www.googleapis.com/auth/youtube.force-ssl`.
6. Submit the app for Google OAuth verification before public distribution. An unverified public app using user-data scopes can be subject to warnings and a limited user cap.
7. Monitor and request YouTube Data API quota through the FyFlade Google Cloud project as usage grows.

Official references:

- <https://developers.google.com/identity/protocols/oauth2/native-app>
- <https://developers.google.com/youtube/v3/getting-started>
- <https://support.google.com/cloud/answer/13464321>

## Application and release-machine configuration

FyFlade's official desktop OAuth Client ID is embedded in `src/youtubeConfig.ts`. This public identifier is used automatically when a local environment file is absent, so ordinary users never configure Google Cloud and a clean release machine does not silently disable YouTube.

For a deliberate release-only override, copy `.env.example` to `.env.production.local` and set:

```text
VITE_YOUTUBE_OAUTH_CLIENT_ID=the-fyflade-desktop-client-id.apps.googleusercontent.com
```

The client secret is optional for Google's installed-app flow with PKCE. If the configured client requires it, set `VITE_YOUTUBE_OAUTH_CLIENT_SECRET` too. Values prefixed with `VITE_` are bundled into the desktop client and must never be treated as confidential. User refresh tokens are separate and remain in Windows Credential Manager on each user's PC.

The release scripts validate the effective Client ID (override first, embedded fallback) and stop before building if it is missing or malformed.

## Manual release test

- Install a production build on a clean Windows user profile.
- Confirm the Accounts page shows one YouTube **Log in** action and no Google Cloud setup guide.
- Complete login in the system browser and confirm the loopback callback returns to FyFlade.
- Restart FyFlade and confirm the saved session restores without another consent prompt.
- Confirm channel lookup, offline/live discovery, incoming live chat, sending, and moderation.
- Revoke FyFlade from the Google account, restart, and confirm the app asks the user to sign in again without exposing token details.
- Confirm Quota & Usage shows endpoint calls/errors as local diagnostics and clearly describes the Google project as a shared quota pool.
