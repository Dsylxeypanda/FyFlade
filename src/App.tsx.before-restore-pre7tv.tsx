import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";

import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import { openUrl } from "@tauri-apps/plugin-opener";

import { TWITCH_CLIENT_ID } from "./twitchConfig";

const SAVED_CHANNELS_KEY =
  "chatnest.twitch.channels.v1";

const ACTIVE_CHANNEL_KEY =
  "chatnest.twitch.activeChannel.v1";

const MUTED_MENTION_CHANNELS_KEY =
  "chatnest.twitch.mutedMentionChannels.v1";

const IGNORED_HIGHLIGHT_USERS_KEY =
  "chatnest.twitch.ignoredHighlightUsers.v1";

const USER_NOTES_KEY =
  "chatnest.twitch.userNotes.v1";

const CHAT_FONT_SIZE_KEY =
  "chatnest.chat.fontSize.v1";

const HIGHLIGHT_USERS_KEY =
  "chatnest.twitch.highlightUsers.v1";

const CHANNEL_CACHE_KEY =
  "chatnest.twitch.channelCache.v1";

const APPEARANCE_MODE_KEY =
  "chatnest.appearance.mode.v1";

const CHAT_BACKGROUND_KEY =
  "chatnest.appearance.chatBackground.v1";

const CHAT_HISTORY_MAX_AGE_MS =
  24 * 60 * 60 * 1000;

const TWITCH_SCOPES =
  "user:read:chat user:write:chat user:read:moderated_channels moderator:manage:banned_users moderator:manage:chat_messages moderator:manage:chat_settings moderator:read:followers user:read:blocked_users user:manage:blocked_users user:manage:whispers channel:manage:moderators channel:manage:vips";

type TwitchDeviceResponse = {
  device_code: string;
  expires_in: number;
  interval: number;
  user_code: string;
  verification_uri: string;
};

type TwitchTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string[];
  token_type: string;
};

type TwitchUser = {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
  created_at?: string;
};

type TwitchUsersResponse = {
  data: TwitchUser[];
};

type TwitchStreamsResponse = {
  data: {
    user_id: string;
  }[];
};

type TwitchModeratedChannelsResponse = {
  data: {
    broadcaster_id: string;
  }[];

  pagination: {
    cursor?: string;
  };
};

type TwitchBadgeFromMessage = {
  set_id: string;
  id: string;
  info: string;
};

type TwitchBadgeVersion = {
  id: string;
  image_url_2x: string;
  title: string;
};

type TwitchBadgeSet = {
  set_id: string;
  versions: TwitchBadgeVersion[];
};

type TwitchBadgeApiResponse = {
  data: TwitchBadgeSet[];
};

type BadgeLookupItem = {
  imageUrl: string;
  title: string;
};

type ResolvedBadge = {
  setId: string;
  id: string;
  info: string;
  imageUrl: string;
  title: string;
};

type TwitchEmoteInfo = {
  id: string;
  emote_set_id: string;
  owner_id: string;
  format: string[];
};

type TwitchMessageFragment = {
  type: string;
  text: string;

  emote?: TwitchEmoteInfo | null;

  gif?: {
    gif_id: string;
    url: string;
  } | null;

  mention?: {
    user_id: string;
    user_name: string;
    user_login: string;
  } | null;

  cheermote?: {
    prefix: string;
    bits: number;
    tier: number;
  } | null;
};

type TwitchReplyInfo = {
  parentMessageId: string;
  parentMessageBody: string;

  parentUserId: string;
  parentUserName: string;
  parentUserLogin: string;

  threadMessageId: string;

  threadUserId: string;
  threadUserName: string;
  threadUserLogin: string;
};

type TwitchChatMessage = {
  id: string;

  kind:
    | "chat"
    | "system";

  timestampMs: number;

  time: string;

  userId: string;
  userLogin: string;

  username: string;
  text: string;
  color: string;

  badges: ResolvedBadge[];

  fragments:
    TwitchMessageFragment[];

  reply?:
    | TwitchReplyInfo
    | null;
};

type ChannelTab = {
  broadcasterId: string;

  login: string;
  displayName: string;

  profileImageUrl: string;

  isLive: boolean;

  canModerate: boolean;

  status:
    | "joining"
    | "live"
    | "error"
    | "disconnected";

  error: string;

  messages:
    TwitchChatMessage[];

  hasMention: boolean;
};

type TwitchSendMessageResponse = {
  data: {
    message_id: string;

    is_sent: boolean;

    drop_reason: {
      code: string;
      message: string;
    } | null;
  }[];
};

type ReplyTarget = {
  messageId: string;
  username: string;
  text: string;
};

type TabContextMenu = {
  x: number;
  y: number;

  broadcasterId: string;
} | null;

type UserRoles = {
  broadcaster: boolean;
  moderator: boolean;
  vip: boolean;
  subscriber: boolean;
};

type UserCardState = {
  broadcasterId: string;

  channelLogin: string;
  channelDisplayName: string;

  canModerate: boolean;

  userId: string;
  userLogin: string;
  username: string;

  profileImageUrl: string;

  createdAt: string;

  followerCount:
    | number
    | null;

  followedAt:
    | string
    | null;

  blocked:
    | boolean
    | null;

  roles:
    UserRoles;
};

type ChannelFollowersResponse = {
  total: number;

  data: {
    followed_at: string;
    user_id: string;
  }[];

  pagination: {
    cursor?: string;
  };
};

type BlockedUsersResponse = {
  data: {
    user_id: string;
  }[];

  pagination: {
    cursor?: string;
  };
};

type HighlightUser = {
  userId: string;
  login: string;
  displayName: string;
};

type AppearanceMode =
  | "dark"
  | "light";

type CachedChannel = {
  login: string;
  displayName: string;
  profileImageUrl: string;
};

const smallButton: CSSProperties = {
  border:
    "1px solid rgba(127,127,127,.35)",

  background:
    "transparent",

  color:
    "inherit",

  borderRadius:
    4,

  padding:
    "6px 9px",

  cursor:
    "pointer",

  fontSize:
    11,

  fontFamily:
    "inherit",
};

function readStringArray(
  key: string
): string[] {
  try {
    const raw =
      localStorage.getItem(
        key
      );

    const parsed =
      raw
        ? JSON.parse(
            raw
          )
        : [];

    return Array.isArray(
      parsed
    )
      ? parsed.filter(
          (
            value
          ): value is string =>
            typeof value ===
            "string"
        )
      : [];
  } catch {
    return [];
  }
}

function readStringRecord(
  key: string
): Record<
  string,
  string
> {
  try {
    const raw =
      localStorage.getItem(
        key
      );

    const parsed =
      raw
        ? JSON.parse(
            raw
          )
        : {};

    if (
      !parsed ||
      typeof parsed !==
        "object" ||
      Array.isArray(
        parsed
      )
    ) {
      return {};
    }

    const out:
      Record<
        string,
        string
      > = {};

    for (
      const [
        recordKey,
        value,
      ] of Object.entries(
        parsed
      )
    ) {
      if (
        typeof value ===
        "string"
      ) {
        out[
          recordKey
        ] =
          value;
      }
    }

    return out;
  } catch {
    return {};
  }
}

function readHighlightUsers():
  HighlightUser[] {
  try {
    const raw =
      localStorage.getItem(
        HIGHLIGHT_USERS_KEY
      );

    const parsed =
      raw
        ? JSON.parse(
            raw
          )
        : [];

    if (
      !Array.isArray(
        parsed
      )
    ) {
      return [];
    }

    return parsed
      .filter(
        (
          item
        ) =>
          item &&
          typeof item ===
            "object" &&
          typeof item.userId ===
            "string" &&
          typeof item.login ===
            "string" &&
          typeof item.displayName ===
            "string"
      )
      .map(
        (
          item
        ) => ({
          userId:
            item.userId,

          login:
            item.login.toLowerCase(),

          displayName:
            item.displayName,
        })
      );
  } catch {
    return [];
  }
}

function readChatFontSize() {
  const raw =
    Number(
      localStorage.getItem(
        CHAT_FONT_SIZE_KEY
      ) ||
        "13"
    );

  if (
    !Number.isFinite(
      raw
    )
  ) {
    return 13;
  }

  return Math.max(
    10,
    Math.min(
      24,
      Math.round(
        raw
      )
    )
  );
}

function readAppearanceMode():
  AppearanceMode {
  return localStorage.getItem(
    APPEARANCE_MODE_KEY
  ) === "light"
    ? "light"
    : "dark";
}

function defaultChatBackground(
  mode: AppearanceMode
) {
  return mode === "light"
    ? "#ffffff"
    : "#101115";
}

function readChatBackground(
  mode: AppearanceMode
) {
  const value =
    localStorage.getItem(
      CHAT_BACKGROUND_KEY
    );

  return value &&
    /^#[0-9a-f]{6}$/i.test(
      value
    )
    ? value
    : defaultChatBackground(
        mode
      );
}

function readChannelCache():
  CachedChannel[] {
  try {
    const raw =
      localStorage.getItem(
        CHANNEL_CACHE_KEY
      );

    const parsed =
      raw
        ? JSON.parse(
            raw
          )
        : [];

    if (
      !Array.isArray(
        parsed
      )
    ) {
      return [];
    }

    return parsed
      .filter(
        (
          item
        ) =>
          item &&
          typeof item ===
            "object" &&
          typeof item.login ===
            "string" &&
          typeof item.displayName ===
            "string" &&
          typeof item.profileImageUrl ===
            "string"
      )
      .map(
        (
          item
        ) => ({
          login:
            item.login.toLowerCase(),

          displayName:
            item.displayName,

          profileImageUrl:
            item.profileImageUrl,
        })
      );
  } catch {
    return [];
  }
}

function isLightColor(
  hex: string
) {
  const match =
    /^#([0-9a-f]{6})$/i.exec(
      hex
    );

  if (
    !match
  ) {
    return false;
  }

  const value =
    match[1];

  const r =
    parseInt(
      value.slice(
        0,
        2
      ),
      16
    );

  const g =
    parseInt(
      value.slice(
        2,
        4
      ),
      16
    );

  const b =
    parseInt(
      value.slice(
        4,
        6
      ),
      16
    );

  return (
    r * 0.299 +
    g * 0.587 +
    b * 0.114
  ) > 186;
}

function TwitchIcon({
  size = 16,
}: {
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{
        display:
          "block",
      }}
    >
      <path
        fill="currentColor"
        d="M2.149 0 .537 4.119v16.836h5.731V24h3.224l3.045-3.045h4.656l6.27-6.269V0H2.149Zm19.165 13.612-3.582 3.582h-5.731l-3.045 3.045v-3.045H4.119V2.149h17.195v11.463ZM17.731 5.731h-2.149V12h2.149V5.731Zm-5.731 0H9.851V12H12V5.731Z"
      />
    </svg>
  );
}

function clockTime(
  timestampMs =
    Date.now()
) {
  return new Date(
    timestampMs
  ).toLocaleTimeString(
    "nb-NO",
    {
      hour:
        "2-digit",

      minute:
        "2-digit",

      hour12:
        false,
    }
  );
}

function dateOnly(
  value: string
) {
  if (
    !value
  ) {
    return "Ukjent";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Ukjent";
  }

  return date.toLocaleDateString(
    "nb-NO",
    {
      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit",
    }
  );
}

function escapeRegExp(
  value: string
) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function shortenText(
  value: string,
  maxLength = 90
) {
  const clean =
    value
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  return clean.length <=
    maxLength
    ? clean
    : clean.slice(
        0,
        maxLength - 1
      ) + "…";
}

function timeoutLabel(
  seconds: number
) {
  if (
    seconds <
    60
  ) {
    return `${seconds}s`;
  }

  if (
    seconds <
    3600
  ) {
    return `${seconds / 60}m`;
  }

  if (
    seconds <
    86400
  ) {
    return `${seconds / 3600}h`;
  }

  return `${seconds / 86400}d`;
}

function rolesFromMessage(
  message:
    TwitchChatMessage,

  broadcasterId:
    string
):
  UserRoles {
  const sets =
    new Set(
      message.badges.map(
        (
          badge
        ) =>
          badge.setId
      )
    );

  return {
    broadcaster:
      message.userId ===
        broadcasterId ||
      sets.has(
        "broadcaster"
      ),

    moderator:
      sets.has(
        "moderator"
      ),

    vip:
      sets.has(
        "vip"
      ),

    subscriber:
      sets.has(
        "subscriber"
      ) ||
      sets.has(
        "founder"
      ),
  };
}

async function friendlyTwitchError(
  response:
    Response,

  action:
    string
) {
  const raw =
    await response.text();

  let message =
    raw;

  try {
    const parsed =
      JSON.parse(
        raw
      ) as {
        message?: string;
        error?: string;
      };

    message =
      parsed.message ||
      parsed.error ||
      raw;
  } catch {
    // vanlig tekst
  }

  const lower =
    message.toLowerCase();

  if (
    response.status ===
      400 &&
    (
      lower.includes(
        "may not be banned"
      ) ||
      lower.includes(
        "may not be put in a timeout"
      )
    )
  ) {
    return (
      `Twitch tillater ikke ${action} på denne brukeren. ` +
      "Brukeren kan være broadcaster, moderator eller på annen måte beskyttet."
    );
  }

  if (
    response.status ===
    401
  ) {
    return "Twitch-tilgangen mangler en nødvendig rettighet, eller innloggingen må fornyes.";
  }

  if (
    response.status ===
    403
  ) {
    return "Twitch sier at du ikke har moderatorrettighet til denne handlingen.";
  }

  if (
    response.status ===
    409
  ) {
    return "En annen modereringshandling pågår. Prøv igjen om et øyeblikk.";
  }

  if (
    response.status ===
    429
  ) {
    return "For mange handlinger akkurat nå. Vent litt og prøv igjen.";
  }

  return (
    message ||
    `${action} feilet (HTTP ${response.status}).`
  );
}

