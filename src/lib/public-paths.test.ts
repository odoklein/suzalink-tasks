import { describe, expect, it } from "vitest";

import { isPublicPath } from "@/lib/public-paths";

describe("isPublicPath", () => {
  it.each([
    "/login",
    "/api/hooks/netlify",
    "/api/hooks/github",
    "/api/cron/tick",
    "/api/v1/projects",
    "/api/v1/tasks/BG-12",
    "/api/mcp",
    "/api/auth/google/callback",
    "/api/ics/abc123",
    "/api/widget/feedback",
    "/p/tok_123",
    "/widget.js",
    "/sw.js",
    "/manifest.webmanifest",
    "/icon",
    "/icon.svg",
    "/icon0",
    "/apple-icon.png",
  ])("%s est public", (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  it.each([
    "/",
    "/projects",
    "/projects/bieres-georges",
    "/settings",
    "/loginx",
    "/api/mcpx",
    "/api/other",
    "/iconography",
    "/pages",
    "/p",
  ])("%s demande une session", (path) => {
    expect(isPublicPath(path)).toBe(false);
  });
});
