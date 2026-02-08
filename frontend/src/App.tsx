import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastProvider } from "./components/Toast";
import { SessionProvider } from "./context/SessionContext";
import { Header } from "./components/Header";
import { StreamSetup } from "./components/left/StreamSetup";
import { ConditionBuilder } from "./components/left/ConditionBuilder";
import { SessionControl } from "./components/left/SessionControl";
import { StatsCards } from "./components/center/StatsCards";
import { EventFeed } from "./components/center/EventFeed";
import { SnapshotViewer } from "./components/center/SnapshotViewer";
import { AgentBindings } from "./components/right/AgentBindings";
import { PrivacyPipeline } from "./components/right/PrivacyPipeline";
import { ResourceGauges } from "./components/right/ResourceGauges";

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <SessionProvider>
          <Header />
          <main className="page">
            {/* Left Column */}
            <div className="left">
              <StreamSetup />
              <ConditionBuilder />
              <SessionControl />
            </div>

            {/* Center Column */}
            <div className="center">
              <StatsCards />
              <div className="card" style={{ flex: 1 }}>
                <div className="card-title">Event Feed</div>
                <div className="monitor-split">
                  <EventFeed />
                  <SnapshotViewer />
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="right">
              <AgentBindings />
              <PrivacyPipeline />
              <ResourceGauges />
            </div>
          </main>
        </SessionProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
