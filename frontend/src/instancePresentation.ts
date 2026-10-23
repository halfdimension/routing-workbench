import type {
  ComparisonSlot,
  Engine,
  EngineInstanceSpec,
  RoutingTarget,
} from "./types";

const ENGINE_NAMES: Record<Engine, string> = {
  osrm: "OSRM",
  valhalla: "Valhalla",
};

/** Format result provenance without exposing production's synthetic port 0. */
export function formatResultInstance(
  slot: ComparisonSlot | null | undefined,
  engine: Engine,
  instance: EngineInstanceSpec | null | undefined,
  routingTarget: RoutingTarget | undefined,
): string {
  const prefix = slot ? `Engine ${slot.toUpperCase()} · ` : "";
  const engineName = ENGINE_NAMES[engine];
  const label = instance?.label || engineName;
  const identity = label.toLowerCase().includes(engineName.toLowerCase())
    ? label
    : `${label} · ${engineName}`;
  const port =
    routingTarget !== "prod" && instance && instance.port > 0
      ? ` · :${instance.port}`
      : "";
  return `${prefix}${identity}${port}`;
}
