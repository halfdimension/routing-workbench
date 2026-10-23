import { useEffect, useState } from "react";
import { useStore } from "../store";
import type { Engine, EngineInstance, EngineResult } from "../types";

function display(instance: EngineInstance): string {
  return `${instance.label} — ${instance.type.toUpperCase()} :${instance.port}`;
}

function InstanceRow({ instance, canRemove }: { instance: EngineInstance; canRemove: boolean }) {
  const update = useStore((state) => state.updateEngineInstance);
  const remove = useStore((state) => state.removeEngineInstance);
  const [type, setType] = useState<Engine>(instance.type);
  const [port, setPort] = useState(String(instance.port));
  const [label, setLabel] = useState(instance.label);
  const numericPort = Number(port);
  const valid = label.trim().length > 0 && Number.isInteger(numericPort) && numericPort >= 1 && numericPort <= 65535;

  useEffect(() => {
    setType(instance.type); setPort(String(instance.port)); setLabel(instance.label);
  }, [instance.type, instance.port, instance.label]);

  return (
    <div className="engine-instance-row">
      <input aria-label={`${instance.label} label`} value={label} onChange={(event) => setLabel(event.target.value)} />
      <select aria-label={`${instance.label} engine type`} value={type} onChange={(event) => setType(event.target.value as Engine)}>
        <option value="osrm">OSRM</option>
        <option value="valhalla">Valhalla</option>
      </select>
      <input aria-label={`${instance.label} port`} type="number" min={1} max={65535} value={port} onChange={(event) => setPort(event.target.value)} />
      <div className="engine-instance-row__actions">
        <button type="button" disabled={!valid} onClick={() => update(instance.id, { type, port: numericPort, label: label.trim() })}>Save</button>
        <button type="button" disabled={!canRemove} onClick={() => remove(instance.id)} aria-label={`Remove ${instance.label}`}>Remove</button>
      </div>
      {!valid && <small className="engine-instance-row__error">Use a label and port 1–65535.</small>}
    </div>
  );
}

function resultStatus(result: EngineResult | undefined, selected: EngineInstance | undefined): string {
  if (!result || !selected || result.engine !== selected.type) return "Not checked";
  if (result.instance && result.instance.port !== selected.port) return "Not checked";
  if (result.status === "error") return result.error?.message ?? "Request failed";
  if (result.normalizedRoutes.length === 0) return result.error?.message ?? "No route";
  return `Connected · ${result.normalizedRoutes.length} route${result.normalizedRoutes.length === 1 ? "" : "s"}`;
}

export default function EngineInstanceManager({
  view = "all",
}: {
  view?: "all" | "selector" | "manager";
}) {
  const instances = useStore((state) => state.engineInstances);
  const aId = useStore((state) => state.engineAId);
  const bId = useStore((state) => state.engineBId);
  const setA = useStore((state) => state.setEngineAId);
  const setB = useStore((state) => state.setEngineBId);
  const swap = useStore((state) => state.swapEngines);
  const add = useStore((state) => state.addEngineInstance);
  const compareStatus = useStore((state) => state.compareStatus);
  const results = useStore((state) => state.results);
  const lastCompared = useStore((state) => state.lastComparedInstances);
  const selectedA = instances.find((item) => item.id === aId);
  const selectedB = instances.find((item) => item.id === bId);
  const resultA = results?.engineA ?? results?.osrm;
  const resultB = results?.engineB ?? results?.valhalla;

  return (
    <div className="engine-manager">
      {view !== "manager" ? <div className="comparison-selector">
        <label>Engine A<select value={aId} onChange={(event) => setA(event.target.value)}>{instances.map((item) => <option key={item.id} value={item.id}>{display(item)}</option>)}</select></label>
        <button type="button" className="comparison-selector__swap" onClick={swap} aria-label="Swap Engine A and Engine B">⇄ Swap</button>
        <label>Engine B<select value={bId} onChange={(event) => setB(event.target.value)}>{instances.map((item) => <option key={item.id} value={item.id}>{display(item)}</option>)}</select></label>
      </div> : null}
      {view !== "manager" ? <>
        <div className="engine-slot-status" data-state={resultA?.status ?? "idle"}><strong>A</strong> {compareStatus === "loading" ? "Loading…" : selectedA && lastCompared?.a.type === selectedA.type && lastCompared.a.port === selectedA.port ? resultStatus(resultA, selectedA) : "Not checked"}</div>
        <div className="engine-slot-status" data-state={resultB?.status ?? "idle"}><strong>B</strong> {compareStatus === "loading" ? "Loading…" : selectedB && lastCompared?.b.type === selectedB.type && lastCompared.b.port === selectedB.port ? resultStatus(resultB, selectedB) : "Not checked"}</div>
        {aId === bId && <p className="engine-manager__note">Both slots use the same instance. This is allowed.</p>}
      </> : null}
      {view !== "selector" ? <div className="engine-manager__instances">
        {instances.map((instance) => <InstanceRow key={instance.id} instance={instance} canRemove={instances.length > 1} />)}
        <button type="button" onClick={add}>+ Add instance</button>
        <p className="engine-manager__note">Instances are saved in this browser. The backend always connects to localhost using only the selected port.</p>
      </div> : null}
    </div>
  );
}
