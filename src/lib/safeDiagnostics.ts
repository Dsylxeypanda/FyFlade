const SENSITIVE_VALUE = /(access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|authorization|bearer|password|device[_ -]?code|authorization[_ -]?code)(\s*[=:]\s*|\s+)[^\s,;}\]]+/gi;
const LONG_CREDENTIAL_LIKE_VALUE = /\b[A-Za-z0-9_-]{48,}\b/g;

export function redactSensitiveText(value: string) {
  return value
    .replace(SENSITIVE_VALUE, (_match, name: string, separator: string) => `${name}${separator}[redacted]`)
    .replace(LONG_CREDENTIAL_LIKE_VALUE, "[redacted]")
    .slice(0, 800);
}

export function safeDiagnosticError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: redactSensitiveText(error.name || "Error"),
      message: redactSensitiveText(error.message || "Unknown error"),
    };
  }
  return { message: redactSensitiveText(String(error || "Unknown error")) };
}
