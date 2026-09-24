// OAuth client IDs are public identifiers (not secrets). Keeping FyFlade's
// desktop client ID in the app prevents production/portable builds from
// accidentally disabling YouTube when a local Vite environment file is absent.
export const YOUTUBE_OAUTH_CLIENT_ID =
  "209414911382-unb2gs0v1b19j0520011snv00a9iht13.apps.googleusercontent.com";
