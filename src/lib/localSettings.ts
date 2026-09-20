export function readBooleanSetting(
  key: string,
  fallback: boolean
) {
  const value = localStorage.getItem(key);

  if (value === null) {
    return fallback;
  }

  return value === "true";
}

export function readJsonSetting<T>(
  key: string,
  fallback: T,
  isValid: (value: unknown) => value is T
): T {
  try {
    const raw = localStorage.getItem(key);

    if (raw === null) {
      return fallback;
    }

    const value: unknown = JSON.parse(raw);
    return isValid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function readUnknownJsonSetting(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeSetting(
  key: string,
  value: string | number | boolean | object
) {
  localStorage.setItem(
    key,
    typeof value === "string" ? value : JSON.stringify(value)
  );
}

const pendingSettingWrites =
  new Map<
    string,
    {
      value: string | number | boolean | object;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

export function writeSettingDebounced(
  key: string,
  value: string | number | boolean | object,
  delayMs = 180
) {
  const pending = pendingSettingWrites.get(key);

  if (pending) {
    clearTimeout(pending.timer);
  }

  const timer = setTimeout(() => {
    writeSetting(key, value);
    pendingSettingWrites.delete(key);
  }, delayMs);

  pendingSettingWrites.set(key, {
    value,
    timer,
  });
}

export function flushPendingSettingWrites() {
  for (const [key, pending] of pendingSettingWrites) {
    clearTimeout(pending.timer);
    writeSetting(key, pending.value);
  }

  pendingSettingWrites.clear();
}
