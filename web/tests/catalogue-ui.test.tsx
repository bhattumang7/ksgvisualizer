// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Catalogue } from "@/components/Catalogue";
import { breeders, roses } from "./helpers";

const scrollTo = vi.fn();
beforeEach(() => {
  scrollTo.mockReset();
  window.scrollTo = scrollTo as never;
});

function setup(search = "", pageSize = 6) {
  const onUrlUpdate = vi.fn();
  render(
    <NuqsTestingAdapter searchParams={search} onUrlUpdate={onUrlUpdate} hasMemory rateLimitFactor={0}>
      <Catalogue roses={roses} breeders={breeders} pageSize={pageSize} />
    </NuqsTestingAdapter>,
  );
  return onUrlUpdate;
}
const results = () => screen.getByRole("region", { name: "Results" });
const sidebar = () => screen.getByRole("complementary", { name: "Filters" });
const lastUrl = (spy: ReturnType<typeof vi.fn>) => (spy.mock.calls.at(-1)?.[0].queryString ?? "<none>") as string;
const urlIs = (spy: ReturnType<typeof vi.fn>, expected: string) => waitFor(() => expect(lastUrl(spy)).toBe(expected));

describe("Catalogue", () => {
  it("lists the first page and paginates", async () => {
    const url = setup();
    expect(within(results()).getByText("23 roses")).toBeTruthy();
    expect(screen.getByText("Page 1 of 4")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Previous/ })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    await urlIs(url, "?page=2");
    expect(scrollTo).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Previous/ }));
    await urlIs(url, "");
  });

  it("lets the user change the page size and resets to page 1", async () => {
    const url = setup("?page=2");
    const select = screen.getByLabelText("Roses per page");
    fireEvent.change(select, { target: { value: "12" } });
    await urlIs(url, "?size=12");
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
    fireEvent.change(select, { target: { value: "6" } });
    await urlIs(url, "");
  });

  it("ignores an unsupported size in the URL", () => {
    setup("?size=7");
    expect(screen.getByText("Page 1 of 4")).toBeTruthy();
  });

  it("goes back from page 3 to page 2 and disables Next on the last page", async () => {
    const url = setup("?page=3");
    fireEvent.click(screen.getByRole("button", { name: /Previous/ }));
    await urlIs(url, "?page=2");
  });

  it("disables Next on the last page", () => {
    setup("?page=4");
    expect(screen.getByRole("button", { name: /Next/ })).toHaveProperty("disabled", true);
  });

  it("snaps an out-of-range page back to the last page", async () => {
    const url = setup("?page=99");
    await urlIs(url, "?page=4");
  });

  it("snaps an out-of-range page back to page 1 when one page remains", async () => {
    const url = setup("?page=3&q=charlene");
    await urlIs(url, "?q=charlene");
  });

  it("shows the raw value for a filter chip with no matching option", () => {
    setup("?class=Mystery");
    expect(screen.getAllByText(/Mystery/).length).toBeGreaterThan(0);
  });

  it("lists breeders and countries that have no roses with a zero count", () => {
    render(
      <NuqsTestingAdapter searchParams="" hasMemory>
        <Catalogue roses={roses} breeders={[...breeders, { id: "ghost", ksg_name: "Ghost", name: "Ghost Roses", country: "JP", indian: false }]} pageSize={6} />
      </NuqsTestingAdapter>,
    );
    expect(screen.getAllByText("Ghost Roses").length).toBeGreaterThan(0);
  });

  it("falls back to the country code when the region has no display name", () => {
    const of = vi.spyOn(Intl.DisplayNames.prototype, "of").mockReturnValue(undefined);
    setup();
    expect(screen.getAllByText("FR").length).toBeGreaterThan(0);
    of.mockRestore();
  });

  it("searches, resets the page and shows relevance sorting", async () => {
    const url = setup();
    fireEvent.change(screen.getByLabelText("Search roses"), { target: { value: "charlene" } });
    await urlIs(url, "?q=charlene");
    fireEvent.change(screen.getByLabelText("Search roses"), { target: { value: "" } });
    await urlIs(url, "");
  });

  it("offers relevance sort only while searching", async () => {
    setup("?q=rose");
    expect(screen.getByRole("option", { name: "Best match" })).toBeTruthy();
  });

  it("changes sort and view", async () => {
    const url = setup();
    expect(screen.queryByRole("option", { name: "Best match" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "price-desc" } });
    await urlIs(url, "?sort=price-desc");
    fireEvent.click(screen.getByRole("button", { name: "List" }));
    await waitFor(() => expect(lastUrl(url)).toContain("view=list"));
    fireEvent.click(screen.getByRole("button", { name: "Grid" }));
    await urlIs(url, "?sort=price-desc");
  });

  it("filters by facet checkbox, shows a chip, then removes it", async () => {
    const url = setup();
    fireEvent.click(within(sidebar()).getByLabelText(/^Floribundas/));
    await urlIs(url, "?class=Floribunda");
    fireEvent.click(screen.getByRole("button", { name: "Remove filter Floribundas" }));
    await urlIs(url, "");
  });

  it("filters the breeder list by typing and shows empty matches", async () => {
    setup();
    const find = within(sidebar()).getByLabelText("Find breeder");
    fireEvent.change(find, { target: { value: "zzz" } });
    expect(within(sidebar()).getByText("No matches")).toBeTruthy();
    fireEvent.change(find, { target: { value: "meil" } });
    expect(within(sidebar()).getByLabelText(/Meilland/)).toBeTruthy();
  });

  it("sets every extra filter and builds chips for each", async () => {
    const url = setup();
    const side = within(sidebar());
    for (const label of ["Indian-bred", "Fragrant", "New this season", "Has awards"]) fireEvent.click(side.getByLabelText(label));
    fireEvent.change(side.getByLabelText("Year from"), { target: { value: "1990" } });
    fireEvent.change(side.getByLabelText("Year to"), { target: { value: "2000" } });
    fireEvent.change(side.getByLabelText("Price from (₹)"), { target: { value: "100" } });
    fireEvent.change(side.getByLabelText("Price to (₹)"), { target: { value: "200" } });
    fireEvent.change(side.getByLabelText("HelpMeFind mapping"), { target: { value: "matched" } });
    fireEvent.click(side.getByLabelText(/^France/));
    fireEvent.click(side.getByLabelText(/^Red/));
    fireEvent.click(side.getByLabelText(/^Meilland/));
    await waitFor(() => expect(lastUrl(url)).toContain("breeder=meilland"));
    const q = lastUrl(url);
    for (const part of ["indian=true", "fragrant=true", "new=true", "awards=true", "from=1990", "to=2000", "pmin=100", "pmax=200", "hmf=matched", "country=FR", "colour=red", "breeder=meilland"]) {
      expect(q).toContain(part);
    }
    for (const name of ["Indian-bred", "Fragrant", "New", "Has awards", "On HelpMeFind", "Year 1990–2000", "₹100–200", "France", "Red"]) {
      expect(screen.getByRole("button", { name: `Remove filter ${name}` })).toBeTruthy();
    }
    fireEvent.click(screen.getByRole("button", { name: /^Remove filter Meilland/ }));
    fireEvent.click(screen.getByRole("button", { name: "Remove filter Year 1990–2000" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove filter ₹100–200" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove filter On HelpMeFind" }));
    for (const name of ["Indian-bred", "Fragrant", "New", "Has awards", "France", "Red"]) {
      fireEvent.click(screen.getByRole("button", { name: `Remove filter ${name}` }));
    }
    await urlIs(url, "");
  });

  it("clears number fields back to empty", async () => {
    const url = setup("?from=1990");
    fireEvent.change(within(sidebar()).getByLabelText("Year from"), { target: { value: "" } });
    await urlIs(url, "");
  });

  it("labels open-ended ranges and the not-matched filter", async () => {
    setup("?from=1990&pmax=300&hmf=unmatched");
    expect(screen.getByRole("button", { name: "Remove filter Year 1990–…" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove filter ₹…–300" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove filter Not on HelpMeFind" })).toBeTruthy();
  });

  it("labels open-ended ranges the other way round", () => {
    setup("?to=2000&pmin=50");
    expect(screen.getByRole("button", { name: "Remove filter Year …–2000" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove filter ₹50–…" })).toBeTruthy();
  });

  it("shows an empty state that clears all filters", async () => {
    const url = setup("?q=zzzzqqq");
    expect(screen.getByText("No roses match these filters.")).toBeTruthy();
    expect(within(results()).getByText("0 roses")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await urlIs(url, "");
  });

  it("uses the singular for one rose and Clear all in the chip row", async () => {
    const url = setup("?new=true&fragrant=true");
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    await urlIs(url, "");
  });

  it("uses the singular for one rose", () => {
    setup("?q=princess+charlene");
    expect(within(results()).getAllByText(/^\d+ roses?$/).length).toBeGreaterThan(0);
  });

  it("opens and closes the mobile filter sheet", async () => {
    const url = setup("?new=true");
    const open = screen.getByRole("button", { name: "Filters (1)" });
    fireEvent.click(open);
    const dialog = screen.getByRole("dialog", { name: "Filters" });
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close filters" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");

    fireEvent.click(open);
    fireEvent.keyDown(document, { key: "a" });
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(open);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Clear all" }));
    await urlIs(url, "");
    fireEvent.click(screen.getByRole("button", { name: /^Show \d+ roses?$/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows plain Filters label with no active filters", async () => {
    setup();
    expect(screen.getByRole("button", { name: "Filters" })).toBeTruthy();
  });
});
