import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cell = (n: number) =>
  `<td><a href="/gardening/l.php?l=21.${n}" class="imgEn"><img src="/gardening/tn/1/${n}.jpg" width="10" height="20"/></a></td>`;
const listing = (n: number, older = false) =>
  `<table><tr>${cell(n)}</tr></table>${older ? '<a href="/x?qn=2&qc=3" title=" View older ">older</a>' : ""}`;
const ok = (body: string) => ({ ok: true, text: async () => body });

let hmf: typeof import("@/lib/hmf");
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  hmf = await import("@/lib/hmf");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Runs a getPhotos call to completion through the request throttle. */
async function settle<T>(p: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(3000);
  return p;
}

describe("getPhotos", () => {
  it("fetches, parses and caches a first page", async () => {
    fetchMock.mockResolvedValue(ok(listing(1, true)));
    const first = await settle(hmf.getPhotos("5"));
    expect(first).toMatchObject({ status: "ok", next: "2.3", hmfUrl: hmf.hmfPlantUrl("5") });
    expect(first.photos).toHaveLength(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${hmf.hmfPlantUrl("5")}&tab=36`);
    expect(await hmf.getPhotos("5")).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("passes the paging cursor", async () => {
    fetchMock.mockResolvedValue(ok(listing(2)));
    const page = await settle(hmf.getPhotos("5", "2.3"));
    expect(page.next).toBeNull();
    expect(fetchMock.mock.calls[0][0]).toContain("&qn=2&qc=3");
  });

  it("shares one in-flight request between callers", async () => {
    fetchMock.mockResolvedValue(ok(listing(1)));
    const [a, b] = await settle(Promise.all([hmf.getPhotos("5"), hmf.getPhotos("5")]));
    expect(a).toBe(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports an empty page and refetches it after its short TTL", async () => {
    fetchMock.mockResolvedValue(ok("<html></html>"));
    expect((await settle(hmf.getPhotos("5"))).status).toBe("empty");
    await vi.advanceTimersByTimeAsync(30_000);
    await hmf.getPhotos("5");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(31_000);
    await settle(hmf.getPhotos("5"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("spaces back-to-back requests apart and skips cells without a thumbnail", async () => {
    fetchMock.mockResolvedValue(ok(`<table><tr><td>no photo</td>${cell(7)}</tr></table>`));
    const first = hmf.getPhotos("1");
    const second = hmf.getPhotos("2");
    await vi.advanceTimersByTimeAsync(100);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await first).photos).toHaveLength(1);
    expect((await second).photos).toHaveLength(1);
  });

  it("refetches ok results after ten minutes", async () => {
    fetchMock.mockResolvedValue(ok(listing(1)));
    await settle(hmf.getPhotos("5"));
    await vi.advanceTimersByTimeAsync(11 * 60_000);
    await settle(hmf.getPhotos("5"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("is unavailable on HTTP errors and network failures", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, text: async () => "" });
    expect((await settle(hmf.getPhotos("1"))).status).toBe("unavailable");
    fetchMock.mockRejectedValueOnce(new Error("boom"));
    expect((await settle(hmf.getPhotos("2"))).status).toBe("unavailable");
  });

  it("evicts the oldest entry once the cache is full", async () => {
    fetchMock.mockResolvedValue(ok("<html></html>"));
    for (let i = 0; i < 501; i++) await settle(hmf.getPhotos(String(i)));
    expect(fetchMock).toHaveBeenCalledTimes(501);
    await settle(hmf.getPhotos("0")); // evicted, so fetched again
    expect(fetchMock).toHaveBeenCalledTimes(502);
  }, 30_000);
});

describe("allowRequest", () => {
  it("allows 30 a minute per client, then again after the window", () => {
    for (let i = 0; i < 30; i++) expect(hmf.allowRequest("ip", 1000)).toBe(true);
    expect(hmf.allowRequest("ip", 1000)).toBe(false);
    expect(hmf.allowRequest("other", 1000)).toBe(true);
    expect(hmf.allowRequest("ip", 62_000)).toBe(true);
  });
  it("bounds the number of tracked clients", () => {
    for (let i = 0; i < 30; i++) hmf.allowRequest("first", 1000);
    expect(hmf.allowRequest("first", 1000)).toBe(false);
    for (let i = 0; i < 5001; i++) hmf.allowRequest(`c${i}`, 1000);
    // "first" was the oldest tracked client, so its history was dropped and it is allowed again.
    expect(hmf.allowRequest("first", 1000)).toBe(true);
  });
});

describe("parsers", () => {
  it("ignores older links without paging numbers", () => {
    expect(hmf.parseNext('<a title="View older" href="/x">o</a><a title="View older">o</a>')).toBeNull();
  });
});
