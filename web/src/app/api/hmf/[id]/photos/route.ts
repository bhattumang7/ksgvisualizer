import { allowRequest, getPhotos, isValidCursor, isValidHmfId } from "@/lib/hmf";

export async function GET(request: Request, ctx: RouteContext<"/api/hmf/[id]/photos">) {
  const { id } = await ctx.params;
  if (!isValidHmfId(id)) return Response.json({ error: "Invalid HMF id" }, { status: 400 });

  const cursor = new URL(request.url).searchParams.get("cursor");
  if (cursor !== null && !isValidCursor(cursor)) return Response.json({ error: "Invalid cursor" }, { status: 400 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allowRequest(ip)) return Response.json({ error: "Too many requests" }, { status: 429 });

  const result = await getPhotos(id, cursor);
  return Response.json(result, {
    headers: { "cache-control": result.status === "ok" ? "public, max-age=300" : "public, max-age=30" },
  });
}
