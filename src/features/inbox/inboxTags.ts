export type InboxTag =
  | "mention"
  | "reply"
  | "private-message"
  | "highlight"
  | "event";

const INBOX_TAG_ORDER: InboxTag[] = [
  "private-message",
  "reply",
  "mention",
  "highlight",
  "event",
];

function isInboxTag(value: unknown): value is InboxTag {
  return INBOX_TAG_ORDER.includes(value as InboxTag);
}

export function normalizeInboxTags(
  value: unknown,
  legacyReason?: unknown
): InboxTag[] {
  const tags = Array.isArray(value)
    ? value.filter(isInboxTag)
    : [];

  if (isInboxTag(legacyReason)) {
    tags.push(legacyReason);
  }

  return INBOX_TAG_ORDER.filter((tag) => tags.includes(tag));
}

export function buildInboxTags(input: {
  mentionsMe: boolean;
  repliesToMe: boolean;
  isPrivateMessage?: boolean;
  isHighlighted?: boolean;
  isEvent?: boolean;
}): InboxTag[] {
  return normalizeInboxTags([
    input.isPrivateMessage ? "private-message" : null,
    input.repliesToMe ? "reply" : null,
    input.mentionsMe ? "mention" : null,
    input.isHighlighted ? "highlight" : null,
    input.isEvent ? "event" : null,
  ]);
}

