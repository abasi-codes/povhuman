import { useSessionContext } from "../../context/SessionContext";
import type { PerceptionEvent } from "../../api/types";

function formatTime(iso: string): string {
  try {
    const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
    return d.toLocaleTimeString("en-US", { hour12: false });
  } catch {
    return iso;
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case "triggered": return "Triggered";
    case "digest": return "Digest Ready";
    case "restart": return "Job Restart";
    case "status": return "Job Status";
    case "heartbeat": return "Heartbeat";
    default: return type;
  }
}

const typeEmoji: Record<string, string> = {
  triggered: "⚡",
  digest: "📋",
  restart: "🔄",
  status: "📊",
  heartbeat: "💓",
};

function EventItem({ event }: { event: PerceptionEvent }) {
  let condition: string | null = null;
  try {
    const meta = JSON.parse(event.metadata);
    condition = meta.condition || null;
  } catch { /* ignore */ }

  return (
    <div className={`evt ${event.type}`}>
      <div className="evt-time">{formatTime(event.created_at)}</div>
      <div>
        <div className="evt-type">
          {typeEmoji[event.type] || "•"} {typeLabel(event.type)}
        </div>
        <div className="event-explanation">{event.explanation || "—"}</div>
        {condition && (
          <div className="event-condition">Matched: &quot;{condition}&quot;</div>
        )}
      </div>
    </div>
  );
}

export function EventFeed() {
  const { events, sessionId } = useSessionContext();

  if (!sessionId) {
    return (
      <div className="event-feed">
        <div style={{ color: "var(--text3)", fontSize: 13, padding: 24, textAlign: "center" }}>
          Start a session to see events
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="event-feed">
        <div style={{ color: "var(--text3)", fontSize: 13, padding: 24, textAlign: "center" }}>
          Waiting for events...
        </div>
      </div>
    );
  }

  return (
    <div className="event-feed">
      {events.map((evt) => (
        <EventItem key={evt.event_id} event={evt} />
      ))}
    </div>
  );
}
