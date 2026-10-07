"use client";

import { useCallback, useEffect, useState } from "react";
import type { HmfPhoto, HmfPhotos } from "@/lib/hmf";
import type { StoredPhoto } from "@/lib/photos";

type Status = "loading" | "loading-more" | "idle" | "error";

async function fetchPhotoPage(hmfId: string, cursor: string | null, signal?: AbortSignal): Promise<HmfPhotos> {
  const query = cursor ? `?cursor=${cursor}` : "";
  const res = await fetch(`/api/hmf/${hmfId}/photos${query}`, { signal });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

/** Appends incoming photos, skipping any already shown. */
function mergePhotos(prev: HmfPhoto[], incoming: HmfPhoto[]): HmfPhoto[] {
  const seen = new Set(prev.map((p) => p.src));
  return [...prev, ...incoming.filter((p) => !seen.has(p.src))];
}

export function HmfGallery({ hmfId, hmfUrl, name, stored }: Readonly<{ hmfId: string | null; hmfUrl: string | null; name: string; stored: StoredPhoto[] | null }>) {
  const [photos, setPhotos] = useState<HmfPhoto[]>(stored ?? []);
  const [next, setNext] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(stored ? "idle" : "loading");
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(
    (cursor: string | null, signal?: AbortSignal) =>
      fetchPhotoPage(hmfId as string, cursor, signal)
        .then((data) => {
          setPhotos((prev) => mergePhotos(prev, data.photos));
          setNext(data.next);
          setUnavailable(data.status === "unavailable");
          setStatus("idle");
        })
        .catch((e: Error) => {
          if (e.name !== "AbortError") {
            setUnavailable(true);
            setStatus("error");
          }
        }),
    [hmfId],
  );

  useEffect(() => {
    if (!hmfId || stored) return;
    const controller = new AbortController();
    load(null, controller.signal);
    return () => controller.abort();
  }, [hmfId, stored, load]);

  if (!hmfId) {
    return <Placeholder text="This rose hasn't been matched to HelpMeFind yet." />;
  }

  const link = hmfUrl ?? `https://www.helpmefind.com/rose/pl.php?n=${hmfId}`;
  // HMF only serves its /gardening/l.php photo and photographer pages to visitors clicking within HMF
  // itself (a link from another site gets "Forbidden"), so photos link to the plant's photos tab instead.
  const photosLink = `${link}${link.includes("?") ? "&" : "?"}tab=36`;
  const busy = status === "loading" || status === "loading-more";

  return (
    <section aria-label={`Photos of ${name} from HelpMeFind`}>
      {photos.length > 0 && (
        <ul className="-mx-4 flex snap-x scroll-pl-4 gap-3 overflow-x-auto px-4 pb-2">
          {photos.map((p) => (
            <li key={p.src} className="shrink-0 snap-start">
              <a href={photosLink} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- snapshot or live HMF thumbnail */}
                <img src={p.src} width={p.width} height={p.height} loading="lazy" alt={`${name}, from HelpMeFind`} className="h-24 w-auto rounded-lg border border-border" />
              </a>
              {p.credit && (
                <p className="mt-1 max-w-[9rem] truncate text-xs text-muted">
                  Photo: {p.credit}
                </p>
              )}
            </li>
          ))}
          {next && !stored && (
            <li className="flex shrink-0 snap-start items-center">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setStatus("loading-more");
                  load(next);
                }}
                className="h-24 rounded-lg border border-border bg-card px-4 text-sm font-medium disabled:opacity-60"
              >
                {status === "loading-more" ? "Loading…" : "More photos"}
              </button>
            </li>
          )}
        </ul>
      )}
      {status === "loading" && (
        <div className="flex gap-3 overflow-hidden" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 w-24 shrink-0 animate-pulse rounded-lg bg-border" />
          ))}
        </div>
      )}
      {!busy && photos.length === 0 && (
        <Placeholder text={unavailable ? "Photos from HelpMeFind aren't available right now." : "HelpMeFind has no photos of this rose yet."} />
      )}
      {!busy && photos.length > 0 && unavailable && (
        <p className="text-sm text-muted">Couldn&rsquo;t load more photos from HelpMeFind right now.</p>
      )}
      <p className="mt-2 text-sm">
        <a className="font-medium text-accent underline" href={link} target="_blank" rel="noopener noreferrer">
          View on HelpMeFind
        </a>
        <span className="text-muted"> for more photos, ratings and details.</span>
      </p>
    </section>
  );
}

function Placeholder({ text }: Readonly<{ text: string }>) {
  return (
    <div className="flex h-24 items-center rounded-lg border border-dashed border-border px-4 text-sm text-muted">{text}</div>
  );
}