function App() {
  const [
    twitchLogin,
    setTwitchLogin,
  ] =
    useState<
      TwitchDeviceResponse | null
    >(null);

  const [
    twitchConnected,
    setTwitchConnected,
  ] =
    useState(false);

  const [
    connectingTwitch,
    setConnectingTwitch,
  ] =
    useState(false);

  const [
    twitchUserName,
    setTwitchUserName,
  ] =
    useState("");

  const [
    twitchProfileImage,
    setTwitchProfileImage,
  ] =
    useState("");

  const [
    channelTabs,
    setChannelTabs,
  ] =
    useState<
      ChannelTab[]
    >([]);

  const [
    activeChannelId,
    setActiveChannelId,
  ] =
    useState("");

  const [
    showAddChannel,
    setShowAddChannel,
  ] =
    useState(false);

  const [
    newChannelInput,
    setNewChannelInput,
  ] =
    useState("");

  const [
    addingChannel,
    setAddingChannel,
  ] =
    useState(false);

  const [
    addChannelError,
    setAddChannelError,
  ] =
    useState("");

  const [
    chatInput,
    setChatInput,
  ] =
    useState("");

  const [
    sendingMessage,
    setSendingMessage,
  ] =
    useState(false);

  const [
    twitchError,
    setTwitchError,
  ] =
    useState("");

  const [
    socketHealthy,
    setSocketHealthy,
  ] =
    useState(false);

  const [
    reconnectingChat,
    setReconnectingChat,
  ] =
    useState(false);

  const [
    hadChatConnection,
    setHadChatConnection,
  ] =
    useState(false);

  const [
    mutedMentionChannels,
    setMutedMentionChannels,
  ] =
    useState<
      string[]
    >(
      () =>
        readStringArray(
          MUTED_MENTION_CHANNELS_KEY
        )
    );

  const [
    ignoredHighlightUsers,
    setIgnoredHighlightUsers,
  ] =
    useState<
      string[]
    >(
      () =>
        readStringArray(
          IGNORED_HIGHLIGHT_USERS_KEY
        )
    );

  const [
    userNotes,
    setUserNotes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >(
      () =>
        readStringRecord(
          USER_NOTES_KEY
        )
    );

  const [
    chatFontSize,
    setChatFontSize,
  ] =
    useState(
      readChatFontSize
    );

  const [
    appearanceMode,
    setAppearanceMode,
  ] =
    useState<
      AppearanceMode
    >(
      readAppearanceMode
    );

  const [
    chatBackground,
    setChatBackground,
  ] =
    useState(
      () =>
        readChatBackground(
          readAppearanceMode()
        )
    );

  const [
    restoringSession,
    setRestoringSession,
  ] =
    useState(
      true
    );

  const [
    hasSavedTwitchSession,
    setHasSavedTwitchSession,
  ] =
    useState(
      false
    );

  const [
    highlightUsers,
    setHighlightUsers,
  ] =
    useState<
      HighlightUser[]
    >(
      readHighlightUsers
    );

  const [
    highlightInput,
    setHighlightInput,
  ] =
    useState("");

  const [
    addingHighlight,
    setAddingHighlight,
  ] =
    useState(false);

  const [
    highlightError,
    setHighlightError,
  ] =
    useState("");

  const [
    profileMenuOpen,
    setProfileMenuOpen,
  ] =
    useState(false);

  const [
    showSettings,
    setShowSettings,
  ] =
    useState(false);

  const [
    tabContextMenu,
    setTabContextMenu,
  ] =
    useState<
      TabContextMenu
    >(null);

  const [
    replyingTo,
    setReplyingTo,
  ] =
    useState<
      ReplyTarget | null
    >(null);

  const [
    hoveredMessageId,
    setHoveredMessageId,
  ] =
    useState("");

  const [
    userCard,
    setUserCard,
  ] =
    useState<
      UserCardState | null
    >(null);

  const [
    userCardLoading,
    setUserCardLoading,
  ] =
    useState(false);

  const [
    userCardError,
    setUserCardError,
  ] =
    useState("");

  const [
    userCardActionStatus,
    setUserCardActionStatus,
  ] =
    useState("");

  const [
    userCardActionBusy,
    setUserCardActionBusy,
  ] =
    useState(false);

  const [
    modReason,
    setModReason,
  ] =
    useState("");

  const [
    showNoteEditor,
    setShowNoteEditor,
  ] =
    useState(false);

  const [
    noteDraft,
    setNoteDraft,
  ] =
    useState("");

  const twitchAccessTokenRef =
    useRef("");

  const twitchUserIdRef =
    useRef("");

  const twitchUserLoginRef =
    useRef("");

  const twitchSocket =
    useRef<
      WebSocket | null
    >(null);

  const twitchSessionId =
    useRef("");

  const socketConnectPromise =
    useRef<
      Promise<string> | null
    >(null);

  const shouldReconnect =
    useRef(false);

  const reconnectTimer =
    useRef<
      number | null
    >(null);

  const reconnectAttempt =
    useRef(0);

  const reconnectInProgress =
    useRef(false);

  const keepaliveTimer =
    useRef<
      number | null
    >(null);

  const keepaliveTimeoutMs =
    useRef(11500);

  const outageAnnounced =
    useRef(false);

  const subscribedChannelIds =
    useRef(
      new Set<
        string
      >()
    );

  const processedEventIds =
    useRef(
      new Set<
        string
      >()
    );

  const moderatedChannelIdsRef =
    useRef(
      new Set<
        string
      >()
    );

  const globalBadgeMap =
    useRef<
      Record<
        string,
        BadgeLookupItem
      >
    >({});

  const channelBadgeMaps =
    useRef<
      Record<
        string,
        Record<
          string,
          BadgeLookupItem
        >
      >
    >({});

  const channelTabsRef =
    useRef<
      ChannelTab[]
    >([]);

  const activeChannelIdRef =
    useRef("");

  const savedChannelLoginsRef =
    useRef<
      string[]
    >(
      readStringArray(
        SAVED_CHANNELS_KEY
      )
    );

  const channelCacheRef =
    useRef<
      CachedChannel[]
    >(
      readChannelCache()
    );

  const initialStartupRef =
    useRef(
      true
    );

  const mutedMentionChannelsRef =
    useRef<
      string[]
    >(
      readStringArray(
        MUTED_MENTION_CHANNELS_KEY
      )
    );

  const ignoredHighlightUsersRef =
    useRef<
      string[]
    >(
      readStringArray(
        IGNORED_HIGHLIGHT_USERS_KEY
      )
    );

  const highlightUsersRef =
    useRef<
      HighlightUser[]
    >(
      readHighlightUsers()
    );

  const chatBottomRef =
    useRef<
      HTMLDivElement | null
    >(null);

  const chatInputRef =
    useRef<
      HTMLInputElement | null
    >(null);

  const mentionAudioContextRef =
    useRef<
      AudioContext | null
    >(null);

  const userCardLoadCounter =
    useRef(0);

  const activeTab =
    channelTabs.find(
      (
        tab
      ) =>
        tab.broadcasterId ===
        activeChannelId
    ) ||
    null;

  const contextMenuTab =
    tabContextMenu
      ? channelTabs.find(
          (
            tab
          ) =>
            tab.broadcasterId ===
            tabContextMenu.broadcasterId
        ) ||
        null
      : null;

  const connectionOnline =
    twitchConnected &&
    channelTabs.length >
      0 &&
    socketHealthy &&
    !reconnectingChat;

  const showReconnectOverlay =
    twitchConnected &&
    hadChatConnection &&
    !initialStartupRef.current &&
    outageAnnounced.current &&
    reconnectingChat;

  const showChannelUi =
    channelTabs.length >
      0 &&
    (
      twitchConnected ||
      restoringSession ||
      hasSavedTwitchSession
    );

  const theme =
    appearanceMode ===
    "light"
      ? {
          appBg:
            "#eef0f3",

          topBar:
            "#ffffff",

          panel:
            "#f7f7f8",

          panelRaised:
            "#ffffff",

          tabBar:
            "#f3f4f6",

          tab:
            "#eef0f3",

          tabActive:
            "#ffffff",

          input:
            "#ffffff",

          border:
            "#d6d9df",

          borderStrong:
            "#c5c9d1",

          text:
            "#1f2328",

          muted:
            "#66707c",

          subtle:
            "#8b949e",

          hover:
            "rgba(31,35,40,.055)",

          modalBackdrop:
            "rgba(18,22,28,.28)",

          shadow:
            "0 18px 55px rgba(36,42,50,.18)",
        }
      : {
          appBg:
            "#0e0f12",

          topBar:
            "#141519",

          panel:
            "#15171b",

          panelRaised:
            "#1d1f24",

          tabBar:
            "#121317",

          tab:
            "#17191e",

          tabActive:
            "#22242b",

          input:
            "#202228",

          border:
            "#292c33",

          borderStrong:
            "#3a3d45",

          text:
            "#e8e8ea",

          muted:
            "#aeb3bb",

          subtle:
            "#777d86",

          hover:
            "#181a1f",

          modalBackdrop:
            "rgba(0,0,0,.55)",

          shadow:
            "0 22px 70px rgba(0,0,0,.72)",
        };

  const chatBackgroundIsLight =
    isLightColor(
      chatBackground
    );

  const chatTextColor =
    chatBackgroundIsLight
      ? "#1f2328"
      : "#d7d9dd";

  const chatMutedColor =
    chatBackgroundIsLight
      ? "#6e7781"
      : "#505661";

  const chatHoverBackground =
    chatBackgroundIsLight
      ? "rgba(31,35,40,.055)"
      : "#181a1f";

  const userCardMessages =
    useMemo(
      () => {
        if (
          !userCard
        ) {
          return [];
        }

        const tab =
          channelTabs.find(
            (
              item
            ) =>
              item.broadcasterId ===
              userCard.broadcasterId
          );

        if (
          !tab
        ) {
          return [];
        }

        return tab.messages
          .filter(
            (
              message
            ) => {
              if (
                message.kind !==
                "chat"
              ) {
                return false;
              }

              if (
                message.userId &&
                userCard.userId
              ) {
                return (
                  message.userId ===
                  userCard.userId
                );
              }

              return (
                (
                  message.userLogin ||
                  message.username
                ).toLowerCase() ===
                userCard.userLogin
                  .toLowerCase()
              );
            }
          )
          .sort(
            (
              a,
              b
            ) =>
              a.timestampMs -
              b.timestampMs
          );
      },
      [
        channelTabs,
        userCard,
      ]
    );

  useEffect(
    () => {
      chatBottomRef.current
        ?.scrollIntoView({
          block:
            "end",
        });
    },
    [
      activeChannelId,
      activeTab
        ?.messages
        .length,
    ]
  );

  useEffect(
    () => {
      setReplyingTo(
        null
      );
    },
    [
      activeChannelId,
    ]
  );

  useEffect(
    () => {
      const unlock =
        () =>
          primeMentionSound();

      window.addEventListener(
        "pointerdown",
        unlock
      );

      window.addEventListener(
        "keydown",
        unlock
      );

      return () => {
        window.removeEventListener(
          "pointerdown",
          unlock
        );

        window.removeEventListener(
          "keydown",
          unlock
        );
      };
    },
    []
  );

  useEffect(
    () => {
      const closeMenus =
        () => {
          setTabContextMenu(
            null
          );

          setProfileMenuOpen(
            false
          );
        };

      const key =
        (
          event:
            KeyboardEvent
        ) => {
          if (
            event.key ===
            "Escape"
          ) {
            setTabContextMenu(
              null
            );

            setProfileMenuOpen(
              false
            );

            setReplyingTo(
              null
            );

            if (
              showSettings
            ) {
              setShowSettings(
                false
              );
            } else {
              setUserCard(
                null
              );
            }
          }
        };

      window.addEventListener(
        "pointerdown",
        closeMenus
      );

      window.addEventListener(
        "keydown",
        key
      );

      return () => {
        window.removeEventListener(
          "pointerdown",
          closeMenus
        );

        window.removeEventListener(
          "keydown",
          key
        );
      };
    },
    [
      showSettings,
    ]
  );

  useEffect(
    () => {
      const timer =
        window.setTimeout(
          () => {
            void invoke(
              "cleanup_chat_history"
            ).catch(
              console.error
            );

            preloadSavedChannelTabs();

            void restoreTwitchLogin();
          },
          250
        );

      return () =>
        window.clearTimeout(
          timer
        );
    },
    []
  );

  useEffect(
    () => {
      const timer =
        window.setInterval(
          () => {
            const cutoff =
              Date.now() -
              CHAT_HISTORY_MAX_AGE_MS;

            updateTabs(
              (
                tabs
              ) =>
                tabs.map(
                  (
                    tab
                  ) => ({
                    ...tab,

                    messages:
                      tab.messages.filter(
                        (
                          message
                        ) =>
                          message.timestampMs >=
                          cutoff
                      ),
                  })
                )
            );
          },
          30000
        );

      return () =>
        window.clearInterval(
          timer
        );
    },
    []
  );

  useEffect(
    () => {
      const timer =
        window.setInterval(
          () => {
            void invoke(
              "cleanup_chat_history"
            ).catch(
              console.error
            );
          },
          10 *
            60 *
            1000
        );

      return () =>
        window.clearInterval(
          timer
        );
    },
    []
  );

  useEffect(
    () => {
      if (
        !twitchConnected
      ) {
        return;
      }

      void refreshLiveStatuses();

      const timer =
        window.setInterval(
          () => {
            void refreshLiveStatuses();
          },
          30000
        );

      return () =>
        window.clearInterval(
          timer
        );
    },
    [
      twitchConnected,
    ]
  );

  useEffect(
    () => {
      const offline =
        () => {
          if (
            shouldReconnect.current &&
            channelTabsRef.current
              .length >
              0
          ) {
            beginConnectionLoss();
          }
        };

      const online =
        () => {
          if (
            !twitchAccessTokenRef.current &&
            savedChannelLoginsRef.current
              .length >
              0
          ) {
            void restoreTwitchLogin();

            return;
          }

          if (
            !shouldReconnect.current ||
            channelTabsRef.current
              .length ===
              0
          ) {
            return;
          }

          clearReconnectTimer();

          void reconnectAllChannels();
        };

      window.addEventListener(
        "offline",
        offline
      );

      window.addEventListener(
        "online",
        online
      );

      return () => {
        window.removeEventListener(
          "offline",
          offline
        );

        window.removeEventListener(
          "online",
          online
        );
      };
    },
    []
  );

  useEffect(
    () => {
      return () => {
        shouldReconnect.current =
          false;

        clearKeepaliveTimer();

        clearReconnectTimer();

        twitchSocket.current
          ?.close();

        if (
          mentionAudioContextRef.current
        ) {
          void mentionAudioContextRef.current
            .close();
        }
      };
    },
    []
  );

  function updateTabs(
    updater:
      (
        tabs:
          ChannelTab[]
      ) =>
        ChannelTab[]
  ) {
    const next =
      updater(
        channelTabsRef.current
      );

    channelTabsRef.current =
      next;

    setChannelTabs(
      next
    );
  }

  function replaceTabs(
    tabs:
      ChannelTab[]
  ) {
    channelTabsRef.current =
      tabs;

    setChannelTabs(
      tabs
    );
  }

  function sanitizeChannelName(
    input: string
  ) {
    let value =
      input
        .trim()
        .replace(
          /^https?:\/\/(www\.)?twitch\.tv\//i,
          ""
        );

    value =
      value
        .split(
          "/"
        )[0]
        .split(
          "?"
        )[0]
        .replace(
          /^[@#]/,
          ""
        );

    return value
      .toLowerCase()
      .trim();
  }

  function saveChannelCache(
    channels:
      CachedChannel[]
  ) {
    const deduped =
      Array.from(
        new Map(
          channels.map(
            (
              channel
            ) => [
              channel.login.toLowerCase(),

              {
                ...channel,

                login:
                  channel.login.toLowerCase(),
              },
            ]
          )
        ).values()
      );

    channelCacheRef.current =
      deduped;

    localStorage.setItem(
      CHANNEL_CACHE_KEY,
      JSON.stringify(
        deduped
      )
    );
  }

  function cacheChannel(
    user: TwitchUser
  ) {
    saveChannelCache([
      ...channelCacheRef.current.filter(
        (
          channel
        ) =>
          channel.login !==
          user.login.toLowerCase()
      ),

      {
        login:
          user.login.toLowerCase(),

        displayName:
          user.display_name,

        profileImageUrl:
          user.profile_image_url,
      },
    ]);
  }

  function preloadSavedChannelTabs() {
    const savedLogins =
      savedChannelLoginsRef.current;

    if (
      savedLogins.length ===
      0
    ) {
      return;
    }

    const cachedByLogin =
      new Map<
        string,
        CachedChannel
      >(
        channelCacheRef.current.map(
          (
            channel
          ) => [
            channel.login,
            channel,
          ]
        )
      );

    const cachedTabs:
      ChannelTab[] =
      savedLogins.map(
        (
          login
        ) => {
          const cached =
            cachedByLogin.get(
              login
            );

          return {
            broadcasterId:
              `cached:${login}`,

            login,

            displayName:
              cached?.displayName ||
              login,

            profileImageUrl:
              cached?.profileImageUrl ||
              "",

            isLive:
              false,

            canModerate:
              false,

            status:
              "disconnected",

            error:
              "",

            messages:
              [],

            hasMention:
              false,
          };
        }
      );

    replaceTabs(
      cachedTabs
    );

    const preferred =
      localStorage.getItem(
        ACTIVE_CHANNEL_KEY
      );

    const active =
      cachedTabs.find(
        (
          tab
        ) =>
          tab.login ===
          preferred
      ) ||
      cachedTabs[0];

    if (
      active
    ) {
      activeChannelIdRef.current =
        active.broadcasterId;

      setActiveChannelId(
        active.broadcasterId
      );
    }

    for (
      const tab
      of cachedTabs
    ) {
      void loadStoredChannelHistory(
        tab.login
      ).then(
        (
          messages
        ) => {
          updateTabs(
            (
              tabs
            ) =>
              tabs.map(
                (
                  item
                ) =>
                  item.login ===
                  tab.login
                    ? {
                        ...item,

                        messages:
                          [
                            ...messages,

                            ...item.messages.filter(
                              (
                                current
                              ) =>
                                !messages.some(
                                  (
                                    stored
                                  ) =>
                                    stored.id ===
                                    current.id
                                )
                            ),
                          ].sort(
                            (
                              a,
                              b
                            ) =>
                              a.timestampMs -
                              b.timestampMs
                          ),
                      }
                    : item
              )
          );
        }
      );
    }
  }

  function setAndSaveAppearanceMode(
    mode: AppearanceMode
  ) {
    const previousDefault =
      defaultChatBackground(
        appearanceMode
      );

    setAppearanceMode(
      mode
    );

    localStorage.setItem(
      APPEARANCE_MODE_KEY,
      mode
    );

    if (
      !localStorage.getItem(
        CHAT_BACKGROUND_KEY
      ) ||
      chatBackground.toLowerCase() ===
        previousDefault.toLowerCase()
    ) {
      const nextBackground =
        defaultChatBackground(
          mode
        );

      setChatBackground(
        nextBackground
      );

      localStorage.setItem(
        CHAT_BACKGROUND_KEY,
        nextBackground
      );
    }
  }

  function setAndSaveChatBackground(
    color: string
  ) {
    if (
      !/^#[0-9a-f]{6}$/i.test(
        color
      )
    ) {
      return;
    }

    setChatBackground(
      color
    );

    localStorage.setItem(
      CHAT_BACKGROUND_KEY,
      color
    );
  }

  function saveChannelLogins(
    logins:
      string[]
  ) {
    const cleaned =
      Array.from(
        new Set(
          logins
            .map(
              sanitizeChannelName
            )
            .filter(
              Boolean
            )
        )
      );

    savedChannelLoginsRef.current =
      cleaned;

    localStorage.setItem(
      SAVED_CHANNELS_KEY,
      JSON.stringify(
        cleaned
      )
    );
  }

  function rememberChannel(
    login: string
  ) {
    const clean =
      sanitizeChannelName(
        login
      );

    if (
      !clean ||
      savedChannelLoginsRef.current
        .includes(
          clean
        )
    ) {
      return;
    }

    saveChannelLogins([
      ...savedChannelLoginsRef.current,
      clean,
    ]);
  }

  function forgetChannel(
    login: string
  ) {
    const clean =
      sanitizeChannelName(
        login
      );

    saveChannelLogins(
      savedChannelLoginsRef.current
        .filter(
          (
            item
          ) =>
            item !==
            clean
        )
    );

    saveChannelCache(
      channelCacheRef.current
        .filter(
          (
            item
          ) =>
            item.login !==
            clean
        )
    );
  }

  function saveActiveChannel(
    login: string
  ) {
    if (
      !login
    ) {
      localStorage.removeItem(
        ACTIVE_CHANNEL_KEY
      );
    } else {
      localStorage.setItem(
        ACTIVE_CHANNEL_KEY,
        login
      );
    }
  }

  function saveMutedMentionChannels(
    channels:
      string[]
  ) {
    const cleaned =
      Array.from(
        new Set(
          channels.map(
            (
              channel
            ) =>
              channel.toLowerCase()
          )
        )
      );

    mutedMentionChannelsRef.current =
      cleaned;

    setMutedMentionChannels(
      cleaned
    );

    localStorage.setItem(
      MUTED_MENTION_CHANNELS_KEY,
      JSON.stringify(
        cleaned
      )
    );
  }

  function isMentionSoundMuted(
    login: string
  ) {
    return (
      mutedMentionChannelsRef.current
        .includes(
          login.toLowerCase()
        )
    );
  }

  function toggleMentionSound(
    login: string
  ) {
    const clean =
      login.toLowerCase();

    saveMutedMentionChannels(
      isMentionSoundMuted(
        clean
      )
        ? mutedMentionChannelsRef.current
            .filter(
              (
                channel
              ) =>
                channel !==
                clean
            )
        : [
            ...mutedMentionChannelsRef.current,
            clean,
          ]
    );
  }

  function saveIgnoredHighlightUsers(
    users:
      string[]
  ) {
    const cleaned =
      Array.from(
        new Set(
          users.filter(
            Boolean
          )
        )
      );

    ignoredHighlightUsersRef.current =
      cleaned;

    setIgnoredHighlightUsers(
      cleaned
    );

    localStorage.setItem(
      IGNORED_HIGHLIGHT_USERS_KEY,
      JSON.stringify(
        cleaned
      )
    );
  }

  function isUserIgnoredForHighlights(
    userId: string
  ) {
    return Boolean(
      userId &&
      ignoredHighlightUsersRef.current
        .includes(
          userId
        )
    );
  }

  function toggleIgnoreHighlights(
    userId: string
  ) {
    if (
      !userId
    ) {
      return;
    }

    saveIgnoredHighlightUsers(
      isUserIgnoredForHighlights(
        userId
      )
        ? ignoredHighlightUsersRef.current
            .filter(
              (
                id
              ) =>
                id !==
                userId
            )
        : [
            ...ignoredHighlightUsersRef.current,
            userId,
          ]
    );
  }

  function saveHighlightUsers(
    users:
      HighlightUser[]
  ) {
    const deduped =
      Array.from(
        new Map(
          users.map(
            (
              user
            ) => [
              user.userId ||
                user.login,

              {
                ...user,

                login:
                  user.login.toLowerCase(),
              },
            ]
          )
        ).values()
      );

    highlightUsersRef.current =
      deduped;

    setHighlightUsers(
      deduped
    );

    localStorage.setItem(
      HIGHLIGHT_USERS_KEY,
      JSON.stringify(
        deduped
      )
    );
  }

  function isHighlightedUser(
    userId: string,
    login: string
  ) {
    const cleanLogin =
      login.toLowerCase();

    return highlightUsersRef.current
      .some(
        (
          user
        ) =>
          (
            userId &&
            user.userId ===
              userId
          ) ||
          user.login ===
            cleanLogin
      );
  }

  function toggleUserHighlight(
    userId: string,
    login: string,
    displayName: string
  ) {
    const cleanLogin =
      login.toLowerCase();

    if (
      isHighlightedUser(
        userId,
        cleanLogin
      )
    ) {
      saveHighlightUsers(
        highlightUsersRef.current
          .filter(
            (
              user
            ) =>
              !(
                (
                  userId &&
                  user.userId ===
                    userId
                ) ||
                user.login ===
                  cleanLogin
              )
          )
      );

      return;
    }

    saveHighlightUsers([
      ...highlightUsersRef.current,

      {
        userId,

        login:
          cleanLogin,

        displayName,
      },
    ]);
  }

  async function addHighlightUserFromSettings() {
    const login =
      sanitizeChannelName(
        highlightInput
      );

    if (
      !login
    ) {
      setHighlightError(
        "Skriv inn et Twitch-navn."
      );

      return;
    }

    setAddingHighlight(
      true
    );

    setHighlightError(
      ""
    );

    try {
      const user =
        await getTwitchUserByLogin(
          login
        );

      if (
        isHighlightedUser(
          user.id,
          user.login
        )
      ) {
        setHighlightError(
          `${user.display_name} er allerede på highlight-lista.`
        );

        return;
      }

      saveHighlightUsers([
        ...highlightUsersRef.current,

        {
          userId:
            user.id,

          login:
            user.login.toLowerCase(),

          displayName:
            user.display_name,
        },
      ]);

      setHighlightInput(
        ""
      );
    } catch (
      error
    ) {
      setHighlightError(
        error instanceof
        Error
          ? error.message
          : "Kunne ikke finne brukeren."
      );
    } finally {
      setAddingHighlight(
        false
      );
    }
  }

  function setAndSaveFontSize(
    size: number
  ) {
    const clean =
      Math.max(
        10,
        Math.min(
          24,
          Math.round(
            size
          )
        )
      );

    setChatFontSize(
      clean
    );

    localStorage.setItem(
      CHAT_FONT_SIZE_KEY,
      String(
        clean
      )
    );
  }

  function saveUserNote(
    userId: string,
    note: string
  ) {
    if (
      !userId
    ) {
      return;
    }

    const next = {
      ...userNotes,
    };

    const clean =
      note.trim();

    if (
      clean
    ) {
      next[
        userId
      ] =
        clean;
    } else {
      delete next[
        userId
      ];
    }

    setUserNotes(
      next
    );

    localStorage.setItem(
      USER_NOTES_KEY,
      JSON.stringify(
        next
      )
    );

    setNoteDraft(
      clean
    );

    setShowNoteEditor(
      false
    );

    setUserCardActionStatus(
      clean
        ? "Notat lagret lokalt."
        : "Notat fjernet."
    );
  }

  function activateChannel(
    broadcasterId:
      string
  ) {
    const tab =
      channelTabsRef.current
        .find(
          (
            item
          ) =>
            item.broadcasterId ===
            broadcasterId
        );

    activeChannelIdRef.current =
      broadcasterId;

    setActiveChannelId(
      broadcasterId
    );

    updateTabs(
      (
        tabs
      ) =>
        tabs.map(
          (
            item
          ) =>
            item.broadcasterId ===
            broadcasterId
              ? {
                  ...item,

                  hasMention:
                    false,
                }
              : item
        )
    );

    if (
      tab
    ) {
      saveActiveChannel(
        tab.login
      );
    }
  }

  async function loadModeratedChannels(
    accessToken:
      string,

    userId:
      string
  ) {
    const ids =
      new Set<
        string
      >([
        userId,
      ]);

    try {
      let after =
        "";

      do {
        const params =
          new URLSearchParams({
            user_id:
              userId,

            first:
              "100",
          });

        if (
          after
        ) {
          params.set(
            "after",
            after
          );
        }

        const response =
          await fetch(
            `https://api.twitch.tv/helix/moderation/channels?${params}`,
            {
              headers: {
                Authorization:
                  `Bearer ${accessToken}`,

                "Client-Id":
                  TWITCH_CLIENT_ID,
              },
            }
          );

        if (
          !response.ok
        ) {
          throw new Error(
            await response.text()
          );
        }

        const data =
          (
            await response.json()
          ) as TwitchModeratedChannelsResponse;

        for (
          const channel
          of data.data
        ) {
          ids.add(
            channel.broadcaster_id
          );
        }

        after =
          data.pagination
            ?.cursor ||
          "";
      } while (
        after
      );
    } catch (
      error
    ) {
      console.error(
        "Kunne ikke hente moderator-kanaler:",
        error
      );
    }

    moderatedChannelIdsRef.current =
      ids;

    updateTabs(
      (
        tabs
      ) =>
        tabs.map(
          (
            tab
          ) => ({
            ...tab,

            canModerate:
              ids.has(
                tab.broadcasterId
              ),
          })
        )
    );
  }

  function startReply(
    message:
      TwitchChatMessage
  ) {
    if (
      message.kind !==
      "chat"
    ) {
      return;
    }

    setReplyingTo({
      messageId:
        message.id,

      username:
        message.username,

      text:
        message.text,
    });

    window.requestAnimationFrame(
      () =>
        chatInputRef.current
          ?.focus()
    );
  }

  function openTabContextMenu(
    event:
      MouseEvent<
        HTMLDivElement
      >,

    broadcasterId:
      string
  ) {
    event.preventDefault();

    event.stopPropagation();

    const width =
      235;

    const height =
      205;

    setTabContextMenu({
      x:
        Math.max(
          8,
          Math.min(
            event.clientX,
            window.innerWidth -
              width -
              8
          )
        ),

      y:
        Math.max(
          8,
          Math.min(
            event.clientY,
            window.innerHeight -
              height -
              8
          )
        ),

      broadcasterId,
    });
  }

  async function openOnTwitch(
    login: string
  ) {
    try {
      await openUrl(
        `https://www.twitch.tv/${encodeURIComponent(
          login
        )}`
      );
    } catch (
      error
    ) {
      console.error(
        "Kunne ikke åpne Twitch:",
        error
      );
    }
  }

  async function clearChannelHistory(
    tab:
      ChannelTab
  ) {
    setTabContextMenu(
      null
    );

    if (
      !window.confirm(
        `Vil du tømme den lokale 24-timers chatloggen for ${tab.displayName}?`
      )
    ) {
      return;
    }

    try {
      await invoke(
        "clear_channel_chat_history",
        {
          platform:
            "twitch",

          channel:
            tab.login,
        }
      );

      updateTabs(
        (
          tabs
        ) =>
          tabs.map(
            (
              item
            ) =>
              item.broadcasterId ===
              tab.broadcasterId
                ? {
                    ...item,

                    messages:
                      item.messages.filter(
                        (
                          message
                        ) =>
                          message.kind ===
                          "system"
                      ),
                  }
                : item
          )
      );
    } catch {
      setTwitchError(
        "Kunne ikke tømme chatloggen."
      );
    }
  }

  function getMentionAudioContext() {
    try {
      if (
        !mentionAudioContextRef.current
      ) {
        mentionAudioContextRef.current =
          new AudioContext();
      }

      return mentionAudioContextRef.current;
    } catch {
      return null;
    }
  }

  function primeMentionSound() {
    const context =
      getMentionAudioContext();

    if (
      context
        ?.state ===
      "suspended"
    ) {
      void context
        .resume()
        .catch(
          () =>
            undefined
        );
    }
  }

  function playMentionSound() {
    const context =
      getMentionAudioContext();

    if (
      !context
    ) {
      return;
    }

    const play =
      () => {
        const now =
          context.currentTime;

        for (
          const note
          of [
            {
              frequency:
                880,

              delay:
                0,
            },

            {
              frequency:
                1175,

              delay:
                0.12,
            },
          ]
        ) {
          const oscillator =
            context.createOscillator();

          const gain =
            context.createGain();

          const start =
            now +
            note.delay;

          oscillator.type =
            "sine";

          oscillator.frequency
            .setValueAtTime(
              note.frequency,
              start
            );

          gain.gain
            .setValueAtTime(
              0.0001,
              start
            );

          gain.gain
            .exponentialRampToValueAtTime(
              0.16,
              start +
                0.012
            );

          gain.gain
            .exponentialRampToValueAtTime(
              0.0001,
              start +
                0.18
            );

          oscillator.connect(
            gain
          );

          gain.connect(
            context.destination
          );

          oscillator.start(
            start
          );

          oscillator.stop(
            start +
              0.2
          );
        }
      };

    if (
      context.state ===
      "suspended"
    ) {
      void context
        .resume()
        .then(
          play
        )
        .catch(
          () =>
            undefined
        );
    } else {
      play();
    }
  }

  function messageMentionsMe(
    event: any,

    fragments:
      TwitchMessageFragment[]
  ) {
    const myUserId =
      twitchUserIdRef.current;

    const myLogin =
      twitchUserLoginRef.current
        .toLowerCase();

    if (
      myUserId &&
      fragments.some(
        (
          fragment
        ) =>
          fragment.type ===
            "mention" &&
          fragment.mention
            ?.user_id ===
            myUserId
      )
    ) {
      return true;
    }

    if (
      myLogin &&
      fragments.some(
        (
          fragment
        ) =>
          fragment.type ===
            "mention" &&
          fragment.mention
            ?.user_login
            ?.toLowerCase() ===
            myLogin
      )
    ) {
      return true;
    }

    if (
      !myLogin
    ) {
      return false;
    }

    const text =
      String(
        event
          ?.message
          ?.text ||
          ""
      );

    return new RegExp(
      `(^|\\s)@${escapeRegExp(
        myLogin
      )}(?=\\s|$|[.,!?;:])`,
      "i"
    ).test(
      text
    );
  }

  function storedMessageMentionsMe(
    message:
      TwitchChatMessage
  ) {
    if (
      message.userId &&
      isUserIgnoredForHighlights(
        message.userId
      )
    ) {
      return false;
    }

    const myUserId =
      twitchUserIdRef.current;

    const myLogin =
      twitchUserLoginRef.current
        .toLowerCase();

    if (
      message.fragments.some(
        (
          fragment
        ) =>
          fragment.type ===
            "mention" &&
          (
            (
              myUserId &&
              fragment.mention
                ?.user_id ===
                myUserId
            ) ||
            (
              myLogin &&
              fragment.mention
                ?.user_login
                ?.toLowerCase() ===
                myLogin
            )
          )
      )
    ) {
      return true;
    }

    if (
      !myLogin
    ) {
      return false;
    }

    return new RegExp(
      `(^|\\s)@${escapeRegExp(
        myLogin
      )}(?=\\s|$|[.,!?;:])`,
      "i"
    ).test(
      message.text
    );
  }

  function storedMessageIsCustomHighlighted(
    message:
      TwitchChatMessage
  ) {
    if (
      message.userId &&
      isUserIgnoredForHighlights(
        message.userId
      )
    ) {
      return false;
    }

    return isHighlightedUser(
      message.userId,
      message.userLogin ||
        message.username
    );
  }

  async function loadStoredChannelHistory(
    channelLogin:
      string
  ) {
    try {
      const rawMessages =
        await invoke<
          string[]
        >(
          "load_chat_history",
          {
            platform:
              "twitch",

            channel:
              channelLogin,
          }
        );

      const cutoff =
        Date.now() -
        CHAT_HISTORY_MAX_AGE_MS;

      const parsed:
        TwitchChatMessage[] =
        [];

      const seen =
        new Set<
          string
        >();

      for (
        const raw
        of rawMessages
      ) {
        try {
          const message =
            JSON.parse(
              raw
            ) as TwitchChatMessage;

          if (
            !message ||
            typeof message.id !==
              "string" ||
            message.kind !==
              "chat" ||
            typeof message.timestampMs !==
              "number" ||
            message.timestampMs <
              cutoff ||
            seen.has(
              message.id
            )
          ) {
            continue;
          }

          seen.add(
            message.id
          );

          parsed.push({
            ...message,

            time:
              clockTime(
                message.timestampMs
              ),

            userId:
              message.userId ||
              "",

            userLogin:
              message.userLogin ||
              message.username
                ?.toLowerCase() ||
              "",

            badges:
              Array.isArray(
                message.badges
              )
                ? message.badges
                : [],

            fragments:
              Array.isArray(
                message.fragments
              )
                ? message.fragments
                : [],

            reply:
              message.reply ||
              null,
          });
        } catch {
          // ødelagt logglinje
        }
      }

      return parsed.sort(
        (
          a,
          b
        ) =>
          a.timestampMs -
          b.timestampMs
      );
    } catch (
      error
    ) {
      console.error(
        `Kunne ikke laste chat for ${channelLogin}:`,
        error
      );

      return [];
    }
  }

  function saveMessageToDisk(
    channelLogin:
      string,

    message:
      TwitchChatMessage
  ) {
    if (
      message.kind !==
      "chat"
    ) {
      return;
    }

    void invoke(
      "save_chat_message",
      {
        platform:
          "twitch",

        channel:
          channelLogin,

        timestampMs:
          message.timestampMs,

        payloadJson:
          JSON.stringify(
            message
          ),
      }
    ).catch(
      console.error
    );
  }

  async function refreshLiveStatuses() {
    const accessToken =
      twitchAccessTokenRef.current;

    const tabs =
      channelTabsRef.current;

    if (
      !accessToken ||
      tabs.length ===
        0
    ) {
      return;
    }

    try {
      const liveIds =
        new Set<
          string
        >();

      const ids =
        tabs.map(
          (
            tab
          ) =>
            tab.broadcasterId
        );

      for (
        let i =
          0;
        i <
        ids.length;
        i +=
          100
      ) {
        const query =
          ids
            .slice(
              i,
              i +
                100
            )
            .map(
              (
                id
              ) =>
                `user_id=${encodeURIComponent(
                  id
                )}`
            )
            .join(
              "&"
            );

        const response =
          await fetch(
            `https://api.twitch.tv/helix/streams?${query}`,
            {
              headers: {
                Authorization:
                  `Bearer ${accessToken}`,

                "Client-Id":
                  TWITCH_CLIENT_ID,
              },
            }
          );

        if (
          !response.ok
        ) {
          throw new Error(
            await response.text()
          );
        }

        const data =
          (
            await response.json()
          ) as TwitchStreamsResponse;

        for (
          const stream
          of data.data
        ) {
          liveIds.add(
            stream.user_id
          );
        }
      }

      updateTabs(
        (
          tabsNow
        ) =>
          tabsNow.map(
            (
              tab
            ) => ({
              ...tab,

              isLive:
                liveIds.has(
                  tab.broadcasterId
                ),
            })
          )
      );
    } catch (
      error
    ) {
      console.error(
        "Kunne ikke oppdatere LIVE-status:",
        error
      );
    }
  }

  function addSystemLine(
    text: string,

    broadcasterId?:
      string
  ) {
    const timestampMs =
      Date.now();

    const line:
      TwitchChatMessage = {
        id:
          `system-${timestampMs}-${Math.random()}`,

        kind:
          "system",

        timestampMs,

        time:
          clockTime(
            timestampMs
          ),

        userId:
          "",

        userLogin:
          "",

        username:
          "",

        text,

        color:
          "#8b949e",

        badges:
          [],

        fragments:
          [],

        reply:
          null,
      };

    updateTabs(
      (
        tabs
      ) =>
        tabs.map(
          (
            tab
          ) =>
            broadcasterId &&
            tab.broadcasterId !==
              broadcasterId
              ? tab
              : {
                  ...tab,

                  messages: [
                    ...tab.messages,
                    line,
                  ],
                }
        )
    );
  }

  function announceConnectionLost() {
    if (
      outageAnnounced.current
    ) {
      return;
    }

    outageAnnounced.current =
      true;

    addSystemLine(
      "disconnected"
    );

    addSystemLine(
      "Server connection timed out, reconnecting"
    );
  }

  function announceConnectionRestored() {
    if (
      !outageAnnounced.current
    ) {
      return;
    }

    addSystemLine(
      "connected"
    );

    outageAnnounced.current =
      false;
  }

  function getTwitchEmoteUrl(
    emote:
      TwitchEmoteInfo
  ) {
    const format =
      emote.format
        ?.includes(
          "animated"
        )
        ? "animated"
        : "static";

    return (
      "https://static-cdn.jtvnw.net/emoticons/v2/" +
      `${emote.id}/${format}/dark/2.0`
    );
  }

  function badgeSetsToMap(
    sets:
      TwitchBadgeSet[]
  ) {
    const map:
      Record<
        string,
        BadgeLookupItem
      > = {};

    for (
      const set
      of sets
    ) {
      for (
        const version
        of set.versions
      ) {
        map[
          `${set.set_id}:${version.id}`
        ] = {
          imageUrl:
            version.image_url_2x,

          title:
            version.title,
        };
      }
    }

    return map;
  }

  function resolveBadges(
    broadcasterId:
      string,

    badges?:
      TwitchBadgeFromMessage[]
  ):
    ResolvedBadge[] {
    if (
      !badges
    ) {
      return [];
    }

    const map =
      channelBadgeMaps.current[
        broadcasterId
      ] ||
      globalBadgeMap.current;

    return badges.map(
      (
        badge
      ) => {
        const info =
          map[
            `${badge.set_id}:${badge.id}`
          ];

        return {
          setId:
            badge.set_id,

          id:
            badge.id,

          info:
            badge.info,

          imageUrl:
            info
              ?.imageUrl ||
            "",

          title:
            info
              ?.title ||
            badge.set_id,
        };
      }
    );
  }

  async function getLoggedInTwitchUser(
    accessToken:
      string
  ):
    Promise<
      TwitchUser
    > {
    const response =
      await fetch(
        "https://api.twitch.tv/helix/users",
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            "Client-Id":
              TWITCH_CLIENT_ID,
          },
        }
      );

    if (
      !response.ok
    ) {
      throw new Error(
        await response.text()
      );
    }

    const data =
      (
        await response.json()
      ) as TwitchUsersResponse;

    if (
      !data.data
        ?.length
    ) {
      throw new Error(
        "Twitch returnerte ingen bruker."
      );
    }

    return data.data[
      0
    ];
  }

  async function getTwitchUserByLogin(
    login:
      string
  ):
    Promise<
      TwitchUser
    > {
    const response =
      await fetch(
        "https://api.twitch.tv/helix/users?login=" +
          encodeURIComponent(
            login
          ),
        {
          headers: {
            Authorization:
              `Bearer ${twitchAccessTokenRef.current}`,

            "Client-Id":
              TWITCH_CLIENT_ID,
          },
        }
      );

    if (
      !response.ok
    ) {
      throw new Error(
        "Kunne ikke finne Twitch-brukeren."
      );
    }

    const data =
      (
        await response.json()
      ) as TwitchUsersResponse;

    if (
      !data.data
        ?.length
    ) {
      throw new Error(
        `Fant ingen Twitch-bruker som heter "${login}".`
      );
    }

    return data.data[
      0
    ];
  }

  async function getTwitchUserById(
    userId:
      string
  ):
    Promise<
      TwitchUser
    > {
    const response =
      await fetch(
        "https://api.twitch.tv/helix/users?id=" +
          encodeURIComponent(
            userId
          ),
        {
          headers: {
            Authorization:
              `Bearer ${twitchAccessTokenRef.current}`,

            "Client-Id":
              TWITCH_CLIENT_ID,
          },
        }
      );

    if (
      !response.ok
    ) {
      throw new Error(
        "Kunne ikke hente Twitch-brukeren."
      );
    }

    const data =
      (
        await response.json()
      ) as TwitchUsersResponse;

    if (
      !data.data
        ?.length
    ) {
      throw new Error(
        "Fant ikke Twitch-brukeren."
      );
    }

    return data.data[
      0
    ];
  }

  async function loadGlobalBadges(
    accessToken:
      string
  ) {
    const response =
      await fetch(
        "https://api.twitch.tv/helix/chat/badges/global",
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            "Client-Id":
              TWITCH_CLIENT_ID,
          },
        }
      );

    if (
      !response.ok
    ) {
      throw new Error(
        "Kunne ikke hente globale Twitch-badges."
      );
    }

    const data =
      (
        await response.json()
      ) as TwitchBadgeApiResponse;

    globalBadgeMap.current =
      badgeSetsToMap(
        data.data
      );
  }

  async function loadChannelBadges(
    broadcasterId:
      string
  ) {
    const response =
      await fetch(
        "https://api.twitch.tv/helix/chat/badges?broadcaster_id=" +
          encodeURIComponent(
            broadcasterId
          ),
        {
          headers: {
            Authorization:
              `Bearer ${twitchAccessTokenRef.current}`,

            "Client-Id":
              TWITCH_CLIENT_ID,
          },
        }
      );

    if (
      !response.ok
    ) {
      throw new Error(
        "Kunne ikke hente kanalens badges."
      );
    }

    const data =
      (
        await response.json()
      ) as TwitchBadgeApiResponse;

    channelBadgeMaps.current[
      broadcasterId
    ] = {
      ...globalBadgeMap.current,

      ...badgeSetsToMap(
        data.data
      ),
    };
  }

  async function saveTwitchRefreshToken(
    refreshToken:
      string
  ) {
    await invoke(
      "save_twitch_refresh_token",
      {
        refreshToken,
      }
    );
  }

  async function deleteSavedTwitchLogin() {
    await invoke(
      "delete_twitch_refresh_token"
    );
  }

  function clearKeepaliveTimer() {
    if (
      keepaliveTimer.current !==
      null
    ) {
      window.clearTimeout(
        keepaliveTimer.current
      );
    }

    keepaliveTimer.current =
      null;
  }

  function clearReconnectTimer() {
    if (
      reconnectTimer.current !==
      null
    ) {
      window.clearTimeout(
        reconnectTimer.current
      );
    }

    reconnectTimer.current =
      null;
  }

  function armKeepaliveWatchdog(
    socket:
      WebSocket,

    timeoutSeconds?:
      number
  ) {
    if (
      typeof timeoutSeconds ===
        "number" &&
      Number.isFinite(
        timeoutSeconds
      ) &&
      timeoutSeconds >
        0
    ) {
      keepaliveTimeoutMs.current =
        timeoutSeconds *
          1000 +
        1500;
    }

    clearKeepaliveTimer();

    keepaliveTimer.current =
      window.setTimeout(
        () => {
          keepaliveTimer.current =
            null;

          if (
            shouldReconnect.current &&
            twitchSocket.current ===
              socket &&
            channelTabsRef.current
              .length >
              0
          ) {
            beginConnectionLoss(
              socket
            );
          }
        },
        keepaliveTimeoutMs.current
      );
  }

  function markSocketDisconnected() {
    updateTabs(
      (
        tabs
      ) =>
        tabs.map(
          (
            tab
          ) =>
            tab.status ===
              "live" ||
            tab.status ===
              "joining"
              ? {
                  ...tab,

                  status:
                    "disconnected",

                  error:
                    "",
                }
              : tab
        )
    );
  }

  function markChannelsJoining() {
    updateTabs(
      (
        tabs
      ) =>
        tabs.map(
          (
            tab
          ) => ({
            ...tab,

            status:
              "joining",

            error:
              "",
          })
        )
    );
  }

  function beginConnectionLoss(
    socket?:
      WebSocket
  ) {
    if (
      !shouldReconnect.current ||
      channelTabsRef.current
        .length ===
        0
    ) {
      return;
    }

    setSocketHealthy(
      false
    );

    setReconnectingChat(
      true
    );

    markSocketDisconnected();

    if (
      !initialStartupRef.current
    ) {
      announceConnectionLost();
    }

    clearKeepaliveTimer();

    subscribedChannelIds.current
      .clear();

    twitchSessionId.current =
      "";

    socketConnectPromise.current =
      null;

    const target =
      socket ||
      twitchSocket.current;

    if (
      !socket ||
      twitchSocket.current ===
        socket
    ) {
      twitchSocket.current =
        null;
    }

    try {
      target
        ?.close();
    } catch {
      // ignore
    }

    scheduleSocketReconnect();
  }

  function scheduleSocketReconnect() {
    if (
      !shouldReconnect.current ||
      reconnectTimer.current !==
        null ||
      channelTabsRef.current
        .length ===
        0
    ) {
      return;
    }

    const delay =
      Math.min(
        1000 *
          Math.pow(
            2,
            reconnectAttempt.current
          ),
        30000
      );

    reconnectAttempt.current +=
      1;

    setSocketHealthy(
      false
    );

    setReconnectingChat(
      true
    );

    reconnectTimer.current =
      window.setTimeout(
        () => {
          reconnectTimer.current =
            null;

          void reconnectAllChannels();
        },
        delay
      );
  }

  async function reconnectAllChannels() {
    if (
      !shouldReconnect.current ||
      reconnectInProgress.current ||
      channelTabsRef.current
        .length ===
        0 ||
      !twitchAccessTokenRef.current ||
      !twitchUserIdRef.current
    ) {
      return;
    }

    reconnectInProgress.current =
      true;

    setSocketHealthy(
      false
    );

    setReconnectingChat(
      true
    );

    markChannelsJoining();

    try {
      const sessionId =
        await ensureTwitchSocket();

      announceConnectionRestored();

      for (
        const tab
        of [
          ...channelTabsRef.current,
        ]
      ) {
        if (
          !shouldReconnect.current
        ) {
          break;
        }

        await createChatSubscription(
          sessionId,
          tab.broadcasterId
        );

        updateTabs(
          (
            tabs
          ) =>
            tabs.map(
              (
                item
              ) =>
                item.broadcasterId ===
                tab.broadcasterId
                  ? {
                      ...item,

                      status:
                        "live",

                      error:
                        "",
                    }
                  : item
            )
        );
      }

      reconnectAttempt.current =
        0;

      setSocketHealthy(
        true
      );

      setReconnectingChat(
        false
      );

      setHadChatConnection(
        true
      );

      void refreshLiveStatuses();
    } catch (
      error
    ) {
      console.error(
        "Automatisk Twitch reconnect feilet:",
        error
      );

      markSocketDisconnected();

      scheduleSocketReconnect();
    } finally {
      reconnectInProgress.current =
        false;
    }
  }

  function processChatNotification(
    message: any
  ) {
    const metadataId =
      message
        ?.metadata
        ?.message_id;

    if (
      metadataId
    ) {
      if (
        processedEventIds.current
          .has(
            metadataId
          )
      ) {
        return;
      }

      processedEventIds.current
        .add(
          metadataId
        );

      if (
        processedEventIds.current
          .size >
        1000
      ) {
        const first =
          processedEventIds.current
            .values()
            .next()
            .value;

        if (
          first
        ) {
          processedEventIds.current
            .delete(
              first
            );
        }
      }
    }

    const event =
      message
        ?.payload
        ?.event;

    if (
      !event
    ) {
      return;
    }

    const broadcasterId =
      String(
        event.broadcaster_user_id ||
        ""
      );

    const channelTab =
      channelTabsRef.current
        .find(
          (
            tab
          ) =>
            tab.broadcasterId ===
            broadcasterId
        );

    if (
      !channelTab
    ) {
      return;
    }

    const fragments:
      TwitchMessageFragment[] =
      event.message
        ?.fragments ||
      [
        {
          type:
            "text",

          text:
            event.message
              ?.text ||
            "",
        },
      ];

    const authorUserId =
      String(
        event.chatter_user_id ||
        ""
      );

    const mentionedMe =
      messageMentionsMe(
        event,
        fragments
      ) &&
      !isUserIgnoredForHighlights(
        authorUserId
      );

    const isOwnMessage =
      authorUserId ===
      twitchUserIdRef.current;

    if (
      mentionedMe &&
      !isOwnMessage &&
      !isMentionSoundMuted(
        channelTab.login
      )
    ) {
      playMentionSound();
    }

    const parsedTimestamp =
      Date.parse(
        message
          ?.metadata
          ?.message_timestamp ||
          ""
      );

    const timestampMs =
      Number.isFinite(
        parsedTimestamp
      )
        ? parsedTimestamp
        : Date.now();

    const reply:
      TwitchReplyInfo | null =
      event.reply
        ? {
            parentMessageId:
              String(
                event.reply
                  .parent_message_id ||
                  ""
              ),

            parentMessageBody:
              String(
                event.reply
                  .parent_message_body ||
                  ""
              ),

            parentUserId:
              String(
                event.reply
                  .parent_user_id ||
                  ""
              ),

            parentUserName:
              String(
                event.reply
                  .parent_user_name ||
                  ""
              ),

            parentUserLogin:
              String(
                event.reply
                  .parent_user_login ||
                  ""
              ),

            threadMessageId:
              String(
                event.reply
                  .thread_message_id ||
                  ""
              ),

            threadUserId:
              String(
                event.reply
                  .thread_user_id ||
                  ""
              ),

            threadUserName:
              String(
                event.reply
                  .thread_user_name ||
                  ""
              ),

            threadUserLogin:
              String(
                event.reply
                  .thread_user_login ||
                  ""
              ),
          }
        : null;

    const newMessage:
      TwitchChatMessage = {
        id:
          event.message_id ||
          metadataId ||
          `chat-${timestampMs}-${Math.random()}`,

        kind:
          "chat",

        timestampMs,

        time:
          clockTime(
            timestampMs
          ),

        userId:
          authorUserId,

        userLogin:
          String(
            event.chatter_user_login ||
            ""
          ).toLowerCase(),

        username:
          String(
            event.chatter_user_name ||
            event.chatter_user_login ||
            "Ukjent"
          ),

        text:
          event.message
            ?.text ||
          "",

        color:
          event.color ||
          "#b784ff",

        badges:
          resolveBadges(
            broadcasterId,
            event.badges
          ),

        fragments,

        reply,
      };

    let didInsert =
      false;

    updateTabs(
      (
        tabs
      ) =>
        tabs.map(
          (
            tab
          ) => {
            if (
              tab.broadcasterId !==
                broadcasterId ||
              tab.messages.some(
                (
                  existing
                ) =>
                  existing.id ===
                  newMessage.id
              )
            ) {
              return tab;
            }

            didInsert =
              true;

            return {
              ...tab,

              messages: [
                ...tab.messages,
                newMessage,
              ],

              hasMention:
                broadcasterId ===
                activeChannelIdRef.current
                  ? false
                  : tab.hasMention ||
                    mentionedMe,
            };
          }
        )
    );

    if (
      didInsert
    ) {
      saveMessageToDisk(
        channelTab.login,
        newMessage
      );
    }
  }

  function attachSocketHandlers(
    socket:
      WebSocket,

    welcomeCallback?:
      (
        sessionId:
          string
      ) =>
        void,

    failureCallback?:
      (
        message:
          string
      ) =>
        void,

    oldSocket?:
      WebSocket,

    serverReconnect =
      false
  ) {
    let receivedWelcome =
      false;

    socket.onmessage =
      (
        event
      ) => {
        try {
          const message =
            JSON.parse(
              event.data
            );

          const type =
            message
              ?.metadata
              ?.message_type;

          if (
            type ===
            "session_welcome"
          ) {
            receivedWelcome =
              true;

            const sessionId =
              message
                .payload
                .session
                .id;

            twitchSessionId.current =
              sessionId;

            twitchSocket.current =
              socket;

            armKeepaliveWatchdog(
              socket,
              message
                ?.payload
                ?.session
                ?.keepalive_timeout_seconds
            );

            setSocketHealthy(
              true
            );

            setHadChatConnection(
              true
            );

            reconnectAttempt.current =
              0;

            if (
              oldSocket &&
              oldSocket !==
                socket
            ) {
              oldSocket.close();
            }

            if (
              serverReconnect
            ) {
              updateTabs(
                (
                  tabs
                ) =>
                  tabs.map(
                    (
                      tab
                    ) => ({
                      ...tab,

                      status:
                        "live",

                      error:
                        "",
                    })
                  )
              );

              if (
                !initialStartupRef.current
              ) {
                announceConnectionRestored();
              }

              setReconnectingChat(
                false
              );

              void refreshLiveStatuses();
            }

            welcomeCallback?.(
              sessionId
            );

            return;
          }

          if (
            type ===
            "notification"
          ) {
            setSocketHealthy(
              true
            );

            armKeepaliveWatchdog(
              socket
            );

            if (
              message
                ?.metadata
                ?.subscription_type ===
              "channel.chat.message"
            ) {
              processChatNotification(
                message
              );
            }

            return;
          }

          if (
            type ===
            "session_keepalive"
          ) {
            setSocketHealthy(
              true
            );

            armKeepaliveWatchdog(
              socket
            );

            return;
          }

          if (
            type ===
            "session_reconnect"
          ) {
            const reconnectUrl =
              message
                ?.payload
                ?.session
                ?.reconnect_url;

            if (
              !reconnectUrl
            ) {
              return;
            }

            setSocketHealthy(
              false
            );

            setReconnectingChat(
              true
            );

            markSocketDisconnected();

            if (
              !initialStartupRef.current
            ) {
              announceConnectionLost();
            }

            clearKeepaliveTimer();

            clearReconnectTimer();

            const replacement =
              new WebSocket(
                reconnectUrl
              );

            twitchSocket.current =
              replacement;

            attachSocketHandlers(
              replacement,
              undefined,
              undefined,
              socket,
              true
            );

            return;
          }
        } catch (
          error
        ) {
          console.error(
            "EventSub error:",
            error
          );
        }
      };

    socket.onerror =
      () => {
        if (
          !receivedWelcome
        ) {
          if (
            twitchSocket.current ===
            socket
          ) {
            twitchSocket.current =
              null;
          }

          try {
            socket.close();
          } catch {
            // ignore
          }

          failureCallback?.(
            "Kunne ikke koble til Twitch EventSub."
          );
        } else if (
          twitchSocket.current ===
            socket &&
          shouldReconnect.current
        ) {
          beginConnectionLoss(
            socket
          );
        }
      };

    socket.onclose =
      () => {
        if (
          twitchSocket.current !==
          socket
        ) {
          return;
        }

        clearKeepaliveTimer();

        twitchSocket.current =
          null;

        twitchSessionId.current =
          "";

        socketConnectPromise.current =
          null;

        subscribedChannelIds.current
          .clear();

        setSocketHealthy(
          false
        );

        if (
          shouldReconnect.current &&
          channelTabsRef.current
            .length >
            0
        ) {
          setReconnectingChat(
            true
          );

          markSocketDisconnected();

          if (
            !initialStartupRef.current
          ) {
            announceConnectionLost();
          }

          scheduleSocketReconnect();
        }
      };
  }

  async function ensureTwitchSocket() {
    if (
      twitchSocket.current
        ?.readyState ===
        WebSocket.OPEN &&
      twitchSessionId.current
    ) {
      return twitchSessionId.current;
    }

    if (
      socketConnectPromise.current
    ) {
      return socketConnectPromise.current;
    }

    subscribedChannelIds.current
      .clear();

    setSocketHealthy(
      false
    );

    const promise =
      new Promise<
        string
      >(
        (
          resolve,
          reject
        ) => {
          const socket =
            new WebSocket(
              "wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=10"
            );

          twitchSocket.current =
            socket;

          const failTimer =
            window.setTimeout(
              () => {
                if (
                  socketConnectPromise.current &&
                  !twitchSessionId.current
                ) {
                  socketConnectPromise.current =
                    null;

                  try {
                    socket.close();
                  } catch {
                    // ignore
                  }

                  reject(
                    new Error(
                      "Twitch connection timed out."
                    )
                  );
                }
              },
              15000
            );

          attachSocketHandlers(
            socket,

            (
              sessionId
            ) => {
              window.clearTimeout(
                failTimer
              );

              socketConnectPromise.current =
                null;

              resolve(
                sessionId
              );
            },

            (
              message
            ) => {
              window.clearTimeout(
                failTimer
              );

              socketConnectPromise.current =
                null;

              reject(
                new Error(
                  message
                )
              );
            }
          );
        }
      );

    socketConnectPromise.current =
      promise;

    return promise;
  }

  async function createChatSubscription(
    sessionId:
      string,

    broadcasterId:
      string
  ) {
    if (
      subscribedChannelIds.current
        .has(
          broadcasterId
        )
    ) {
      return;
    }

    const response =
      await fetch(
        "https://api.twitch.tv/helix/eventsub/subscriptions",
        {
          method:
            "POST",

          headers: {
            Authorization:
              `Bearer ${twitchAccessTokenRef.current}`,

            "Client-Id":
              TWITCH_CLIENT_ID,

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              type:
                "channel.chat.message",

              version:
                "1",

              condition: {
                broadcaster_user_id:
                  broadcasterId,

                user_id:
                  twitchUserIdRef.current,
              },

              transport: {
                method:
                  "websocket",

                session_id:
                  sessionId,
              },
            }),
        }
      );

    if (
      !response.ok
    ) {
      throw new Error(
        `Kunne ikke koble til chatten: ${await response.text()}`
      );
    }

    subscribedChannelIds.current
      .add(
        broadcasterId
      );
  }

  async function joinTwitchChannel(
    rawLogin:
      string,

    persist:
      boolean,

    activate:
      boolean
  ) {
    const login =
      sanitizeChannelName(
        rawLogin
      );

    if (
      !login
    ) {
      throw new Error(
        "Skriv inn et kanalnavn."
      );
    }

    const user =
      await getTwitchUserByLogin(
        login
      );

    cacheChannel(
      user
    );

    const existingLive =
      channelTabsRef.current
        .find(
          (
            tab
          ) =>
            tab.broadcasterId ===
              user.id &&
            tab.status ===
              "live"
        );

    if (
      existingLive
    ) {
      if (
        persist
      ) {
        rememberChannel(
          user.login
        );
      }

      if (
        activate
      ) {
        activateChannel(
          user.id
        );
      }

      return;
    }

    const placeholder =
      channelTabsRef.current
        .find(
          (
            tab
          ) =>
            tab.login ===
            user.login.toLowerCase()
        );

    const storedMessages =
      placeholder
        ?.messages.length
        ? placeholder.messages
        : await loadStoredChannelHistory(
            user.login
          );

    const newTab:
      ChannelTab = {
        broadcasterId:
          user.id,

        login:
          user.login.toLowerCase(),

        displayName:
          user.display_name,

        profileImageUrl:
          user.profile_image_url,

        isLive:
          placeholder?.isLive ||
          false,

        canModerate:
          moderatedChannelIdsRef.current
            .has(
              user.id
            ),

        status:
          "joining",

        error:
          "",

        messages:
          storedMessages,

        hasMention:
          placeholder?.hasMention ||
          false,
      };

    if (
      placeholder
    ) {
      const wasActive =
        activeChannelIdRef.current ===
          placeholder.broadcasterId;

      updateTabs(
        (
          tabs
        ) =>
          tabs.map(
            (
              tab
            ) =>
              tab.login ===
              user.login.toLowerCase()
                ? newTab
                : tab
          )
      );

      if (
        wasActive ||
        activate
      ) {
        activeChannelIdRef.current =
          user.id;

        setActiveChannelId(
          user.id
        );

        saveActiveChannel(
          user.login
        );
      }
    } else {
      updateTabs(
        (
          tabs
        ) => [
          ...tabs,
          newTab,
        ]
      );

      if (
        activate
      ) {
        activateChannel(
          user.id
        );
      }
    }

    try {
      shouldReconnect.current =
        true;

      await loadChannelBadges(
        user.id
      );

      const sessionId =
        await ensureTwitchSocket();

      await createChatSubscription(
        sessionId,
        user.id
      );

      updateTabs(
        (
          tabs
        ) =>
          tabs.map(
            (
              tab
            ) =>
              tab.broadcasterId ===
              user.id
                ? {
                    ...tab,

                    canModerate:
                      moderatedChannelIdsRef.current
                        .has(
                          user.id
                        ),

                    status:
                      "live",

                    error:
                      "",
                  }
                : tab
          )
      );

      setSocketHealthy(
        true
      );

      setHadChatConnection(
        true
      );

      setReconnectingChat(
        false
      );

      if (
        persist
      ) {
        rememberChannel(
          user.login
        );
      }
    } catch (
      error
    ) {
      const errorMessage =
        error instanceof
        Error
          ? error.message
          : "Ukjent feil.";

      updateTabs(
        (
          tabs
        ) =>
          tabs.map(
            (
              tab
            ) =>
              tab.broadcasterId ===
              user.id
                ? {
                    ...tab,

                    status:
                      "error",

                    error:
                      errorMessage,
                  }
                : tab
          )
      );

      throw error;
    }
  }

  async function restoreSavedChannels() {
    const preferred =
      localStorage.getItem(
        ACTIVE_CHANNEL_KEY
      );

    for (
      const login
      of savedChannelLoginsRef.current
    ) {
      try {
        await joinTwitchChannel(
          login,
          false,
          false
        );
      } catch (
        error
      ) {
        console.error(
          `Kunne ikke gjenopprette ${login}:`,
          error
        );
      }
    }

    const tab =
      channelTabsRef.current
        .find(
          (
            item
          ) =>
            item.login ===
            preferred
        ) ||
      channelTabsRef.current[
        0
      ];

    if (
      tab
    ) {
      activateChannel(
        tab.broadcasterId
      );
    }

    await refreshLiveStatuses();

    initialStartupRef.current =
      false;
  }

  async function finishTwitchLogin(
    tokenData:
      TwitchTokenResponse
  ) {
    try {
      await saveTwitchRefreshToken(
        tokenData.refresh_token
      );
    } catch (
      error
    ) {
      console.error(
        "Kunne ikke lagre refresh token:",
        error
      );
    }

    twitchAccessTokenRef.current =
      tokenData.access_token;

    const user =
      await getLoggedInTwitchUser(
        tokenData.access_token
      );

    twitchUserIdRef.current =
      user.id;

    twitchUserLoginRef.current =
      user.login;

    setTwitchUserName(
      user.display_name
    );

    setTwitchProfileImage(
      user.profile_image_url
    );

    await loadModeratedChannels(
      tokenData.access_token,
      user.id
    );

    await loadGlobalBadges(
      tokenData.access_token
    );

    shouldReconnect.current =
      true;

    setHasSavedTwitchSession(
      true
    );

    setTwitchConnected(
      true
    );

    setConnectingTwitch(
      false
    );

    setTwitchLogin(
      null
    );

    setTwitchError(
      ""
    );

    await restoreSavedChannels();
  }

  async function restoreTwitchLogin() {
    try {
      const refreshToken =
        await invoke<
          string | null
        >(
          "load_twitch_refresh_token"
        );

      if (
        !refreshToken
      ) {
        setHasSavedTwitchSession(
          false
        );

        return;
      }

      setHasSavedTwitchSession(
        true
      );

      setConnectingTwitch(
        true
      );

      const body =
        new URLSearchParams({
          client_id:
            TWITCH_CLIENT_ID,

          grant_type:
            "refresh_token",

          refresh_token:
            refreshToken,
        });

      const response =
        await fetch(
          "https://id.twitch.tv/oauth2/token",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded",
            },

            body:
              body.toString(),
          }
        );

      if (
        !response.ok
      ) {
        if (
          response.status ===
            400 ||
          response.status ===
            401
        ) {
          await deleteSavedTwitchLogin()
            .catch(
              () =>
                undefined
            );

          setHasSavedTwitchSession(
            false
          );

          setConnectingTwitch(
            false
          );

          setTwitchError(
            "Twitch-innloggingen er utløpt. Trykk Connect Twitch for å logge inn igjen."
          );

          return;
        }

        throw new Error(
          await response.text()
        );
      }

      await finishTwitchLogin(
        (
          await response.json()
        ) as TwitchTokenResponse
      );
    } catch (
      error
    ) {
      setConnectingTwitch(
        false
      );

      setTwitchError(
        error instanceof
        Error
          ? error.message
          : "Kunne ikke gjenopprette Twitch-innloggingen."
      );
    } finally {
      setRestoringSession(
        false
      );

      if (
        !twitchAccessTokenRef.current
      ) {
        initialStartupRef.current =
          false;
      }
    }
  }

  async function waitForTwitchLogin(
    deviceCode:
      string,

    interval:
      number,

    expiresIn:
      number
  ) {
    const startedAt =
      Date.now();

    while (
      Date.now() -
        startedAt <
      expiresIn *
        1000
    ) {
      await new Promise(
        (
          resolve
        ) =>
          setTimeout(
            resolve,
            interval *
              1000
          )
      );

      const body =
        new URLSearchParams({
          client_id:
            TWITCH_CLIENT_ID,

          scopes:
            TWITCH_SCOPES,

          device_code:
            deviceCode,

          grant_type:
            "urn:ietf:params:oauth:grant-type:device_code",
        });

      const response =
        await fetch(
          "https://id.twitch.tv/oauth2/token",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded",
            },

            body:
              body.toString(),
          }
        );

      if (
        response.ok
      ) {
        await finishTwitchLogin(
          (
            await response.json()
          ) as TwitchTokenResponse
        );

        return;
      }

      const errorData =
        await response.json();

      if (
        errorData.message ===
        "authorization_pending"
      ) {
        continue;
      }

      throw new Error(
        errorData.message ||
          "Twitch login failed."
      );
    }

    throw new Error(
      "Twitch-koden gikk ut på tid."
    );
  }

  async function connectTwitch() {
    primeMentionSound();

    initialStartupRef.current =
      false;

    setRestoringSession(
      false
    );

    setConnectingTwitch(
      true
    );

    setTwitchConnected(
      false
    );

    setTwitchError(
      ""
    );

    if (
      channelTabsRef.current.length ===
      0
    ) {
      preloadSavedChannelTabs();
    }

    setReplyingTo(
      null
    );

    setUserCard(
      null
    );

    setProfileMenuOpen(
      false
    );

    setShowSettings(
      false
    );

    activeChannelIdRef.current =
      "";

    setActiveChannelId(
      ""
    );

    twitchAccessTokenRef.current =
      "";

    twitchUserIdRef.current =
      "";

    twitchUserLoginRef.current =
      "";

    moderatedChannelIdsRef.current =
      new Set();

    globalBadgeMap.current =
      {};

    channelBadgeMaps.current =
      {};

    subscribedChannelIds.current
      .clear();

    processedEventIds.current
      .clear();

    shouldReconnect.current =
      false;

    outageAnnounced.current =
      false;

    setSocketHealthy(
      false
    );

    setHadChatConnection(
      false
    );

    setReconnectingChat(
      false
    );

    clearKeepaliveTimer();

    clearReconnectTimer();

    socketConnectPromise.current =
      null;

    twitchSocket.current
      ?.close();

    twitchSocket.current =
      null;

    twitchSessionId.current =
      "";

    try {
      const body =
        new URLSearchParams({
          client_id:
            TWITCH_CLIENT_ID,

          scopes:
            TWITCH_SCOPES,
        });

      const response =
        await fetch(
          "https://id.twitch.tv/oauth2/device",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded",
            },

            body:
              body.toString(),
          }
        );

      if (
        !response.ok
      ) {
        throw new Error(
          await response.text()
        );
      }

      const data =
        (
          await response.json()
        ) as TwitchDeviceResponse;

      setTwitchLogin(
        data
      );

      await openUrl(
        data.verification_uri
      );

      await waitForTwitchLogin(
        data.device_code,
        data.interval,
        data.expires_in
      );
    } catch (
      error
    ) {
      setConnectingTwitch(
        false
      );

      if (
        error instanceof
        Error
      ) {
        setTwitchError(
          error.message
        );
      }
    }
  }

  async function disconnectTwitch() {
    shouldReconnect.current =
      false;

    clearKeepaliveTimer();

    clearReconnectTimer();

    setReplyingTo(
      null
    );

    setUserCard(
      null
    );

    setProfileMenuOpen(
      false
    );

    setShowSettings(
      false
    );

    setHasSavedTwitchSession(
      false
    );

    const accessToken =
      twitchAccessTokenRef.current;

    if (
      accessToken
    ) {
      try {
        const body =
          new URLSearchParams({
            client_id:
              TWITCH_CLIENT_ID,

            token:
              accessToken,
          });

        await fetch(
          "https://id.twitch.tv/oauth2/revoke",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded",
            },

            body:
              body.toString(),
          }
        );
      } catch {
        // lokal logout
      }
    }

    await deleteSavedTwitchLogin()
      .catch(
        () =>
          undefined
      );

    twitchSocket.current
      ?.close();

    twitchSocket.current =
      null;

    twitchSessionId.current =
      "";

    socketConnectPromise.current =
      null;

    subscribedChannelIds.current
      .clear();

    moderatedChannelIdsRef.current =
      new Set();

    twitchAccessTokenRef.current =
      "";

    twitchUserIdRef.current =
      "";

    twitchUserLoginRef.current =
      "";

    activeChannelIdRef.current =
      "";

    outageAnnounced.current =
      false;

    replaceTabs(
      []
    );

    setActiveChannelId(
      ""
    );

    setTwitchConnected(
      false
    );

    setConnectingTwitch(
      false
    );

    setTwitchLogin(
      null
    );

    setTwitchUserName(
      ""
    );

    setTwitchProfileImage(
      ""
    );

    setSocketHealthy(
      false
    );

    setHadChatConnection(
      false
    );

    setReconnectingChat(
      false
    );
  }

  async function addTwitchChannel() {
    primeMentionSound();

    if (
      !twitchConnected
    ) {
      setAddChannelError(
        "Koble til Twitch først."
      );

      return;
    }

    setAddingChannel(
      true
    );

    setAddChannelError(
      ""
    );

    try {
      await joinTwitchChannel(
        newChannelInput,
        true,
        true
      );

      setNewChannelInput(
        ""
      );

      setShowAddChannel(
        false
      );

      await refreshLiveStatuses();
    } catch (
      error
    ) {
      setAddChannelError(
        error instanceof
        Error
          ? error.message
          : "Ukjent feil."
      );
    } finally {
      setAddingChannel(
        false
      );
    }
  }

  function removeChannel(
    broadcasterId:
      string
  ) {
    setTabContextMenu(
      null
    );

    const removed =
      channelTabsRef.current
        .find(
          (
            tab
          ) =>
            tab.broadcasterId ===
            broadcasterId
        );

    if (
      removed
    ) {
      forgetChannel(
        removed.login
      );
    }

    const remaining =
      channelTabsRef.current
        .filter(
          (
            tab
          ) =>
            tab.broadcasterId !==
            broadcasterId
        );

    replaceTabs(
      remaining
    );

    if (
      activeChannelIdRef.current ===
      broadcasterId
    ) {
      setReplyingTo(
        null
      );

      setUserCard(
        null
      );

      const next =
        remaining[
          0
        ];

      if (
        next
      ) {
        activateChannel(
          next.broadcasterId
        );
      } else {
        activeChannelIdRef.current =
          "";

        setActiveChannelId(
          ""
        );

        saveActiveChannel(
          ""
        );
      }
    }

    if (
      remaining.length ===
      0
    ) {
      shouldReconnect.current =
        false;

      clearKeepaliveTimer();

      clearReconnectTimer();

      twitchSocket.current
        ?.close();

      twitchSocket.current =
        null;

      twitchSessionId.current =
        "";

      subscribedChannelIds.current
        .clear();

      setSocketHealthy(
        false
      );

      setReconnectingChat(
        false
      );

      setHadChatConnection(
        false
      );

      outageAnnounced.current =
        false;
    }
  }

  async function sendTwitchMessage() {
    primeMentionSound();

    const message =
      chatInput.trim();

    if (
      !message ||
      !activeTab
    ) {
      return;
    }

    if (
      activeTab.status !==
        "live" ||
      !connectionOnline
    ) {
      setTwitchError(
        "Denne chatten er ikke koblet til."
      );

      return;
    }

    setSendingMessage(
      true
    );

    setTwitchError(
      ""
    );

    try {
      const requestBody: {
        broadcaster_id:
          string;

        sender_id:
          string;

        message:
          string;

        reply_parent_message_id?:
          string;
      } = {
        broadcaster_id:
          activeTab.broadcasterId,

        sender_id:
          twitchUserIdRef.current,

        message,
      };

      if (
        replyingTo
      ) {
        requestBody.reply_parent_message_id =
          replyingTo.messageId;
      }

      const response =
        await fetch(
          "https://api.twitch.tv/helix/chat/messages",
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${twitchAccessTokenRef.current}`,

              "Client-Id":
                TWITCH_CLIENT_ID,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                requestBody
              ),
          }
        );

      if (
        !response.ok
      ) {
        throw new Error(
          await response.text()
        );
      }

      const result =
        (
          (
            await response.json()
          ) as TwitchSendMessageResponse
        ).data?.[
          0
        ];

      if (
        !result
          ?.is_sent
      ) {
        throw new Error(
          result
            ?.drop_reason
            ?.message ||
            "Twitch stoppet meldingen."
        );
      }

      setChatInput(
        ""
      );

      setReplyingTo(
        null
      );
    } catch (
      error
    ) {
      setTwitchError(
        error instanceof
        Error
          ? error.message
          : "Kunne ikke sende meldingen."
      );
    } finally {
      setSendingMessage(
        false
      );
    }
  }

  async function getFollowerCount(
    userId:
      string
  ) {
    try {
      const response =
        await fetch(
          "https://api.twitch.tv/helix/channels/followers?broadcaster_id=" +
            encodeURIComponent(
              userId
            ) +
            "&first=1",
          {
            headers: {
              Authorization:
                `Bearer ${twitchAccessTokenRef.current}`,

              "Client-Id":
                TWITCH_CLIENT_ID,
            },
          }
        );

      if (
        !response.ok
      ) {
        return null;
      }

      const data =
        (
          await response.json()
        ) as ChannelFollowersResponse;

      return typeof data.total ===
        "number"
        ? data.total
        : null;
    } catch {
      return null;
    }
  }

  async function getFollowedAt(
    broadcasterId:
      string,

    userId:
      string,

    canModerate:
      boolean
  ) {
    if (
      !canModerate
    ) {
      return null;
    }

    try {
      const params =
        new URLSearchParams({
          broadcaster_id:
            broadcasterId,

          user_id:
            userId,

          first:
            "1",
        });

      const response =
        await fetch(
          `https://api.twitch.tv/helix/channels/followers?${params}`,
          {
            headers: {
              Authorization:
                `Bearer ${twitchAccessTokenRef.current}`,

              "Client-Id":
                TWITCH_CLIENT_ID,
            },
          }
        );

      if (
        !response.ok
      ) {
        return null;
      }

      const data =
        (
          await response.json()
        ) as ChannelFollowersResponse;

      return (
        data.data?.[
          0
        ]?.followed_at ||
        null
      );
    } catch {
      return null;
    }
  }

  async function checkBlockedUser(
    targetUserId:
      string
  ) {
    try {
      let after =
        "";

      do {
        const params =
          new URLSearchParams({
            broadcaster_id:
              twitchUserIdRef.current,

            first:
              "100",
          });

        if (
          after
        ) {
          params.set(
            "after",
            after
          );
        }

        const response =
          await fetch(
            `https://api.twitch.tv/helix/users/blocks?${params}`,
            {
              headers: {
                Authorization:
                  `Bearer ${twitchAccessTokenRef.current}`,

                "Client-Id":
                  TWITCH_CLIENT_ID,
              },
            }
          );

        if (
          !response.ok
        ) {
          return null;
        }

        const data =
          (
            await response.json()
          ) as BlockedUsersResponse;

        if (
          data.data.some(
            (
              item
            ) =>
              item.user_id ===
              targetUserId
          )
        ) {
          return true;
        }

        after =
          data.pagination
            ?.cursor ||
          "";
      } while (
        after
      );

      return false;
    } catch {
      return null;
    }
  }

  async function openUserCard(
    message:
      TwitchChatMessage,

    tab:
      ChannelTab
  ) {
    if (
      message.kind !==
      "chat"
    ) {
      return;
    }

    const loadId =
      ++userCardLoadCounter.current;

    const roles =
      rolesFromMessage(
        message,
        tab.broadcasterId
      );

    setUserCardLoading(
      true
    );

    setUserCardError(
      ""
    );

    setUserCardActionStatus(
      ""
    );

    setModReason(
      ""
    );

    setShowNoteEditor(
      false
    );

    setUserCard({
      broadcasterId:
        tab.broadcasterId,

      channelLogin:
        tab.login,

      channelDisplayName:
        tab.displayName,

      canModerate:
        tab.canModerate,

      userId:
        message.userId,

      userLogin:
        message.userLogin ||
        message.username
          .toLowerCase(),

      username:
        message.username,

      profileImageUrl:
        "",

      createdAt:
        "",

      followerCount:
        null,

      followedAt:
        null,

      blocked:
        null,

      roles,
    });

    try {
      const profile =
        message.userId
          ? await getTwitchUserById(
              message.userId
            )
          : await getTwitchUserByLogin(
              message.userLogin ||
                message.username
            );

      if (
        loadId !==
        userCardLoadCounter.current
      ) {
        return;
      }

      setNoteDraft(
        userNotes[
          profile.id
        ] ||
          ""
      );

      const [
        followerCount,
        followedAt,
        blocked,
      ] =
        await Promise.all([
          getFollowerCount(
            profile.id
          ),

          getFollowedAt(
            tab.broadcasterId,
            profile.id,
            tab.canModerate
          ),

          checkBlockedUser(
            profile.id
          ),
        ]);

      if (
        loadId !==
        userCardLoadCounter.current
      ) {
        return;
      }

      setUserCard({
        broadcasterId:
          tab.broadcasterId,

        channelLogin:
          tab.login,

        channelDisplayName:
          tab.displayName,

        canModerate:
          tab.canModerate,

        userId:
          profile.id,

        userLogin:
          profile.login,

        username:
          profile.display_name,

        profileImageUrl:
          profile.profile_image_url,

        createdAt:
          profile.created_at ||
          "",

        followerCount,

        followedAt,

        blocked,

        roles: {
          ...roles,

          broadcaster:
            roles.broadcaster ||
            profile.id ===
              tab.broadcasterId,
        },
      });
    } catch (
      error
    ) {
      if (
        loadId ===
        userCardLoadCounter.current
      ) {
        setUserCardError(
          error instanceof
          Error
            ? error.message
            : "Kunne ikke laste brukerinfo."
        );
      }
    } finally {
      if (
        loadId ===
        userCardLoadCounter.current
      ) {
        setUserCardLoading(
          false
        );
      }
    }
  }

  function moderationUnavailableReason(
    card:
      UserCardState | null
  ) {
    if (
      !card
    ) {
      return "Ingen bruker valgt.";
    }

    if (
      !card.canModerate
    ) {
      return "Du har ikke moderatorrettigheter i denne kanalen.";
    }

    if (
      card.userId ===
      twitchUserIdRef.current
    ) {
      return "Du kan ikke moderere deg selv.";
    }

    if (
      card.userId ===
        card.broadcasterId ||
      card.roles.broadcaster
    ) {
      return "Broadcasteren kan ikke timeoutes eller bannes her.";
    }

    return "";
  }

  async function timeoutUser(
    seconds:
      number
  ) {
    if (
      !userCard
    ) {
      return;
    }

    const unavailable =
      moderationUnavailableReason(
        userCard
      );

    if (
      unavailable
    ) {
      setUserCardActionStatus(
        unavailable
      );

      return;
    }

    setUserCardActionBusy(
      true
    );

    setUserCardActionStatus(
      ""
    );

    try {
      const params =
        new URLSearchParams({
          broadcaster_id:
            userCard.broadcasterId,

          moderator_id:
            twitchUserIdRef.current,
        });

      const data: {
        user_id: string;
        duration: number;
        reason?: string;
      } = {
        user_id:
          userCard.userId,

        duration:
          seconds,
      };

      if (
        modReason.trim()
      ) {
        data.reason =
          modReason.trim();
      }

      const response =
        await fetch(
          `https://api.twitch.tv/helix/moderation/bans?${params}`,
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${twitchAccessTokenRef.current}`,

              "Client-Id":
                TWITCH_CLIENT_ID,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                data,
              }),
          }
        );

      if (
        !response.ok
      ) {
        throw new Error(
          await friendlyTwitchError(
            response,
            "timeout"
          )
        );
      }

      setUserCardActionStatus(
        `✓ ${userCard.username} fikk timeout ${timeoutLabel(
          seconds
        )}.`
      );
    } catch (
      error
    ) {
      setUserCardActionStatus(
        error instanceof
        Error
          ? error.message
          : "Timeout feilet."
      );
    } finally {
      setUserCardActionBusy(
        false
      );
    }
  }

  async function banUser() {
    if (
      !userCard
    ) {
      return;
    }

    const unavailable =
      moderationUnavailableReason(
        userCard
      );

    if (
      unavailable
    ) {
      setUserCardActionStatus(
        unavailable
      );

      return;
    }

    if (
      !window.confirm(
        `Ban ${userCard.username} permanent fra #${userCard.channelDisplayName}?`
      )
    ) {
      return;
    }

    setUserCardActionBusy(
      true
    );

    setUserCardActionStatus(
      ""
    );

    try {
      const params =
        new URLSearchParams({
          broadcaster_id:
            userCard.broadcasterId,

          moderator_id:
            twitchUserIdRef.current,
        });

      const data: {
        user_id: string;
        reason?: string;
      } = {
        user_id:
          userCard.userId,
      };

      if (
        modReason.trim()
      ) {
        data.reason =
          modReason.trim();
      }

      const response =
        await fetch(
          `https://api.twitch.tv/helix/moderation/bans?${params}`,
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${twitchAccessTokenRef.current}`,

              "Client-Id":
                TWITCH_CLIENT_ID,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                data,
              }),
          }
        );

      if (
        !response.ok
      ) {
        throw new Error(
          await friendlyTwitchError(
            response,
            "ban"
          )
        );
      }

      setUserCardActionStatus(
        `✓ ${userCard.username} er bannet.`
      );
    } catch (
      error
    ) {
      setUserCardActionStatus(
        error instanceof
        Error
          ? error.message
          : "Ban feilet."
      );
    } finally {
      setUserCardActionBusy(
        false
      );
    }
  }

  async function unbanUser() {
    if (
      !userCard
    ) {
      return;
    }

    const unavailable =
      moderationUnavailableReason(
        userCard
      );

    if (
      unavailable
    ) {
      setUserCardActionStatus(
        unavailable
      );

      return;
    }

    setUserCardActionBusy(
      true
    );

    setUserCardActionStatus(
      ""
    );

    try {
      const params =
        new URLSearchParams({
          broadcaster_id:
            userCard.broadcasterId,

          moderator_id:
            twitchUserIdRef.current,

          user_id:
            userCard.userId,
        });

      const response =
        await fetch(
          `https://api.twitch.tv/helix/moderation/bans?${params}`,
          {
            method:
              "DELETE",

            headers: {
              Authorization:
                `Bearer ${twitchAccessTokenRef.current}`,

              "Client-Id":
                TWITCH_CLIENT_ID,
            },
          }
        );

      if (
        !response.ok
      ) {
        throw new Error(
          await friendlyTwitchError(
            response,
            "unban"
          )
        );
      }

      setUserCardActionStatus(
        `✓ Ban/timeout på ${userCard.username} er fjernet.`
      );
    } catch (
      error
    ) {
      setUserCardActionStatus(
        error instanceof
        Error
          ? error.message
          : "Unban feilet."
      );
    } finally {
      setUserCardActionBusy(
        false
      );
    }
  }

  async function toggleBlockUser() {
    if (
      !userCard
        ?.userId
    ) {
      return;
    }

    if (
      userCard.userId ===
      twitchUserIdRef.current
    ) {
      setUserCardActionStatus(
        "Du kan ikke blokkere deg selv."
      );

      return;
    }

    setUserCardActionBusy(
      true
    );

    setUserCardActionStatus(
      ""
    );

    try {
      const params =
        new URLSearchParams({
          target_user_id:
            userCard.userId,
        });

      const shouldUnblock =
        userCard.blocked ===
        true;

      const response =
        await fetch(
          `https://api.twitch.tv/helix/users/blocks?${params}`,
          {
            method:
              shouldUnblock
                ? "DELETE"
                : "PUT",

            headers: {
              Authorization:
                `Bearer ${twitchAccessTokenRef.current}`,

              "Client-Id":
                TWITCH_CLIENT_ID,
            },
          }
        );

      if (
        !response.ok
      ) {
        throw new Error(
          await friendlyTwitchError(
            response,
            shouldUnblock
              ? "unblock"
              : "block"
          )
        );
      }

      setUserCard(
        (
          current
        ) =>
          current
            ? {
                ...current,

                blocked:
                  !shouldUnblock,
              }
            : current
      );

      setUserCardActionStatus(
        shouldUnblock
          ? `✓ ${userCard.username} er unblocked.`
          : `✓ ${userCard.username} er blocked.`
      );
    } catch (
      error
    ) {
      setUserCardActionStatus(
        error instanceof
        Error
          ? error.message
          : "Block-handling feilet."
      );
    } finally {
      setUserCardActionBusy(
        false
      );
    }
  }

  async function deleteChatMessage(
    message:
      TwitchChatMessage
  ) {
    if (
      !userCard
        ?.canModerate
    ) {
      return;
    }

    setUserCardActionBusy(
      true
    );

    setUserCardActionStatus(
      ""
    );

    try {
      const params =
        new URLSearchParams({
          broadcaster_id:
            userCard.broadcasterId,

          moderator_id:
            twitchUserIdRef.current,

          message_id:
            message.id,
        });

      const response =
        await fetch(
          `https://api.twitch.tv/helix/moderation/chat?${params}`,
          {
            method:
              "DELETE",

            headers: {
              Authorization:
                `Bearer ${twitchAccessTokenRef.current}`,

              "Client-Id":
                TWITCH_CLIENT_ID,
            },
          }
        );

      if (
        !response.ok
      ) {
        throw new Error(
          await friendlyTwitchError(
            response,
            "sletting av melding"
          )
        );
      }

      updateTabs(
        (
          tabs
        ) =>
          tabs.map(
            (
              tab
            ) =>
              tab.broadcasterId ===
              userCard.broadcasterId
                ? {
                    ...tab,

                    messages:
                      tab.messages.filter(
                        (
                          item
                        ) =>
                          item.id !==
                          message.id
                      ),
                  }
                : tab
          )
      );

      setUserCardActionStatus(
        "✓ Meldingen er slettet på Twitch."
      );
    } catch (
      error
    ) {
      setUserCardActionStatus(
        error instanceof
        Error
          ? error.message
          : "Kunne ikke slette meldingen."
      );
    } finally {
      setUserCardActionBusy(
        false
      );
    }
  }

  function renderFragment(
    fragment:
      TwitchMessageFragment,

    index:
      number
  ) {
    if (
      fragment.type ===
        "emote" &&
      fragment.emote
    ) {
      return (
        <img
          key={`emote-${index}`}
          src={
            getTwitchEmoteUrl(
              fragment.emote
            )
          }
          alt={
            fragment.text
          }
          title={
            fragment.text
          }
          style={{
            height:
              Math.max(
                26,
                chatFontSize +
                  15
              ),

            maxWidth:
              120,

            objectFit:
              "contain",

            verticalAlign:
              "middle",

            margin:
              "-3px 2px",

            filter:
              "drop-shadow(0 1px 1px rgba(0,0,0,.35))",
          }}
        />
      );
    }

    if (
      fragment.type ===
        "gif" &&
      fragment.gif
        ?.url
    ) {
      return (
        <img
          key={`gif-${index}`}
          src={
            fragment.gif.url
          }
          alt={
            fragment.text
          }
          style={{
            height:
              Math.max(
                30,
                chatFontSize +
                  18
              ),

            maxWidth:
              165,

            objectFit:
              "contain",

            verticalAlign:
              "middle",

            margin:
              "-3px 2px",
          }}
        />
      );
    }

    if (
      fragment.type ===
      "mention"
    ) {
      const isMe =
        (
          twitchUserIdRef.current &&
          fragment.mention
            ?.user_id ===
            twitchUserIdRef.current
        ) ||
        (
          twitchUserLoginRef.current &&
          fragment.mention
            ?.user_login
            ?.toLowerCase() ===
            twitchUserLoginRef.current
              .toLowerCase()
        );

      return (
        <span
          key={`mention-${index}`}
          style={
            isMe
              ? {
                  color:
                    chatBackgroundIsLight
                      ? "#6b4f00"
                      : "#ffe28a",

                  fontWeight:
                    700,

                  background:
                    chatBackgroundIsLight
                      ? "rgba(224,161,0,.15)"
                      : "rgba(255,209,102,.14)",

                  border:
                    chatBackgroundIsLight
                      ? "1px solid rgba(160,112,0,.26)"
                      : "1px solid rgba(255,209,102,.25)",

                  borderRadius:
                    4,

                  padding:
                    "1px 4px",

                  margin:
                    "0 1px",
                }
              : {
                  color:
                    chatTextColor,
                }
          }
        >
          {
            fragment.text
          }
        </span>
      );
    }

    if (
      fragment.type ===
      "cheermote"
    ) {
      return (
        <span
          key={`cheer-${index}`}
          style={{
            color:
              "#d8b4fe",

            fontWeight:
              700,
          }}
        >
          {
            fragment.text
          }
        </span>
      );
    }

    return (
      <span
        key={`text-${index}`}
      >
        {
          fragment.text
        }
      </span>
    );
  }

  const moderationUnavailable =
    moderationUnavailableReason(
      userCard
    );

  const userCardCanAct =
    Boolean(
      userCard &&
      !moderationUnavailable
    );

  return (
    <div
      style={{
        height:
          "100vh",

        background:
          theme.appBg,

        color:
          theme.text,

        fontFamily:
          'Inter, "Segoe UI", Arial, sans-serif',

        fontSize:
          14,

        display:
          "flex",

        flexDirection:
          "column",

        overflow:
          "hidden",
      }}
    >
      {/* TOP BAR */}
      <div
        style={{
          minHeight:
            50,

          height:
            50,

          background:
            theme.topBar,

          borderBottom:
            `1px solid ${theme.border}`,

          display:
            "flex",

          alignItems:
            "center",

          padding:
            "0 12px",

          gap:
            10,

          flexShrink:
            0,

          boxShadow:
            "0 1px 5px rgba(0,0,0,.22)",
        }}
      >
        <strong
          style={{
            fontSize:
              18,

            color:
              theme.text,
          }}
        >
          ChatNest
        </strong>

        <div
          style={{
            flex:
              1,
          }}
        />

        {!twitchConnected ? (
          !restoringSession &&
          !hasSavedTwitchSession ? (
            <button
              onClick={
                connectTwitch
              }
              disabled={
                connectingTwitch
              }
              style={{
                ...smallButton,

                background:
                  "#9147ff",

                color:
                  "white",

                fontWeight:
                  700,
              }}
            >
              {connectingTwitch
                ? "Waiting for Twitch..."
                : "Connect Twitch"}
            </button>
          ) : null
        ) : (
          <div
            onPointerDown={(
              event
            ) =>
              event.stopPropagation()
            }
            style={{
              position:
                "relative",
            }}
          >
            <button
              onClick={() =>
                setProfileMenuOpen(
                  (
                    open
                  ) =>
                    !open
                )
              }
              title="Twitch account"
              style={{
                width:
                  34,

                height:
                  34,

                padding:
                  0,

                borderRadius:
                  "50%",

                border:
                  profileMenuOpen
                    ? "2px solid #9147ff"
                    : `1px solid ${theme.borderStrong}`,

                background:
                  theme.input,

                cursor:
                  "pointer",

                overflow:
                  "hidden",

                display:
                  "grid",

                placeItems:
                  "center",
              }}
            >
              {twitchProfileImage ? (
                <img
                  src={
                    twitchProfileImage
                  }
                  alt=""
                  style={{
                    width:
                      "100%",

                    height:
                      "100%",

                    objectFit:
                      "cover",
                  }}
                />
              ) : (
                <span
                  style={{
                    color:
                      "#bf94ff",

                    fontWeight:
                      800,
                  }}
                >
                  T
                </span>
              )}
            </button>

            {profileMenuOpen && (
              <div
                onPointerDown={(
                  event
                ) =>
                  event.stopPropagation()
                }
                style={{
                  position:
                    "absolute",

                  right:
                    0,

                  top:
                    40,

                  width:
                    205,

                  zIndex:
                    25000,

                  background:
                    theme.panelRaised,

                  border:
                    `1px solid ${theme.borderStrong}`,

                  borderRadius:
                    7,

                  padding:
                    5,

                  boxShadow:
                    "0 14px 40px rgba(0,0,0,.62)",
                }}
              >
                <button
                  onClick={() => {
                    setProfileMenuOpen(
                      false
                    );

                    void openOnTwitch(
                      twitchUserLoginRef.current
                    );
                  }}
                  style={{
                    ...smallButton,

                    width:
                      "100%",

                    border:
                      "none",

                    background:
                      "transparent",

                    textAlign:
                      "left",

                    padding:
                      "9px 10px",
                  }}
                >
                  My Twitch Account ↗
                </button>

                <button
                  onClick={() => {
                    setProfileMenuOpen(
                      false
                    );

                    setShowSettings(
                      true
                    );

                    setHighlightError(
                      ""
                    );
                  }}
                  style={{
                    ...smallButton,

                    width:
                      "100%",

                    border:
                      "none",

                    borderTop:
                      `1px solid ${theme.border}`,

                    borderRadius:
                      0,

                    background:
                      "transparent",

                    textAlign:
                      "left",

                    padding:
                      "9px 10px",
                  }}
                >
                  ⚙ Settings
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showReconnectOverlay && (
        <div
          style={{
            position:
              "fixed",

            inset:
              0,

            zIndex:
              9999,

            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "center",

            pointerEvents:
              "none",

            background:
              "rgba(8,9,12,.20)",
          }}
        >
          <div
            style={{
              padding:
                "22px 28px",

              background:
                "rgba(19,20,24,.97)",

              border:
                "1px solid #5a3034",

              borderRadius:
                9,

              boxShadow:
                "0 18px 55px rgba(0,0,0,.55)",

              textAlign:
                "center",
            }}
          >
            <strong>
              Tilkoblingen ble brutt
            </strong>

            <div
              style={{
                color:
                  "#ff9d98",

                fontSize:
                  13,

                marginTop:
                  7,
              }}
            >
              Prøver å koble til Twitch igjen...
            </div>
          </div>
        </div>
      )}

      {twitchLogin &&
        !twitchConnected && (
          <div
            style={{
              margin:
                10,

              padding:
                14,

              background:
                "#18181b",

              border:
                "1px solid #9147ff",

              borderRadius:
                7,
            }}
          >
            <strong>
              Connect ChatNest to Twitch
            </strong>

            <p>
              Kode:{" "}

              <strong
                style={{
                  fontSize:
                    23,
                }}
              >
                {
                  twitchLogin.user_code
                }
              </strong>
            </p>

            <p
              style={{
                color:
                  "#bf94ff",
              }}
            >
              {
                twitchLogin.verification_uri
              }
            </p>

            <span
              style={{
                color:
                  "#8c9098",
              }}
            >
              ChatNest venter på godkjenning...
            </span>
          </div>
        )}

      {/* TABS */}
      {showChannelUi && (
        <div
          style={{
            height:
              39,

            minHeight:
              39,

            display:
              "flex",

            alignItems:
              "stretch",

            borderBottom:
              `1px solid ${theme.border}`,

            background:
              theme.tabBar,

            overflowX:
              "auto",

            overflowY:
              "hidden",

            flexShrink:
              0,
          }}
        >
          <button
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
              minWidth:
                40,

              width:
                40,

              border:
                "none",

              borderRight:
                `1px solid ${theme.border}`,

              background:
                showAddChannel
                  ? theme.tabActive
                  : theme.tab,

              color:
                theme.muted,

              fontSize:
                21,

              cursor:
                twitchConnected
                  ? "pointer"
                  : "default",

              opacity:
                twitchConnected
                  ? 1
                  : 0.55,
            }}
          >
            +
          </button>

          {channelTabs.map(
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

              return (
                <div
                  key={
                    tab.broadcasterId
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
                  style={{
                    position:
                      "relative",

                    minWidth:
                      120,

                    maxWidth:
                      235,

                    padding:
                      "0 9px",

                    display:
                      "flex",

                    alignItems:
                      "center",

                    gap:
                      6,

                    borderRight:
                      `1px solid ${theme.border}`,

                    borderBottom:
                      active
                        ? "2px solid #9147ff"
                        : tab.hasMention
                          ? "2px solid #ffd166"
                          : "2px solid transparent",

                    background:
                      active
                        ? theme.tabActive
                        : tab.hasMention
                          ? appearanceMode ===
                            "light"
                            ? "#fff7db"
                            : "#2b271d"
                          : theme.tab,

                    cursor:
                      "pointer",

                    userSelect:
                      "none",
                  }}
                >
                  <span
                    title="Twitch"
                    style={{
                      width:
                        17,

                      height:
                        17,

                      display:
                        "grid",

                      placeItems:
                        "center",

                      color:
                        "#9147ff",

                      flexShrink:
                        0,
                    }}
                  >
                    <TwitchIcon
                      size={16}
                    />
                  </span>

                  {tab.isLive && (
                    <span
                      title="LIVE"
                      style={{
                        width:
                          8,

                        height:
                          8,

                        borderRadius:
                          "50%",

                        background:
                          "#ff3b3b",

                        boxShadow:
                          "0 0 6px rgba(255,59,59,.85)",
                      }}
                    />
                  )}

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

                      fontSize:
                        12,

                      fontWeight:
                        active ||
                        tab.hasMention
                          ? 650
                          : 500,

                      color:
                        tab.hasMention &&
                        !active
                          ? "#ffe29a"
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
                          0.55,

                        fontSize:
                          10,
                      }}
                    >
                      🔇
                    </span>
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
                    style={{
                      border:
                        "none",

                      background:
                        "transparent",

                      color:
                        theme.subtle,

                      cursor:
                        "pointer",

                      fontSize:
                        15,
                    }}
                  >
                    ×
                  </button>

                  {tab.hasMention &&
                    !active && (
                      <span
                        style={{
                          position:
                            "absolute",

                          top:
                            2,

                          right:
                            2,

                          width:
                            14,

                          height:
                            14,

                          display:
                            "flex",

                          alignItems:
                            "center",

                          justifyContent:
                            "center",

                          borderRadius:
                            "50%",

                          background:
                            "#ffd166",

                          color:
                            "#181818",

                          fontSize:
                            9,

                          fontWeight:
                            900,
                        }}
                      >
                        !
                      </span>
                    )}
                </div>
              );
            }
          )}
        </div>
      )}

      {/* ADD CHANNEL */}
      {twitchConnected &&
        showAddChannel && (
          <div
            style={{
              padding:
                "8px 10px",

              background:
                theme.panel,

              borderBottom:
                `1px solid ${theme.border}`,

              display:
                "flex",

              gap:
                7,

              alignItems:
                "center",
            }}
          >
            <select
              value="twitch"
              disabled
              style={{
                height:
                  32,

                background:
                  theme.input,

                color:
                  theme.text,

                border:
                  `1px solid ${theme.borderStrong}`,

                borderRadius:
                  4,
              }}
            >
              <option value="twitch">
                Twitch
              </option>
            </select>

            <input
              autoFocus
              value={
                newChannelInput
              }
              onChange={(
                event
              ) =>
                setNewChannelInput(
                  event.target.value
                )
              }
              onKeyDown={(
                event
              ) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  void addTwitchChannel();
                }
              }}
              placeholder="Twitch-kanal..."
              style={{
                width:
                  250,

                height:
                  32,

                background:
                  theme.input,

                color:
                  theme.text,

                border:
                  `1px solid ${theme.borderStrong}`,

                borderRadius:
                  4,

                padding:
                  "0 9px",

                outline:
                  "none",
              }}
            />

            <button
              onClick={
                addTwitchChannel
              }
              disabled={
                addingChannel
              }
              style={{
                ...smallButton,

                height:
                  32,

                background:
                  "#9147ff",

                color:
                  "white",

                fontWeight:
                  700,
              }}
            >
              {addingChannel
                ? "Legger til..."
                : "Legg til"}
            </button>

            {addChannelError && (
              <span
                style={{
                  color:
                    "#ff7b72",

                  fontSize:
                    12,
                }}
              >
                {
                  addChannelError
                }
              </span>
            )}
          </div>
        )}

      {twitchError && (
        <div
          style={{
            padding:
              "7px 12px",

            background:
              appearanceMode ===
              "light"
                ? "#fff0ef"
                : "#32191c",

            color:
              appearanceMode ===
              "light"
                ? "#a32222"
                : "#ff9b95",

            borderBottom:
              appearanceMode ===
              "light"
                ? "1px solid #f0b9b4"
                : "1px solid #793139",

            fontSize:
              12,
          }}
        >
          {
            twitchError
          }
        </div>
      )}

      {/* CHAT */}
      <div
        style={{
          flex:
            1,

          overflowY:
            "auto",

          overflowX:
            "hidden",

          background:
            chatBackground,

          padding:
            "5px 0 8px",
        }}
      >
        {!twitchConnected &&
          !restoringSession &&
          !hasSavedTwitchSession && (
          <div
            style={{
              color:
                theme.subtle,

              textAlign:
                "center",

              marginTop:
                70,
            }}
          >
            Koble ChatNest til Twitch først.
          </div>
        )}

        {showChannelUi &&
          !activeTab && (
            <div
              onClick={() =>
                setShowAddChannel(
                  true
                )
              }
              style={{
                width:
                  285,

                maxWidth:
                  "80%",

                margin:
                  "75px auto 0",

                padding:
                  "28px 20px",

                color:
                  theme.muted,

                textAlign:
                  "center",

                border:
                  `1px solid ${theme.border}`,

                borderRadius:
                  8,

                background:
                  theme.panel,

                cursor:
                  "pointer",
              }}
            >
              <div
                style={{
                  fontSize:
                    28,

                  color:
                    "#bf94ff",
                }}
              >
                +
              </div>

              <strong
                style={{
                  color:
                    theme.text,
                }}
              >
                Legg til ny kanal
              </strong>
            </div>
          )}

        {activeTab && (
          <>
            {activeTab.status ===
              "live" &&
              activeTab.messages
                .length ===
                0 && (
                <div
                  style={{
                    color:
                      chatMutedColor,

                    fontSize:
                      12,

                    padding:
                      "10px 12px",
                  }}
                >
                  Venter på nye meldinger...
                </div>
              )}

            {activeTab.messages.map(
              (
                message
              ) => {
                if (
                  message.kind ===
                  "system"
                ) {
                  return (
                    <div
                      key={
                        message.id
                      }
                      style={{
                        minHeight:
                          24,

                        display:
                          "flex",

                        alignItems:
                          "center",

                        padding:
                          "1px 10px",

                        color:
                          chatMutedColor,

                        fontSize:
                          Math.max(
                            10,
                            chatFontSize -
                              1
                          ),

                        lineHeight:
                          `${Math.max(
                            20,
                            chatFontSize +
                              7
                          )}px`,
                      }}
                    >
                      <span
                        style={{
                          width:
                            42,

                          minWidth:
                            42,

                          color:
                            chatMutedColor,

                          fontSize:
                            11,
                        }}
                      >
                        {
                          message.time
                        }
                      </span>

                      <i>
                        {
                          message.text
                        }
                      </i>
                    </div>
                  );
                }

                const mentionedMe =
                  storedMessageMentionsMe(
                    message
                  );

                const customHighlighted =
                  storedMessageIsCustomHighlighted(
                    message
                  );

                const hovered =
                  hoveredMessageId ===
                  message.id;

                const background =
                  mentionedMe
                    ? chatBackgroundIsLight
                      ? hovered
                        ? "rgba(224,161,0,.16)"
                        : "rgba(224,161,0,.10)"
                      : hovered
                        ? "rgba(255,209,102,.105)"
                        : "rgba(255,209,102,.06)"
                    : customHighlighted
                      ? hovered
                        ? "rgba(145,71,255,.17)"
                        : "rgba(145,71,255,.095)"
                      : hovered
                        ? chatHoverBackground
                        : "transparent";

                const borderLeft =
                  mentionedMe
                    ? "2px solid rgba(255,209,102,.75)"
                    : customHighlighted
                      ? "2px solid rgba(169,112,255,.85)"
                      : "2px solid transparent";

                return (
                  <div
                    key={
                      message.id
                    }
                    onMouseEnter={() =>
                      setHoveredMessageId(
                        message.id
                      )
                    }
                    onMouseLeave={() =>
                      setHoveredMessageId(
                        ""
                      )
                    }
                    style={{
                      position:
                        "relative",

                      background,

                      borderLeft,

                      padding:
                        "1px 38px 1px 0",
                    }}
                  >
                    {message.reply && (
                      <div
                        style={{
                          marginLeft:
                            52,

                          padding:
                            "2px 8px 0",

                          color:
                            chatMutedColor,

                          fontSize:
                            Math.max(
                              10,
                              chatFontSize -
                                2
                            ),

                          lineHeight:
                            "17px",

                          whiteSpace:
                            "nowrap",

                          overflow:
                            "hidden",

                          textOverflow:
                            "ellipsis",
                        }}
                      >
                        ↳{" "}

                        <strong>
                          {
                            message.reply.parentUserName
                          }
                        </strong>

                        :{" "}

                        {
                          shortenText(
                            message.reply.parentMessageBody,
                            120
                          )
                        }
                      </div>
                    )}

                    <div
                      style={{
                        display:
                          "flex",

                        alignItems:
                          "flex-start",

                        flexWrap:
                          "wrap",

                        minHeight:
                          Math.max(
                            24,
                            chatFontSize +
                              11
                          ),

                        padding:
                          "1px 8px",

                        lineHeight:
                          `${Math.max(
                            22,
                            chatFontSize +
                              9
                          )}px`,
                      }}
                    >
                      <span
                        style={{
                          width:
                            42,

                          minWidth:
                            42,

                          color:
                            chatMutedColor,

                          fontSize:
                            11,
                        }}
                      >
                        {
                          message.time
                        }
                      </span>

                      <span
                        style={{
                          display:
                            "inline-flex",

                          alignItems:
                            "center",

                          gap:
                            2,

                          marginRight:
                            4,
                        }}
                      >
                        {message.badges.map(
                          (
                            badge,
                            index
                          ) =>
                            badge.imageUrl ? (
                              <img
                                key={`${badge.setId}-${badge.id}-${index}`}
                                src={
                                  badge.imageUrl
                                }
                                alt={
                                  badge.title
                                }
                                title={
                                  badge.title
                                }
                                style={{
                                  width:
                                    17,

                                  height:
                                    17,

                                  objectFit:
                                    "contain",
                                }}
                              />
                            ) : null
                        )}
                      </span>

                      <button
                        onClick={(
                          event
                        ) => {
                          event.stopPropagation();

                          void openUserCard(
                            message,
                            activeTab
                          );
                        }}
                        title={`Åpne ${message.username}`}
                        style={{
                          border:
                            "none",

                          background:
                            "transparent",

                          padding:
                            0,

                          margin:
                            "0 4px 0 0",

                          color:
                            message.color ||
                            "#b784ff",

                          fontSize:
                            chatFontSize,

                          fontWeight:
                            700,

                          lineHeight:
                            `${Math.max(
                              22,
                              chatFontSize +
                                9
                            )}px`,

                          cursor:
                            "pointer",

                          fontFamily:
                            "inherit",
                        }}
                      >
                        {
                          message.username
                        }
                        :
                      </button>

                      <span
                        style={{
                          display:
                            "inline-flex",

                          alignItems:
                            "center",

                          flexWrap:
                            "wrap",

                          color:
                            chatTextColor,

                          fontSize:
                            chatFontSize,

                          lineHeight:
                            `${Math.max(
                              22,
                              chatFontSize +
                                9
                            )}px`,

                          minWidth:
                            0,

                          wordBreak:
                            "break-word",
                        }}
                      >
                        {message.fragments.map(
                          renderFragment
                        )}
                      </span>
                    </div>

                    <button
                      onClick={(
                        event
                      ) => {
                        event.stopPropagation();

                        startReply(
                          message
                        );
                      }}
                      title={`Svar ${message.username}`}
                      style={{
                        position:
                          "absolute",

                        right:
                          7,

                        top:
                          message.reply
                            ? 10
                            : 3,

                        width:
                          27,

                        height:
                          24,

                        border:
                          "1px solid #343840",

                        borderRadius:
                          4,

                        background:
                          "#22252b",

                        color:
                          "#c7cbd2",

                        cursor:
                          "pointer",

                        fontSize:
                          15,

                        opacity:
                          hovered
                            ? 1
                            : 0,

                        pointerEvents:
                          hovered
                            ? "auto"
                            : "none",
                      }}
                    >
                      ↩
                    </button>
                  </div>
                );
              }
            )}

            <div
              ref={
                chatBottomRef
              }
            />
          </>
        )}
      </div>

      {/* REPLY */}
      {replyingTo &&
        activeTab && (
          <div
            style={{
              display:
                "flex",

              alignItems:
                "center",

              gap:
                8,

              padding:
                "6px 9px",

              background:
                theme.panel,

              borderTop:
                `1px solid ${theme.border}`,

              color:
                theme.muted,

              fontSize:
                12,
            }}
          >
            <span
              style={{
                color:
                  "#9147ff",
              }}
            >
              ↩
            </span>

            <span>
              Svarer
            </span>

            <strong>
              {
                replyingTo.username
              }
            </strong>

            <span
              style={{
                color:
                  "#7f858f",

                overflow:
                  "hidden",

                textOverflow:
                  "ellipsis",

                whiteSpace:
                  "nowrap",

                flex:
                  1,
              }}
            >
              {
                shortenText(
                  replyingTo.text,
                  120
                )
              }
            </span>

            <button
              onClick={() =>
                setReplyingTo(
                  null
                )
              }
              style={{
                border:
                  "none",

                background:
                  "transparent",

                color:
                  "#8f949d",

                cursor:
                  "pointer",
              }}
            >
              ×
            </button>
          </div>
        )}

      {/* INPUT */}
      <div
        style={{
          borderTop:
            replyingTo
              ? "none"
              : `1px solid ${theme.border}`,

          padding:
            "7px 8px",

          display:
            "flex",

          gap:
            6,

          background:
            theme.panel,

          flexShrink:
            0,
        }}
      >
        <input
          ref={
            chatInputRef
          }
          value={
            chatInput
          }
          onChange={(
            event
          ) =>
            setChatInput(
              event.target.value
            )
          }
          onKeyDown={(
            event
          ) => {
            if (
              event.key ===
                "Escape" &&
              replyingTo
            ) {
              setReplyingTo(
                null
              );
            } else if (
              event.key ===
              "Enter"
            ) {
              void sendTwitchMessage();
            }
          }}
          disabled={
            !activeTab ||
            activeTab.status !==
              "live" ||
            !connectionOnline
          }
          placeholder={
            activeTab
              ? replyingTo
                ? `Svar ${replyingTo.username}...`
                : `Skriv i #${activeTab.displayName}`
              : "Legg til en kanal først..."
          }
          style={{
            flex:
              1,

            minWidth:
              0,

            height:
              36,

            background:
              theme.input,

            border:
              replyingTo
                ? "1px solid #6e4aa4"
                : `1px solid ${theme.borderStrong}`,

            borderRadius:
              5,

            color:
              theme.text,

            padding:
              "0 10px",

            outline:
              "none",

            fontSize:
              13,
          }}
        />

        <button
          onClick={
            sendTwitchMessage
          }
          disabled={
            !activeTab ||
            activeTab.status !==
              "live" ||
            !connectionOnline ||
            !chatInput.trim() ||
            sendingMessage
          }
          style={{
            minWidth:
              66,

            height:
              36,

            background:
              activeTab
                ?.status ===
                "live" &&
              connectionOnline &&
              chatInput.trim()
                ? "#9147ff"
                : appearanceMode ===
                  "light"
                  ? "#dfe2e7"
                  : "#292c33",

            color:
              activeTab
                ?.status ===
                "live" &&
              connectionOnline &&
              chatInput.trim()
                ? "#fff"
                : theme.subtle,

            border:
              `1px solid ${theme.borderStrong}`,

            borderRadius:
              5,

            padding:
              "0 14px",

            fontWeight:
              700,
          }}
        >
          {sendingMessage
            ? "..."
            : replyingTo
              ? "Svar"
              : "Send"}
        </button>
      </div>

      {/* TAB CONTEXT MENU */}
      {tabContextMenu &&
        contextMenuTab && (
          <div
            onPointerDown={(
              event
            ) =>
              event.stopPropagation()
            }
            style={{
              position:
                "fixed",

              left:
                tabContextMenu.x,

              top:
                tabContextMenu.y,

              width:
                235,

              zIndex:
                20000,

              background:
                theme.panelRaised,

              border:
                `1px solid ${theme.borderStrong}`,

              borderRadius:
                6,

              padding:
                5,

              boxShadow:
                "0 14px 40px rgba(0,0,0,.62)",
            }}
          >
            <div
              style={{
                padding:
                  "7px 9px",

                color:
                  "#777d86",

                fontSize:
                  11,

                fontWeight:
                  700,

                borderBottom:
                  `1px solid ${theme.border}`,
              }}
            >
              {
                contextMenuTab.displayName
              }
            </div>

            <button
              onClick={() => {
                setTabContextMenu(
                  null
                );

                void openOnTwitch(
                  contextMenuTab.login
                );
              }}
              style={{
                ...smallButton,

                width:
                  "100%",

                border:
                  "none",

                background:
                  "transparent",

                textAlign:
                  "left",
              }}
            >
              ↗ Åpne på Twitch
            </button>

            <button
              onClick={() => {
                toggleMentionSound(
                  contextMenuTab.login
                );

                setTabContextMenu(
                  null
                );
              }}
              style={{
                ...smallButton,

                width:
                  "100%",

                border:
                  "none",

                background:
                  "transparent",

                textAlign:
                  "left",
              }}
            >
              {isMentionSoundMuted(
                contextMenuTab.login
              )
                ? "🔊 Slå på lyd ved tagging"
                : "🔇 Slå av lyd ved tagging"}
            </button>

            <button
              onClick={() =>
                void clearChannelHistory(
                  contextMenuTab
                )
              }
              style={{
                ...smallButton,

                width:
                  "100%",

                border:
                  "none",

                background:
                  "transparent",

                textAlign:
                  "left",
              }}
            >
              🗑 Tøm 24-timers chat
            </button>

            <button
              onClick={() =>
                removeChannel(
                  contextMenuTab.broadcasterId
                )
              }
              style={{
                ...smallButton,

                width:
                  "100%",

                border:
                  "none",

                borderTop:
                  `1px solid ${theme.border}`,

                borderRadius:
                  0,

                background:
                  "transparent",

                color:
                  "#ff827a",

                textAlign:
                  "left",
              }}
            >
              × Fjern kanal
            </button>
          </div>
        )}

      {/* SETTINGS */}
      {showSettings && (
        <div
          onClick={() =>
            setShowSettings(
              false
            )
          }
          style={{
            position:
              "fixed",

            inset:
              0,

            zIndex:
              31000,

            background:
              theme.modalBackdrop,

            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "center",

            padding:
              14,
          }}
        >
          <div
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
            style={{
              width:
                540,

              maxWidth:
                "calc(100vw - 28px)",

              maxHeight:
                "calc(100vh - 28px)",

              overflowY:
                "auto",

              background:
                theme.panelRaised,

              color:
                theme.text,

              border:
                `1px solid ${theme.borderStrong}`,

              borderRadius:
                8,

              boxShadow:
                theme.shadow,
            }}
          >
            <div
              style={{
                height:
                  48,

                padding:
                  "0 14px",

                display:
                  "flex",

                alignItems:
                  "center",

                borderBottom:
                  `1px solid ${theme.border}`,

                background:
                  theme.panel,
              }}
            >
              <strong
                style={{
                  fontSize:
                    16,
                }}
              >
                Settings
              </strong>

              <button
                onClick={() =>
                  setShowSettings(
                    false
                  )
                }
                style={{
                  marginLeft:
                    "auto",

                  border:
                    "none",

                  background:
                    "transparent",

                  color:
                    "#8f949d",

                  cursor:
                    "pointer",

                  fontSize:
                    20,
                }}
              >
                ×
              </button>
            </div>

            {/* APPEARANCE */}
            <div
              style={{
                padding:
                  14,

                borderBottom:
                  `1px solid ${theme.border}`,
              }}
            >
              <div
                style={{
                  fontSize:
                    12,

                  fontWeight:
                    800,

                  color:
                    theme.text,

                  marginBottom:
                    10,
                }}
              >
                Appearance
              </div>

              <div
                style={{
                  display:
                    "flex",

                  gap:
                    7,

                  marginBottom:
                    14,
                }}
              >
                {([
                  [
                    "dark",
                    "🌙 Dark mode",
                  ],

                  [
                    "light",
                    "☀ Light mode",
                  ],
                ] as const).map(
                  ([
                    mode,
                    label,
                  ]) => (
                    <button
                      key={
                        mode
                      }
                      onClick={() =>
                        setAndSaveAppearanceMode(
                          mode
                        )
                      }
                      style={{
                        ...smallButton,

                        flex:
                          1,

                        height:
                          36,

                        border:
                          appearanceMode ===
                          mode
                            ? "1px solid #9147ff"
                            : `1px solid ${theme.borderStrong}`,

                        background:
                          appearanceMode ===
                          mode
                            ? appearanceMode ===
                              "light"
                              ? "#eee7ff"
                              : "#302344"
                            : theme.input,

                        color:
                          theme.text,
                      }}
                    >
                      {
                        label
                      }
                    </button>
                  )
                )}
              </div>

              <div
                style={{
                  color:
                    theme.muted,

                  fontSize:
                    11,

                  marginBottom:
                    7,
                }}
              >
                Chat background
              </div>

              <div
                style={{
                  display:
                    "flex",

                  alignItems:
                    "center",

                  gap:
                    9,
                }}
              >
                <input
                  type="color"
                  value={
                    chatBackground
                  }
                  onChange={(
                    event
                  ) =>
                    setAndSaveChatBackground(
                      event.target.value
                    )
                  }
                  title="Velg chat-bakgrunn"
                  style={{
                    width:
                      54,

                    height:
                      38,

                    padding:
                      2,

                    border:
                      `1px solid ${theme.borderStrong}`,

                    borderRadius:
                      5,

                    background:
                      theme.input,

                    cursor:
                      "pointer",
                  }}
                />

                <input
                  value={
                    chatBackground
                  }
                  onChange={(
                    event
                  ) => {
                    const value =
                      event.target.value;

                    setChatBackground(
                      value
                    );

                    if (
                      /^#[0-9a-f]{6}$/i.test(
                        value
                      )
                    ) {
                      localStorage.setItem(
                        CHAT_BACKGROUND_KEY,
                        value
                      );
                    }
                  }}
                  onBlur={() => {
                    if (
                      !/^#[0-9a-f]{6}$/i.test(
                        chatBackground
                      )
                    ) {
                      setAndSaveChatBackground(
                        defaultChatBackground(
                          appearanceMode
                        )
                      );
                    }
                  }}
                  maxLength={
                    7
                  }
                  spellCheck={
                    false
                  }
                  style={{
                    width:
                      96,

                    height:
                      34,

                    boxSizing:
                      "border-box",

                    background:
                      theme.input,

                    color:
                      theme.text,

                    border:
                      `1px solid ${theme.borderStrong}`,

                    borderRadius:
                      5,

                    padding:
                      "0 9px",

                    outline:
                      "none",

                    fontFamily:
                      "monospace",
                  }}
                />

                <button
                  onClick={() =>
                    setAndSaveChatBackground(
                      defaultChatBackground(
                        appearanceMode
                      )
                    )
                  }
                  style={{
                    ...smallButton,

                    background:
                      theme.input,

                    color:
                      theme.text,

                    border:
                      `1px solid ${theme.borderStrong}`,
                  }}
                >
                  Standard
                </button>
              </div>

              <div
                style={{
                  display:
                    "flex",

                  flexWrap:
                    "wrap",

                  gap:
                    7,

                  marginTop:
                    10,
                }}
              >
                {[
                  "#101115",
                  "#17131f",
                  "#101722",
                  "#10201b",
                  "#201515",
                  "#251f12",
                  "#ffffff",
                  "#f2f4f7",
                  "#fff6e8",
                  "#eef8ff",
                  "#f4efff",
                  "#eef9f2",
                ].map(
                  (
                    color
                  ) => (
                    <button
                      key={
                        color
                      }
                      onClick={() =>
                        setAndSaveChatBackground(
                          color
                        )
                      }
                      title={
                        color
                      }
                      style={{
                        width:
                          28,

                        height:
                          28,

                        padding:
                          0,

                        border:
                          chatBackground.toLowerCase() ===
                          color.toLowerCase()
                            ? "2px solid #9147ff"
                            : `1px solid ${theme.borderStrong}`,

                        borderRadius:
                          5,

                        background:
                          color,

                        cursor:
                          "pointer",
                      }}
                    />
                  )
                )}
              </div>
            </div>

            {/* CHAT SETTINGS */}
            <div
              style={{
                padding:
                  14,

                borderBottom:
                  `1px solid ${theme.border}`,
              }}
            >
              <div
                style={{
                  fontSize:
                    12,

                  fontWeight:
                    800,

                  color:
                    theme.text,

                  marginBottom:
                    10,
                }}
              >
                Chat
              </div>

              <div
                style={{
                  display:
                    "flex",

                  alignItems:
                    "center",

                  gap:
                    12,
                }}
              >
                <span
                  style={{
                    width:
                      78,

                    color:
                      theme.muted,

                    fontSize:
                      12,
                  }}
                >
                  Font size
                </span>

                <input
                  type="range"
                  min={
                    10
                  }
                  max={
                    24
                  }
                  step={
                    1
                  }
                  value={
                    chatFontSize
                  }
                  onChange={(
                    event
                  ) =>
                    setAndSaveFontSize(
                      Number(
                        event.target.value
                      )
                    )
                  }
                  style={{
                    flex:
                      1,
                  }}
                />

                <strong
                  style={{
                    width:
                      42,

                    textAlign:
                      "right",

                    color:
                      "#bf94ff",
                  }}
                >
                  {
                    chatFontSize
                  }
                  px
                </strong>
              </div>

              <div
                style={{
                  marginTop:
                    10,

                  padding:
                    "8px 10px",

                  background:
                    chatBackground,

                  border:
                    `1px solid ${theme.border}`,

                  borderRadius:
                    5,

                  color:
                    chatTextColor,

                  fontSize:
                    chatFontSize,

                  lineHeight:
                    `${Math.max(
                      22,
                      chatFontSize +
                        9
                    )}px`,
                }}
              >
                Preview: Slik vil chat-teksten se ut.
              </div>
            </div>

            {/* HIGHLIGHT SETTINGS */}
            <div
              style={{
                padding:
                  14,

                borderBottom:
                  `1px solid ${theme.border}`,
              }}
            >
              <div
                style={{
                  fontSize:
                    12,

                  fontWeight:
                    800,

                  color:
                    theme.text,

                  marginBottom:
                    4,
                }}
              >
                Highlights
              </div>

              <div
                style={{
                  color:
                    theme.muted,

                  fontSize:
                    11,

                  marginBottom:
                    10,
                }}
              >
                Meldinger fra disse Twitch-brukerne får egen highlight i chatten.
              </div>

              <div
                style={{
                  display:
                    "flex",

                  gap:
                    6,
                }}
              >
                <input
                  value={
                    highlightInput
                  }
                  onChange={(
                    event
                  ) => {
                    setHighlightInput(
                      event.target.value
                    );

                    setHighlightError(
                      ""
                    );
                  }}
                  onKeyDown={(
                    event
                  ) => {
                    if (
                      event.key ===
                      "Enter"
                    ) {
                      void addHighlightUserFromSettings();
                    }
                  }}
                  placeholder="Twitch-navn..."
                  style={{
                    flex:
                      1,

                    minWidth:
                      0,

                    height:
                      34,

                    boxSizing:
                      "border-box",

                    background:
                      theme.input,

                    color:
                      theme.text,

                    border:
                      `1px solid ${theme.borderStrong}`,

                    borderRadius:
                      5,

                    padding:
                      "0 9px",

                    outline:
                      "none",
                  }}
                />

                <button
                  onClick={() =>
                    void addHighlightUserFromSettings()
                  }
                  disabled={
                    addingHighlight
                  }
                  style={{
                    ...smallButton,

                    background:
                      "#9147ff",

                    color:
                      "white",

                    fontWeight:
                      700,
                  }}
                >
                  {addingHighlight
                    ? "..."
                    : "Legg til"}
                </button>
              </div>

              {highlightError && (
                <div
                  style={{
                    color:
                      "#ff8d86",

                    fontSize:
                      11,

                    marginTop:
                      7,
                  }}
                >
                  {
                    highlightError
                  }
                </div>
              )}

              <div
                style={{
                  marginTop:
                    10,

                  display:
                    "grid",

                  gap:
                    5,
                }}
              >
                {highlightUsers.length ===
                0 ? (
                  <div
                    style={{
                      color:
                        theme.subtle,

                      fontSize:
                        11,

                      padding:
                        "6px 0",
                    }}
                  >
                    Ingen brukere på highlight-lista ennå.
                  </div>
                ) : (
                  highlightUsers.map(
                    (
                      user
                    ) => (
                      <div
                        key={
                          user.userId ||
                          user.login
                        }
                        style={{
                          display:
                            "flex",

                          alignItems:
                            "center",

                          gap:
                            8,

                          padding:
                            "7px 8px",

                          background:
                            theme.panel,

                          border:
                            `1px solid ${theme.border}`,

                          borderRadius:
                            5,
                        }}
                      >
                        <span
                          style={{
                            width:
                              8,

                            height:
                              8,

                            borderRadius:
                              "50%",

                            background:
                              "#a970ff",

                            boxShadow:
                              "0 0 6px rgba(169,112,255,.65)",
                          }}
                        />

                        <div
                          style={{
                            flex:
                              1,

                            minWidth:
                              0,
                          }}
                        >
                          <strong
                            style={{
                              fontSize:
                                12,
                            }}
                          >
                            {
                              user.displayName
                            }
                          </strong>

                          <div
                            style={{
                              color:
                                theme.subtle,

                              fontSize:
                                10,
                            }}
                          >
                            @
                            {
                              user.login
                            }
                          </div>
                        </div>

                        <button
                          onClick={() =>
                            saveHighlightUsers(
                              highlightUsersRef.current
                                .filter(
                                  (
                                    item
                                  ) =>
                                    !(
                                      item.userId ===
                                        user.userId &&
                                      item.login ===
                                        user.login
                                    )
                                )
                            )
                          }
                          style={{
                            ...smallButton,

                            color:
                              "#ff827a",
                          }}
                        >
                          Fjern
                        </button>
                      </div>
                    )
                  )
                )}
              </div>
            </div>

            {/* TWITCH ACCOUNT */}
            <div
              style={{
                padding:
                  14,

                borderBottom:
                  `1px solid ${theme.border}`,
              }}
            >
              <div
                style={{
                  fontSize:
                    12,

                  fontWeight:
                    800,

                  color:
                    theme.text,

                  marginBottom:
                    10,
                }}
              >
                Twitch
              </div>

              <div
                style={{
                  display:
                    "flex",

                  alignItems:
                    "center",

                  gap:
                    10,
                }}
              >
                {twitchProfileImage && (
                  <img
                    src={
                      twitchProfileImage
                    }
                    alt=""
                    style={{
                      width:
                        38,

                      height:
                        38,

                      borderRadius:
                        "50%",
                    }}
                  />
                )}

                <div>
                  <strong
                    style={{
                      fontSize:
                        12,
                    }}
                  >
                    {
                      twitchUserName
                    }
                  </strong>

                  <div
                    style={{
                      color:
                        theme.subtle,

                      fontSize:
                        10,

                      marginTop:
                        2,
                    }}
                  >
                    @
                    {
                      twitchUserLoginRef.current
                    }
                  </div>
                </div>

                <button
                  onClick={() =>
                    void openOnTwitch(
                      twitchUserLoginRef.current
                    )
                  }
                  style={{
                    ...smallButton,

                    marginLeft:
                      "auto",
                  }}
                >
                  My Twitch Account ↗
                </button>
              </div>
            </div>

            {/* LOGOUT */}
            <div
              style={{
                padding:
                  14,
              }}
            >
              <button
                onClick={() =>
                  void disconnectTwitch()
                }
                style={{
                  width:
                    "100%",

                  height:
                    38,

                  border:
                    "1px solid #6c3438",

                  borderRadius:
                    5,

                  background:
                    "#2a1719",

                  color:
                    "#ff8e88",

                  cursor:
                    "pointer",

                  fontWeight:
                    700,

                  fontFamily:
                    "inherit",
                }}
              >
                Logg ut av Twitch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* USERCARD */}
      {userCard && (
        <div
          onPointerDown={(
            event
          ) =>
            event.stopPropagation()
          }
          onClick={() =>
            setUserCard(
              null
            )
          }
          style={{
            position:
              "fixed",

            inset:
              0,

            zIndex:
              30000,

            background:
              theme.modalBackdrop,

            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "center",

            padding:
              14,
          }}
        >
          <div
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
            style={{
              width:
                490,

              maxWidth:
                "calc(100vw - 28px)",

              maxHeight:
                "calc(100vh - 28px)",

              display:
                "flex",

              flexDirection:
                "column",

              background:
                theme.panelRaised,

              color:
                theme.text,

              border:
                `1px solid ${theme.borderStrong}`,

              borderRadius:
                5,

              overflow:
                "hidden",

              boxShadow:
                theme.shadow,
            }}
          >
            <div
              style={{
                display:
                  "flex",

                gap:
                  12,

                padding:
                  10,

                borderBottom:
                  `1px solid ${theme.border}`,

                background:
                  theme.panel,
              }}
            >
              <div
                style={{
                  width:
                    88,

                  height:
                    88,

                  flexShrink:
                    0,

                  background:
                    theme.appBg,

                  border:
                    `1px solid ${theme.border}`,

                  overflow:
                    "hidden",
                }}
              >
                {userCard.profileImageUrl ? (
                  <img
                    src={
                      userCard.profileImageUrl
                    }
                    alt=""
                    style={{
                      width:
                        "100%",

                      height:
                        "100%",

                      objectFit:
                        "cover",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      height:
                        "100%",

                      display:
                        "grid",

                      placeItems:
                        "center",

                      color:
                        "#555b65",

                      fontSize:
                        28,
                    }}
                  >
                    ?
                  </div>
                )}
              </div>

              <div
                style={{
                  flex:
                    1,

                  minWidth:
                    0,
                }}
              >
                <div
                  style={{
                    display:
                      "flex",

                    alignItems:
                      "center",

                    gap:
                      6,
                  }}
                >
                  <strong
                    style={{
                      color:
                        theme.text,

                      fontSize:
                        14,
                    }}
                  >
                    {
                      userCard.username
                    }
                  </strong>

                  {userCard.roles.broadcaster && (
                    <span
                      style={{
                        fontSize:
                          9,

                        padding:
                          "2px 4px",

                        background:
                          "#9147ff",

                        borderRadius:
                          3,
                      }}
                    >
                      BROADCASTER
                    </span>
                  )}

                  {userCard.roles.moderator && (
                    <span
                      style={{
                        fontSize:
                          9,

                        padding:
                          "2px 4px",

                        background:
                          "#00a3a3",

                        borderRadius:
                          3,
                      }}
                    >
                      MOD
                    </span>
                  )}

                  {userCard.roles.vip && (
                    <span
                      style={{
                        fontSize:
                          9,

                        padding:
                          "2px 4px",

                        background:
                          "#c33bc3",

                        borderRadius:
                          3,
                      }}
                    >
                      VIP
                    </span>
                  )}

                  <button
                    onClick={() =>
                      setUserCard(
                        null
                      )
                    }
                    style={{
                      marginLeft:
                        "auto",

                      border:
                        "none",

                      background:
                        "transparent",

                      color:
                        "#9ba0a8",

                      fontSize:
                        19,

                      cursor:
                        "pointer",
                    }}
                  >
                    ×
                  </button>
                </div>

                <div
                  style={{
                    marginTop:
                      7,

                    color:
                      theme.text,

                    fontSize:
                      11,

                    lineHeight:
                      "20px",
                  }}
                >
                  <div>
                    ID:{" "}

                    <span
                      style={{
                        color:
                          "#969ca5",
                      }}
                    >
                      {
                        userCard.userId ||
                        "..."
                      }
                    </span>
                  </div>

                  <div>
                    Followers:{" "}

                    <strong>
                      {
                        userCard.followerCount ??
                        "–"
                      }
                    </strong>
                  </div>

                  <div>
                    Created:{" "}

                    <strong>
                      {
                        dateOnly(
                          userCard.createdAt
                        )
                      }
                    </strong>
                  </div>

                  <div>
                    {userCard.canModerate ? (
                      userCard.followedAt ? (
                        <>
                          ♥ Following since{" "}

                          <strong>
                            {
                              dateOnly(
                                userCard.followedAt
                              )
                            }
                          </strong>
                        </>
                      ) : (
                        <>
                          ♡ Follows ikke #
                          {
                            userCard.channelDisplayName
                          }
                        </>
                      )
                    ) : (
                      <span
                        style={{
                          color:
                            "#777d86",
                        }}
                      >
                        Follow-status krever mod-tilgang
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* USERCARD ACTIONS */}
            <div
              style={{
                display:
                  "flex",

                alignItems:
                  "center",

                gap:
                  6,

                flexWrap:
                  "wrap",

                padding:
                  "7px 9px",

                borderBottom:
                  `1px solid ${theme.border}`,

                background:
                  theme.panel,
              }}
            >
              <button
                disabled={
                  userCardActionBusy ||
                  !userCard.userId ||
                  userCard.userId ===
                    twitchUserIdRef.current
                }
                onClick={() =>
                  void toggleBlockUser()
                }
                style={{
                  ...smallButton,

                  background:
                    userCard.blocked
                      ? "#392227"
                      : "#222429",

                  color:
                    userCard.blocked
                      ? "#ff9690"
                      : "#e1e2e4",
                }}
              >
                {userCard.blocked
                  ? "Unblock"
                  : "Block"}
              </button>

              <button
                onClick={() =>
                  toggleIgnoreHighlights(
                    userCard.userId
                  )
                }
                disabled={
                  !userCard.userId
                }
                style={{
                  ...smallButton,

                  background:
                    ignoredHighlightUsers.includes(
                      userCard.userId
                    )
                      ? "#34301d"
                      : "#222429",

                  color:
                    ignoredHighlightUsers.includes(
                      userCard.userId
                    )
                      ? "#ffe08a"
                      : "#e1e2e4",
                }}
              >
                {ignoredHighlightUsers.includes(
                  userCard.userId
                )
                  ? "Highlights ignored"
                  : "Ignore highlights"}
              </button>

              <button
                onClick={() =>
                  toggleUserHighlight(
                    userCard.userId,
                    userCard.userLogin,
                    userCard.username
                  )
                }
                disabled={
                  !userCard.userId
                }
                style={{
                  ...smallButton,

                  background:
                    isHighlightedUser(
                      userCard.userId,
                      userCard.userLogin
                    )
                      ? "#35245a"
                      : "#222429",

                  color:
                    isHighlightedUser(
                      userCard.userId,
                      userCard.userLogin
                    )
                      ? "#d8c2ff"
                      : "#e1e2e4",
                }}
              >
                {isHighlightedUser(
                  userCard.userId,
                  userCard.userLogin
                )
                  ? "Remove highlight"
                  : "Highlight user"}
              </button>

              <button
                onClick={() => {
                  setNoteDraft(
                    userNotes[
                      userCard.userId
                    ] ||
                      ""
                  );

                  setShowNoteEditor(
                    !showNoteEditor
                  );
                }}
                style={
                  smallButton
                }
              >
                {userNotes[
                  userCard.userId
                ]
                  ? "Edit notes"
                  : "Add notes"}
              </button>

              <button
                onClick={() =>
                  void openOnTwitch(
                    userCard.userLogin
                  )
                }
                style={
                  smallButton
                }
              >
                Twitch ↗
              </button>
            </div>

            {showNoteEditor && (
              <div
                style={{
                  padding:
                    9,

                  borderBottom:
                    `1px solid ${theme.border}`,

                  background:
                    theme.panel,
                }}
              >
                <textarea
                  autoFocus
                  value={
                    noteDraft
                  }
                  onChange={(
                    event
                  ) =>
                    setNoteDraft(
                      event.target.value
                    )
                  }
                  placeholder={`Notat om ${userCard.username}...`}
                  style={{
                    width:
                      "100%",

                    height:
                      65,

                    boxSizing:
                      "border-box",

                    resize:
                      "vertical",

                    background:
                      theme.input,

                    color:
                      theme.text,

                    border:
                      `1px solid ${theme.borderStrong}`,

                    borderRadius:
                      4,

                    padding:
                      8,

                    outline:
                      "none",

                    fontFamily:
                      "inherit",

                    fontSize:
                      12,
                  }}
                />

                <div
                  style={{
                    display:
                      "flex",

                    justifyContent:
                      "flex-end",

                    gap:
                      6,

                    marginTop:
                      6,
                  }}
                >
                  <button
                    onClick={() =>
                      setShowNoteEditor(
                        false
                      )
                    }
                    style={
                      smallButton
                    }
                  >
                    Avbryt
                  </button>

                  <button
                    onClick={() =>
                      saveUserNote(
                        userCard.userId,
                        noteDraft
                      )
                    }
                    style={{
                      ...smallButton,

                      background:
                        "#9147ff",

                      color:
                        "white",

                      fontWeight:
                        700,
                    }}
                  >
                    Lagre
                  </button>
                </div>
              </div>
            )}

            {userNotes[
              userCard.userId
            ] &&
              !showNoteEditor && (
                <div
                  style={{
                    padding:
                      "6px 9px",

                    borderBottom:
                      `1px solid ${theme.border}`,

                    color:
                      theme.muted,

                    fontSize:
                      11,

                    background:
                      theme.panel,
                  }}
                >
                  📝{" "}

                  {
                    userNotes[
                      userCard.userId
                    ]
                  }
                </div>
              )}

            {/* MODERATION */}
            {userCard.canModerate && (
              <div
                style={{
                  padding:
                    "8px 8px 9px",

                  borderBottom:
                    `1px solid ${theme.border}`,

                  background:
                    theme.panel,
                }}
              >
                {moderationUnavailable && (
                  <div
                    style={{
                      marginBottom:
                        7,

                      padding:
                        "6px 8px",

                      background:
                        "#2a2320",

                      border:
                        "1px solid #544036",

                      color:
                        "#e8c0aa",

                      fontSize:
                        11,
                    }}
                  >
                    {
                      moderationUnavailable
                    }
                  </div>
                )}

                <div
                  style={{
                    display:
                      "grid",

                    gridTemplateColumns:
                      "48px 1fr 48px",

                    gap:
                      5,

                    alignItems:
                      "end",
                  }}
                >
                  <div>
                    <div
                      style={{
                        textAlign:
                          "center",

                        color:
                          theme.muted,

                        fontSize:
                          10,

                        marginBottom:
                          3,
                      }}
                    >
                      Unban
                    </div>

                    <button
                      disabled={
                        !userCardCanAct ||
                        userCardActionBusy
                      }
                      onClick={() =>
                        void unbanUser()
                      }
                      style={{
                        width:
                          "100%",

                        height:
                          32,

                        border:
                          "1px solid #40503b",

                        background:
                          "#192018",

                        color:
                          userCardCanAct
                            ? "#75db5d"
                            : "#666",

                        cursor:
                          userCardCanAct
                            ? "pointer"
                            : "default",
                      }}
                    >
                      ⊘
                    </button>
                  </div>

                  <div>
                    <div
                      style={{
                        textAlign:
                          "center",

                        color:
                          theme.muted,

                        fontSize:
                          10,

                        marginBottom:
                          3,
                      }}
                    >
                      Timeouts
                    </div>

                    <div
                      style={{
                        display:
                          "grid",

                        gridTemplateColumns:
                          "repeat(8, 1fr)",

                        gap:
                          2,
                      }}
                    >
                      {[
                        [
                          1,
                          "1s",
                        ],

                        [
                          30,
                          "30s",
                        ],

                        [
                          60,
                          "1m",
                        ],

                        [
                          300,
                          "5m",
                        ],

                        [
                          1800,
                          "30m",
                        ],

                        [
                          3600,
                          "1h",
                        ],

                        [
                          86400,
                          "1d",
                        ],

                        [
                          604800,
                          "1w",
                        ],
                      ].map(
                        (
                          [
                            seconds,
                            label,
                          ]
                        ) => (
                          <button
                            key={
                              String(
                                seconds
                              )
                            }
                            disabled={
                              !userCardCanAct ||
                              userCardActionBusy
                            }
                            onClick={() =>
                              void timeoutUser(
                                Number(
                                  seconds
                                )
                              )
                            }
                            style={{
                              height:
                                32,

                              border:
                                "1px solid #454951",

                              background:
                                "#1b1d20",

                              color:
                                userCardCanAct
                                  ? "#e5e7ea"
                                  : "#666",

                              cursor:
                                userCardCanAct
                                  ? "pointer"
                                  : "default",

                              fontSize:
                                10,

                              padding:
                                0,
                            }}
                          >
                            {
                              label
                            }
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        textAlign:
                          "center",

                        color:
                          theme.muted,

                        fontSize:
                          10,

                        marginBottom:
                          3,
                      }}
                    >
                      Ban
                    </div>

                    <button
                      disabled={
                        !userCardCanAct ||
                        userCardActionBusy
                      }
                      onClick={() =>
                        void banUser()
                      }
                      style={{
                        width:
                          "100%",

                        height:
                          32,

                        border:
                          "1px solid #5a4044",

                        background:
                          "#241a1c",

                        color:
                          userCardCanAct
                            ? "#ff8078"
                            : "#666",

                        cursor:
                          userCardCanAct
                            ? "pointer"
                            : "default",
                      }}
                    >
                      ⊘
                    </button>
                  </div>
                </div>

                <input
                  value={
                    modReason
                  }
                  onChange={(
                    event
                  ) =>
                    setModReason(
                      event.target.value
                    )
                  }
                  maxLength={
                    500
                  }
                  placeholder="Mod-grunn (valgfritt)"
                  style={{
                    width:
                      "100%",

                    height:
                      29,

                    boxSizing:
                      "border-box",

                    marginTop:
                      6,

                    background:
                      theme.input,

                    color:
                      theme.text,

                    border:
                      `1px solid ${theme.borderStrong}`,

                    borderRadius:
                      3,

                    padding:
                      "0 8px",

                    outline:
                      "none",

                    fontSize:
                      11,
                  }}
                />
              </div>
            )}

            {(userCardLoading ||
              userCardError ||
              userCardActionStatus) && (
              <div
                style={{
                  padding:
                    "7px 9px",

                  borderBottom:
                    `1px solid ${theme.border}`,

                  color:
                    userCardError
                      ? "#ff8d86"
                      : userCardActionStatus.startsWith(
                            "✓"
                          )
                        ? "#8ee39a"
                        : "#d7b68a",

                  fontSize:
                    11,

                  background:
                    theme.panel,

                  wordBreak:
                    "break-word",
                }}
              >
                {userCardLoading
                  ? "Laster Twitch-bruker..."
                  : userCardError ||
                    userCardActionStatus}
              </div>
            )}

            <div
              style={{
                padding:
                  "6px 9px",

                borderBottom:
                  `1px solid ${theme.border}`,

                color:
                  theme.muted,

                fontSize:
                  10,

                background:
                  theme.panel,
              }}
            >
              Meldinger i #
              {
                userCard.channelDisplayName
              }{" "}
              – siste 24 timer (
              {
                userCardMessages.length
              }
              )
            </div>

            <div
              style={{
                flex:
                  1,

                minHeight:
                  170,

                maxHeight:
                  320,

                overflowY:
                  "auto",

                background:
                  theme.panelRaised,

                padding:
                  "2px 0",
              }}
            >
              {userCardMessages.length ===
              0 ? (
                <div
                  style={{
                    padding:
                      16,

                    color:
                      "#676d77",

                    fontSize:
                      12,
                  }}
                >
                  Ingen lagrede meldinger fra denne brukeren ennå.
                </div>
              ) : (
                userCardMessages.map(
                  (
                    message
                  ) => (
                    <div
                      key={`card-${message.id}`}
                      style={{
                        display:
                          "flex",

                        gap:
                          7,

                        alignItems:
                          "flex-start",

                        padding:
                          "4px 7px",

                        borderBottom:
                          "1px solid rgba(255,255,255,.025)",
                      }}
                    >
                      <span
                        style={{
                          width:
                            38,

                          minWidth:
                            38,

                          color:
                            theme.subtle,

                          fontSize:
                            10,
                        }}
                      >
                        {
                          message.time
                        }
                      </span>

                      <div
                        style={{
                          flex:
                            1,

                          minWidth:
                            0,

                          color:
                            theme.text,

                          fontSize:
                            Math.max(
                              11,
                              chatFontSize -
                                1
                            ),

                          lineHeight:
                            `${Math.max(
                              18,
                              chatFontSize +
                                5
                            )}px`,

                          wordBreak:
                            "break-word",
                        }}
                      >
                        <strong
                          style={{
                            color:
                              message.color ||
                              "#b784ff",
                          }}
                        >
                          {
                            message.username
                          }
                          :
                        </strong>{" "}

                        {
                          message.text
                        }
                      </div>

                      {userCard.canModerate &&
                        Date.now() -
                          message.timestampMs <=
                          6 *
                            60 *
                            60 *
                            1000 && (
                          <button
                            disabled={
                              userCardActionBusy
                            }
                            onClick={() =>
                              void deleteChatMessage(
                                message
                              )
                            }
                            title="Slett meldingen på Twitch"
                            style={{
                              border:
                                "none",

                              background:
                                "transparent",

                              color:
                                theme.subtle,

                              cursor:
                                "pointer",

                              padding:
                                "0 3px",

                              fontSize:
                                12,
                            }}
                          >
                            🗑
                          </button>
                        )}
                    </div>
                  )
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;