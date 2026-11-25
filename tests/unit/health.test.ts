import { describe, expect, it } from "vitest";
import { buildHealthStatus } from "@/src/shared/health";

describe("buildHealthStatus", () => {
  it("returns ok readiness payload without leaking environment data", () => {
    const fixedDate = new Date("2026-11-25T12:00:00.000Z");
    const result = buildHealthStatus(42.9, fixedDate);

    expect(result).toEqual({
      status: "ok",
      service: "mela-io",
      uptimeSeconds: 42,
      timestamp: "2026-11-25T12:00:00.000Z",
    });
  });

  it("clamps negative uptime values to zero", () => {
    const result = buildHealthStatus(-5, new Date("2026-11-25T12:00:00.000Z"));
    expect(result.uptimeSeconds).toBe(0);
  });
});
