# FyFlade — Custom Layout Editor and Dockable Chat Panes

Completed 2026-09-13 in `outputs/Chatnest-7TV`.

## Result

FyFlade remains unchanged for users who never open Edit layout. A profile without a saved layout continues to use the original combined Twitch/Kick/YouTube renderer and existing channel-tab arrangement.

Settings → Profiles now provides **Edit layout** and a confirmed **Reset profile layout** action. Ctrl+K includes **Edit current layout** and **Reset profile layout…**. Reset navigation never resets immediately.

Edit mode is visually marked and provides Save layout, Cancel, bounded Undo (30 snapshots), confirmed Reset layout and Save and lock. Dragging and resizing are disabled outside edit mode. The editor also provides keyboard-accessible panel visibility, movement selects and resize separators.

## Layout architecture

The versioned layout is a recursive tree:

```text
WorkspaceLayout v1
└─ Split(horizontal | vertical, ratio 0.15–0.85)
   ├─ Pane(chat, [twitch, kick])
   └─ Pane(chat, [youtube])
```

Pane kinds are `chat`, `channels` and `inbox`. Chat panes hold platform groups rather than channels or connection objects. Platform identity is limited to `twitch`, `kick` and `youtube`; validation requires each platform exactly once across the tree. This allows mixed groups and nested two/three-pane layouts without hard-coded combinations.

All nodes have stable IDs. Splits store direction and ratio. Ratios clamp to 15–85%. Recursive minimum sizes prevent panes from becoming unusable. A viewport that is too small scrolls the layout container without rewriting the saved tree, so the intended arrangement returns when the window grows.

## Docking and resizing

During edit mode, meaningful blocks and platform tabs can be dragged. The entire pane header is a drag surface, and each platform tab has a larger full-tab drag surface. A pointer-driven implementation is used because native HTML drag proved unreliable in the Windows Tauri WebView. Each target pane displays large left, right, top, bottom and compatible center/combine zones before drop. Edge drops build a horizontal or vertical split at 50/50. Center drops combine chat platform groups.

Existing channel tabs now use their robust pointer reorder/merge logic from the entire channel row (except real buttons), not only the narrow grip at the left. A short click still activates the channel; movement beyond five pixels begins reordering. Dropping in the compatible center region merges two single-platform channel tabs.

The same operations are available in **Move without dragging** for keyboard users. Split separators are pointer-draggable and respond to arrow keys in 5% increments. A resize is committed only at pointer release; Cancel restores the exact pre-edit profile layout.

The supported panel list currently contains actual main-workspace regions:

- Channels and embedded connection status — always visible for safe recovery.
- Chat — always visible, with the shared message input outside the split tree.
- Inbox — can be hidden/restored and docked.

OBS tools remain in the existing Settings/OBS flow, and user/moderation detail remains in the existing movable popup. They were deliberately not duplicated as fake permanent panels.

## Existing chat reuse

The original chat message renderer was extracted into one reusable render function. Each chat pane creates a presentation-only filtered view of `activeTab.messages`. Network subscriptions, polling, OAuth state, badges, emotes, moderation permissions, chat history and channel identity remain shared and untouched.

No pane opens a Twitch EventSub connection, Kick subscription, YouTube poll or emote request. Each incoming message exists once in the active channel state and renders only in the pane containing its platform. Missing/disconnected platform sources show a local state and keep their saved pane. Changing channel keeps the profile layout but applies it to the new active channel's platform sources.

Sending still uses the existing single input and existing `/t`, `/k` and `/y` routing. A workspace strip shows the current sending platform. No duplicate send implementation was added.

## Profile association and migration

The existing `fyflate.profiles.v1` profile entry gains one optional `layout` field. Custom profile creation copies the current active layout; duplication copies the selected profile layout; renaming retains its stable profile ID. Each profile keeps an independent tree.

Existing stored profile data remains valid because layout is optional. Missing layout means the original interface, so installation does not change the user's current workspace. On first Edit layout, the tree is generated from that profile's current safe view values. Built-in Reset restores its generated default; custom profiles can edit and save their copied layout.

Invalid layout data—bad version, corrupt node, excessive depth/node count, invalid IDs/types/ratios, duplicate platforms, missing platforms or missing Channels—validates to `null`, safely returning that profile to the original/default interface. Invalid data cannot prevent startup.

