import { useSessionContext } from "../../context/SessionContext";

export function PrivacyPipeline() {
  const { redactionPolicy } = useSessionContext();

  const steps = [
    { name: "BlazeFace (faces)", active: redactionPolicy.blur_faces },
    { name: "YOLOv11n (screens)", active: redactionPolicy.blur_screens },
    { name: "OCR (text)", active: redactionPolicy.blur_text },
    { name: "Places365 (scene)", active: redactionPolicy.block_private_locations },
    { name: "Fail-closed mode", status: "warn" as const },
  ];

  return (
    <div className="card">
      <div className="card-title">Privacy Pipeline</div>
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
