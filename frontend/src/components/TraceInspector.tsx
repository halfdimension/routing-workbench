import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type CSSProperties,
} from "react";
import {
  STRUCTURAL_MAP_MIN_HEIGHT,
  useVerticalPanelResize,
} from "../layout/useVerticalPanelResize";
import { flattenRoutes, useStore } from "../store";
import type { CompareDebug } from "../types";
import EdgeDetailsPanel from "./EdgeDetailsPanel";
import JsonViewer from "./JsonViewer";
import TraceMap from "./TraceMap";
import TraceRouteAnalysis from "./TraceRouteAnalysis";
import { BASEMAP_OPTIONS, type Basemap } from "../map/basemap";

export const TRACE_DETAILS_DEFAULT_HEIGHT = 180;
export const TRACE_DETAILS_MIN_HEIGHT = 140;

export default function TraceInspector({
  basemap = "detailed",
  onBasemapChange = () => undefined,
}: {
  basemap?: Basemap;
  onBasemapChange?: (basemap: Basemap) => void;
}) {
  const results = useStore((state) => state.results);
  const sourceRouteId = useStore((state) => state.traceSourceRouteId);
  const status = useStore((state) => state.traceStatus);
  const result = useStore((state) => state.traceResult);
  const error = useStore((state) => state.traceError);
  const pinnedIds = useStore((state) => state.tracePinnedSegmentIds);
  const pinnedPoint = useStore((state) => state.tracePinnedPoint);
  const pinned = useStore((state) => state.traceInspectorPinned);
  const detailsCollapsed = useStore((state) => state.traceDetailsCollapsed);
  const preferredDetailsHeight = useStore(
    (state) => state.traceDetailsExpandedHeight,
  );
  const setSource = useStore((state) => state.setTraceSourceRouteId);
  const runTrace = useStore((state) => state.runValhallaTrace);
  const clearPin = useStore((state) => state.clearTracePin);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const detailsRef = useRef<HTMLElement | null>(null);
  const toggleDetails = useStore((state) => state.toggleTraceDetailsCollapsed);
  const setPreferredDetailsHeight = useStore(
    (state) => state.setTraceDetailsExpandedHeight,
  );
  const requestFit = useStore((state) => state.requestTraceFit);
  const continuityOverlay = useStore(
    (state) => state.traceContinuityOverlayEnabled,
  );
  const toggleContinuityOverlay = useStore(
    (state) => state.toggleTraceContinuityOverlay,
  );
  const lowerTab = useStore((state) => state.traceLowerTab);
  const setLowerTab = useStore((state) => state.setTraceLowerTab);
  const detailsCompact =
    detailsCollapsed || (lowerTab === "edge-details" && !pinned);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [settingsHeight, setSettingsHeight] = useState(104);
  const dragStart = useRef<{ pointerId: number; y: number; height: number } | null>(null);
  const resizeSettings = (height: number) => setSettingsHeight(Math.max(88, Math.min(220, height)));
  const onSettingsPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragStart.current = { pointerId: event.pointerId, y: event.clientY, height: settingsHeight };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onSettingsPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStart.current?.pointerId === event.pointerId) resizeSettings(dragStart.current.height + event.clientY - dragStart.current.y);
  };
  const stopSettingsDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStart.current?.pointerId !== event.pointerId) return;
    dragStart.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
  };
  const onSettingsKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    resizeSettings(settingsHeight + (event.key === "ArrowDown" ? 10 : -10));
  };
  const {
    liveHeight: liveDetailsHeight,
    minimumHeight: minimumDetailsHeight,
    maximumHeight: maximumDetailsHeight,
    resizing: resizingDetails,
    layoutRevision,
    resizeHandleProps,
  } = useVerticalPanelResize({
    workspaceRef,
    panelRef: detailsRef,
    preferredHeight: preferredDetailsHeight,
    panelMinimum: TRACE_DETAILS_MIN_HEIGHT,
    onPreferredHeightChange: setPreferredDetailsHeight,
    disabled: detailsCompact,
    bodyClassName: "is-resizing-trace-details",
  });

  const comparisonIsLocal = (results?.routingTarget ?? "local") === "local";
  const comparisonRoutes = results ? flattenRoutes(results) : [];
  const osrmRoutes = comparisonIsLocal
    ? comparisonRoutes.filter((route) => route.engine === "osrm")
    : [];
  const sourceRoute =
    osrmRoutes.find((route) => route.id === sourceRouteId) ?? osrmRoutes[0];
  const usableResult =
    result && result.sourceRouteId === sourceRoute?.id ? result : null;
  const traceRouteId = sourceRoute ? `trace:${sourceRoute.id}` : "trace:none";
  const visibility = useMemo(() => ({ [traceRouteId]: true }), [traceRouteId]);
  const routeLabels = useMemo(
    () => ({
      [traceRouteId]: sourceRoute
        ? `Valhalla Trace — ${sourceRoute.label}`
        : "Valhalla Trace",
    }),
    [sourceRoute, traceRouteId],
  );
  const debug = useMemo<CompareDebug | null>(
    () =>
      usableResult
        ? {
            osrm: { engine: "osrm", status: "ok", segments: [], errors: [] },
            valhalla: {
              engine: "valhalla",
              status: usableResult.status === "error" ? "error" : usableResult.status,
              segments: usableResult.segments,
              errors: usableResult.errors,
            },
          }
        : null,
    [usableResult],
  );
  const pointCounts = useMemo(() => {
    const counts = { matched: 0, interpolated: 0, unmatched: 0, flags: 0 };
    for (const point of usableResult?.matchedPoints ?? []) {
      counts[point.type] += 1;
      if (point.beginRouteDiscontinuity || point.endRouteDiscontinuity) {
        counts.flags += 1;
      }
    }
    return counts;
  }, [usableResult]);
  const continuityLabel =
    usableResult?.continuity.isContinuous === true
      ? "CONTINUOUS"
      : usableResult?.continuity.isContinuous === false
        ? "BROKEN"
        : "UNKNOWN / UNAVAILABLE";

  useEffect(() => {
    if (!sourceRouteId && osrmRoutes[0]) {
      setSource(osrmRoutes[0].id);
    }
  }, [osrmRoutes, setSource, sourceRouteId]);

  const workspaceStyle: CSSProperties | undefined = detailsCompact
    ? undefined
    : {
        gridTemplateRows:
          `minmax(${STRUCTURAL_MAP_MIN_HEIGHT}px, 1fr) ${liveDetailsHeight}px`,
      };

  return (
    <main className="trace-inspector" aria-label="Trace Inspector">
      <header className="trace-toolbar">
        <div className="trace-toolbar__identity"><h1>Trace Inspector</h1><span>Local Valhalla</span></div>
        <label className="trace-route-select"><span className="sr-only">Source OSRM route</span>
          <select
            aria-label="Route"
            title={sourceRoute?.label}
            value={sourceRoute?.id ?? ""}
            disabled={osrmRoutes.length === 0 || status === "loading"}
            onChange={(event) => setSource(event.target.value)}
          >
            {osrmRoutes.map((route) => (
              <option key={route.id} value={route.id}>{route.label}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="trace-controls__run"
          disabled={!sourceRoute || status === "loading"}
          onClick={() => void runTrace()}
        >
          {status === "loading" ? "Running…" : "Run Trace"}
        </button>
        <label className="trace-controls__toggle">
          <input
            type="checkbox"
            checked={continuityOverlay}
            onChange={toggleContinuityOverlay}
          />
          <span>Continuity</span>
        </label>
        <button type="button" className="trace-toolbar__plain" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((value) => !value)}>Settings</button>
        <button type="button" className="toolbar__fit-btn" onClick={requestFit}>Fit Routes</button>
        <label className="trace-basemap"><span className="sr-only">Basemap</span><select aria-label="Trace basemap" value={basemap} onChange={(event) => onBasemapChange(event.target.value as Basemap)}>{BASEMAP_OPTIONS.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}</select></label>
      </header>

      {settingsOpen ? <section className="trace-settings" style={{ height: settingsHeight }} aria-label="Trace settings">
        <dl><div><dt>Source</dt><dd>OSRM</dd></div><div><dt>Trace engine</dt><dd>Local Valhalla</dd></div><div><dt>Costing</dt><dd>motorcycle</dd></div><div><dt>Shape match</dt><dd>map_snap</dd></div></dl>
        <div className="trace-settings__resize" role="separator" aria-label="Resize trace settings" aria-orientation="horizontal" aria-valuemin={88} aria-valuemax={220} aria-valuenow={settingsHeight} tabIndex={0} onPointerDown={onSettingsPointerDown} onPointerMove={onSettingsPointerMove} onPointerUp={stopSettingsDrag} onPointerCancel={stopSettingsDrag} onLostPointerCapture={stopSettingsDrag} onKeyDown={onSettingsKeyDown}><span /></div>
      </section> : null}

      {osrmRoutes.length === 0 ? (
        <div className="trace-empty" role="status">
          {comparisonIsLocal
            ? "Run a route comparison first."
            : "Trace Inspector is Local-only. Run a Local comparison first."}
        </div>
      ) : null}

      {error && !usableResult ? <div className="trace-error" role="alert">{error}</div> : null}

      {usableResult ? (
        <section className="trace-summary" aria-label="Trace summary">
          <div><span>Matched</span><strong>{pointCounts.matched}</strong></div>
          <div><span>Interpolated</span><strong>{pointCounts.interpolated}</strong></div>
          <div><span>Unmatched</span><strong>{pointCounts.unmatched}</strong></div>
          <div>
            <span>Continuity</span>
            <strong className={
              usableResult.continuity.isContinuous === true
                ? "trace-summary__yes"
                : usableResult.continuity.isContinuous === false
                  ? "trace-summary__broken"
                  : "trace-summary__unknown"
            }>
              {continuityLabel}
            </strong>
          </div>
          <button type="button" className="trace-summary__more" aria-expanded={summaryOpen} onClick={() => setSummaryOpen((value) => !value)}>More details</button>
          {usableResult.errors.length > 0 ? <span className="trace-summary__alert" role="alert">{usableResult.errors[0].message}</span> : usableResult.warnings.length > 0 ? <span className="trace-summary__alert" role="status">{usableResult.warnings.length} warning{usableResult.warnings.length === 1 ? "" : "s"}</span> : null}
          {summaryOpen ? <div className="trace-summary__details">
            <div><span>Source route</span><strong>{sourceRoute?.label}</strong></div><div><span>Original points</span><strong>{usableResult.originalPointCount}</strong></div><div><span>Trace points</span><strong>{usableResult.tracePointCount}</strong></div><div><span>Exact geometry</span><strong>{usableResult.exactGeometryMatch ? "Yes" : "No"}</strong></div><div><span>Point flags</span><strong>{pointCounts.flags}</strong></div><div><span>Components</span><strong>{usableResult.continuity.componentCount}</strong></div><div><span>Breaks</span><strong>{usableResult.continuity.breakCount}</strong></div>
            {usableResult.warnings.map((warning, index) => <p className="trace-summary__warning" role="status" key={`${warning.kind}:${index}`}>{warning.message}</p>)}
            {usableResult.errors.map((traceError, index) => <p className="trace-summary__error" role="status" key={`${traceError.kind}:${index}`}>{traceError.message}</p>)}
            {(usableResult.rawTraceAttributes != null || usableResult.rawTraceRoute != null) ? <details className="trace-raw-responses"><summary>Raw Trace Responses</summary><details><summary>trace_attributes</summary><JsonViewer value={usableResult.rawTraceAttributes} /></details><details><summary>trace_route</summary><JsonViewer value={usableResult.rawTraceRoute} /></details></details> : null}
          </div> : null}
        </section>
      ) : null}

      <div
        ref={workspaceRef}
        className={
          "trace-workspace" +
          (detailsCompact ? " trace-workspace--details-compact" : "") +
          (resizingDetails ? " trace-workspace--resizing" : "")
        }
        style={workspaceStyle}
      >
        <TraceMap
          sourceRoute={sourceRoute}
          basemap={basemap}
          compactDetails={detailsCompact}
          layoutRevision={layoutRevision + settingsHeight + (settingsOpen ? 1 : 0)}
        />
        <section
          ref={detailsRef}
          className={"trace-details" + (detailsCompact ? " trace-details--compact" : "")}
          aria-label="Trace edge details"
        >
          {!detailsCompact ? (
            <div
              className="trace-details__resize-handle"
              data-testid="trace-details-resize-handle"
              role="separator"
              aria-label="Resize pinned trace edge details"
              aria-orientation="horizontal"
              aria-valuemin={Math.round(minimumDetailsHeight)}
              aria-valuemax={Math.round(maximumDetailsHeight)}
              aria-valuenow={Math.round(liveDetailsHeight)}
              aria-valuetext={`${Math.round(liveDetailsHeight)} pixels`}
              tabIndex={0}
              title="Drag to resize pinned trace edge details"
              {...resizeHandleProps}
            >
              <span />
            </div>
          ) : null}
          <div
            className="trace-details__tabs"
            role="tablist"
            aria-label="Trace analysis workspace"
          >
            <button
              type="button"
              role="tab"
              aria-selected={lowerTab === "edge-details"}
              onClick={() => setLowerTab("edge-details")}
            >
              Edge Details
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={lowerTab === "route-analysis"}
              onClick={() => setLowerTab("route-analysis")}
            >
              Route Analysis
            </button>
            {detailsCompact && lowerTab === "edge-details" && !pinned ? (
              <span className="trace-details__compact-status">
                No pinned edge
              </span>
            ) : null}
            {lowerTab === "route-analysis" || (detailsCompact && !pinned) ? (
              <button
              type="button"
              className="trace-details__collapse"
              aria-expanded={!detailsCompact}
              aria-label={
                lowerTab === "edge-details"
                  ? `${detailsCompact ? "Expand" : "Collapse"} pinned trace edge details`
                  : `${detailsCompact ? "Expand" : "Collapse"} trace route analysis`
              }
              disabled={lowerTab === "edge-details" && !pinned}
              onClick={toggleDetails}
            >
              {detailsCompact ? "Expand" : "Collapse"}
              </button>
            ) : null}
          </div>
          {!detailsCompact || (lowerTab === "edge-details" && pinned) ? (
            <div
              className="trace-details__body"
              hidden={detailsCompact && !pinned}
            >
              {lowerTab === "edge-details" ? (
                <EdgeDetailsPanel
                  debug={debug}
                  routeLabels={routeLabels}
                  visibility={visibility}
                  pinnedIds={pinnedIds}
                  pinned={pinned}
                  point={pinnedPoint}
                  onClear={clearPin}
                  collapsible
                  collapsed={detailsCollapsed}
                  onToggleCollapsed={toggleDetails}
                  title="PINNED TRACE EDGE DETAILS"
                />
              ) : (
                <TraceRouteAnalysis
                  sourceRoute={sourceRoute}
                  result={usableResult}
                />
              )}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
