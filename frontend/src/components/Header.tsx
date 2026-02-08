import { useEffect, useState } from "react";
import { useSessionContext } from "../context/SessionContext";

export function Header() {
  const { session, sessionId } = useSessionContext();
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

  const state = session?.state ?? (sessionId ? "created" : "idle");
  const badgeClass = state === "live" ? "live" : state === "paused" ? "paused" : state === "stopped" ? "stopped" : "idle";
  const label = sessionId
    ? `Session ${state.charAt(0).toUpperCase() + state.slice(1)}`
    : "No Session";

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <div className="eye-logo">
          <span className="eye-logo-inner">👁</span>
        </div>
        <div>
          <div className="brand-name">World Through My Eyes</div>
          <div className="brand-sub">OpenClaw Perception Connector</div>
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
