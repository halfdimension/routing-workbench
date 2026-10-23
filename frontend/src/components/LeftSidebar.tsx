import type { ReactNode } from "react";
import { useStore } from "../store";
import CoordinateInputs from "./CoordinateInputs";
import RequestPreview from "./RequestPreview";
import CurlImport from "./CurlImport";
import TestCases from "./TestCases";
import EngineInstanceManager from "./EngineInstanceManager";

function WorkflowGroup({ title, children }: { title: string; children: ReactNode }) {
  return <section className="workflow-group"><h2>{title}</h2><div className="workflow-group__body">{children}</div></section>;
}

function ToolDisclosure({ title, children }: { title: string; children: ReactNode }) {
  return <details className="tool-disclosure"><summary><span>{title}</span><span aria-hidden="true">›</span></summary><div className="tool-disclosure__body">{children}</div></details>;
}

function MapSelection() {
  const mapClickTarget = useStore((s) => s.mapClickTarget);
  const setMapClickTarget = useStore((s) => s.setMapClickTarget);
  const arm = (target: "start" | "dest") => setMapClickTarget(mapClickTarget === target ? null : target);
  return <div className="map-selection">
    <button type="button" className={mapClickTarget === "start" ? "map-selection__btn map-selection__btn--armed" : "map-selection__btn"} aria-pressed={mapClickTarget === "start"} onClick={() => arm("start")}><span className="map-selection__dot map-selection__dot--start" aria-hidden="true" /> Pick Start</button>
    <button type="button" className={mapClickTarget === "dest" ? "map-selection__btn map-selection__btn--armed" : "map-selection__btn"} aria-pressed={mapClickTarget === "dest"} onClick={() => arm("dest")}><span className="map-selection__dot map-selection__dot--dest" aria-hidden="true" /> Pick Destination</button>
    {mapClickTarget ? <p className="map-selection__hint">Click the map to set the {mapClickTarget === "start" ? "start" : "destination"}.</p> : null}
  </div>;
}

function ModeToggle() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  return <div className="mode-toggle" role="group" aria-label="Request mode">
    <button type="button" className={mode === "normal" ? "mode-toggle__btn mode-toggle__btn--active" : "mode-toggle__btn"} aria-pressed={mode === "normal"} onClick={() => setMode("normal")}>Normal</button>
    <button type="button" className={mode === "advanced" ? "mode-toggle__btn mode-toggle__btn--active" : "mode-toggle__btn"} aria-pressed={mode === "advanced"} onClick={() => setMode("advanced")}>Advanced</button>
  </div>;
}

export default function LeftSidebar() {
  const collapsed = useStore((s) => s.leftCollapsed);
  const toggle = useStore((s) => s.toggleLeftCollapsed);
  const routingTarget = useStore((s) => s.routingTarget);
  const resultsTarget = useStore((s) => s.results?.routingTarget);
  const staleTarget = resultsTarget && resultsTarget !== routingTarget ? resultsTarget : null;
  return <aside className={collapsed ? "left-sidebar left-sidebar--collapsed" : "left-sidebar"} aria-label="Controls">
    <button type="button" className="panel-collapse panel-collapse--left" data-testid="collapse-left" aria-expanded={!collapsed} aria-label={collapsed ? "Expand left panel" : "Collapse left panel"} title={collapsed ? "Expand left panel" : "Collapse left panel"} onClick={toggle}>{collapsed ? "›" : "‹"}</button>
    {!collapsed ? <div className="left-sidebar__content">
      {staleTarget ? <p className="result-provenance" role="status">Showing previous {staleTarget === "local" ? "Local" : "Prod"} results — compare to load {routingTarget === "local" ? "Local" : "Prod"}.</p> : null}
      <WorkflowGroup title={routingTarget === "prod" ? "Production Route" : "Route Setup"}><CoordinateInputs /><MapSelection /></WorkflowGroup>
      {routingTarget === "local" ? <>
        <WorkflowGroup title="Compare Engines"><EngineInstanceManager view="selector" /></WorkflowGroup>
        <WorkflowGroup title="Request Mode"><ModeToggle /></WorkflowGroup>
        <WorkflowGroup title="Additional Tools">
          <ToolDisclosure title="Saved Test Cases"><TestCases /></ToolDisclosure>
          <ToolDisclosure title="Manage Instances"><EngineInstanceManager view="manager" /></ToolDisclosure>
          <ToolDisclosure title="Request Preview"><RequestPreview /></ToolDisclosure>
          <ToolDisclosure title="Curl Import"><CurlImport /></ToolDisclosure>
        </WorkflowGroup>
      </> : <>
        <WorkflowGroup title="Routing Engines"><div className="prod-engines" aria-label="Production routing engines"><div><strong>A</strong><span>Production OSRM</span></div><div><strong>B</strong><span>Production Valhalla</span></div><p>Uses configured production APIs</p></div></WorkflowGroup>
        <WorkflowGroup title="Additional Tools"><ToolDisclosure title="Saved Test Cases"><TestCases /></ToolDisclosure><ToolDisclosure title="Prod Request Preview"><RequestPreview /></ToolDisclosure></WorkflowGroup>
      </>}
    </div> : null}
  </aside>;
}
