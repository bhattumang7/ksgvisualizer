import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPhotos, allowRequest } = vi.hoisted(() => ({ getPhotos: vi.fn(), allowRequest: vi.fn() }));
vi.mock("@/lib/hmf", async (orig) => ({ ...(await orig<typeof import("@/lib/hmf")>()), getPhotos, allowRequest }));

import { GET } from "@/app/api/hmf/[id]/photos/route";

const call = (id: string, qs = "", headers: Record<string, string> = {}) =>
  GET(new Request(`http://x/api/hmf/${id}/photos${qs}`, { headers }), { params: Promise.resolve({ id }) } as never);

beforeEach(() => {
  getPhotos.mockReset();
  allowRequest.mockReset().mockReturnValue(true);
});

describe("GET /api/hmf/[id]/photos", () => {
  it("rejects a bad id without touching HMF", async () => {
    const res = await call("abc");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid HMF id" });
    expect(getPhotos).not.toHaveBeenCalled();
  });

  it("rejects a bad cursor", async () => {
    const res = await call("5", "?cursor=nope");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid cursor" });
  });

  it("rate-limits by the first forwarded address", async () => {
    allowRequest.mockReturnValue(false);
    const res = await call("5", "", { "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(res.status).toBe(429);
    expect(allowRequest).toHaveBeenCalledWith("1.2.3.4");
  });

  it("keys anonymous clients as unknown", async () => {
    allowRequest.mockReturnValue(false);
    await call("5");
    expect(allowRequest).toHaveBeenCalledWith("unknown");
  });

  it("returns photos with a five-minute cache for ok results", async () => {
    const body = { hmfUrl: "u", photos: [], next: null, status: "ok" };
    getPhotos.mockResolvedValue(body);
    const res = await call("5", "?cursor=1.2");
    expect(getPhotos).toHaveBeenCalledWith("5", "1.2");
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
    expect(await res.json()).toEqual(body);
  });

  it("caches non-ok results only briefly and passes a null cursor", async () => {
    getPhotos.mockResolvedValue({ hmfUrl: "u", photos: [], next: null, status: "empty" });
    const res = await call("5");
    expect(getPhotos).toHaveBeenCalledWith("5", null);
    expect(res.headers.get("cache-control")).toBe("public, max-age=30");
  });
});
