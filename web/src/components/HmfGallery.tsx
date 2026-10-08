import type { StoredPhoto } from "@/lib/photos";

export function HmfGallery({ hmfId, hmfUrl, name, stored }: Readonly<{ hmfId: string | null; hmfUrl: string | null; name: string; stored: StoredPhoto[] | null }>) {
  const photos = stored ?? [];

  if (!hmfId && hmfUrl) {
    // Matched by url only: photos need the numeric id, which the details step fills in later.
    return (
      <div className="flex h-24 items-center rounded-lg border border-dashed border-border px-4 text-sm text-muted">
        <a href={hmfUrl} target="_blank" rel="noopener noreferrer" className="underline">
          See {name} on HelpMeFind
        </a>
      </div>
    );
  }
  if (!hmfId) {
    return <Placeholder text="This rose hasn't been matched to HelpMeFind yet." />;
  }

  const link = hmfUrl ?? `https://www.helpmefind.com/rose/pl.php?n=${hmfId}`;
  // HMF only serves its /gardening/l.php photo and photographer pages to visitors clicking within HMF
  // itself (a link from another site gets "Forbidden"), so photos link to the plant's photos tab instead.
  const photosLink = `${link}${link.includes("?") ? "&" : "?"}tab=36`;

  return (
    <section aria-label={`Photos of ${name} from HelpMeFind`}>
      {photos.length > 0 && (
        <ul className="-mx-4 flex snap-x scroll-pl-4 gap-3 overflow-x-auto px-4 pb-2">
          {photos.map((p) => (
            <li key={p.src} className="shrink-0 snap-start">
              <a href={photosLink} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- stored HMF photo */}
                <img src={p.src} width={p.width} height={p.height} loading="lazy" alt={`${name}, from HelpMeFind`} className="h-24 w-auto rounded-lg border border-border" />
              </a>
              {p.credit && (
                <p className="mt-1 max-w-[9rem] truncate text-xs text-muted">
                  Photo: {p.credit}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {photos.length === 0 && <Placeholder text="No photos of this rose are stored here yet." />}
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
