import { DurableObject } from "cloudflare:workers";
const KICK_API_ORIGIN = "https://api.kick.com";
const KICK_ID_ORIGIN = "https://id.kick.com";
const SERVICE_VERSION = "1.0.0";
const TICKET_LIFETIME_SECONDS = 5 * 60;
const MAX_CHANNELS_PER_SOCKET = 100;
let cachedKickPublicKey = null;
let cachedKickAppToken = null;
function corsHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Cache-Control": "no-store",
    };
}
function jsonResponse(body, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            ...corsHeaders(),
            ...extraHeaders,
        },
    });
}
function errorResponse(message, status = 400) {
    return jsonResponse({ error: message }, status);
}
function configured(env) {
    return Boolean(env.KICK_CLIENT_ID?.trim() &&
        env.KICK_CLIENT_SECRET?.trim() &&
        env.CHATNEST_SESSION_SECRET?.trim() &&
        env.KICK_REDIRECT_URI?.trim());
}
function bearerToken(request) {
    const value = request.headers.get("Authorization") || "";
    const match = /^Bearer\s+(.+)$/i.exec(value.trim());
    return match?.[1]?.trim() || "";
}
async function readJson(request) {
    const contentType = request.headers.get("Content-Type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
        throw new Error("Content-Type must be application/json.");
    }
    return (await request.json());
}
function base64UrlEncodeBytes(bytes) {
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}
function base64UrlEncodeText(value) {
    return base64UrlEncodeBytes(new TextEncoder().encode(value));
}
function base64UrlDecodeText(value) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return new TextDecoder().decode(bytes);
}
function safeEqual(left, right) {
    if (left.length !== right.length) {
        return false;
    }
    let difference = 0;
    for (let index = 0; index < left.length; index += 1) {
        difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return difference === 0;
}
async function hmacSignature(value, secret) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
    return base64UrlEncodeBytes(new Uint8Array(signature));
}
async function createRelayTicket(payload, secret) {
    const encoded = base64UrlEncodeText(JSON.stringify(payload));
    const signature = await hmacSignature(encoded, secret);
    return `${encoded}.${signature}`;
}
async function verifyRelayTicket(token, secret) {
    const [encoded = "", receivedSignature = ""] = token.split(".");
    if (!encoded || !receivedSignature) {
        return null;
    }
    const expectedSignature = await hmacSignature(encoded, secret);
    if (!safeEqual(receivedSignature, expectedSignature)) {
        return null;
    }
    try {
        const payload = JSON.parse(base64UrlDecodeText(encoded));
        const now = Math.floor(Date.now() / 1000);
        if (!payload.sub || !payload.exp || payload.exp <= now) {
            return null;
        }
        return payload;
    }
    catch {
        return null;
    }
}
async function authenticateKickUser(accessToken) {
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
    const data = (await response.json());
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
async function getKickAppToken(env) {
    if (cachedKickAppToken &&
        cachedKickAppToken.expiresAt > Date.now() + 60_000) {
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
    const data = (await response.json());
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
function pemToArrayBuffer(pem) {
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
    const data = (await response.json());
    const pem = data.public_key ||
        (Array.isArray(data.data)
            ? data.data[0]?.public_key
            : data.data?.public_key) ||
        "";
    if (!pem) {
        throw new Error("Kick public key response was empty.");
    }
    cachedKickPublicKey = await crypto.subtle.importKey("spki", pemToArrayBuffer(pem), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    return cachedKickPublicKey;
}
async function verifyKickWebhook(request, rawBody) {
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
    return crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, key, signatureBytes, new TextEncoder().encode(`${messageId}.${timestamp}.${rawBody}`));
}
function broadcasterIdFromWebhook(rawBody) {
    try {
        const data = JSON.parse(rawBody);
        return String(data.broadcaster?.user_id ?? "").trim();
    }
    catch {
        return "";
    }
}
async function exchangeKickToken(request, env) {
    const body = await readJson(request);
    const grantType = String(body.grant_type || "");
    const params = new URLSearchParams({
        grant_type: grantType,
        client_id: env.KICK_CLIENT_ID,
        client_secret: env.KICK_CLIENT_SECRET,
    });
    if (grantType === "authorization_code") {
        if (!body.code ||
            !body.code_verifier ||
            body.redirect_uri !== env.KICK_REDIRECT_URI) {
            return errorResponse("Invalid authorization-code request.", 400);
        }
        params.set("code", body.code);
        params.set("code_verifier", body.code_verifier);
        params.set("redirect_uri", env.KICK_REDIRECT_URI);
    }
    else if (grantType === "refresh_token") {
        if (!body.refresh_token) {
            return errorResponse("Refresh token is missing.", 400);
        }
        params.set("refresh_token", body.refresh_token);
    }
    else {
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
            "Content-Type": response.headers.get("Content-Type") ||
                "application/json; charset=utf-8",
            ...corsHeaders(),
        },
    });
}
async function handleWorkerRequest(request, env) {
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
    if (!configured(env)) {
        return errorResponse("ChatNest Kick relay is not configured yet.", 503);
    }
    if (request.method === "POST" && url.pathname === "/oauth/token") {
        return exchangeKickToken(request, env);
    }
    if (request.method === "POST" && url.pathname === "/kick/app-token") {
        try {
            await authenticateKickUser(bearerToken(request));
            const token = await getKickAppToken(env);
            return jsonResponse({ access_token: token, token_type: "Bearer" });
        }
        catch (error) {
            return errorResponse(error instanceof Error ? error.message : "Kick authentication failed.", 401);
        }
    }
    if (request.method === "POST" && url.pathname === "/relay/ticket") {
        try {
            const user = await authenticateKickUser(bearerToken(request));
            const now = Math.floor(Date.now() / 1000);
            const ticket = await createRelayTicket({
                sub: user.id,
                name: user.name,
                iat: now,
                exp: now + TICKET_LIFETIME_SECONDS,
            }, env.CHATNEST_SESSION_SECRET);
            return jsonResponse({ ticket, expiresIn: TICKET_LIFETIME_SECONDS });
        }
        catch (error) {
            return errorResponse(error instanceof Error ? error.message : "Kick authentication failed.", 401);
        }
    }
    if (request.method === "GET" && url.pathname === "/relay") {
        if ((request.headers.get("Upgrade") || "").toLowerCase() !== "websocket") {
            return errorResponse("WebSocket upgrade required.", 426);
        }
        const ticket = await verifyRelayTicket(url.searchParams.get("ticket") || "", env.CHATNEST_SESSION_SECRET);
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
        const envelope = { broadcasterUserId, payload };
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
    async fetch(request, env) {
        try {
            return await handleWorkerRequest(request, env);
        }
        catch (error) {
            console.error("ChatNest Kick relay request failed", {
                path: new URL(request.url).pathname,
                message: error instanceof Error ? error.message : String(error),
            });
            return errorResponse("Internal service error.", 500);
        }
    },
};
export class ChatHub extends DurableObject {
    state;
    constructor(state, env) {
        super(state, env);
        this.state = state;
        this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
    }
    async fetch(request) {
        const url = new URL(request.url);
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
            const attachment = {
                userId,
                broadcasterIds: [],
                connectedAt: Date.now(),
            };
            server.serializeAttachment(attachment);
            this.state.acceptWebSocket(server);
            return new Response(null, { status: 101, webSocket: client });
        }
        if (request.method === "POST" && url.pathname === "/publish") {
            const envelope = (await request.json());
            if (!envelope.broadcasterUserId || !Array.isArray(envelope.payload)) {
                return new Response("Invalid envelope", { status: 400 });
            }
            const message = JSON.stringify({
                type: "kick-webhook-event",
                payload: envelope.payload,
            });
            let delivered = 0;
            for (const socket of this.state.getWebSockets()) {
                const attachment = socket.deserializeAttachment();
                if (attachment?.broadcasterIds?.includes(envelope.broadcasterUserId)) {
                    try {
                        socket.send(message);
                        delivered += 1;
                    }
                    catch {
                        try {
                            socket.close(1011, "Delivery failed");
                        }
                        catch {
                            // The socket is already closed.
                        }
                    }
                }
            }
            return jsonResponse({ delivered });
        }
        return new Response("Not found", { status: 404 });
    }
    async webSocketMessage(socket, message) {
        if (typeof message !== "string") {
            return;
        }
        try {
            const data = JSON.parse(message);
            if (data.type !== "subscribe" || !Array.isArray(data.broadcasterIds)) {
                return;
            }
            const current = socket.deserializeAttachment() || {
                userId: "",
                broadcasterIds: [],
                connectedAt: Date.now(),
            };
            const broadcasterIds = Array.from(new Set(data.broadcasterIds
                .map((value) => String(value || "").trim())
                .filter(Boolean))).slice(0, MAX_CHANNELS_PER_SOCKET);
            socket.serializeAttachment({ ...current, broadcasterIds });
            socket.send(JSON.stringify({
                type: "subscribed",
                broadcasterIds,
            }));
        }
        catch {
            socket.send(JSON.stringify({ type: "error", message: "Invalid message" }));
        }
    }
    async webSocketClose(socket, code, reason, wasClean) {
        socket.close(code, reason || (wasClean ? "Closed" : "Connection lost"));
    }
    async webSocketError(socket) {
        try {
            socket.close(1011, "WebSocket error");
        }
        catch {
            // The socket is already closed.
        }
    }
}
