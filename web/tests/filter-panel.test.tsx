// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilterPanel } from "@/components/FilterPanel";
import { EMPTY_FILTERS } from "@/lib/catalogue";

const opt = (value: string) => ({ value, label: value, count: 1 });
const options = { classes: [opt("Tea"), opt("Floribunda")], colours: [], breeders: [], countries: [] } as never;

describe("FilterPanel", () => {
  it("adds an unselected option and removes a selected one", () => {
    const onChange = vi.fn();
    render(<FilterPanel filters={{ ...EMPTY_FILTERS, classes: ["Tea"] }} options={options} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/Floribunda/));
    expect(onChange).toHaveBeenLastCalledWith({ classes: ["Tea", "Floribunda"] });
    fireEvent.click(screen.getByLabelText(/Tea/));
    expect(onChange).toHaveBeenLastCalledWith({ classes: [] });
  });
});
