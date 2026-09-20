import { DurableObject } from "cloudflare:workers";

export interface Env {
  CHAT_HUB: DurableObjectNamespace;
  ANONYMOUS_USAGE_RATE_LIMITER: RateLimit;
  KICK_CLIENT_ID: string;
  KICK_CLIENT_SECRET: string;
  CHATNEST_SESSION_SECRET: string;
  KICK_REDIRECT_URI: string;
  CHATNEST_UPDATE_VERSION?: string;
  CHATNEST_UPDATE_URL?: string;
  CHATNEST_UPDATE_SIGNATURE?: string;
  CHATNEST_UPDATE_NOTES?: string;
  CHATNEST_UPDATE_PUB_DATE?: string;
  ANALYTICS_ADMIN_SECRET?: string;
}

type RelayTicket = {
  sub: string;
  name: string;
  iat: number;
  exp: number;
};

type RelaySocketAttachment = {
  userId: string;
  broadcasterIds: string[];
  connectedAt: number;
};

type KickUser = {
  user_id?: number | string;
  id?: number | string;
  username?: string;
  name?: string;
};

type KickUsersResponse = {
  data?: KickUser[];
};

type KickPublicKeyResponse = {
  data?:
    | { public_key?: string }
    | Array<{ public_key?: string }>;
  public_key?: string;
};

type KickAppTokenResponse = {
  access_token?: string;
  expires_in?: number | string;
  token_type?: string;
};

type KickWebhookEnvelope = {
  broadcasterUserId: string;
  payload: string[];
};

const KICK_API_ORIGIN = "https://api.kick.com";
const KICK_ID_ORIGIN = "https://id.kick.com";
const SERVICE_VERSION = "1.0.0";
const TICKET_LIFETIME_SECONDS = 5 * 60;
const MAX_CHANNELS_PER_SOCKET = 100;

let cachedKickPublicKey: CryptoKey | null = null;
let cachedKickAppToken:
  | { token: string; expiresAt: number }
  | null = null;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
  };
}

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: HeadersInit = {}
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  return message
    .replace(/(access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|authorization|bearer)(\s*[=:]\s*|\s+)[^\s,;}\]]+/gi, "$1$2[redacted]")
    .replace(/\b[A-Za-z0-9_-]{48,}\b/g, "[redacted]")
    .slice(0, 500);
}

function configured(env: Env) {
  return Boolean(
    env.KICK_CLIENT_ID?.trim() &&
      env.KICK_CLIENT_SECRET?.trim() &&
      env.CHATNEST_SESSION_SECRET?.trim() &&
      env.KICK_REDIRECT_URI?.trim()
  );
}

