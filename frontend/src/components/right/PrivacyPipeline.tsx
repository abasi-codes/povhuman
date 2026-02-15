export function PrivacyPipeline() {
  const steps = [
    { name: "Face blurring", active: true },
    { name: "Text redaction", active: false },
    { name: "Evidence capture", active: true },
    { name: "Fail-closed mode", status: "warn" as const },
  ];

  return (
    <div className="card">
      <div className="card-title">Evidence Pipeline</div>
      <div className="pipeline-list">
        {steps.map((step) => (
          <div key={step.name} className="priv-row">
            <span>{step.name}</span>
            {step.status === "warn" ? (
              <span className="priv-b warn">Enforced</span>
            ) : (
              <span className={`priv-b ${step.active ? "active" : "idle"}`}>
                {step.active ? "Active" : "Idle"}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
