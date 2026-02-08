import { useMemo } from "react";
import { useSessionContext } from "../../context/SessionContext";

export function StatsCards() {
  const { session, events } = useSessionContext();

  const stats = useMemo(() => {
    const triggers = events.filter((e) => e.type === "triggered").length;
    const restarts = events.filter((e) => e.type === "restart").length;

    // Uptime: time since session created_at
    let uptimeStr = "—";
    if (session?.created_at && session.state === "live") {
      const created = new Date(session.created_at + "Z").getTime();
      const elapsed = Math.floor((Date.now() - created) / 1000);
      if (elapsed >= 3600) {
        uptimeStr = `${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m`;
      } else {
        uptimeStr = `${Math.floor(elapsed / 60)}m`;
      }
    }

    // Avg latency from restart gap times
    const gapEvents = events.filter((e) => e.type === "restart");
    let avgLatency = "—";
    if (gapEvents.length > 0) {
      const gaps = gapEvents
        .map((e) => {
          try {
            const meta = JSON.parse(e.metadata);
            return meta.gap_ms;
          } catch {
            return null;
          }
        })
        .filter((g): g is number => g != null);
      if (gaps.length > 0) {
        const avg = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
        avgLatency = `${avg}ms`;
      }
    }

    return { triggers, restarts, uptimeStr, avgLatency };
  }, [session, events]);

  return (
    <div className="stats-row">
      <div className="stat">
        <div className="stat-icon blue">⚡</div>
        <div>
          <div className="stat-label">Total Triggers</div>
          <div className="stat-num">{stats.triggers}</div>
        </div>
      </div>
      <div className="stat">
        <div className="stat-icon green">🔄</div>
        <div>
          <div className="stat-label">Restarts</div>
          <div className="stat-num">{stats.restarts}</div>
        </div>
      </div>
      <div className="stat">
        <div className="stat-icon amber">⏱</div>
        <div>
          <div className="stat-label">Uptime</div>
          <div className="stat-num">{stats.uptimeStr}</div>
        </div>
      </div>
      <div className="stat">
        <div className="stat-icon purple">📡</div>
        <div>
          <div className="stat-label">Avg Gap</div>
          <div className="stat-num">{stats.avgLatency}</div>
        </div>
      </div>
    </div>
  );
}
