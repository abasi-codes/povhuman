import { ErrorBoundary } from "./components/ErrorBoundary";
import { ToastProvider } from "./components/Toast";
import { TaskProvider } from "./context/TaskContext";
import { Header } from "./components/Header";
import { TaskCreator } from "./components/left/TaskCreator";
import { CheckpointBuilder } from "./components/left/CheckpointBuilder";
import { CheckpointProgress } from "./components/left/CheckpointProgress";
import { TaskControl } from "./components/left/TaskControl";
import { StatsCards } from "./components/center/StatsCards";
import { TrioJobs } from "./components/center/TrioJobs";
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
            <div className="col">
              <TaskCreator />
              <CheckpointBuilder />
              <CheckpointProgress />
              <TaskControl />
            </div>

            {/* Center Column */}
            <div className="col">
              <StatsCards />
              <TrioJobs />
              <div className="panel" style={{ padding: 0 }}>
                <div className="monitor-layout">
                  <EventFeed />
                  <EvidenceViewer />
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="col">
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
