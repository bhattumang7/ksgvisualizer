// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "geist-var" }),
  Fraunces: () => ({ variable: "fraunces-var" }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({}),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

import BreederPage, { generateMetadata as breederMeta, generateStaticParams as breederParams } from "@/app/breeder/[id]/page";
import RootLayout, { metadata } from "@/app/layout";
import Home from "@/app/page";
import RosePage, { generateMetadata as roseMeta, generateStaticParams as roseParams } from "@/app/rose/[id]/page";
import { loadDataset } from "@/lib/data";
import { roses } from "./helpers";

const params = <T extends object>(p: T) => Promise.resolve(p) as never;

describe("layout", () => {
  it("wraps children with the header, footer and fonts", () => {
    const html = renderToStaticMarkup(<RootLayout params={params({})}><p id="kid">hello</p></RootLayout>);
    expect(html).toContain('<html lang="en" class="geist-var fraunces-var h-full antialiased">');
    expect(html).toContain("KSG");
    expect(html).toContain('<p id="kid">hello</p>');
    expect(html).toContain('href="https://www.helpmefind.com/roses/"');
    expect(metadata.title).toMatchObject({ default: "KSG's Roses catalogue" });
  });
});

describe("home page", () => {
  it("renders the catalogue with the small-set page size and card photos", () => {
    render(<NuqsTestingAdapter><Home /></NuqsTestingAdapter>);
    // 23 sample roses (< 100) use a page size of 6, so there are 4 pages.
    expect(screen.getByText("Page 1 of 4")).toBeTruthy();
    expect(screen.getByText("23 roses")).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(6);
  });
});

describe("breeder page", () => {
  it("lists static params and titles for every breeder", async () => {
    expect(breederParams()).toHaveLength(loadDataset().breeders.length);
    expect(await breederMeta({ params: params({ id: "meilland" }) } as never)).toEqual({ title: "Meilland International" });
    expect(await breederMeta({ params: params({ id: "ghost" }) } as never)).toEqual({ title: "Breeder not found" });
  });

  it("shows the breeder's roses sorted by name, with the country", async () => {
    render(await BreederPage({ params: params({ id: "meilland" }) } as never));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Meilland International");
    expect(screen.getByText(/France/)).toBeTruthy();
    const names = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(names.length).toBe(roses.filter((r) => r.breeder_id === "meilland").length);
    expect(names).toEqual([...names].sort((a, b) => a!.localeCompare(b!)));
    expect(screen.getByText(/Princess Charlene de Monaco/).closest("li")?.querySelectorAll("img").length).toBeGreaterThan(1);
  });

  it("uses the singular for a single rose and 404s unknown breeders", async () => {
    render(await BreederPage({ params: params({ id: "iari" }) } as never));
    expect(screen.getByText(/1 rose in the catalogue/)).toBeTruthy();
    await expect(BreederPage({ params: params({ id: "ghost" }) } as never)).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("rose page", () => {
  const facts = () => Object.fromEntries([...document.querySelectorAll("dt")].map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]));

  it("lists static params and titles", async () => {
    expect(roseParams()).toHaveLength(roses.length);
    expect(await roseMeta({ params: params({ id: "alliance" }) } as never)).toEqual({ title: "Alliance" });
    expect(await roseMeta({ params: params({ id: "ghost" }) } as never)).toEqual({ title: "Rose not found" });
  });

  it("404s for an unknown rose", async () => {
    await expect(RosePage({ params: params({ id: "ghost" }) } as never)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("shows HMF-enriched facts for a matched rose", async () => {
    render(await RosePage({ params: params({ id: "princess-charlene-de-monaco" }) } as never));
    const f = facts();
    expect(f.Colour).toBe("Light pink, peach shading. [Light apricot and pink.]");
    expect(f.Fragrance).toBe("Strong fragrance.");
    expect(f.Parentage).toBe("seed: Louis de Funès ®; pollen: Pink Panther ® × Graham Thomas");
    expect(f.Habit).toBeTruthy();
    expect(f.Breeder).toBe("Meilland International");
    expect(f.Year).toBe("Not listed");
    expect(f.Awards).toBe("None listed");
    expect(f.Price).toBe("On request");
    expect(screen.getByText(/Details from the KSG catalogue 2024\.$/)).toBeTruthy();
    expect(screen.getByText("View on HelpMeFind")).toBeTruthy();
    expect(screen.queryByText("NEW")).toBeNull();
  });

  it("shows catalogue facts, awards and the NEW badge for an unmatched rose", async () => {
    render(await RosePage({ params: params({ id: "abracadabra" }) } as never));
    const f = facts();
    expect(f.Colour).toBe("multicolour");
    expect(f.Fragrance).toBe("Not noted");
    expect(f.Price).toBe("₹200");
    expect(f.Habit).toBeUndefined();
    expect(f.Parentage).toBeUndefined();
    expect(screen.getByText("NEW")).toBeTruthy();
    expect(screen.getByText(/hasn't been matched/)).toBeTruthy();
    expect(screen.getByText(/page 30\./)).toBeTruthy();
  });

  it("handles awards, an unlisted breeder, the KSG name note and a missing page", async () => {
    render(await RosePage({ params: params({ id: "about-face" }) } as never));
    expect(facts().Awards).toMatch(/\d{4}|\w/);
    expect(facts().Awards).not.toBe("None listed");
    render(await RosePage({ params: params({ id: "clg-quick-silver" }) } as never));
    expect(screen.getByText(/Listed by KSG as CLG/)).toBeTruthy();
    expect(screen.getAllByText("Not listed").length).toBeGreaterThan(0);
    expect(within(document.body).getAllByText(/Details from the KSG catalogue 2024/).length).toBe(2);
  });
});
