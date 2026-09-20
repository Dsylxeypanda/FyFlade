export type SavedWindowGeometry = {
  version: 1;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MonitorBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const SETTINGS_WINDOW_GEOMETRY_KEY =
  "fyflate.window.settings.geometry.v1";

export function normalizeSavedWindowGeometry(
  value: unknown
): SavedWindowGeometry | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<SavedWindowGeometry>;
  if (
    item.version !== 1 ||
    !Number.isFinite(item.x) ||
    !Number.isFinite(item.y) ||
    !Number.isFinite(item.width) ||
    !Number.isFinite(item.height)
  ) {
    return null;
  }
  return {
    version: 1,
    x: Math.round(item.x!),
    y: Math.round(item.y!),
    width: Math.max(620, Math.min(3840, Math.round(item.width!))),
    height: Math.max(430, Math.min(2160, Math.round(item.height!))),
  };
}

export function readSettingsWindowGeometry() {
  try {
    const raw = localStorage.getItem(SETTINGS_WINDOW_GEOMETRY_KEY);
    return normalizeSavedWindowGeometry(raw ? JSON.parse(raw) : null);
  } catch {
    return null;
  }
}

export function writeSettingsWindowGeometry(value: SavedWindowGeometry) {
  localStorage.setItem(
    SETTINGS_WINDOW_GEOMETRY_KEY,
    JSON.stringify(normalizeSavedWindowGeometry(value))
  );
}

export function fitGeometryToMonitors(
  geometry: SavedWindowGeometry,
  monitors: MonitorBounds[]
): SavedWindowGeometry {
  if (!monitors.length) return geometry;
  const intersects = (monitor: MonitorBounds) =>
    geometry.x + geometry.width > monitor.x + 80 &&
    geometry.x < monitor.x + monitor.width - 80 &&
    geometry.y + geometry.height > monitor.y + 40 &&
    geometry.y < monitor.y + monitor.height - 40;
  const monitor = monitors.find(intersects) || monitors[0];
  const width = Math.min(geometry.width, Math.max(620, monitor.width));
  const height = Math.min(geometry.height, Math.max(430, monitor.height));
  return {
    version: 1,
    width,
    height,
    x: Math.max(monitor.x, Math.min(geometry.x, monitor.x + monitor.width - Math.min(width, 220))),
    y: Math.max(monitor.y, Math.min(geometry.y, monitor.y + monitor.height - Math.min(height, 80))),
  };
}
