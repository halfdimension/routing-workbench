export type Basemap = "openfreemap" | "mappls";

export const OPENFREEMAP_STYLE_URL =
  "https://tiles.openfreemap.org/styles/liberty";

export const MAPPLS_TILE_URL =
  import.meta.env.VITE_MAPPLS_TILE_URL?.trim() ?? "";

export const MAPPLS_SOURCE_ID = "mappls-basemap-source";
export const MAPPLS_LAYER_ID = "mappls-basemap-layer";
