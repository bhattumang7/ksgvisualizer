import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, Geist } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "KSG's Roses catalogue", template: "%s · KSG's Roses" },
  description: "Browse and filter the roses sold by K.S.G. Son (KSG's Roses), Bangalore.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-6xl items-baseline justify-between gap-4 px-4 py-3">
            <Link href="/" className="font-serif text-xl font-semibold tracking-tight">
              KSG&rsquo;s Roses <span className="font-sans text-sm font-normal text-muted">catalogue</span>
            </Link>
          </div>
        </header>
        <NuqsAdapter>
          <div className="flex-1">{children}</div>
        </NuqsAdapter>
        <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted">
          Unofficial catalogue browser. Rose photos and ratings belong to{" "}
          <a className="underline" href="https://www.helpmefind.com/roses/">HelpMeFind</a> and its photographers.
        </footer>
      </body>
    </html>
  );
}
