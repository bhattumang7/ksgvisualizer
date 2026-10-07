// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeSelector, themeInitScript } from "@/components/ThemeSelector";

const root = document.documentElement;
beforeEach(() => {
  localStorage.clear();
  delete root.dataset.theme;
});

describe("ThemeSelector", () => {
  it("defaults to system and applies and saves an explicit choice", () => {
    render(<ThemeSelector />);
    const select = screen.getByLabelText("Theme") as HTMLSelectElement;
    expect(select.value).toBe("system");

    fireEvent.change(select, { target: { value: "dark" } });
    expect(root.dataset.theme).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(select.value).toBe("dark");

    fireEvent.change(select, { target: { value: "light" } });
    expect(root.dataset.theme).toBe("light");
  });

  it("clears the override when set back to system", () => {
    localStorage.setItem("theme", "dark");
    root.dataset.theme = "dark";
    render(<ThemeSelector />);
    const select = screen.getByLabelText("Theme") as HTMLSelectElement;
    expect(select.value).toBe("dark");

    fireEvent.change(select, { target: { value: "system" } });
    expect(root.dataset.theme).toBeUndefined();
    expect(localStorage.getItem("theme")).toBeNull();
  });

  it("ignores junk saved values", () => {
    localStorage.setItem("theme", "purple");
    render(<ThemeSelector />);
    expect((screen.getByLabelText("Theme") as HTMLSelectElement).value).toBe("system");
  });
});

describe("themeInitScript", () => {
  it("applies a saved theme before paint, and ignores invalid ones", () => {
    localStorage.setItem("theme", "dark");
    new Function(themeInitScript)();
    expect(root.dataset.theme).toBe("dark");

    delete root.dataset.theme;
    localStorage.setItem("theme", "purple");
    new Function(themeInitScript)();
    expect(root.dataset.theme).toBeUndefined();
  });
});
