import { useTaskContext } from "../../context/TaskContext";

function lamportsToSol(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(2);
}

function truncSig(sig: string): string {
  return `${sig.slice(0, 8)}...${sig.slice(-6)}`;
}

function explorerTxUrl(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

function flagLabel(flag: string): string {
  return flag.replace(/_/g, " ");
}

export function ResourceGauges() {
  const { task } = useTaskContext();

  const activeJobs = task?.active_jobs ?? 0;
  const maxJobs = 10;
  const r = 17;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (activeJobs / maxJobs) * circumference;

  const hasEscrow = task && task.escrow_lamports > 0;
  const gradeClass = task?.trust_grade ? `trust-grade-${task.trust_grade}` : "";

  // Escrow timeline step state
  const depositDone = hasEscrow && task.escrow_status !== "none";
  const verifyDone = task?.status === "completed";
  const releaseDone = hasEscrow && (task.escrow_status === "released" || task.escrow_status === "refunded");
  const depositActive = hasEscrow && task.escrow_status === "deposited" && !verifyDone;
  const verifyActive = depositDone && !verifyDone;
  const releaseActive = verifyDone && !releaseDone;
  const releaseLabel = task?.escrow_status === "refunded" ? "Refund" : "Release";

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

      {/* Trust Score Breakdown */}
      {task?.trust_score != null && (
        <div className="trust-display">
          <div className="hash-label">Trust Score</div>
          <div className="trust-header">
            <span className={`trust-score ${gradeClass}`}>
              {Math.round(task.trust_score * 100)}%
            </span>
            <span className={`trust-grade-pill ${gradeClass}`}>
              Grade {task.trust_grade}
            </span>
          </div>
          {task.trust_breakdown && (
            <div className="trust-bars">
              <div className="trust-bar-row">
                <span className="trust-bar-label">VLM 50%</span>
                <div className="trust-bar-track">
                  <div
                    className="trust-bar-fill vlm"
                    style={{ width: `${Math.round(task.trust_breakdown.vlm * 100)}%` }}
                  />
                </div>
                <span className="trust-bar-value">{Math.round(task.trust_breakdown.vlm * 100)}%</span>
              </div>
              <div className="trust-bar-row">
                <span className="trust-bar-label">GPS 30%</span>
                <div className="trust-bar-track">
                  <div
                    className="trust-bar-fill gps"
                    style={{ width: `${Math.round(task.trust_breakdown.gps * 100)}%` }}
                  />
                </div>
                <span className="trust-bar-value">{Math.round(task.trust_breakdown.gps * 100)}%</span>
              </div>
              <div className="trust-bar-row">
                <span className="trust-bar-label">Device 20%</span>
                <div className="trust-bar-track">
                  <div
                    className="trust-bar-fill attest"
                    style={{ width: `${Math.round(task.trust_breakdown.attestation * 100)}%` }}
                  />
                </div>
                <span className="trust-bar-value">{Math.round(task.trust_breakdown.attestation * 100)}%</span>
              </div>
            </div>
          )}
          {task.trust_flags && task.trust_flags.length > 0 && (
            <div className="trust-flags">
              {task.trust_flags.map((flag) => (
                <span key={flag} className="trust-flag">{flagLabel(flag)}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Attestation Indicator */}
      {task && (task.status === "streaming" || task.status === "verifying" || task.status === "completed") && (
        <div className="attest-display">
          <div className="hash-label">Device Attestation</div>
          {task.attestation ? (
            <>
              <div className="attest-status-row">
                <div className={`attest-indicator ${task.attestation.valid ? "valid" : "invalid"}`}>
                  {task.attestation.valid ? "\u2713" : "\u2717"}
                </div>
                <div className="attest-info">
                  <div className="attest-platform">{task.attestation.platform}</div>
                  <div className="attest-level">{task.attestation.integrity_level}</div>
                </div>
                <span className={`attest-badge ${task.attestation.valid ? "verified" : "failed"}`}>
                  {task.attestation.valid ? "Verified" : "Failed"}
                </span>
              </div>
              {task.attestation.device_type === "mock" && (
                <div className="attest-mock-hint">Mock mode &mdash; not a real device attestation</div>
              )}
            </>
          ) : (
            <div className="attest-pending">No attestation submitted</div>
          )}
        </div>
      )}

      {/* Verification Hash */}
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

      {/* Escrow Timeline */}
      {hasEscrow && (
        <div className="escrow-display">
          <div className="hash-label">
            Escrow &mdash; {lamportsToSol(task.escrow_lamports)} SOL
          </div>
          <div className="escrow-timeline">
            {/* Step 1: Deposit */}
            <div className="escrow-step">
              <div className="escrow-step-track">
                <div className={`escrow-step-node ${depositDone ? "done" : depositActive ? "active" : ""}`}>
                  {depositDone ? "\u2713" : "\u25CF"}
                </div>
                <div className={`escrow-step-line ${depositDone ? "done" : ""}`} />
              </div>
              <div className="escrow-step-content">
                <div className="escrow-step-label">Deposit</div>
                {task.deposit_signature && (
                  <div className="escrow-step-hint">
                    <a href={explorerTxUrl(task.deposit_signature)} target="_blank" rel="noopener noreferrer">
                      {truncSig(task.deposit_signature)}
                    </a>
                  </div>
                )}
              </div>
            </div>
            {/* Step 2: Verify */}
            <div className="escrow-step">
              <div className="escrow-step-track">
                <div className={`escrow-step-node ${verifyDone ? "done" : verifyActive ? "active" : ""}`}>
                  {verifyDone ? "\u2713" : verifyActive ? "\u25CF" : "\u25CB"}
                </div>
                <div className={`escrow-step-line ${verifyDone ? "done" : ""}`} />
              </div>
              <div className="escrow-step-content">
                <div className="escrow-step-label">Verify</div>
                {verifyActive && (
                  <div className="escrow-step-hint">Awaiting checkpoint completion...</div>
                )}
              </div>
            </div>
            {/* Step 3: Release/Refund */}
            <div className="escrow-step">
              <div className="escrow-step-track">
                <div className={`escrow-step-node ${releaseDone ? "done" : releaseActive ? "active" : ""}`}>
                  {releaseDone ? "\u2713" : releaseActive ? "\u25CF" : "\u25CB"}
                </div>
              </div>
              <div className="escrow-step-content">
                <div className="escrow-step-label">{releaseLabel}</div>
                {task.release_signature && (
                  <div className="escrow-step-hint">
                    <a href={explorerTxUrl(task.release_signature)} target="_blank" rel="noopener noreferrer">
                      {truncSig(task.release_signature)}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
          {task.escrow_pda && (
            <div className="escrow-pda">
              PDA: {task.escrow_pda.slice(0, 8)}...{task.escrow_pda.slice(-6)}
            </div>
          )}
        </div>
      )}

      {/* On-Chain Receipt */}
      {task?.status === "completed" && (
        <div className="chain-display">
          <div className="hash-label">On-Chain Receipt</div>
          {task.tx_hash ? (
            <>
              <a
                className="chain-link"
                href={explorerTxUrl(task.tx_hash)}
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
