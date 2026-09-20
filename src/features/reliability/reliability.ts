export type ConnectionHealthState =
  | "connected"
  | "connecting"
  | "reconnecting"
  | "sign-in"
  | "disconnected"
  | "unavailable"
  | "not-connected"
  | "offline";

export type PlatformConnectionHealth = {
  id: "twitch" | "kick" | "youtube";
  label: string;
  state: ConnectionHealthState;
  detail: string;
};

export type DiagnosticStatus =
  | "checking"
  | "ok"
  | "warning"
  | "error"
  | "off";

export type DiagnosticResult = {
  id:
    | "twitch"
    | "kick"
    | "youtube"
    | "7tv"
    | "bttv"
    | "storage"
    | "obs";
  label: string;
  status: DiagnosticStatus;
  summary: string;
  details?: string;
};

const SESSION_KEY = "fyflate.reliability.session.v1";
const PAGE_SESSION_KEY = "fyflate.reliability.pageSession.v1";

type StoredSession = {
  id: string;
  startedAt: number;
  heartbeatAt: number;
  cleanExit: boolean;
};

export type ReliabilitySession = {
  id: string;
  previousUncleanExit: boolean;
};

function readStoredSession(): StoredSession | null {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(SESSION_KEY) || "null"
    );

    if (
      !value ||
      typeof value !== "object" ||
      typeof (value as StoredSession).id !== "string" ||
      typeof (value as StoredSession).startedAt !== "number" ||
      typeof (value as StoredSession).heartbeatAt !== "number" ||
      typeof (value as StoredSession).cleanExit !== "boolean"
    ) {
      return null;
    }

    return value as StoredSession;
  } catch {
    return null;
  }
}

function sessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `fyflate-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function writeSession(value: StoredSession) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(value));
  } catch {
    // If storage is unavailable, recovery detection is simply disabled.
  }
}

export function beginReliabilitySession(): ReliabilitySession {
  const previous = readStoredSession();
  let existingPageSession = "";

  try {
    existingPageSession = sessionStorage.getItem(PAGE_SESSION_KEY) || "";
  } catch {
    // Continue with a fresh page session.
  }

  const samePageSession = Boolean(
    previous && existingPageSession && previous.id === existingPageSession
  );
  const id = samePageSession ? existingPageSession : sessionId();
  const now = Date.now();

  try {
    sessionStorage.setItem(PAGE_SESSION_KEY, id);
  } catch {
    // The local marker still works when sessionStorage is unavailable.
  }

  writeSession({
    id,
    startedAt: samePageSession && previous ? previous.startedAt : now,
    heartbeatAt: now,
    cleanExit: false,
  });

  return {
    id,
    previousUncleanExit: Boolean(
      previous && !previous.cleanExit && !samePageSession
    ),
  };
}

export function markReliabilitySessionActive(id: string) {
  const previous = readStoredSession();
  const now = Date.now();

  writeSession({
    id,
    startedAt: previous?.id === id ? previous.startedAt : now,
    heartbeatAt: now,
    cleanExit: false,
  });
}

export function markReliabilitySessionClean(id: string) {
  const previous = readStoredSession();

  if (!previous || previous.id !== id) {
    return;
  }

  writeSession({
    ...previous,
    heartbeatAt: Date.now(),
    cleanExit: true,
  });
}

export function connectionHealthColor(state: ConnectionHealthState) {
  if (state === "connected") {
    return "#57c76f";
  }

  if (state === "connecting" || state === "reconnecting") {
    return "#e4bd55";
  }

  if (state === "sign-in" || state === "offline" || state === "unavailable") {
    return "#ff827a";
  }

  return "#858a94";
}

export function overallConnectionHealth(
  items: PlatformConnectionHealth[]
) {
  const active = items.filter((item) => item.state !== "not-connected");

  if (active.some((item) => item.state === "offline")) {
    return "offline" as const;
  }

  if (active.some((item) => item.state === "sign-in")) {
    return "sign-in" as const;
  }

  if (active.some((item) => item.state === "unavailable")) {
    return "unavailable" as const;
  }

  if (active.some((item) => item.state === "disconnected")) {
    return "disconnected" as const;
  }

  if (
    active.some(
      (item) => item.state === "connecting" || item.state === "reconnecting"
    )
  ) {
    return "reconnecting" as const;
  }

  if (active.some((item) => item.state === "connected")) {
    return "connected" as const;
  }

  return "not-connected" as const;
}

export function connectionErrorNeedsSignIn(error: string) {
  return /utløpt|logg inn på nytt|expired|sign in again|invalid[_ -]grant|invalid[_ -]token|\b401\b/i.test(
    error
  );
}
