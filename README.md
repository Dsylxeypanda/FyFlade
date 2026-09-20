# FyFlade

FyFlade is a Windows multistream chat application for Twitch, Kick, and YouTube. It combines supported platform chats, badges, emotes, channel tools, profiles, layouts, popouts, and local OBS views in one desktop app.

The desktop application uses React, TypeScript, Vite, Tauri, and Rust. The Kick relay and update metadata service live under `cloudflare/kick-relay`.

## Local development

Run `npm run tauri dev` from this directory. Production installers must use the signed release workflow described in `SECURITY.md`.
