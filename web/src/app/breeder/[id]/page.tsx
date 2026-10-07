import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { joinBreeders } from "@/lib/catalogue";
import { loadDataset } from "@/lib/data";
import { withCardPhotos } from "@/lib/photos";
import { RoseCard } from "@/components/RoseCard";

export function generateStaticParams() {
  return loadDataset().breeders.map((b) => ({ id: b.id }));
}

export async function generateMetadata({ params }: PageProps<"/breeder/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: loadDataset().breeders.find((b) => b.id === id)?.name ?? "Breeder not found" };
}

export default async function BreederPage({ params }: Readonly<PageProps<"/breeder/[id]">>) {
  const { id } = await params;
  const { roses, breeders } = loadDataset();
  const breeder = breeders.find((b) => b.id === id);
  if (!breeder) notFound();
  const list = withCardPhotos(joinBreeders(roses.filter((r) => r.breeder_id === id), breeders)).sort((a, b) => a.canonical_name.localeCompare(b.canonical_name));
  const country = new Intl.DisplayNames(["en"], { type: "region" }).of(breeder.country);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <Link href="/" className="text-sm text-muted hover:text-accent">&larr; All roses</Link>
      <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight">{breeder.name}</h1>
      <p className="mt-1 text-muted">{country} &middot; {list.length} {list.length === 1 ? "rose" : "roses"} in the catalogue</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((r) => (
          <li key={r.id}><RoseCard rose={r} /></li>
        ))}
      </ul>
    </main>
  );
}
