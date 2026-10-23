import type { EngineInstance } from "./types";

const STORAGE_KEY = "biking.engine-instances.v1";
const SELECTION_KEY = "biking.engine-selection.v1";

export const DEFAULT_ENGINE_INSTANCES: EngineInstance[] = [
  { id: "osrm-original", type: "osrm", port: 5000, label: "OSRM original" },
  { id: "osrm-new-traffic", type: "osrm", port: 5010, label: "OSRM new traffic" },
  { id: "valhalla-current", type: "valhalla", port: 8002, label: "Valhalla current" },
];

function validInstance(value: unknown): value is EngineInstance {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<EngineInstance>;
  return (
    typeof item.id === "string" && item.id.length > 0 &&
    (item.type === "osrm" || item.type === "valhalla") &&
    Number.isInteger(item.port) && Number(item.port) >= 1 && Number(item.port) <= 65535 &&
    typeof item.label === "string" && item.label.trim().length > 0
  );
}

export function loadEngineInstances(): EngineInstance[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return Array.isArray(parsed) && parsed.length > 0 && parsed.every(validInstance)
      ? parsed
      : DEFAULT_ENGINE_INSTANCES.map((item) => ({ ...item }));
  } catch {
    return DEFAULT_ENGINE_INSTANCES.map((item) => ({ ...item }));
  }
}

export function saveEngineInstances(instances: EngineInstance[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(instances)); } catch { /* unavailable */ }
}

export function loadEngineSelection(instances: EngineInstance[]): { a: string; b: string } {
  const fallback = {
    a: instances.find((item) => item.id === "osrm-original")?.id ?? instances[0]?.id ?? "",
    b: instances.find((item) => item.id === "valhalla-current")?.id ?? instances[1]?.id ?? instances[0]?.id ?? "",
  };
  try {
    const parsed = JSON.parse(localStorage.getItem(SELECTION_KEY) ?? "null") as { a?: unknown; b?: unknown } | null;
    const ids = new Set(instances.map((item) => item.id));
    return {
      a: typeof parsed?.a === "string" && ids.has(parsed.a) ? parsed.a : fallback.a,
      b: typeof parsed?.b === "string" && ids.has(parsed.b) ? parsed.b : fallback.b,
    };
  } catch { return fallback; }
}

export function saveEngineSelection(selection: { a: string; b: string }): void {
  try { localStorage.setItem(SELECTION_KEY, JSON.stringify(selection)); } catch { /* unavailable */ }
}

export function newEngineInstanceId(): string {
  return `engine-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
