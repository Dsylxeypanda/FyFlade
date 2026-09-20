export const DISMISSED_WARNINGS_KEY = "fyflade.reliability.dismissedWarnings.v1";

export function readDismissedWarnings(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_WARNINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((item): item is string => typeof item === "string"))]
      : [];
  } catch {
    return [];
  }
}

export function writeDismissedWarnings(ids: string[]) {
  localStorage.setItem(
    DISMISSED_WARNINGS_KEY,
    JSON.stringify([...new Set(ids)])
  );
}