function compareSemver(left: string, right: string) {
  const parts = (value: string) =>
    value
      .trim()
      .replace(/^v/i, "")
      .split("-", 1)[0]
      .split(".")
      .slice(0, 3)
      .map((part) => Number.parseInt(part, 10) || 0);
  const leftParts = parts(left);
  const rightParts = parts(right);

  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

function bearerToken(request: Request) {
  const value = request.headers.get("Authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match?.[1]?.trim() || "";
}

function constantTimeEqual(left: string, right: string) {
  const maximum = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < maximum; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

async function readJson<T>(request: Request): Promise<T> {
  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("Content-Type must be application/json.");
  }
  return (await request.json()) as T;
}

function base64UrlEncodeBytes(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlEncodeText(value: string) {
  return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

function base64UrlDecodeText(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function hmacSignature(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

async function createRelayTicket(payload: RelayTicket, secret: string) {
  const encoded = base64UrlEncodeText(JSON.stringify(payload));
  const signature = await hmacSignature(encoded, secret);
  return `${encoded}.${signature}`;
}

async function verifyRelayTicket(token: string, secret: string) {
  const [encoded = "", receivedSignature = ""] = token.split(".");
  if (!encoded || !receivedSignature) {
    return null;
  }
  const expectedSignature = await hmacSignature(encoded, secret);
  if (!safeEqual(receivedSignature, expectedSignature)) {
    return null;
  }
  try {
    const payload = JSON.parse(base64UrlDecodeText(encoded)) as RelayTicket;
    const now = Math.floor(Date.now() / 1000);
    if (!payload.sub || !payload.exp || payload.exp <= now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

async function authenticateKickUser(accessToken: string) {
  if (!accessToken) {
    throw new Error("Kick access token is missing.");
  }
  const response = await fetch(`${KICK_API_ORIGIN}/public/v1/users`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error("Kick access token is invalid or expired.");
  }
  const data = (await response.json()) as KickUsersResponse;
  const user = data.data?.[0];
  const id = String(user?.user_id ?? user?.id ?? "").trim();
  if (!user || !id) {
    throw new Error("Kick returned no user for this access token.");
  }
  return {
    id,
    name: String(user.username || user.name || "Kick"),
  };
}

async function getKickAppToken(env: Env) {
  if (
    cachedKickAppToken &&
    cachedKickAppToken.expiresAt > Date.now() + 60_000
  ) {
    return cachedKickAppToken.token;
  }
  const response = await fetch(`${KICK_ID_ORIGIN}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.KICK_CLIENT_ID,
      client_secret: env.KICK_CLIENT_SECRET,
    }).toString(),
  });
  if (!response.ok) {
    throw new Error(`Kick app token failed with HTTP ${response.status}.`);
  }
  const data = (await response.json()) as KickAppTokenResponse;
  const token = String(data.access_token || "").trim();
  if (!token) {
    throw new Error("Kick returned no app access token.");
  }
  const expiresIn = Math.max(60, Number(data.expires_in || 3600));
  cachedKickAppToken = {
    token,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  return token;
}

function pemToArrayBuffer(pem: string) {
  const normalized = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

async function getKickPublicKey() {
  if (cachedKickPublicKey) {
    return cachedKickPublicKey;
  }
  const response = await fetch(`${KICK_API_ORIGIN}/public/v1/public-key`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Kick public key failed with HTTP ${response.status}.`);
  }
  const data = (await response.json()) as KickPublicKeyResponse;
  const pem =
    data.public_key ||
    (Array.isArray(data.data)
      ? data.data[0]?.public_key
      : data.data?.public_key) ||
    "";
  if (!pem) {
    throw new Error("Kick public key response was empty.");
  }
  cachedKickPublicKey = await crypto.subtle.importKey(
    "spki",
    pemToArrayBuffer(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  return cachedKickPublicKey;
}

async function verifyKickWebhook(request: Request, rawBody: string) {
  const messageId = request.headers.get("Kick-Event-Message-Id") || "";
  const timestamp = request.headers.get("Kick-Event-Message-Timestamp") || "";
  const signature = request.headers.get("Kick-Event-Signature") || "";
  if (!messageId || !timestamp || !signature) {
    return false;
  }
  const signatureBinary = atob(signature);
  const signatureBytes = new Uint8Array(signatureBinary.length);
  for (let index = 0; index < signatureBinary.length; index += 1) {
    signatureBytes[index] = signatureBinary.charCodeAt(index);
  }
  const key = await getKickPublicKey();
  return crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    signatureBytes,
    new TextEncoder().encode(`${messageId}.${timestamp}.${rawBody}`)
  );
}

function broadcasterIdFromWebhook(rawBody: string) {
  try {
    const data = JSON.parse(rawBody) as {
      broadcaster?: { user_id?: string | number };
    };
    return String(data.broadcaster?.user_id ?? "").trim();
  } catch {
    return "";
  }
}

async function exchangeKickToken(request: Request, env: Env) {
  const body = await readJson<{
    grant_type?: string;
    code?: string;
    code_verifier?: string;
    redirect_uri?: string;
    refresh_token?: string;
  }>(request);
  const grantType = String(body.grant_type || "");
  const params = new URLSearchParams({
    grant_type: grantType,
    client_id: env.KICK_CLIENT_ID,
    client_secret: env.KICK_CLIENT_SECRET,
  });
  if (grantType === "authorization_code") {
    if (
      !body.code ||
      !body.code_verifier ||
      body.redirect_uri !== env.KICK_REDIRECT_URI
    ) {
      return errorResponse("Invalid authorization-code request.", 400);
    }
    params.set("code", body.code);
    params.set("code_verifier", body.code_verifier);
    params.set("redirect_uri", env.KICK_REDIRECT_URI);
  } else if (grantType === "refresh_token") {
    if (!body.refresh_token) {
      return errorResponse("Refresh token is missing.", 400);
    }
    params.set("refresh_token", body.refresh_token);
  } else {
    return errorResponse("Unsupported grant type.", 400);
  }
  const response = await fetch(`${KICK_ID_ORIGIN}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params.toString(),
  });
  const responseBody = await response.text();
  return new Response(responseBody, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") ||
        "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}

async function handleWorkerRequest(request: Request, env: Env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/health") {
    return jsonResponse({
      ok: true,
      service: "chatnest-kick-relay",
      version: SERVICE_VERSION,
      configured: configured(env),
    });
  }

  if (request.method === "GET" && url.pathname === "/config") {
    return jsonResponse({
      service: "chatnest-kick-relay",
      version: SERVICE_VERSION,
      configured: configured(env),
      clientId: env.KICK_CLIENT_ID || "",
      redirectUri: env.KICK_REDIRECT_URI || "",
      webhookUrl: new URL("/kick/webhook", request.url).toString(),
    });
  }

  if (request.method === "POST" && url.pathname === "/usage") {
    const rateLimit = await env.ANONYMOUS_USAGE_RATE_LIMITER.limit({
      key: "anonymous-usage",
    });
    if (!rateLimit.success) {
      return new Response(null, {
        status: 429,
        headers: { "Cache-Control": "no-store", "Retry-After": "60" },
      });
    }
    const id = env.CHAT_HUB.idFromName("fyflate-anonymous-usage");
    const response = await env.CHAT_HUB.get(id).fetch(
      new Request("https://fyflate.internal/usage-record", { method: "POST" })
    );
    return new Response(null, {
      status: response.ok ? 204 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (request.method === "GET" && url.pathname === "/usage/summary") {
    const expected = (env.ANALYTICS_ADMIN_SECRET || "").trim();
    if (!expected) {
      return errorResponse("Not found.", 404);
    }
    if (!constantTimeEqual(bearerToken(request), expected)) {
      return errorResponse("Unauthorized.", 401);
    }
    const id = env.CHAT_HUB.idFromName("fyflate-anonymous-usage");
    return env.CHAT_HUB.get(id).fetch(
      new Request("https://fyflate.internal/usage-summary")
    );
  }

  const updatePath = /^\/updates-v1\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(
    url.pathname
  );

  if (request.method === "GET" && updatePath) {
    const target = decodeURIComponent(updatePath[1] || "").toLowerCase();
    const architecture = decodeURIComponent(updatePath[2] || "").toLowerCase();
    const currentVersion = decodeURIComponent(updatePath[3] || "");
    const updateVersion = (env.CHATNEST_UPDATE_VERSION || "").trim();
    const updateUrl = (env.CHATNEST_UPDATE_URL || "").trim();
    const updateSignature = (env.CHATNEST_UPDATE_SIGNATURE || "").trim();

    if (
      target !== "windows" ||
      architecture !== "x86_64" ||
      !updateVersion ||
      !updateUrl ||
      !updateSignature ||
      compareSemver(updateVersion, currentVersion) <= 0
    ) {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    return jsonResponse({
      version: updateVersion,
      url: updateUrl,
      signature: updateSignature,
      notes:
        env.CHATNEST_UPDATE_NOTES ||
        `FyFlade ${updateVersion}`,
      pub_date:
        env.CHATNEST_UPDATE_PUB_DATE ||
        undefined,
    });
  }

  if (!configured(env)) {
    return errorResponse("FyFlade Kick relay is not configured yet.", 503);
  }

  if (request.method === "POST" && url.pathname === "/oauth/token") {
    return exchangeKickToken(request, env);
  }

  if (request.method === "POST" && url.pathname === "/kick/app-token") {
    try {
      await authenticateKickUser(bearerToken(request));
      const token = await getKickAppToken(env);
      return jsonResponse({ access_token: token, token_type: "Bearer" });
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : "Kick authentication failed.",
        401
      );
    }
  }

  if (request.method === "POST" && url.pathname === "/relay/ticket") {
    try {
      const user = await authenticateKickUser(bearerToken(request));
      const now = Math.floor(Date.now() / 1000);
      const ticket = await createRelayTicket(
        {
          sub: user.id,
          name: user.name,
          iat: now,
          exp: now + TICKET_LIFETIME_SECONDS,
        },
        env.CHATNEST_SESSION_SECRET
      );
      return jsonResponse({ ticket, expiresIn: TICKET_LIFETIME_SECONDS });
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : "Kick authentication failed.",
        401
      );
    }
  }

  if (request.method === "GET" && url.pathname === "/relay") {
    if ((request.headers.get("Upgrade") || "").toLowerCase() !== "websocket") {
      return errorResponse("WebSocket upgrade required.", 426);
    }
    const ticket = await verifyRelayTicket(
      url.searchParams.get("ticket") || "",
      env.CHATNEST_SESSION_SECRET
    );
    if (!ticket) {
      return errorResponse("Relay ticket is invalid or expired.", 401);
    }
    const id = env.CHAT_HUB.idFromName("chatnest-kick-global");
    const stub = env.CHAT_HUB.get(id);
    const hubUrl = new URL("https://chatnest.internal/connect");
    const hubRequest = new Request(hubUrl, {
      headers: {
        Upgrade: "websocket",
        "X-ChatNest-User-Id": ticket.sub,
      },
    });
    return stub.fetch(hubRequest);
  }

  if (request.method === "POST" && url.pathname === "/kick/webhook") {
    const rawBody = await request.text();
    const valid = await verifyKickWebhook(request, rawBody).catch(() => false);
    if (!valid) {
      return errorResponse("Invalid Kick webhook signature.", 401);
    }
    const broadcasterUserId = broadcasterIdFromWebhook(rawBody);
    if (!broadcasterUserId) {
      return errorResponse("Kick webhook broadcaster is missing.", 400);
    }
    const payload = [
      request.headers.get("Kick-Event-Type") || "",
      request.headers.get("Kick-Event-Message-Id") || "",
      request.headers.get("Kick-Event-Message-Timestamp") || "",
      request.headers.get("Kick-Event-Signature") || "",
      rawBody,
    ];
    const envelope: KickWebhookEnvelope = { broadcasterUserId, payload };
    const id = env.CHAT_HUB.idFromName("chatnest-kick-global");
    const stub = env.CHAT_HUB.get(id);
    await stub.fetch("https://chatnest.internal/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(envelope),
    });
    return new Response(null, { status: 204 });
  }

  return errorResponse("Not found.", 404);
}

export default {
  async fetch(request: Request, env: Env) {
    try {
      return await handleWorkerRequest(request, env);
    } catch (error) {
      console.error("FyFlade Kick relay request failed", {
        path: new URL(request.url).pathname,
        message: safeErrorMessage(error),
      });
      return errorResponse("Internal service error.", 500);
    }
  },
};

export class ChatHub extends DurableObject<Env> {
  constructor(
    private readonly state: DurableObjectState,
    env: Env
  ) {
    super(state, env);
    this.state.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong")
    );
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/usage-record") {
      const day = new Date().toISOString().slice(0, 10);
      const key = `usage:${day}`;
      const count = (await this.state.storage.get<number>(key)) || 0;
      await this.state.storage.put(key, Math.min(count + 1, Number.MAX_SAFE_INTEGER));
      const storedDays = Array.from(
        (await this.state.storage.list<number>({ prefix: "usage:" })).keys()
      ).sort((left, right) => right.localeCompare(left));
      for (const staleKey of storedDays.slice(31)) {
        await this.state.storage.delete(staleKey);
      }
      return new Response(null, { status: 204 });
    }

    if (request.method === "GET" && url.pathname === "/usage-summary") {
      const rows = await this.state.storage.list<number>({ prefix: "usage:" });
      const days = Array.from(rows.entries())
        .map(([key, count]) => ({ day: key.slice("usage:".length), count }))
        .sort((left, right) => right.day.localeCompare(left.day))
        .slice(0, 31);
      return jsonResponse({ days });
    }

    if (request.method === "GET" && url.pathname === "/connect") {
      if ((request.headers.get("Upgrade") || "").toLowerCase() !== "websocket") {
        return new Response("WebSocket required", { status: 426 });
      }
      const userId = request.headers.get("X-ChatNest-User-Id") || "";
      if (!userId) {
        return new Response("Unauthorized", { status: 401 });
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      const attachment: RelaySocketAttachment = {
        userId,
        broadcasterIds: [],
        connectedAt: Date.now(),
      };
      server.serializeAttachment(attachment);
      this.state.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    if (request.method === "POST" && url.pathname === "/publish") {
      const envelope = (await request.json()) as KickWebhookEnvelope;
      if (!envelope.broadcasterUserId || !Array.isArray(envelope.payload)) {
        return new Response("Invalid envelope", { status: 400 });
      }
      const message = JSON.stringify({
        type: "kick-webhook-event",
        payload: envelope.payload,
      });
      let delivered = 0;
      for (const socket of this.state.getWebSockets()) {
        const attachment =
          socket.deserializeAttachment() as RelaySocketAttachment | null;
        if (
          attachment?.broadcasterIds?.includes(envelope.broadcasterUserId)
        ) {
          try {
            socket.send(message);
            delivered += 1;
          } catch {
            try {
              socket.close(1011, "Delivery failed");
            } catch {
              // The socket is already closed.
            }
          }
        }
      }
      return jsonResponse({ delivered });
    }

    return new Response("Not found", { status: 404 });
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string") {
      return;
    }
    try {
      const data = JSON.parse(message) as {
        type?: string;
        broadcasterIds?: unknown[];
      };
      if (data.type !== "subscribe" || !Array.isArray(data.broadcasterIds)) {
        return;
      }
      const current =
        (socket.deserializeAttachment() as RelaySocketAttachment | null) || {
          userId: "",
          broadcasterIds: [],
          connectedAt: Date.now(),
        };
      const broadcasterIds = Array.from(
        new Set(
          data.broadcasterIds
            .map((value) => String(value || "").trim())
            .filter(Boolean)
        )
      ).slice(0, MAX_CHANNELS_PER_SOCKET);
      socket.serializeAttachment({ ...current, broadcasterIds });
      socket.send(
        JSON.stringify({
          type: "subscribed",
          broadcasterIds,
        })
      );
    } catch {
      socket.send(JSON.stringify({ type: "error", message: "Invalid message" }));
    }
  }

  async webSocketClose(
    socket: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean
  ) {
    socket.close(code, reason || (wasClean ? "Closed" : "Connection lost"));
  }

  async webSocketError(socket: WebSocket) {
    try {
      socket.close(1011, "WebSocket error");
    } catch {
      // The socket is already closed.
    }
  }
}
