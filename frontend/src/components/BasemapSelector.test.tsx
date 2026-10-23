import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BASEMAP_OPTIONS } from "../map/basemap";
import BasemapSelector from "./BasemapSelector";

describe("BasemapSelector", () => {
  it("shows every available choice and identifies the selected option", () => {
    render(<BasemapSelector value="clean" />);
    const trigger = screen.getByRole("button", { name: "Basemap: Clean" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("option")).toHaveLength(BASEMAP_OPTIONS.length);
    expect(screen.getByRole("option", { name: "Clean" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "Clean" })).toHaveTextContent("✓");
  });

  it("selects with pointer input and closes when clicking outside", () => {
    const onChange = vi.fn();
    render(<div><BasemapSelector value="detailed" onChange={onChange} /><button type="button">Outside</button></div>);

    fireEvent.click(screen.getByRole("button", { name: "Basemap: Detailed" }));
    fireEvent.pointerMove(screen.getByRole("option", { name: "Clean" }));
    expect(screen.getByRole("option", { name: "Clean" })).toHaveClass("toolbar-basemap__option--active");
    fireEvent.click(screen.getByRole("option", { name: "Clean" }));
    expect(onChange).toHaveBeenCalledWith("clean");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Basemap: Detailed" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("supports arrow keys, Home, End, Enter, Space, and Escape", () => {
    const onChange = vi.fn();
    render(<BasemapSelector value="detailed" onChange={onChange} />);
    const trigger = screen.getByRole("button", { name: "Basemap: Detailed" });

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    let listbox = screen.getByRole("listbox", { name: "Basemap options" });
    expect(screen.getByRole("option", { name: "Clean" })).toHaveClass("toolbar-basemap__option--active");
    fireEvent.keyDown(listbox, { key: "Escape" });
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    listbox = screen.getByRole("listbox", { name: "Basemap options" });
    fireEvent.keyDown(listbox, { key: "End" });
    const lastOption = BASEMAP_OPTIONS[BASEMAP_OPTIONS.length - 1];
    expect(screen.getByRole("option", { name: lastOption.label })).toHaveClass("toolbar-basemap__option--active");
    fireEvent.keyDown(listbox, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith(lastOption.value);

    fireEvent.click(trigger);
    listbox = screen.getByRole("listbox", { name: "Basemap options" });
    fireEvent.keyDown(listbox, { key: "Home" });
    fireEvent.keyDown(listbox, { key: " " });
    expect(onChange).toHaveBeenLastCalledWith(BASEMAP_OPTIONS[0].value);
  });

  it("skips disabled choices for keyboard and pointer selection", () => {
    const onChange = vi.fn();
    const options = [
      { value: "detailed" as const, label: "Detailed" },
      { value: "clean" as const, label: "Clean", disabled: true },
      { value: "legacy" as const, label: "Legacy" },
    ];
    render(<BasemapSelector value="detailed" onChange={onChange} options={options} />);
    const trigger = screen.getByRole("button", { name: "Basemap: Detailed" });

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const listbox = screen.getByRole("listbox");
    expect(screen.getByRole("option", { name: "Clean" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("option", { name: "Legacy" })).toHaveClass("toolbar-basemap__option--active");
    fireEvent.click(screen.getByRole("option", { name: "Clean" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(listbox).toBeInTheDocument();
  });

  it("exposes the selected provider in the trigger's accessible name", () => {
    const { rerender } = render(<BasemapSelector value="detailed" />);
    expect(screen.getByRole("button")).toHaveAccessibleName("Basemap: Detailed");

    rerender(<BasemapSelector value="clean" />);
    expect(screen.getByRole("button")).toHaveAccessibleName("Basemap: Clean");

    rerender(<BasemapSelector value="legacy" />);
    expect(screen.getByRole("button")).toHaveAccessibleName("Basemap: Legacy");

    rerender(
      <BasemapSelector
        value="custom"
        options={[{ value: "custom", label: "Custom style" }]}
      />,
    );
    expect(screen.getByRole("button")).toHaveAccessibleName("Basemap: Custom style");
  });

  it("closes on Tab and returns focus to the mounted trigger without selecting", () => {
    const onChange = vi.fn();
    render(
      <div>
        <BasemapSelector value="detailed" onChange={onChange} />
        <button type="button">After</button>
      </div>,
    );
    const trigger = screen.getByRole("button", { name: "Basemap: Detailed" });

    fireEvent.click(trigger);
    const listbox = screen.getByRole("listbox", { name: "Basemap options" });
    fireEvent.keyDown(listbox, { key: "Tab" });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    // Focus is restored to the still-mounted trigger, never lost to <body>,
    // so the browser can continue native Tab navigation from the control.
    expect(trigger).toHaveFocus();
    expect(document.body).not.toHaveFocus();
  });

  it("closes on Shift+Tab and returns focus to the trigger without selecting", () => {
    const onChange = vi.fn();
    render(
      <div>
        <button type="button">Before</button>
        <BasemapSelector value="detailed" onChange={onChange} />
      </div>,
    );
    const trigger = screen.getByRole("button", { name: "Basemap: Detailed" });

    fireEvent.click(trigger);
    const listbox = screen.getByRole("listbox", { name: "Basemap options" });
    fireEvent.keyDown(listbox, { key: "Tab", shiftKey: true });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
    expect(document.body).not.toHaveFocus();
  });
});
