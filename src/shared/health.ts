export interface HealthStatus {
  status: "ok";
  service: "mela-io";
  uptimeSeconds: number;
  timestamp: string;
}

export function buildHealthStatus(
  uptimeSeconds: number = Math.floor(process.uptime()),
  now: Date = new Date()
): HealthStatus {
  return {
    status: "ok",
    service: "mela-io",
    uptimeSeconds: Math.max(0, Math.floor(uptimeSeconds)),
    timestamp: now.toISOString(),
  };
}
