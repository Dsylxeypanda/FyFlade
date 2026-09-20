$path = "C:\Users\stigm\Desktop\Chatnest\src\App.tsx"
$backup = "C:\Users\stigm\Desktop\Chatnest\src\App.tsx.backup-before-tab-polish.tsx"

if (!(Test-Path $path)) {
    throw "Fant ikke App.tsx på: $path"
}

Copy-Item $path $backup -Force

$text = [System.IO.File]::ReadAllText($path)

$startMarker = "  function renderChannelTabs() {"
$endMarker = "  const moderationUnavailable ="

$start = $text.IndexOf($startMarker)

if ($start -lt 0) {
    throw "Fant ikke renderChannelTabs() i App.tsx."
}

$end = $text.IndexOf($endMarker, $start)

if ($end -lt 0) {
    throw "Fant ikke slutten på renderChannelTabs()."
}

$replacement = @'
  function renderChannelTabs() {
    const vertical =
      channelTabsVertical;

    const compact =
      channelTabsCompact;

    const barThickness =
      vertical
        ? compact
          ? 112
          : 142
        : compact
          ? 28
          : 36;

    const rowSize =
      compact
        ? 26
        : 32;

    const horizontalMinWidth =
      compact
        ? 86
        : 110;

    const twitchIconSize =
      compact
        ? 11
        : 13;

    const channelFontSize =
      compact
        ? 10.5
        : 11.5;

    const plusButton = (
      <button
        key="add-channel"
        onClick={() => {
          if (
            !twitchConnected
          ) {
            return;
          }

          primeMentionSound();

          setShowAddChannel(
            !showAddChannel
          );

          setAddChannelError(
            ""
          );
        }}
        disabled={
          !twitchConnected
        }
        title="Legg til kanal"
        style={{
          flexShrink:
            0,

          width:
            vertical
              ? "100%"
              : compact
                ? 28
                : 36,

          minWidth:
            vertical
              ? 0
              : compact
                ? 28
                : 36,

          height:
            vertical
              ? compact
                ? 25
                : 30
              : "100%",

          minHeight:
            vertical
              ? compact
                ? 25
                : 30
              : 0,

          border:
            "none",

          borderTop:
            vertical
              ? `1px solid ${theme.border}`
              : "none",

          borderLeft:
            !vertical
              ? `1px solid ${theme.border}`
              : "none",

          background:
            showAddChannel
              ? theme.tabActive
              : theme.tabBar,

          color:
            showAddChannel
              ? "#bf94ff"
              : theme.subtle,

          fontSize:
            compact
              ? 17
              : 19,

          fontWeight:
            400,

          lineHeight:
            1,

          cursor:
            twitchConnected
              ? "pointer"
              : "default",

          opacity:
            twitchConnected
              ? 1
              : 0.42,

          fontFamily:
            "inherit",

          transition:
            "background 90ms ease, color 90ms ease",
        }}
      >
        +
      </button>
    );

    const channelItems =
      channelTabs.map(
        (
          tab
        ) => {
          const active =
            tab.broadcasterId ===
            activeChannelId;

          const muted =
            mutedMentionChannels.includes(
              tab.login.toLowerCase()
            );

          const hovered =
            hoveredChannelTabId ===
            tab.broadcasterId;

          const activeAccent =
            active
              ? "#9147ff"
              : tab.hasMention
                ? "#ffd166"
                : "transparent";

          const tabBackground =
            active
              ? appearanceMode ===
                "light"
                ? "#ffffff"
                : "#202126"
              : tab.hasMention
                ? appearanceMode ===
                  "light"
                  ? "#fff9e8"
                  : "#242117"
                : hovered
                  ? appearanceMode ===
                    "light"
                    ? "#e8ebef"
                    : "#1d1f24"
                  : theme.tab;

          const closeButtonWidth =
            hovered
              ? compact
                ? 14
                : 17
              : 0;

          return (
            <div
              key={
                tab.broadcasterId
              }
              onMouseEnter={() =>
                setHoveredChannelTabId(
                  tab.broadcasterId
                )
              }
              onMouseLeave={() =>
                setHoveredChannelTabId(
                  ""
                )
              }
              onClick={() => {
                primeMentionSound();

                activateChannel(
                  tab.broadcasterId
                );
              }}
              onContextMenu={(
                event
              ) =>
                openTabContextMenu(
                  event,
                  tab.broadcasterId
                )
              }
              title={
                tab.displayName
              }
              style={{
                position:
                  "relative",

                flexShrink:
                  0,

                width:
                  vertical
                    ? "100%"
                    : "auto",

                minWidth:
                  vertical
                    ? 0
                    : horizontalMinWidth,

                maxWidth:
                  vertical
                    ? "100%"
                    : compact
                      ? 142
                      : 190,

                height:
                  vertical
                    ? rowSize
                    : "100%",

                minHeight:
                  vertical
                    ? rowSize
                    : 0,

                padding:
                  vertical
                    ? compact
                      ? "0 5px"
                      : "0 7px"
                    : compact
                      ? "0 6px"
                      : "0 8px",

                boxSizing:
                  "border-box",

                display:
                  "flex",

                alignItems:
                  "center",

                gap:
                  compact
                    ? 4
                    : 5,

                borderRight:
                  !vertical
                    ? `1px solid ${theme.border}`
                    : channelTabPosition ===
                      "right"
                      ? `2px solid ${activeAccent}`
                      : "none",

                borderLeft:
                  vertical &&
                  channelTabPosition ===
                    "left"
                    ? `2px solid ${activeAccent}`
                    : "none",

                borderBottom:
                  vertical
                    ? `1px solid ${theme.border}`
                    : channelTabPosition ===
                      "top"
                      ? `2px solid ${activeAccent}`
                      : "none",

                borderTop:
                  !vertical &&
                  channelTabPosition ===
                    "bottom"
                    ? `2px solid ${activeAccent}`
                    : "none",

                background:
                  tabBackground,

                boxShadow:
                  active
                    ? appearanceMode ===
                      "light"
                      ? "inset 0 0 0 1px rgba(145,71,255,.05)"
                      : "inset 0 0 16px rgba(145,71,255,.035)"
                    : "none",

                cursor:
                  "pointer",

                userSelect:
                  "none",

                transition:
                  "background 85ms ease, box-shadow 85ms ease",
              }}
            >
              <span
                title="Twitch"
                style={{
                  width:
                    twitchIconSize,

                  height:
                    twitchIconSize,

                  display:
                    "grid",

                  placeItems:
                    "center",

                  color:
                    active
                      ? "#a970ff"
                      : "#9147ff",

                  flexShrink:
                    0,

                  opacity:
                    active
                      ? 1
                      : 0.82,
                }}
              >
                <TwitchIcon
                  size={
                    twitchIconSize
                  }
                />
              </span>

              <span
                style={{
                  overflow:
                    "hidden",

                  textOverflow:
                    "ellipsis",

                  whiteSpace:
                    "nowrap",

                  flex:
                    1,

                  minWidth:
                    0,

                  fontSize:
                    channelFontSize,

                  lineHeight:
                    `${rowSize}px`,

                  fontWeight:
                    active
                      ? 650
                      : tab.hasMention
                        ? 600
                        : 450,

                  color:
                    tab.hasMention &&
                    !active
                      ? appearanceMode ===
                        "light"
                        ? "#6e5200"
                        : "#ffe39b"
                      : active
                        ? theme.text
                        : theme.muted,
                }}
              >
                {
                  tab.displayName
                }
              </span>

              {muted && (
                <span
                  title="Mention-lyd er av"
                  style={{
                    opacity:
                      0.34,

                    fontSize:
                      compact
                        ? 7
                        : 8,

                    flexShrink:
                      0,
                  }}
                >
                  🔇
                </span>
              )}

              {tab.isLive && (
                <span
                  title="LIVE"
                  style={{
                    width:
                      compact
                        ? 5
                        : 6,

                    height:
                      compact
                        ? 5
                        : 6,

                    borderRadius:
                      "50%",

                    background:
                      "#ff3347",

                    boxShadow:
                      "0 0 4px rgba(255,51,71,.8)",

                    flexShrink:
                      0,
                  }}
                />
              )}

              <button
                onClick={(
                  event
                ) => {
                  event.stopPropagation();

                  removeChannel(
                    tab.broadcasterId
                  );
                }}
                title="Fjern kanal"
                style={{
                  width:
                    closeButtonWidth,

                  minWidth:
                    closeButtonWidth,

                  height:
                    compact
                      ? 18
                      : 20,

                  padding:
                    0,

                  margin:
                    0,

                  border:
                    "none",

                  borderRadius:
                    3,

                  background:
                    hovered
                      ? appearanceMode ===
                        "light"
                        ? "rgba(31,35,40,.05)"
                        : "rgba(255,255,255,.035)"
                      : "transparent",

                  color:
                    hovered
                      ? theme.muted
                      : theme.subtle,

                  cursor:
                    "pointer",

                  fontSize:
                    compact
                      ? 12
                      : 14,

                  lineHeight:
                    1,

                  opacity:
                    hovered
                      ? 1
                      : 0,

                  overflow:
                    "hidden",

                  transition:
                    "opacity 80ms ease, width 80ms ease, background 80ms ease",
                }}
              >
                ×
              </button>

              {tab.hasMention &&
                !active && (
                  <span
                    title="Du ble tagget"
                    style={{
                      position:
                        "absolute",

                      top:
                        compact
                          ? 2
                          : 3,

                      right:
                        compact
                          ? 2
                          : 3,

                      width:
                        compact
                          ? 9
                          : 10,

                      height:
                        compact
                          ? 9
                          : 10,

                      display:
                        "flex",

                      alignItems:
                        "center",

                      justifyContent:
                        "center",

                      borderRadius:
                        2,

                      background:
                        "#ffd166",

                      color:
                        "#171717",

                      fontSize:
                        compact
                          ? 6.5
                          : 7,

                      lineHeight:
                        1,

                      fontWeight:
                        900,

                      boxShadow:
                        "0 0 0 1px rgba(0,0,0,.18)",

                      pointerEvents:
                        "none",
                    }}
                  >
                    !
                  </span>
                )}
            </div>
          );
        }
      );

    return (
      <div
        style={{
          width:
            vertical
              ? barThickness
              : "100%",

          minWidth:
            vertical
              ? barThickness
              : 0,

          maxWidth:
            vertical
              ? barThickness
              : "100%",

          height:
            vertical
              ? "100%"
              : barThickness,

          minHeight:
            vertical
              ? 0
              : barThickness,

          maxHeight:
            vertical
              ? "100%"
              : barThickness,

          display:
            "flex",

          flexDirection:
            vertical
              ? "column"
              : "row",

          alignItems:
            "stretch",

          background:
            theme.tabBar,

          borderRight:
            channelTabPosition ===
            "left"
              ? `1px solid ${theme.border}`
              : "none",

          borderLeft:
            channelTabPosition ===
            "right"
              ? `1px solid ${theme.border}`
              : "none",

          borderBottom:
            channelTabPosition ===
            "top"
              ? `1px solid ${theme.border}`
              : "none",

          borderTop:
            channelTabPosition ===
            "bottom"
              ? `1px solid ${theme.border}`
              : "none",

          overflow:
            "hidden",

          flexShrink:
            0,
        }}
      >
        <div
          style={{
            flex:
              1,

            minWidth:
              0,

            minHeight:
              0,

            display:
              "flex",

            flexDirection:
              vertical
                ? "column"
                : "row",

            alignItems:
              "stretch",

            overflowX:
              vertical
                ? "hidden"
                : "auto",

            overflowY:
              vertical
                ? "auto"
                : "hidden",
          }}
        >
          {
            channelItems
          }
        </div>

        {
          plusButton
        }
      </div>
    );
  }
'@

$newText =
    $text.Substring(0, $start) +
    $replacement +
    "`r`n`r`n" +
    $text.Substring($end)

$utf8NoBom =
    New-Object System.Text.UTF8Encoding($false)

[System.IO.File]::WriteAllText(
    $path,
    $newText,
    $utf8NoBom
)

Write-Host ""
Write-Host "FERDIG!" -ForegroundColor Green
Write-Host "ChatNest-kanalfanene er oppdatert." -ForegroundColor Green
Write-Host ""
Write-Host "Backup ligger her:"
Write-Host $backup -ForegroundColor Yellow