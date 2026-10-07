"use client";

import { useRef, useState } from "react";
import type { CardPhoto } from "@/lib/catalogue";

/**
 * Swipeable photo strip for a listing card (CSS scroll-snap, so it swipes natively on touch).
 * Shows the photographer credit for the current slide, as HMF requires.
 */
export function CardPhotos({ photos, name, className = "" }: Readonly<{ photos: CardPhoto[]; name: string; className?: string }>) {
  const [index, setIndex] = useState(0);
  const strip = useRef<HTMLUListElement>(null);
  const credit = photos[index]?.credit;

  function onScroll() {
    const el = strip.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  function go(e: React.MouseEvent, to: number) {
    e.preventDefault(); // the card is a link
    e.stopPropagation();
    const el = strip.current;
    if (el) el.scrollTo({ left: to * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className={`relative overflow-hidden bg-border ${className}`}>
      <ul ref={strip} onScroll={onScroll} className="flex h-full w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {photos.map((p, i) => (
          <li key={p.src} className="h-full w-full shrink-0 snap-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- stored HMF thumbnail */}
            <img src={p.src} alt={`${name} (${i + 1} of ${photos.length}), from HelpMeFind`} loading={i === 0 ? "eager" : "lazy"} draggable={false} className="h-full w-full object-cover" />
          </li>
        ))}
      </ul>
      {photos.length > 1 && (
        <>
          {index > 0 && (
            <button type="button" aria-label="Previous photo" onClick={(e) => go(e, index - 1)} className="absolute left-1 top-1/2 hidden h-7 w-7 -translate-y-1/2 rounded-full bg-black/50 text-white sm:block">‹</button>
          )}
          {index < photos.length - 1 && (
            <button type="button" aria-label="Next photo" onClick={(e) => go(e, index + 1)} className="absolute right-1 top-1/2 hidden h-7 w-7 -translate-y-1/2 rounded-full bg-black/50 text-white sm:block">›</button>
          )}
          <span className="pointer-events-none absolute right-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">{index + 1}/{photos.length}</span>
        </>
      )}
      {credit && (
        <span className="pointer-events-none absolute bottom-1 left-1.5 max-w-[80%] truncate rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white">Photo: {credit}</span>
      )}
    </div>
  );
}
