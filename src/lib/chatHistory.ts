export type ChatHistoryRetention = "24h" | "48h" | "7d" | "30d" | "unlimited";

export const CHAT_HISTORY_RETENTION_KEY = "fyflade.chat.historyRetention.v1";
export const DEFAULT_CHAT_HISTORY_RETENTION: ChatHistoryRetention = "24h";

export const CHAT_HISTORY_RETENTION_OPTIONS: Array<{
  id: ChatHistoryRetention;
  milliseconds: number;
  labelNo: string;
  labelEn: string;
}> = [
  { id: "24h", milliseconds: 24 * 60 * 60 * 1000, labelNo: "24 timer", labelEn: "24 hours" },
  { id: "48h", milliseconds: 48 * 60 * 60 * 1000, labelNo: "48 timer", labelEn: "48 hours" },
  { id: "7d", milliseconds: 7 * 24 * 60 * 60 * 1000, labelNo: "1 uke", labelEn: "1 week" },
  { id: "30d", milliseconds: 30 * 24 * 60 * 60 * 1000, labelNo: "30 dager", labelEn: "30 days" },
  { id: "unlimited", milliseconds: 0, labelNo: "Ubegrenset / slett manuelt", labelEn: "Unlimited / delete manually" },
];

export function readChatHistoryRetention(): ChatHistoryRetention {
  const value = localStorage.getItem(CHAT_HISTORY_RETENTION_KEY);
  return CHAT_HISTORY_RETENTION_OPTIONS.some((option) => option.id === value)
    ? value as ChatHistoryRetention
    : DEFAULT_CHAT_HISTORY_RETENTION;
}

export function chatHistoryRetentionMs(retention: ChatHistoryRetention): number {
  return CHAT_HISTORY_RETENTION_OPTIONS.find((option) => option.id === retention)?.milliseconds
    ?? CHAT_HISTORY_RETENTION_OPTIONS[0].milliseconds;
}

export function chatHistoryRetentionLabel(retention: ChatHistoryRetention, norwegian: boolean): string {
  const option = CHAT_HISTORY_RETENTION_OPTIONS.find((candidate) => candidate.id === retention)
    ?? CHAT_HISTORY_RETENTION_OPTIONS[0];
  return norwegian ? option.labelNo : option.labelEn;
}

// Compatibility export for older feature modules. New storage calls use the selected value.
export const CHAT_HISTORY_MAX_AGE_MS = CHAT_HISTORY_RETENTION_OPTIONS[0].milliseconds;
