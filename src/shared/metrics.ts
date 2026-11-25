const counters = {
  socketEventsTotal: 0,
  sarvamRequestsTotal: 0,
  flagsmithRefreshesTotal: 0,
};

const gauges = {
  activeRooms: 0,
  activePlayers: 0,
};

export function recordSocketEvent() {
  counters.socketEventsTotal += 1;
}

export function recordSarvamRequest() {
  counters.sarvamRequestsTotal += 1;
}

export function recordFlagsmithRefresh() {
  counters.flagsmithRefreshesTotal += 1;
}

export function setRoomGauges(rooms: number, players: number) {
  gauges.activeRooms = rooms;
  gauges.activePlayers = players;
}

export function renderPrometheusMetrics(): string {
  return [
    "# HELP mela_uptime_seconds Process uptime in seconds",
    "# TYPE mela_uptime_seconds gauge",
    `mela_uptime_seconds ${Math.floor(process.uptime())}`,
    "# HELP mela_active_rooms Current active rooms in memory",
    "# TYPE mela_active_rooms gauge",
    `mela_active_rooms ${gauges.activeRooms}`,
    "# HELP mela_active_players Current players in rooms",
    "# TYPE mela_active_players gauge",
    `mela_active_players ${gauges.activePlayers}`,
    "# HELP mela_socket_events_total Total handled socket requests",
    "# TYPE mela_socket_events_total counter",
    `mela_socket_events_total ${counters.socketEventsTotal}`,
    "# HELP mela_sarvam_requests_total Total Sarvam AI text/voice requests",
    "# TYPE mela_sarvam_requests_total counter",
    `mela_sarvam_requests_total ${counters.sarvamRequestsTotal}`,
    "# HELP mela_flagsmith_refreshes_total Total Flagsmith flag evaluations",
    "# TYPE mela_flagsmith_refreshes_total counter",
    `mela_flagsmith_refreshes_total ${counters.flagsmithRefreshesTotal}`,
    "",
  ].join("\n");
}
