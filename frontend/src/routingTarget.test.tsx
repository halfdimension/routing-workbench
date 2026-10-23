import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Toolbar from "./components/Toolbar";
import RequestPreview from "./components/RequestPreview";
import RawResponseInspector from "./components/RawResponseInspector";
import LeftSidebar from "./components/LeftSidebar";
import { useStore } from "./store";
import type { CompareResponse } from "./types";

vi.mock("./api", () => ({
  compare: vi.fn(),
  health: vi.fn(),
  osrmRaw: vi.fn(),
  valhallaRaw: vi.fn(),
  curlImport: vi.fn(),
  valhallaTrace: vi.fn(),
}));

import * as api from "./api";

function response(target: "local" | "prod"): CompareResponse {
  const empty = {
    status: "ok" as const,
    httpStatus: 200,
    durationMs: 1,
    normalizedRoutes: [],
    raw: { target },
    warnings: [],
    error: null,
  };
  return {
    routingTarget: target,
    osrm: { ...empty, engine: "osrm" },
    valhalla: { ...empty, engine: "valhalla" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useStore.setState({
    start: { lat: 28.651770012429765, lon: 77.36783435642826 },
    dest: { lat: 28.631769137973578, lon: 77.11696030930938 },
    routingTarget: "local",
    results: null,
    routes: [],
    visibility: {},
    selectedRouteId: null,
    edgeDebugEnabled: false,
    debugResults: null,
    compareStatus: "idle",
    lastError: null,
    latestResponseSource: { osrm: null, valhalla: null },
    osrmRawState: { status: "idle", result: null, error: null },
    valhallaRawState: { status: "idle", result: null, error: null },
    health: { osrm: "unknown", valhalla: "unknown" },
  });
});

describe("routing target", () => {
  it("defaults to Local and toggling target sends no request or mutates inputs/results", () => {
    const oldResults = response("local");
    useStore.setState({ results: oldResults, edgeDebugEnabled: true });
    render(<Toolbar />);

    expect(screen.getByRole("button", { name: "Local" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const start = useStore.getState().start;
    const dest = useStore.getState().dest;
    fireEvent.click(screen.getByRole("button", { name: "Prod" }));

    expect(api.compare).not.toHaveBeenCalled();
    expect(useStore.getState().start).toEqual(start);
    expect(useStore.getState().dest).toEqual(dest);
    expect(useStore.getState().results).toBe(oldResults);
    expect(useStore.getState().edgeDebugEnabled).toBe(false);
    expect(screen.queryByRole("button", { name: "Edge Debug: OFF" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Local" }));
    expect(screen.getByRole("button", { name: "Edge Debug: OFF" })).not.toBeDisabled();
  });

  it("sends the selected target on the next explicit Compare", async () => {
    vi.mocked(api.compare).mockResolvedValue(response("prod"));
    useStore.getState().setRoutingTarget("prod");
    await useStore.getState().runCompare();

    expect(api.compare).toHaveBeenCalledWith(
      { lat: 28.651770012429765, lon: 77.36783435642826 },
      { lat: 28.631769137973578, lon: 77.11696030930938 },
      false,
      "prod",
    );
    expect(useStore.getState().results?.routingTarget).toBe("prod");
    expect(useStore.getState().results?.engineA?.instance).toMatchObject({
      type: "osrm",
      label: "Production OSRM",
    });
    expect(useStore.getState().results?.engineB?.instance).toMatchObject({
      type: "valhalla",
      label: "Production Valhalla",
    });
    expect(useStore.getState().lastComparedInstances).toBeNull();
  });

  it("renders a minimal Prod sidebar without local-only engine tools", () => {
    useStore.setState({ routingTarget: "prod", results: response("local") });
    render(<LeftSidebar />);
    expect(screen.getByText("Production OSRM")).toBeInTheDocument();
    expect(screen.getByText("Production Valhalla")).toBeInTheDocument();
    expect(screen.queryByLabelText("Swap Engine A and Engine B")).not.toBeInTheDocument();
    expect(screen.queryByText("Manage Instances")).not.toBeInTheDocument();
    expect(screen.queryByText("Curl Import")).not.toBeInTheDocument();
    expect(screen.getByText(/Showing previous Local results/)).toBeInTheDocument();
  });

  it("keeps displayed result provenance Local after the selector moves to Prod", () => {
    useStore.setState({
      results: response("local"),
      routingTarget: "prod",
      latestResponseSource: { osrm: "compare", valhalla: "compare" },
    });
    render(<RawResponseInspector engine="osrm" />);
    expect(screen.getByTestId("raw-inspector-source-osrm")).toHaveTextContent(
      "Compare · Local",
    );
  });

  it("switches previews between unchanged Local requests and redacted Prod URLs", () => {
    const { unmount } = render(<RequestPreview />);
    expect(screen.getByText(/http:\/\/localhost:5000\/route\/v1\/biking/)).toBeInTheDocument();
    expect(screen.getByText(/"costing": "motorcycle"/)).toBeInTheDocument();
    unmount();

    useStore.getState().setRoutingTarget("prod");
    render(<RequestPreview />);
    expect(screen.getByText(/advancedmaps\/v1\/<TOKEN>\/route_eta\/biking/)).toBeInTheDocument();
    expect(screen.getByText(/access_token=<TOKEN>/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("TEST_TOKEN_DO_NOT_USE");
  });
});
