export type Basemap = "detailed" | "clean" | "legacy" | "mappls";

export const OPENFREEMAP_LIBERTY_STYLE_URL =
  "https://tiles.openfreemap.org/styles/liberty";
export const OPENFREEMAP_POSITRON_STYLE_URL =
  "https://tiles.openfreemap.org/styles/positron";

/** Backwards-compatible name for the default OpenFreeMap style. */
export const OPENFREEMAP_STYLE_URL = OPENFREEMAP_LIBERTY_STYLE_URL;

export const MAPPLS_TILE_URL =
  import.meta.env.VITE_MAPPLS_TILE_URL?.trim() ?? "";

export function basemapOptions(
  mapplsTileUrl: string = MAPPLS_TILE_URL,
): ReadonlyArray<{
  value: Basemap;
  label: string;
  disabled?: boolean;
}> {
  return [
    { value: "detailed", label: "Detailed" },
    { value: "clean", label: "Clean" },
    { value: "legacy", label: "Legacy" },
    ...(mapplsTileUrl.trim()
      ? [{ value: "mappls" as const, label: "Mappls" }]
      : []),
  ];
}

export const BASEMAP_OPTIONS = basemapOptions();
