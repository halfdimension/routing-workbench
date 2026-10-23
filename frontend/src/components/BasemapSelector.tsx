import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  BASEMAP_OPTIONS,
  defaultBasemap,
  type Basemap,
} from "../map/basemap";

type BasemapOption = (typeof BASEMAP_OPTIONS)[number];

function enabledIndex(
  options: ReadonlyArray<BasemapOption>,
  start: number,
  direction: 1 | -1,
) {
  if (options.length === 0) return -1;
  for (let offset = 1; offset <= options.length; offset += 1) {
    const index = (start + direction * offset + options.length) % options.length;
    if (!options[index].disabled) return index;
  }
  return -1;
}

export default function BasemapSelector({
  value = defaultBasemap(),
  onChange = () => undefined,
  options = BASEMAP_OPTIONS,
}: {
  value?: Basemap;
  onChange?: (value: Basemap) => void;
  options?: ReadonlyArray<BasemapOption>;
}) {
  const [open, setOpen] = useState(false);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const id = useId();
  const listboxId = `${id}-basemap-listbox`;
  const selectedOption = options[selectedIndex];

  useEffect(() => {
    if (open) listboxRef.current?.focus();
  }, [open, options, selectedIndex]);

  useEffect(() => {
    if (open) return;
    setActiveIndex(selectedIndex >= 0 && !options[selectedIndex].disabled
      ? selectedIndex
      : enabledIndex(options, -1, 1));
  }, [open, options, selectedIndex]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  const openWithIndex = (index: number) => {
    if (index >= 0) setActiveIndex(index);
    setOpen(true);
  };

  const selectActive = () => {
    const option = options[activeIndex];
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const start = selectedIndex >= 0 ? selectedIndex : direction === 1 ? -1 : 0;
      openWithIndex(enabledIndex(options, start, direction));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      openWithIndex(enabledIndex(options, event.key === "Home" ? -1 : 0, event.key === "Home" ? 1 : -1));
    }
  };

  const onListboxKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = enabledIndex(options, activeIndex, event.key === "ArrowDown" ? 1 : -1);
      if (next >= 0) setActiveIndex(next);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const next = enabledIndex(options, event.key === "Home" ? -1 : 0, event.key === "Home" ? 1 : -1);
      if (next >= 0) setActiveIndex(next);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectActive();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === "Tab") {
      // Closing the listbox unmounts the currently focused element. Move focus
      // back to the always-mounted trigger first so the browser's sequential
      // focus navigation continues from the control (Tab -> next, Shift+Tab ->
      // previous) instead of dropping to document.body. Default is not
      // prevented, so native Tab/Shift+Tab proceeds from the trigger.
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <div className="toolbar-basemap" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="toolbar-basemap__trigger"
        aria-label={selectedOption ? `Basemap: ${selectedOption.label}` : "Basemap"}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="toolbar-basemap__value">{selectedOption?.label ?? "Basemap"}</span>
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3" /></svg>
      </button>
      {open ? (
        <ul
          ref={listboxRef}
          id={listboxId}
          className="toolbar-basemap__listbox"
          role="listbox"
          aria-label="Basemap options"
          aria-activedescendant={activeIndex >= 0 ? `${id}-basemap-${activeIndex}` : undefined}
          tabIndex={-1}
          onKeyDown={onListboxKeyDown}
        >
          {options.map((option, index) => (
            <li
              id={`${id}-basemap-${index}`}
              key={option.value}
              className={index === activeIndex ? "toolbar-basemap__option--active" : undefined}
              role="option"
              aria-selected={option.value === value}
              aria-disabled={option.disabled || undefined}
              onPointerMove={() => { if (!option.disabled) setActiveIndex(index); }}
              onClick={() => {
                if (option.disabled) return;
                onChange(option.value);
                setOpen(false);
                triggerRef.current?.focus();
              }}
            >
              <span>{option.label}</span>
              <span className="toolbar-basemap__check" aria-hidden="true">
                {option.value === value ? "✓" : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
