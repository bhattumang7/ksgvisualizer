import Link from "next/link";
import type { CatalogueRose } from "@/lib/catalogue";
import { ColourSwatch } from "./ColourSwatch";

export function RoseCard({ rose, list = false }: { rose: CatalogueRose; list?: boolean }) {
  const meta = [rose.breeder_name, rose.year ?? rose.year_raw].filter(Boolean).join(" · ");
  return (
    <Link
      href={`/rose/${rose.id}`}
      className={`group flex overflow-hidden rounded-xl border border-border bg-card transition hover:border-accent ${list ? "flex-row" : "flex-col"}`}
    >
      <ColourSwatch group={rose.colour_group} className={list ? "w-20 shrink-0 sm:w-28" : "h-24 w-full"} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <span>{rose.class}</span>
          {rose.is_new && <span className="rounded bg-accent px-1.5 py-0.5 font-medium text-accent-fg">NEW</span>}
          {rose.awards.length > 0 && (
            <span className="rounded bg-accent-soft px-1.5 py-0.5 font-medium text-accent">
              {rose.awards.map((a) => a.name).join(", ")}
            </span>
          )}
        </div>
        <h3 className="font-serif text-lg font-semibold leading-tight group-hover:text-accent">{rose.canonical_name}</h3>
        {meta && <p className="truncate text-sm text-muted">{meta}</p>}
        {list && <p className="line-clamp-2 text-sm">{rose.colour_text}</p>}
        <p className="mt-auto pt-1 text-sm font-medium">{rose.price_inr !== null ? `₹${rose.price_inr}` : <span className="font-normal text-muted">Price on request</span>}</p>
      </div>
    </Link>
  );
}
