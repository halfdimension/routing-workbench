import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_ENGINE_INSTANCES,
  loadEngineInstances,
  loadEngineSelection,
  saveEngineInstances,
  saveEngineSelection,
} from "./engineInstances";

describe("engine instance persistence", () => {
  beforeEach(() => localStorage.clear());

  it("provides the three requested defaults and original A/B comparison", () => {
    const instances = loadEngineInstances();
    expect(instances).toEqual(DEFAULT_ENGINE_INSTANCES);
    expect(loadEngineSelection(instances)).toEqual({
      a: "osrm-original",
      b: "valhalla-current",
    });
  });

  it("round-trips arbitrary valid localhost ports and selections", () => {
    const instances = [
      { id: "a", type: "valhalla" as const, port: 8003, label: "Candidate A" },
      { id: "b", type: "osrm" as const, port: 5099, label: "Candidate B" },
    ];
    saveEngineInstances(instances);
    saveEngineSelection({ a: "b", b: "a" });
    expect(loadEngineInstances()).toEqual(instances);
    expect(loadEngineSelection(instances)).toEqual({ a: "b", b: "a" });
  });

  it("falls back safely when persisted data is malformed", () => {
    localStorage.setItem("biking.engine-instances.v1", JSON.stringify([
      { id: "bad", type: "osrm", port: 70000, label: "Bad" },
    ]));
    expect(loadEngineInstances()).toEqual(DEFAULT_ENGINE_INSTANCES);
  });
});
