import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastProvider } from "./components/Toast";
import { TaskProvider } from "./context/TaskContext";
import { Header } from "./components/Header";
import { TaskCreator } from "./components/left/TaskCreator";
import { CheckpointBuilder } from "./components/left/CheckpointBuilder";
import { TaskControl } from "./components/left/TaskControl";
import { StatsCards } from "./components/center/StatsCards";
import { EventFeed } from "./components/center/EventFeed";
import { EvidenceViewer } from "./components/center/EvidenceViewer";
import { AgentBindings } from "./components/right/AgentBindings";
import { PrivacyPipeline } from "./components/right/PrivacyPipeline";
import { ResourceGauges } from "./components/right/ResourceGauges";

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <TaskProvider>
          <Header />
          <main className="page">
            {/* Left Column */}
            <div className="left">
              <TaskCreator />
              <CheckpointBuilder />
              <TaskControl />
            </div>

            {/* Center Column */}
            <div className="center">
              <StatsCards />
              <div className="card" style={{ flex: 1 }}>
                <div className="card-title">Verification Feed</div>
                <div className="monitor-split">
                  <EventFeed />
                  <EvidenceViewer />
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
        </TaskProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
