"use client";

import { useState } from "react";
import type { Filters, HmfFilter } from "@/lib/catalogue";

export interface Option {
  value: string;
  label: string;
  count: number;
}

export interface FilterPanelProps {
  filters: Filters;
  options: { classes: Option[]; colours: Option[]; breeders: Option[]; countries: Option[] };
  onChange: (patch: Partial<Filters>) => void;
}

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Group({ title, options, selected, onToggle, searchable = false }: {
  title: string;
  options: Option[];
  selected: string[];
  onToggle: (value: string) => void;
  searchable?: boolean;
}) {
  const [term, setTerm] = useState("");
  const shown = options.filter((o) => !term || o.label.toLowerCase().includes(term.toLowerCase()));
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-semibold">{title}</legend>
      {searchable && (
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={`Find ${title.toLowerCase()}`}
          aria-label={`Find ${title.toLowerCase()}`}
          className="mb-2 w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
        />
      )}
      <ul className={`space-y-0.5 ${searchable ? "max-h-48 overflow-y-auto pr-1" : ""}`}>
        {shown.map((o) => {
          const on = selected.includes(o.value);
          return (
            <li key={o.value}>
              <label className={`flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-sm hover:bg-accent-soft ${o.count === 0 && !on ? "opacity-45" : ""}`}>
                <input type="checkbox" checked={on} onChange={() => onToggle(o.value)} className="size-4 accent-[var(--accent)]" />
                <span className="flex-1 truncate">{o.label}</span>
                <span className="text-xs text-muted tabular-nums">{o.count}</span>
              </label>
            </li>
          );
        })}
        {shown.length === 0 && <li className="px-1 text-sm text-muted">No matches</li>}
      </ul>
    </fieldset>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1.5 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--accent)]" />
      {label}
    </label>
  );
}

function NumberField({ label, value, onChange, placeholder }: { label: string; value: number | null; onChange: (v: number | null) => void; placeholder: string }) {
  return (
    <label className="block text-xs text-muted">
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-foreground"
      />
    </label>
  );
}

export function FilterPanel({ filters, options, onChange }: FilterPanelProps) {
  return (
    <div className="space-y-5">
      <Group title="Section" options={options.classes} selected={filters.classes} onToggle={(v) => onChange({ classes: toggle(filters.classes, v) })} />
      <Group title="Colour" options={options.colours} selected={filters.colours} onToggle={(v) => onChange({ colours: toggle(filters.colours, v) })} />
      <Group title="Breeder" options={options.breeders} selected={filters.breeders} onToggle={(v) => onChange({ breeders: toggle(filters.breeders, v) })} searchable />
      <details className="group border-t border-border pt-3">
        <summary className="cursor-pointer text-sm font-semibold">More filters</summary>
        <div className="mt-3 space-y-5">
          <Group title="Breeder country" options={options.countries} selected={filters.countries} onToggle={(v) => onChange({ countries: toggle(filters.countries, v) })} />
          <div>
            <Check label="Indian-bred" checked={filters.indian} onChange={(v) => onChange({ indian: v })} />
            <Check label="Fragrant" checked={filters.fragrant} onChange={(v) => onChange({ fragrant: v })} />
            <Check label="New this season" checked={filters.isNew} onChange={(v) => onChange({ isNew: v })} />
            <Check label="Has awards" checked={filters.awards} onChange={(v) => onChange({ awards: v })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Year from" value={filters.yearFrom} onChange={(v) => onChange({ yearFrom: v })} placeholder="1900" />
            <NumberField label="Year to" value={filters.yearTo} onChange={(v) => onChange({ yearTo: v })} placeholder="2024" />
            <NumberField label="Price from (₹)" value={filters.priceMin} onChange={(v) => onChange({ priceMin: v })} placeholder="100" />
            <NumberField label="Price to (₹)" value={filters.priceMax} onChange={(v) => onChange({ priceMax: v })} placeholder="300" />
          </div>
          <label className="block text-sm font-semibold">
            HelpMeFind match
            <select
              value={filters.hmf}
              onChange={(e) => onChange({ hmf: e.target.value as HmfFilter })}
              className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1.5 text-sm font-normal"
            >
              <option value="all">Any</option>
              <option value="matched">Matched</option>
              <option value="unmatched">Not matched</option>
            </select>
          </label>
        </div>
      </details>
    </div>
  );
}
