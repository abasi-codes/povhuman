import { useEffect, useState } from "react";
import { useTaskContext } from "../context/TaskContext";

export function Header() {
  const { task, taskId } = useTaskContext();
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = now.getHours().toString().padStart(2, "0");
      const m = now.getMinutes().toString().padStart(2, "0");
      const s = now.getSeconds().toString().padStart(2, "0");
      setClock(`${h}:${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const status = task?.status ?? (taskId ? "pending" : "idle");
  const badgeClass =
    status === "streaming" || status === "verifying" ? "live" :
    status === "completed" ? "stopped" :
    status === "cancelled" ? "stopped" :
    "idle";
  const label = taskId
    ? `Task ${status.charAt(0).toUpperCase() + status.slice(1)}`
    : "No Task";

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <div className="eye-logo">
          <span className="eye-logo-inner">{"\uD83D\uDCF9"}</span>
        </div>
        <div>
          <div className="brand-name">VerifyHuman</div>
          <div className="brand-sub">Livestream Verification</div>
        </div>
      </div>
      <div className="topbar-status">
        <div className={`chip-live ${badgeClass}`}>
          <div className="status-dot" />
          {label}
        </div>
        <div className="topbar-time">{clock}</div>
      </div>
    </header>
  );
}
