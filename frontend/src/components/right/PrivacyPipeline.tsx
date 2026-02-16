import { useState } from "react";

export function PrivacyPipeline() {
  const [blurFaces, setBlurFaces] = useState(true);
  const [blurText, setBlurText] = useState(false);
  const [failClosed, setFailClosed] = useState(true);

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-label">Evidence Pipeline</div>
      </div>

      <div className="priv-pipeline">
        <span className="priv-step active">Capture</span>
        <span className="priv-arrow">&rarr;</span>
        <span className="priv-step active">Redact</span>
        <span className="priv-arrow">&rarr;</span>
        <span className="priv-step active">Store</span>
      </div>

      <div className="toggle-group">
        <div className="toggle-row">
          <span>Blur faces</span>
          <button
            className={`tg-track ${blurFaces ? "on" : ""}`}
            onClick={() => setBlurFaces(!blurFaces)}
          />
        </div>
        <div className="toggle-row">
          <span>Blur text</span>
          <button
            className={`tg-track ${blurText ? "on" : ""}`}
            onClick={() => setBlurText(!blurText)}
          />
        </div>
        <div className="toggle-row">
          <span>Fail-closed mode</span>
          <button
            className={`tg-track ${failClosed ? "on" : ""}`}
            onClick={() => setFailClosed(!failClosed)}
          />
        </div>
      </div>
    </div>
  );
}
