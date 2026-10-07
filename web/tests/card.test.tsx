// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CardPhotos } from "@/components/CardPhotos";
import { ColourSwatch } from "@/components/ColourSwatch";
import { RoseCard } from "@/components/RoseCard";
import { photo, roses } from "./helpers";

const scrollTo = vi.fn();
beforeEach(() => {
  scrollTo.mockReset();
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 100 });
  HTMLElement.prototype.scrollTo = scrollTo as never;
});

describe("ColourSwatch", () => {
  it("uses the group colour, or grey when unknown", () => {
    const { container, rerender } = render(<ColourSwatch group="red" className="x" />);
    expect((container.firstElementChild as HTMLElement).style.background).toContain("rgb(179, 38, 63)");
    rerender(<ColourSwatch group="nope" />);
    expect((container.firstElementChild as HTMLElement).style.background).toContain("rgb(204, 204, 204)");
  });
});

describe("CardPhotos", () => {
  const three = [photo(1), photo(2, null), photo(3)];

  it("shows a single photo without controls", () => {
    render(<CardPhotos photos={[photo(1)]} name="Rosa" />);
    expect(screen.getByAltText(/Rosa \(1 of 1\)/)).toBeTruthy();
    expect(screen.queryByText("1/1")).toBeNull();
    expect(screen.getByText("Photo: Ann")).toBeTruthy();
  });

  it("tracks the swiped slide, its credit and the arrow buttons", () => {
    const { container } = render(<CardPhotos photos={three} name="Rosa" className="h-1" />);
    expect(screen.getByText("1/3")).toBeTruthy();
    expect(screen.queryByLabelText("Previous photo")).toBeNull();

    fireEvent.click(screen.getByLabelText("Next photo"));
    expect(scrollTo).toHaveBeenCalledWith({ left: 100, behavior: "smooth" });

    const strip = container.querySelector("ul") as HTMLElement;
    strip.scrollLeft = 100;
    fireEvent.scroll(strip);
    expect(screen.getByText("2/3")).toBeTruthy();
    expect(screen.queryByText(/^Photo:/)).toBeNull(); // slide 2 has no credit
    expect(screen.getByLabelText("Previous photo")).toBeTruthy();

    strip.scrollLeft = 200;
    fireEvent.scroll(strip);
    expect(screen.getByText("3/3")).toBeTruthy();
    expect(screen.queryByLabelText("Next photo")).toBeNull();
    fireEvent.click(screen.getByLabelText("Previous photo"));
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 100, behavior: "smooth" });
  });

  it("does not navigate the parent link when an arrow is clicked", () => {
    const onClick = vi.fn();
    render(<a href="/x" onClick={onClick}><CardPhotos photos={three} name="Rosa" /></a>);
    fireEvent.click(screen.getByLabelText("Next photo"));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("RoseCard", () => {
  const rose = roses.find((r) => r.id === "about-face")!;

  it("renders a grid card with meta, awards and price", () => {
    render(<RoseCard rose={{ ...rose, is_new: true, awards: [{ name: "AARS", year: 2004 }] }} />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/rose/about-face");
    expect(screen.getByText("NEW")).toBeTruthy();
    expect(screen.getByText("AARS")).toBeTruthy();
    expect(screen.getByText("₹100")).toBeTruthy();
  });

  it("renders a list card with the colour text and a price on request", () => {
    render(<RoseCard list rose={{ ...rose, price_inr: null, year: null, year_raw: null, breeder_name: null, awards: [] }} />);
    expect(screen.getByText("Price on request")).toBeTruthy();
    expect(screen.getByText(rose.colour_text)).toBeTruthy();
  });

  it("falls back to year_raw and uses the swipeable photos when present", () => {
    const { container } = render(<RoseCard rose={{ ...rose, year: null, year_raw: "c.1990", photos: [photo(1), photo(2)] }} />);
    expect(screen.getByText(/c\.1990/)).toBeTruthy();
    expect(container.querySelectorAll("img")).toHaveLength(2);
    expect(screen.getByText("1/2")).toBeTruthy();
    expect(screen.getByText("Photo: Ann")).toBeTruthy();
    expect(container.querySelector("[aria-hidden]")).toBeNull(); // no colour swatch when photos exist
  });
});
