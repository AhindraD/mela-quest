import { renderPrometheusMetrics } from "../../../src/shared/metrics";

export const dynamic = "force-dynamic";

export function GET() {
  return new Response(renderPrometheusMetrics(), {
    status: 200,
    headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
  });
}
