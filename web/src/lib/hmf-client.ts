/**
 * The one way we talk to HelpMeFind: the live photo route and both snapshot scripts go through here,
 * so every request carries the same browser-style headers (accept, language, referer) and the same
 * cookie handling. Cookies are only what HMF itself hands us (Set-Cookie), kept in memory and sent
 * back like a browser would; we never replay anyone's real session. The user-agent stays honest.
 */

import fs from "node:fs";
import path from "node:path";

export const HMF_ORIGIN = "https://www.helpmefind.com";
export const USER_AGENT = "KSGVisualizer/0.1 (personal catalogue project)";

const ACCEPT = {
  document: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  image: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
} as const;
const ACCEPT_LANGUAGE = "en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7";

const jar = new Map<string, { value: string; expires: number }>();

let jarFile: string | null = null;

export function resetCookies() {
  jar.clear();
  jarFile = null;
}

/** Keep the jar in a file so a restarted script run continues the same session. Scripts only. */
export function persistCookies(file: string) {
  jarFile = file;
  try {
    for (const [name, c] of Object.entries(JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, { value: string; expires: number | null }>))
      jar.set(name, { value: c.value, expires: c.expires ?? Infinity });
  } catch {
    // no file yet, or unreadable: start with an empty jar
  }
}

function saveJar() {
  if (!jarFile) return;
  const out = Object.fromEntries([...jar].map(([n, c]) => [n, { value: c.value, expires: Number.isFinite(c.expires) ? c.expires : null }]));
  fs.mkdirSync(path.dirname(jarFile), { recursive: true });
  fs.writeFileSync(jarFile, JSON.stringify(out, null, 2) + "\n");
}

export function cookieHeader(now = Date.now()): string {
  const parts: string[] = [];
  for (const [name, c] of jar) {
    if (c.expires <= now) jar.delete(name);
    else parts.push(`${name}=${c.value}`);
  }
  return parts.join("; ");
}

export function storeCookies(setCookies: string[], now = Date.now()) {
  for (const line of setCookies) {
    const [pair, ...attrs] = line.split(";").map((s) => s.trim());
    const eq = pair.indexOf("=");
    if (eq < 1) continue;
    let expires = Infinity;
    for (const a of attrs) {
      const [k, v = ""] = a.split("=");
      const key = k.toLowerCase();
      if (key === "max-age" && !Number.isNaN(Number(v))) expires = now + Number(v) * 1000;
      else if (key === "expires" && expires === Infinity && !Number.isNaN(Date.parse(v))) expires = Date.parse(v);
    }
    jar.set(pair.slice(0, eq), { value: pair.slice(eq + 1), expires });
  }
}

export interface HmfRequest {
  kind?: keyof typeof ACCEPT;
  /** Page the browser would have been on; defaults to the HMF home page. */
  referer?: string;
  signal?: AbortSignal;
  cache?: RequestCache;
  redirect?: RequestRedirect;
}

export async function hmfFetch(url: string, { kind = "document", referer = `${HMF_ORIGIN}/`, signal, cache, redirect }: HmfRequest = {}) {
  const headers: Record<string, string> = {
    "user-agent": USER_AGENT,
    accept: ACCEPT[kind],
    "accept-language": ACCEPT_LANGUAGE,
    referer,
  };
  const cookie = cookieHeader();
  if (cookie) headers.cookie = cookie;
  const res = await fetch(url, { headers, signal, cache, redirect });
  const set = res.headers?.getSetCookie?.();
  if (set?.length) {
    storeCookies(set);
    saveJar();
  }
  return res;
}
