/**
 * Unit tests for `resolveMapStyle` (Task 13.1, Req 20.4).
 *
 * These are pure and require no MapLibre instance or jsdom map support: the
 * override argument lets us exercise both branches directly.
 */
import { describe, it, expect } from "vitest";
import { resolveMapStyle, inlineOsmRasterStyle, mapplsRasterStyle, OSM_TILE_URL, styleForBasemap } from "./style";
import { basemapOptions, defaultBasemap, OPENFREEMAP_POSITRON_STYLE_URL, OPENFREEMAP_STYLE_URL } from "./basemap";

describe("resolveMapStyle", () => {
  it("returns OpenFreeMap when no style URL is set", () => {
    expect(resolveMapStyle(undefined)).toBe(OPENFREEMAP_STYLE_URL);
  });

  it("treats an empty / whitespace style URL as unset", () => {
    expect(resolveMapStyle("")).toBe(OPENFREEMAP_STYLE_URL);
    expect(resolveMapStyle("   ")).toBe(OPENFREEMAP_STYLE_URL);
  });

  it("returns the style URL string verbatim when set and non-empty", () => {
    const url = "https://example.com/style.json";
    expect(resolveMapStyle(url)).toBe(url);
  });

  it("does not treat the OSM raster tile URL as a style URL by default", () => {
    // The inline builder embeds the tile URL inside a raster source, never as
    // the top-level style.
    const style = inlineOsmRasterStyle();
    expect(style).not.toBe(OSM_TILE_URL);
    const osm = style.sources.osm as { tiles?: string[] };
    expect(osm.tiles?.[0]).toBe(OSM_TILE_URL);
  });

  it("offers OpenFreeMap and a configured Mappls raster style", () => {
    expect(styleForBasemap("detailed")).toBe(OPENFREEMAP_STYLE_URL);
    expect(styleForBasemap("clean")).toBe(OPENFREEMAP_POSITRON_STYLE_URL);
    expect(styleForBasemap("legacy")).toEqual(inlineOsmRasterStyle());
    const style = mapplsRasterStyle("https://tiles.example/{z}/{x}/{y}.png");
    expect(style?.sources.mappls).toMatchObject({
      type: "raster",
      tiles: ["https://tiles.example/{z}/{x}/{y}.png"],
      tileSize: 256,
    });
  });

  it("only offers Mappls when a tile URL is configured", () => {
    expect(basemapOptions("", "").map((option) => option.label)).toEqual([
      "Detailed", "Clean", "Legacy",
    ]);
    expect(basemapOptions("https://tiles.example/{z}/{x}/{y}.png", "").map(
      (option) => option.label,
    )).toEqual(["Detailed", "Clean", "Legacy", "Mappls"]);
  });

  it("defaults to Mappls only when configured and no custom style wins", () => {
    expect(defaultBasemap("", "")).toBe("detailed");
    expect(defaultBasemap("https://tiles.example/{z}/{x}/{y}.png", "")).toBe("mappls");
    expect(defaultBasemap("https://tiles.example/{z}/{x}/{y}.png", "https://example.com/style.json")).toBe("custom");
    expect(basemapOptions("ignored", "https://example.com/style.json")).toEqual([
      { value: "custom", label: "Custom style" },
    ]);
  });
});
