import {
  BASEMAP_OPTIONS,
  defaultBasemap,
  type Basemap,
} from "../map/basemap";

export default function BasemapSelector({
  value = defaultBasemap(),
  onChange = () => undefined,
}: {
  value?: Basemap;
  onChange?: (value: Basemap) => void;
}) {
  return (
    <label className="toolbar-basemap">
      <span className="sr-only">Basemap</span>
      <select
        aria-label="Basemap"
        value={value}
        onChange={(event) => onChange(event.target.value as Basemap)}
      >
        {BASEMAP_OPTIONS.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
