import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cookieHeader, hmfFetch, resetCookies, storeCookies } from "../src/lib/hmf-client";

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  resetCookies();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const reply = (setCookie: string[] = []) => ({ ok: true, headers: { getSetCookie: () => setCookie } });

describe("hmfFetch", () => {
  it("sends browser-style headers and the honest user-agent", async () => {
    fetchMock.mockResolvedValue(reply());
    await hmfFetch("https://x/a.jpg", { kind: "image", referer: "https://x/page" });
    const h = fetchMock.mock.calls[0][1].headers;
    expect(h.accept).toContain("image/avif");
    expect(h.referer).toBe("https://x/page");
    expect(h["accept-language"]).toContain("en-IN");
    expect(h["user-agent"]).toContain("KSGVisualizer");
    expect(h.cookie).toBeUndefined();
  });

  it("stores cookies the server sets and sends them on later requests", async () => {
    fetchMock.mockResolvedValueOnce(reply(["PHPSESSID=abc; path=/; HttpOnly", "user_pt=10; Max-Age=3600"]));
    await hmfFetch("https://x/1");
    fetchMock.mockResolvedValueOnce({ ok: true });
    await hmfFetch("https://x/2");
    expect(fetchMock.mock.calls[1][1].headers.cookie).toBe("PHPSESSID=abc; user_pt=10");
  });

  it("drops expired cookies and tolerates responses without headers", () => {
    storeCookies(["old=1; Max-Age=0", "keep=2"]);
    expect(cookieHeader()).toBe("keep=2");
    storeCookies(["junk", "dated=3; Expires=Wed, 01 Jan 2020 00:00:00 GMT"]);
    expect(cookieHeader()).toBe("keep=2");
  });
});

describe("persistCookies", () => {
  it("saves server cookies to a file and a fresh jar reloads them", async () => {
    const { mkdtempSync, readFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { persistCookies } = await import("../src/lib/hmf-client");
    const dir = mkdtempSync(join(tmpdir(), "hmf-"));
    const file = join(dir, "sub", "cookies.json");
    persistCookies(file);
    fetchMock.mockResolvedValue(reply(["PHPSESSID=abc", "t=1; Max-Age=3600"]));
    await hmfFetch("https://x/1");
    expect(JSON.parse(readFileSync(file, "utf8")).PHPSESSID.expires).toBeNull();
    resetCookies();
    expect(cookieHeader()).toBe("");
    persistCookies(file);
    expect(cookieHeader()).toBe("PHPSESSID=abc; t=1");
    rmSync(dir, { recursive: true });
  });
});
