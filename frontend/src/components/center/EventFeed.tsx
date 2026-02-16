import { useTaskContext } from "../../context/TaskContext";
import type { VerificationEvent } from "../../api/types";

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
    case "checkpoint_verified": return "Checkpoint Verified";
    case "task_completed": return "Task Completed";
    case "task_started": return "Task Started";
    case "task_cancelled": return "Task Cancelled";
    case "task_failed": return "Task Failed";
    case "job_restarted": return "Job Restarted";
    default: return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function EventItem({ event }: { event: VerificationEvent }) {
  return (
    <div className="evt">
      <div className="evt-time">{formatTime(event.created_at)}</div>
      <div className="evt-body">
        <div className={`evt-type ${event.event_type}`}>
          {typeLabel(event.event_type)}
        </div>
        {event.explanation && (
          <div className="evt-desc">{event.explanation}</div>
        )}
      </div>
      {event.confidence != null && (
        <div className="evt-conf">{Math.round(event.confidence * 100)}%</div>
      )}
    </div>
  );
}

export function EventFeed() {
  const { events, taskId } = useTaskContext();

  if (!taskId) {
    return (
      <div className="event-feed">
        <div style={{ color: "var(--text4)", fontSize: 11, padding: 24, textAlign: "center" }}>
          Create a task to see events
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="event-feed">
        <div style={{ color: "var(--text4)", fontSize: 11, padding: 24, textAlign: "center" }}>
          Waiting for verification events...
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
