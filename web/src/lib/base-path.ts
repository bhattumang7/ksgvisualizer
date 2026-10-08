/** Sub-path the site is served from ("" locally, "/ksgvisualizer" on GitHub Pages). Inlined at build time. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefixes a root-relative URL for plain <img>/<a> tags, which Next does not rewrite (next/link does). */
export const withBasePath = (url: string) => `${BASE_PATH}${url}`;