Per-channel overrides remain outside profiles and are never read or written by layout operations. OBS overlay/dock configuration is also excluded.

## Files changed

- `src/features/layout/layout.ts` — versioned tree, validation, defaults, docking, combining, resizing, visibility and minimum-size logic.
- `src/features/layout/DockWorkspace.tsx` — editor toolbar, drag/drop previews, nested rendering, dividers and keyboard controls.
- `src/features/profiles/profiles.ts` — optional validated layout in existing profile storage.
- `src/features/profiles/useProfiles.ts` — profile-layout save/Undo/copy/reset behavior.
- `src/features/profiles/ProfilesPanel.tsx` — Edit/Reset layout controls and short instructions.
- `src/features/commands/quickCommands.ts` — safe edit/reset navigation commands.
- `src/App.tsx` — shared chat rendering, profile edit session, workspace integration, existing input/navigation reuse and Help text.
- `work/ui-correction-test/bootstrap.ts` — isolated exposure of the pure layout model.
- `work/ui-correction-test/layouts.mjs` — model and editor regression tests.
- `work/ui-correction-test/run.mjs` — layout test integration.
- `work/ui-correction-test/results/` — updated report and visual evidence.
- `dist/` — regenerated production frontend output.

## Tests and builds

**46 grouped interface tests passed, with zero uncaught browser errors.** All 39 prior channel settings, Profiles, Global Search, Quick Commands and interface groups still pass. Seven new groups cover:

1. Original combined layout; Twitch/Kick/YouTube separation on every edge; recombination; no duplicate platforms.
2. Nested three-way horizontal/vertical layouts; serialized ratios; Inbox visibility; corrupt layout fallback.
3. Drag preview and drop; keyboard resize; edit Undo; Cancel without persistence.
4. Keyboard docking into three panes; hidden Inbox restoration; Save and locked normal mode.
5. Per-profile restart/switch/resize persistence; recombination; Cancel restoration.
6. Confirmed, active-profile-only layout reset.
7. Whole-channel-row pointer reordering without using the narrow left grip.

Screenshots visually inspected:

- `layout-drop-preview.png` — large five-zone target preview.
- `layout-three-panes.png` — nested Twitch/Kick/YouTube panes, Channels and Inbox.
- `layout-narrow.png` — narrow-window fallback without destructive layout changes.

Build results:

- `npm run build`: passed TypeScript and production Vite build. The existing >500 kB main-bundle warning remains.
- `cargo check --manifest-path src-tauri/Cargo.toml`: passed. The existing `C:\Users\stigm` canonicalization warning remains.

## Manual Windows/live-chat checklist

1. Start the real FyFlade Tauri app and open a channel containing Twitch, Kick and YouTube.
2. Confirm the original combined chat looks and behaves exactly as before.
3. Open Settings → Profiles → Edit layout.
4. Drag YouTube to the right; confirm Twitch + Kick stay combined.
5. Resize the divider with the mouse and with an arrow key while focused.
6. Drag Kick out; confirm three panes and correct platform labels.
7. Drag Kick onto Twitch's center; confirm Twitch + Kick recombine.
8. Toggle Inbox off and on, then dock it elsewhere.
9. Use Move without dragging to verify keyboard recovery.
10. Cancel an edit and verify the previously saved arrangement returns exactly.
11. Edit again, Save layout, close and restart FyFlade; verify the arrangement and ratios return.
12. Switch profiles and back; verify each profile restores its own layout.
13. Shrink and enlarge the native window; verify no overlap and that the saved layout is unchanged.
14. Watch real incoming messages on all three services; verify every message appears once and in the correct pane.
15. Send with `/t`, `/k` and `/y`; verify the selected platform and existing shared input still work.
16. Check badges, 7TV emotes, highlights, ignores, user popups, moderation tools and saved history in every pane.
17. Disconnect/reconnect one platform and switch between channels with one/two/three attached sources; verify the layout remains stable.
18. Verify OBS dock and transparent overlay remain unchanged.
19. Test Edit layout from a detached Settings window and confirm the main window enters edit mode.
20. Use Reset profile layout, confirm the warning, then test the existing Undo toast.

The automated suite uses mocked Tauri/platform services. Real authenticated streams, native pointer behavior, native WebView synchronization, OBS and outgoing messages were not tested live. No installer was built, installed or published for this task.
