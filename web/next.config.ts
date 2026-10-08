import type { NextConfig } from "next";

// The site is a plain static export. On GitHub Pages it lives under a sub-path (umangbhatt.in/ksgvisualizer),
// which the deploy workflow supplies; locally it is served from the root.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
