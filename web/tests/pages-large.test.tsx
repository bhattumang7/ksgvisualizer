// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({}),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/data", async (orig) => {
  const real = await orig<typeof import("@/lib/data")>();
  const base = real.loadDataset();
  const first = { ...base.roses[0], awards: [{ name: "Gold Star", year: null }] };
  const roses = Array.from({ length: 120 }, (_, i) => ({ ...first, id: i === 0 ? first.id : `${first.id}-${i}` }));
  return { ...real, loadDataset: () => ({ ...base, roses }) };
});

import Home from "@/app/page";
import RosePage from "@/app/rose/[id]/page";
import { loadDataset } from "@/lib/data";

describe("with a full-size catalogue", () => {
  it("uses the normal page size on the home page", () => {
    render(<NuqsTestingAdapter><Home /></NuqsTestingAdapter>);
    expect(screen.getByText("Page 1 of 5")).toBeTruthy();
  });

  it("lists an award that has no year by name only", async () => {
    const id = loadDataset().roses[0].id;
    render(await RosePage({ params: Promise.resolve({ id }) } as never));
    expect(screen.getByText("Gold Star")).toBeTruthy();
  });
});
