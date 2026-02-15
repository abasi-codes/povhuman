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
    default: return type;
  }
}

const typeIcon: Record<string, string> = {
  checkpoint_verified: "\u2705",
  task_completed: "\uD83C\uDFC1",
  task_started: "\u25B6\uFE0F",
  task_cancelled: "\u274C",
  task_failed: "\u26A0\uFE0F",
  job_restarted: "\uD83D\uDD04",
};

function EventItem({ event }: { event: VerificationEvent }) {
  let meta: Record<string, string> = {};
  try { meta = JSON.parse(event.metadata); } catch { /* ignore */ }

  return (
    <div className={`evt ${event.event_type}`}>
      <div className="evt-time">{formatTime(event.created_at)}</div>
      <div>
        <div className="evt-type">
          {typeIcon[event.event_type] || "\u2022"} {typeLabel(event.event_type)}
          {event.confidence != null && (
            <span className="evt-confidence"> ({Math.round(event.confidence * 100)}%)</span>
          )}
        </div>
        <div className="event-explanation">{event.explanation || "\u2014"}</div>
        {meta.type && (
          <div className="event-condition">{meta.type}: {meta.target}</div>
        )}
      </div>
    </div>
  );
}

export function EventFeed() {
  const { events, taskId } = useTaskContext();

  if (!taskId) {
    return (
      <div className="event-feed">
        <div style={{ color: "var(--text3)", fontSize: 13, padding: 24, textAlign: "center" }}>
          Create a task to see events
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="event-feed">
        <div style={{ color: "var(--text3)", fontSize: 13, padding: 24, textAlign: "center" }}>
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
