import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Component tests run in jsdom (via a per-file docblock); node tests have no DOM to clean up.
afterEach(() => {
  if (typeof document !== "undefined") cleanup();
});
