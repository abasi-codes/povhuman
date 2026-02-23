import { useEffect, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
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
  const chipClass =
    status === "verifying" ? "verifying" :
    status === "streaming" ? "streaming" :
    status === "completed" ? "completed" :
    status === "pending" ? "pending" :
    "idle";
  const label = taskId
    ? status.charAt(0).toUpperCase() + status.slice(1)
    : "Idle";

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <div className="brand-mark" />
        <div>
          <div className="brand-name">
            Verify<span className="brand-sep">/</span>Human
          </div>
          <div className="brand-sub">Livestream Verification</div>
        </div>
      </div>
      <div className="topbar-right">
        <div className={`status-chip ${chipClass}`}>
          <div className="status-dot" />
          {label}
        </div>
        <WalletMultiButton />
        <div className="topbar-clock">{clock}</div>
      </div>
    </header>
  );
}
