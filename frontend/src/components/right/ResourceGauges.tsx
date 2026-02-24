import { useTaskContext } from "../../context/TaskContext";

function lamportsToSol(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(2);
}

function escrowLabel(status: string): string {
  switch (status) {
    case "deposited": return "Deposited";
    case "released": return "Released";
    case "refunded": return "Refunded";
    default: return "No Escrow";
  }
}

function escrowClass(status: string): string {
  switch (status) {
    case "deposited": return "escrow-deposited";
    case "released": return "escrow-released";
    case "refunded": return "escrow-refunded";
    default: return "escrow-none";
  }
}

export function ResourceGauges() {
  const { task } = useTaskContext();

  const activeJobs = task?.active_jobs ?? 0;
  const maxJobs = 10;
  const r = 17;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (activeJobs / maxJobs) * circumference;

  const hasEscrow = task && task.escrow_lamports > 0;

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-label">Resources</div>
      </div>

      <div className="gauge-row">
        <div className="gauge-ring">
          <svg viewBox="0 0 40 40">
            <circle className="gauge-bg" cx="20" cy="20" r={r} />
            <circle
              className="gauge-fg"
              cx="20"
              cy="20"
              r={r}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="gauge-text">{activeJobs}</div>
        </div>
        <div className="gauge-info">
          Trio Jobs<br />
          <span className="gauge-sub">{activeJobs} of {maxJobs} slots used</span>
        </div>
      </div>

      {hasEscrow && (
        <div className="escrow-display">
          <div className="hash-label">Escrow</div>
          <div className="escrow-amount">
            {lamportsToSol(task.escrow_lamports)} SOL
          </div>
          <div className={`escrow-status ${escrowClass(task.escrow_status)}`}>
            {escrowLabel(task.escrow_status)}
          </div>
          {task.escrow_pda && (
            <div className="escrow-pda">
              PDA: {task.escrow_pda.slice(0, 8)}...{task.escrow_pda.slice(-6)}
            </div>
          )}
          {task.deposit_signature && (
            <a
              className="chain-link"
              href={`https://explorer.solana.com/tx/${task.deposit_signature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Deposit tx: {task.deposit_signature.slice(0, 8)}...{task.deposit_signature.slice(-6)}
            </a>
          )}
          {task.release_signature && (
            <a
              className="chain-link"
              href={`https://explorer.solana.com/tx/${task.release_signature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Release tx: {task.release_signature.slice(0, 8)}...{task.release_signature.slice(-6)}
            </a>
          )}
        </div>
      )}

      {task?.trust_score != null && (
        <div className="trust-display" style={{ marginBottom: 12 }}>
          <div className="hash-label">Trust Score</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <span style={{
              fontSize: 20,
              fontWeight: 700,
              fontFamily: "var(--fm)",
              color: task.trust_grade === "A" ? "var(--green)" :
                     task.trust_grade === "B" ? "var(--amber)" :
                     task.trust_grade === "C" ? "var(--amber)" : "var(--red, #ef4444)",
            }}>
              {Math.round(task.trust_score * 100)}%
            </span>
            <span style={{
              padding: "2px 8px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              background: task.trust_grade === "A" ? "rgba(16,185,129,0.15)" :
                          task.trust_grade === "B" ? "rgba(245,158,11,0.15)" :
                          task.trust_grade === "C" ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)",
              color: task.trust_grade === "A" ? "var(--green)" :
                     task.trust_grade === "B" ? "var(--amber)" :
                     task.trust_grade === "C" ? "var(--amber)" : "var(--red, #ef4444)",
            }}>
              Grade {task.trust_grade}
            </span>
          </div>
        </div>
      )}

      <div className="hash-display">
        <div className="hash-label">Verification Hash</div>
        {task?.verification_hash ? (
          <div className="hash-value">{task.verification_hash}</div>
        ) : (
          <div className="hash-pending">
            Pending &mdash; computed when all checkpoints verified
          </div>
        )}
      </div>

      {task?.status === "completed" && (
        <div className="chain-display">
          <div className="hash-label">On-Chain Receipt</div>
          {task.tx_hash ? (
            <>
              <a
                className="chain-link"
                href={`https://explorer.solana.com/tx/${task.tx_hash}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {task.tx_hash.slice(0, 10)}...{task.tx_hash.slice(-8)}
              </a>
              <span className="chain-badge">Solana</span>
            </>
          ) : (
            <div className="chain-pending">
              Pending &mdash; posting to Solana...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
