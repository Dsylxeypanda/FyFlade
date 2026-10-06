// OAuth client IDs are public identifiers (not secrets). Keeping FyFlade's
// desktop client ID in the app prevents production/portable builds from
// accidentally disabling YouTube when a local Vite environment file is absent.
export const YOUTUBE_OAUTH_CLIENT_ID =
  "549334493933-o482nqbqbnhrmbipl1mcsh9jgsvc46u7.apps.googleusercontent.com";
