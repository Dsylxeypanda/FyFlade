ChatNest - YouTube streamList pack

Mål:
- Bytter YouTube livechat fra gjentatt liveChatMessages.list polling til Googles offisielle
  liveChatMessages.streamList over gRPC.
- Beholder Twitch + YouTube + Kick, merged tabs, Kick mod control, YouTube mod control,
  Kick emotes/badges og 24t historikk.
- YouTube live-status-sjekk bruker fortsatt noen få vanlige API-kall.
- En allerede oppbrukt Google-kvote blir ikke nullstilt av denne endringen; vent til Google
  resetter kvoten før første test hvis prosjektet står på quotaExceeded.

Plassering:
1) src/App.tsx
2) src-tauri/src/lib.rs
3) src-tauri/build.rs
4) src-tauri/proto/youtube_live_chat.proto
5) Kjør PATCH_CARGO_YOUTUBE_STREAM.ps1 fra ChatNest-hovedmappen.
6) npm run tauri dev

Ingen separat protoc-installasjon er nødvendig. protoc-bin-vendored følger via Cargo.
