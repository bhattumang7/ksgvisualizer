import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { joinBreeders } from "@/lib/catalogue";
import { loadDataset } from "@/lib/data";
import { loadHmfDetails } from "@/lib/hmf-store";
import { loadStoredPhotos } from "@/lib/photos";
import { HmfGallery } from "@/components/HmfGallery";

const all = () => {
  const { roses, breeders } = loadDataset();
  return joinBreeders(roses, breeders);
};

export function generateStaticParams() {
  return all().map((r) => ({ id: r.id }));
}

export async function generateMetadata({ params }: PageProps<"/rose/[id]">): Promise<Metadata> {
  const { id } = await params;
  const rose = all().find((r) => r.id === id);
  return { title: rose?.canonical_name ?? "Rose not found" };
}

export default async function RosePage({ params }: Readonly<PageProps<"/rose/[id]">>) {
  const { id } = await params;
  const rose = all().find((r) => r.id === id);
  if (!rose) notFound();

  const hmf = rose.hmf.id ? loadHmfDetails(rose.hmf.id) : null;
  const facts: [string, React.ReactNode][] = [
    ["Section", rose.class],
    ["Breeder", rose.breeder_id ? <Link className="underline" href={`/breeder/${rose.breeder_id}`}>{rose.breeder_name}</Link> : (rose.breeder_name ?? "Not listed")],
    ["Year", rose.year ?? rose.year_raw ?? "Not listed"],
    ["Colour", hmf?.colour ?? rose.colour_group ?? "Not listed"],
    ["Fragrance", hmf?.fragrance ?? rose.fragrance ?? "Not noted"],
    ...(hmf?.rows.Habit ? ([["Habit", hmf.rows.Habit]] as [string, React.ReactNode][]) : []),
    ...(hmf?.parentage ? ([["Parentage", [hmf.parentage.seed && `seed: ${hmf.parentage.seed}`, hmf.parentage.pollen && `pollen: ${hmf.parentage.pollen}`].filter(Boolean).join("; ")]] as [string, React.ReactNode][]) : []),
    ["Awards", rose.awards.length ? rose.awards.map((a) => (a.year ? `${a.name} ${a.year}` : a.name)).join(", ") : "None listed"],
    ["Price", rose.price_inr === null ? "On request" : `₹${rose.price_inr}`],
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/" className="text-sm text-muted hover:text-accent">&larr; All roses</Link>
      <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
        {rose.canonical_name}
        {rose.is_new && <span className="ml-3 rounded bg-accent px-2 py-0.5 align-middle font-sans text-xs font-medium text-accent-fg">NEW</span>}
      </h1>
      <p className="mt-1 text-muted">{rose.ksg_name !== rose.canonical_name.toUpperCase() && <>Listed by KSG as {rose.ksg_name}. </>}</p>

      <div className="mt-5">
        <HmfGallery hmfId={rose.hmf.id} hmfUrl={rose.hmf.url} name={rose.canonical_name} stored={rose.hmf.id ? loadStoredPhotos(rose.hmf.id) : null} />
      </div>

      <p className="mt-6 text-lg leading-relaxed">{rose.description}</p>

      <dl className="mt-6 grid grid-cols-[7rem_1fr] gap-x-4 gap-y-2 rounded-xl border border-border bg-card p-4 text-sm">
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted">Details from the KSG catalogue 2024{rose.ksg_page ? `, page ${rose.ksg_page}` : ""}.</p>
    </main>
  );
}
