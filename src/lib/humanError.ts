function extractMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.trim();
  }

  return typeof error === "string" ? error.trim() : "";
}

export function humanErrorMessage(
  error: unknown,
  fallback: string
) {
  const message = extractMessage(error);

  if (!message) {
    return fallback;
  }

  const looksTechnical =
    message.length > 220 ||
    /https?:\/\//i.test(message) ||
    /(?:^|\s)(?:at\s+\S+|stack|serde|reqwest|websocket|json|invoke)\b/i.test(
      message
    ) ||
    /^[\[{]/.test(message) ||
    /\bHTTP\s*[45]\d\d\b/i.test(message);

  return looksTechnical ? fallback : message;
}

