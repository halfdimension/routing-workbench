export type Basemap = "mappls" | "openfreemap";

export const OPENFREEMAP_STYLE_URL =
  "https://tiles.openfreemap.org/styles/liberty";

export const MAPPLS_TILE_URL =
  import.meta.env.VITE_MAPPLS_TILE_URL?.trim() ?? "";
