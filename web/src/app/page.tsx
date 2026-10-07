import { Suspense } from "react";
import { Catalogue } from "@/components/Catalogue";
import { joinBreeders } from "@/lib/catalogue";
import { loadDataset } from "@/lib/data";
import { withCardPhotos } from "@/lib/photos";

export default function Home() {
  const { roses, breeders } = loadDataset();
  // A tiny set (like the test sample), so use a small page size to make pagination visible.
  const pageSize = roses.length < 100 ? 6 : 24;
  return (
    <main>
      <Suspense fallback={<p className="p-6 text-muted">Loading roses…</p>}>
        <Catalogue roses={withCardPhotos(joinBreeders(roses, breeders))} breeders={breeders} pageSize={pageSize} />
      </Suspense>
    </main>
  );
}
