import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BASEMAP_OPTIONS } from "../map/basemap";
import BasemapSelector from "./BasemapSelector";

describe("BasemapSelector", () => {
  it("shows every available choice and identifies the selected option", () => {
    render(<BasemapSelector value="clean" />);
    const trigger = screen.getByRole("button", { name: "Basemap" });
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

    fireEvent.click(screen.getByRole("button", { name: "Basemap" }));
    fireEvent.pointerMove(screen.getByRole("option", { name: "Clean" }));
    expect(screen.getByRole("option", { name: "Clean" })).toHaveClass("toolbar-basemap__option--active");
    fireEvent.click(screen.getByRole("option", { name: "Clean" }));
    expect(onChange).toHaveBeenCalledWith("clean");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Basemap" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("supports arrow keys, Home, End, Enter, Space, and Escape", () => {
    const onChange = vi.fn();
    render(<BasemapSelector value="detailed" onChange={onChange} />);
    const trigger = screen.getByRole("button", { name: "Basemap" });

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
    const trigger = screen.getByRole("button", { name: "Basemap" });

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const listbox = screen.getByRole("listbox");
    expect(screen.getByRole("option", { name: "Clean" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("option", { name: "Legacy" })).toHaveClass("toolbar-basemap__option--active");
    fireEvent.click(screen.getByRole("option", { name: "Clean" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(listbox).toBeInTheDocument();
  });
});
