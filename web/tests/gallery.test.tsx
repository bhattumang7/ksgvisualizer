// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HmfGallery } from "@/components/HmfGallery";

const hp = (n: number, credit: string | null = "Zed", creditUrl: string | null = "https://c.test/z") => ({
  src: `/g/${n}.webp`, width: 10, height: 10, pageUrl: `https://hmf.test/${n}`, credit, creditUrl,
});

describe("HmfGallery", () => {
  it("explains an unmatched rose", () => {
    render(<HmfGallery hmfId={null} hmfUrl={null} name="Rosa" stored={null} />);
    expect(screen.getByText(/hasn't been matched/)).toBeTruthy();
  });

  it("links a rose matched by url only to HelpMeFind", () => {
    render(<HmfGallery hmfId={null} hmfUrl="https://hmf.test/x" name="Rosa" stored={null} />);
    expect(screen.getByText("See Rosa on HelpMeFind").getAttribute("href")).toBe("https://hmf.test/x");
  });

  it("shows stored photos with their credits", () => {
    render(<HmfGallery hmfId="5" hmfUrl="https://hmf.test/5" name="Rosa" stored={[hp(1), hp(2, null, null)]} />);
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.getByText("Photo: Zed")).toBeTruthy();
    expect(screen.getByText("View on HelpMeFind").getAttribute("href")).toBe("https://hmf.test/5");
  });

  it("links photos to the plant's photos tab and builds the HMF link when none is given", () => {
    render(<HmfGallery hmfId="5" hmfUrl={null} name="Rosa" stored={[hp(1, "Q", null)]} />);
    expect(screen.getAllByRole("link")[0].getAttribute("href")).toBe("https://www.helpmefind.com/rose/pl.php?n=5&tab=36");
    expect(screen.getByText("View on HelpMeFind").getAttribute("href")).toContain("pl.php?n=5");
  });

  it("says so when a matched rose has no stored photos", () => {
    render(<HmfGallery hmfId="5" hmfUrl={null} name="Rosa" stored={null} />);
    expect(screen.getByText(/No photos of this rose are stored/)).toBeTruthy();
  });
});
