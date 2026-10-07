// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HmfGallery } from "@/components/HmfGallery";

const hp = (n: number, credit: string | null = "Zed", creditUrl: string | null = "https://c.test/z") => ({
  src: `/g/${n}.jpg`, width: 10, height: 10, pageUrl: `https://hmf.test/${n}`, credit, creditUrl,
});
const page = (over: object) => ({ hmfUrl: "https://hmf.test", photos: [], next: null, status: "ok", ...over });
const respond = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body });

afterEach(() => vi.unstubAllGlobals());

describe("HmfGallery", () => {
  it("explains an unmatched rose", () => {
    render(<HmfGallery hmfId={null} hmfUrl={null} name="Rosa" stored={null} />);
    expect(screen.getByText(/hasn't been matched/)).toBeTruthy();
  });

  it("shows stored photos without calling the live route", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<HmfGallery hmfId="5" hmfUrl="https://hmf.test/5" name="Rosa" stored={[hp(1), hp(2, null, null)]} />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("Photo: Zed")).toBeTruthy();
    expect(screen.queryByText("More photos")).toBeNull();
    expect(screen.getByText("View on HelpMeFind").getAttribute("href")).toBe("https://hmf.test/5");
  });

  it("links photos to the plant's photos tab and builds the HMF link when none is given", () => {
    render(<HmfGallery hmfId="5" hmfUrl={null} name="Rosa" stored={[hp(1, "Q", null)]} />);
    expect(screen.getAllByRole("link")[0].getAttribute("href")).toBe("https://www.helpmefind.com/rose/pl.php?n=5&tab=36");
    expect(screen.getByText("View on HelpMeFind").getAttribute("href")).toContain("pl.php?n=5");
  });

  it("loads live photos, then more with de-duplication", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(page({ photos: [hp(1), hp(2)], next: "1.2" })))
      .mockResolvedValueOnce(respond(page({ photos: [hp(2), hp(3)], next: null })));
    vi.stubGlobal("fetch", fetchMock);
    render(<HmfGallery hmfId="5" hmfUrl={null} name="Rosa" stored={null} />);
    expect(document.querySelector("[aria-busy]")).toBeTruthy();
    const more = await screen.findByText("More photos");
    fireEvent.click(more);
    expect(screen.getByText("Loading…")).toBeTruthy();
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(3));
    expect(fetchMock.mock.calls[1][0]).toBe("/api/hmf/5/photos?cursor=1.2");
    expect(screen.queryByText("More photos")).toBeNull();
  });

  it("reports an empty rose and an unavailable HMF", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(page({ status: "empty" }))));
    const { unmount } = render(<HmfGallery hmfId="5" hmfUrl={null} name="Rosa" stored={null} />);
    expect(await screen.findByText(/has no photos/)).toBeTruthy();
    unmount();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(page({ status: "unavailable" }))));
    render(<HmfGallery hmfId="5" hmfUrl={null} name="Rosa" stored={null} />);
    expect(await screen.findByText(/aren't available/)).toBeTruthy();
  });

  it("handles HTTP and network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond({}, false)));
    const { unmount } = render(<HmfGallery hmfId="5" hmfUrl={null} name="Rosa" stored={null} />);
    expect(await screen.findByText(/aren't available/)).toBeTruthy();
    unmount();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    render(<HmfGallery hmfId="5" hmfUrl={null} name="Rosa" stored={null} />);
    expect(await screen.findByText(/aren't available/)).toBeTruthy();
  });

  it("warns when loading more fails after some photos are shown", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(respond(page({ photos: [hp(1)], next: "1.1" }))).mockResolvedValueOnce(respond({}, false)),
    );
    render(<HmfGallery hmfId="5" hmfUrl={null} name="Rosa" stored={null} />);
    fireEvent.click(await screen.findByText("More photos"));
    expect(await screen.findByText(/Couldn.t load more photos/)).toBeTruthy();
  });

  it("ignores an aborted request on unmount", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    const fetchMock = vi.fn().mockRejectedValue(abort);
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = render(<HmfGallery hmfId="5" hmfUrl={null} name="Rosa" stored={null} />);
    unmount();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });
});
