export type LocalUserPlatform = "twitch" | "kick" | "youtube";

export type LocalNickname = {
  platform: LocalUserPlatform;
  userId: string;
  userLogin: string;
  nickname: string;
  updatedAt: number;
};

export type LocalIgnore = {
  platform: LocalUserPlatform;
  userId: string;
  userLogin: string;
  displayName: string;
  createdAt: number;
  expiresAt: number | null;
  untilStreamEnds: boolean;
  channelId: string;
};

export type IgnoreDuration = "10m" | "1h" | "stream" | "permanent";

export function localUserKey(
  platform: LocalUserPlatform,
  userId: string,
  userLogin: string
) {
  const identity = userId.trim() || userLogin.trim().toLowerCase();
  return `${platform}:${identity}`;
}

export function normalizeNicknames(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, LocalNickname>;
  }

  const result: Record<string, LocalNickname> = {};

  for (const entry of Object.values(value)) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const candidate = entry as Partial<LocalNickname>;
    if (
      (candidate.platform !== "twitch" &&
        candidate.platform !== "kick" &&
        candidate.platform !== "youtube") ||
      typeof candidate.userId !== "string" ||
      typeof candidate.userLogin !== "string" ||
      typeof candidate.nickname !== "string" ||
      !candidate.nickname.trim()
    ) {
      continue;
    }

    const normalized: LocalNickname = {
      platform: candidate.platform,
      userId: candidate.userId,
      userLogin: candidate.userLogin,
      nickname: candidate.nickname.trim().slice(0, 40),
      updatedAt:
        typeof candidate.updatedAt === "number"
          ? candidate.updatedAt
          : Date.now(),
    };
    result[
      localUserKey(
        normalized.platform,
        normalized.userId,
        normalized.userLogin
      )
    ] = normalized;
  }

  return result;
}

export function normalizeIgnores(value: unknown, now = Date.now()) {
  if (!Array.isArray(value)) {
    return [] as LocalIgnore[];
  }

  return value.filter((entry): entry is LocalIgnore => {
    if (!entry || typeof entry !== "object") {
      return false;
    }

    const candidate = entry as Partial<LocalIgnore>;
    const validPlatform =
      candidate.platform === "twitch" ||
      candidate.platform === "kick" ||
      candidate.platform === "youtube";
    const active =
      candidate.expiresAt === null ||
      (typeof candidate.expiresAt === "number" && candidate.expiresAt > now);

    return Boolean(
      validPlatform &&
        typeof candidate.userId === "string" &&
        typeof candidate.userLogin === "string" &&
        typeof candidate.displayName === "string" &&
        typeof candidate.createdAt === "number" &&
        typeof candidate.untilStreamEnds === "boolean" &&
        typeof candidate.channelId === "string" &&
        active
    );
  });
}

export function createLocalIgnore(input: {
  platform: LocalUserPlatform;
  userId: string;
  userLogin: string;
  displayName: string;
  channelId: string;
  duration: IgnoreDuration;
  now?: number;
}): LocalIgnore {
  const now = input.now ?? Date.now();
  const durationMs =
    input.duration === "10m"
      ? 10 * 60 * 1000
      : input.duration === "1h"
        ? 60 * 60 * 1000
        : null;

  return {
    platform: input.platform,
    userId: input.userId,
    userLogin: input.userLogin,
    displayName: input.displayName,
    createdAt: now,
    expiresAt: durationMs === null ? null : now + durationMs,
    untilStreamEnds: input.duration === "stream",
    channelId: input.channelId,
  };
}

export function isUserLocallyIgnored(
  ignores: LocalIgnore[],
  platform: LocalUserPlatform,
  userId: string,
  userLogin: string,
  now = Date.now()
) {
  const key = localUserKey(platform, userId, userLogin);
  return ignores.some(
    (entry) =>
      localUserKey(entry.platform, entry.userId, entry.userLogin) === key &&
      (entry.expiresAt === null || entry.expiresAt > now)
  );
}

