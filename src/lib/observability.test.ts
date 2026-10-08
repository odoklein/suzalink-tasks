import { describe, expect, it } from "vitest";

import { errorTags } from "@/lib/observability";

describe("errorTags", () => {
  it.each([
    ["/api/v1/projects/bg/tasks", { via: "API", projectKey: "BG" }],
    ["/api/v1/tasks/BG-12", { via: "API", projectKey: "BG" }],
    ["/api/mcp", { via: "MCP" }],
    ["/api/hooks/netlify", { via: "DEPLOY" }],
    ["/projects/bieres-georges?tache=BG-3", { via: "WEB", projectKey: "BG" }],
    ["/t/SUZ-4", { via: "WEB", projectKey: "SUZ" }],
    ["/p/abc", { via: "PORTAL" }],
    ["/", { via: "WEB" }],
  ])("%s", (path, expected) => {
    expect(errorTags(path)).toEqual(expected);
  });
});
