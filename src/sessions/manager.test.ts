import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { SessionManager } from "./manager.js";
import { TrioClient } from "../trio/client.js";
import { createTestDb, createMockTrioClient, buildSessionConfig } from "../test-helpers.js";
import type { SessionRow, TrioJobRow } from "../db/schema.js";

vi.mock("../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe("SessionManager", () => {
  let db: Database.Database;
  let mockTrio: ReturnType<typeof createMockTrioClient>;
  let manager: SessionManager;

  beforeEach(() => {
    db = createTestDb();
    mockTrio = createMockTrioClient();
    manager = new SessionManager(db, mockTrio as unknown as TrioClient, "https://webhook.example.com");
  });

  // -- createSession --

  it("createSession inserts session and returns id", async () => {
    const id = await manager.createSession(buildSessionConfig());
    expect(id).toHaveLength(12);
    const row = manager.getSession(id);
    expect(row).toBeDefined();
    expect(row!.state).toBe("created");
    expect(row!.stream_url).toContain("youtube.com");
  });

  it("createSession binds agents", async () => {
    const id = await manager.createSession(buildSessionConfig({ agent_ids: ["a1", "a2"] }));
    const bindings = manager.getActiveBindings(id);
    expect(bindings).toHaveLength(2);
  });

  // -- getSession --

  it("getSession returns undefined for nonexistent id", () => {
    expect(manager.getSession("nope")).toBeUndefined();
  });

  // -- startSession --

  it("startSession transitions to live when stream is valid", async () => {
    const id = await manager.createSession(buildSessionConfig());
    await manager.startSession(id);
    const session = manager.getSession(id)!;
    expect(session.state).toBe("live");
    expect(mockTrio.validateUrl).toHaveBeenCalled();
  });

  it("startSession throws for nonexistent session", async () => {
    await expect(manager.startSession("nope")).rejects.toThrow("not found");
  });

  it("startSession is no-op if already live", async () => {
    const id = await manager.createSession(buildSessionConfig());
    await manager.startSession(id);
    // Second call should not throw
    await manager.startSession(id);
    expect(mockTrio.validateUrl).toHaveBeenCalledTimes(1);
  });

  it("startSession throws when stream is not live", async () => {
    mockTrio.validateUrl.mockResolvedValue({ valid: true, is_live: false, url: "", platform: "youtube" });
    const id = await manager.createSession(buildSessionConfig());
    await expect(manager.startSession(id)).rejects.toThrow("not live");
    expect(manager.getSession(id)!.state).toBe("error");
  });

  it("startSession throws when max 10 concurrent jobs reached", async () => {
    // Insert 10 running jobs
    const dummySession = await manager.createSession(buildSessionConfig());
    for (let i = 0; i < 10; i++) {
      db.prepare(
        "INSERT INTO trio_jobs (job_id, session_id, job_type, status) VALUES (?, ?, ?, ?)"
      ).run(`fake-job-${i}`, dummySession, "live-monitor", "running");
    }

    const id = await manager.createSession(buildSessionConfig());
    await expect(manager.startSession(id)).rejects.toThrow("Maximum 10");
  });

  // -- startMonitoringJob --

  it("startMonitoringJob starts a Trio job and records in DB", async () => {
    const sessionId = await manager.createSession(buildSessionConfig());
    await manager.startSession(sessionId);
    const jobId = await manager.startMonitoringJob(sessionId, ["Is there a person?"]);
    expect(jobId).toBe("job-1");
    expect(mockTrio.startLiveMonitor).toHaveBeenCalled();
    const jobs = manager.getRunningJobs(sessionId);
    expect(jobs).toHaveLength(1);
  });

  it("startMonitoringJob combines multiple conditions", async () => {
    const sessionId = await manager.createSession(buildSessionConfig());
    await manager.startSession(sessionId);
    await manager.startMonitoringJob(sessionId, ["Is there a dog?", "Is it raining?"]);
    const call = mockTrio.startLiveMonitor.mock.calls[0][0];
    expect(call.condition).toContain("Check ALL");
    expect(call.condition).toContain("1. Is there a dog?");
  });

  // -- restartJob --

  it("restartJob creates new job and records restart event", async () => {
    const sessionId = await manager.createSession(buildSessionConfig());
    await manager.startSession(sessionId);
    const jobId = await manager.startMonitoringJob(sessionId, ["Is there a person?"]);

    mockTrio.startLiveMonitor.mockResolvedValue({ job_id: "job-new", status: "started" });
    const newJobId = await manager.restartJob(jobId);
    expect(newJobId).toBe("job-new");

    // Check restart event was recorded
    const events = db.prepare("SELECT * FROM perception_events WHERE session_id = ? AND type = 'restart'").all(sessionId);
    expect(events).toHaveLength(1);
  });

  it("restartJob returns null for nonexistent job", async () => {
    const result = await manager.restartJob("nonexistent");
    expect(result).toBeNull();
  });

  it("restartJob returns null if session is not live", async () => {
    const sessionId = await manager.createSession(buildSessionConfig());
    // Session stays in "created" state (not live)
    db.prepare("INSERT INTO trio_jobs (job_id, session_id, job_type, status) VALUES (?, ?, ?, ?)").run(
      "fake-job", sessionId, "live-monitor", "running"
    );
    const result = await manager.restartJob("fake-job");
    expect(result).toBeNull();
  });

  // -- pauseSession --

  it("pauseSession cancels jobs and updates state", async () => {
    const sessionId = await manager.createSession(buildSessionConfig());
    await manager.startSession(sessionId);
    await manager.startMonitoringJob(sessionId, ["Is there a person?"]);

    await manager.pauseSession(sessionId);
    expect(mockTrio.cancelJob).toHaveBeenCalledWith("job-1");
    expect(manager.getSession(sessionId)!.state).toBe("paused");
  });

  // -- stopSession --

  it("stopSession cancels jobs, revokes bindings, updates state", async () => {
    const sessionId = await manager.createSession(buildSessionConfig());
    await manager.startSession(sessionId);
    await manager.startMonitoringJob(sessionId, ["Is there a person?"]);

    await manager.stopSession(sessionId);
    expect(mockTrio.cancelJob).toHaveBeenCalled();
    expect(manager.getSession(sessionId)!.state).toBe("stopped");
    expect(manager.getActiveBindings(sessionId)).toHaveLength(0);
  });

  // -- recordEvent --

  it("recordEvent with short_lived sets 24h expiry", () => {
    const sessionId = "test-sess";
    db.prepare("INSERT INTO sessions (session_id, stream_url, state) VALUES (?, ?, ?)").run(
      sessionId, "https://youtube.com/watch?v=abc", "live"
    );
    const eventId = manager.recordEvent(sessionId, null, "triggered", "test", null, {}, "short_lived");
    expect(eventId).toHaveLength(12);
    const row = db.prepare("SELECT expires_at FROM perception_events WHERE event_id = ?").get(eventId) as { expires_at: string };
    expect(row.expires_at).toBeTruthy();
  });

  it("recordEvent with no_storage sets immediate expiry", () => {
    const sessionId = "test-sess2";
    db.prepare("INSERT INTO sessions (session_id, stream_url, state) VALUES (?, ?, ?)").run(
      sessionId, "https://youtube.com/watch?v=abc", "live"
    );
    const eventId = manager.recordEvent(sessionId, null, "triggered", "test", null, {}, "no_storage");
    const row = db.prepare("SELECT expires_at FROM perception_events WHERE event_id = ?").get(eventId) as { expires_at: string };
    expect(row.expires_at).toBeTruthy();
  });

  it("recordEvent with extended sets null expiry", () => {
    const sessionId = "test-sess3";
    db.prepare("INSERT INTO sessions (session_id, stream_url, state) VALUES (?, ?, ?)").run(
      sessionId, "https://youtube.com/watch?v=abc", "live"
    );
    const eventId = manager.recordEvent(sessionId, null, "triggered", "test", null, {}, "extended");
    const row = db.prepare("SELECT expires_at FROM perception_events WHERE event_id = ?").get(eventId) as { expires_at: string | null };
    expect(row.expires_at).toBeNull();
  });

  // -- findJobSession --

  it("findJobSession returns session_id for existing job", async () => {
    const sessionId = await manager.createSession(buildSessionConfig());
    await manager.startSession(sessionId);
    const jobId = await manager.startMonitoringJob(sessionId, ["Is there a person?"]);
    expect(manager.findJobSession(jobId)).toBe(sessionId);
  });

  it("findJobSession returns null for nonexistent job", () => {
    expect(manager.findJobSession("nope")).toBeNull();
  });

  // -- markJobStopped --

  it("markJobStopped updates job status and reason", async () => {
    const sessionId = await manager.createSession(buildSessionConfig());
    await manager.startSession(sessionId);
    const jobId = await manager.startMonitoringJob(sessionId, ["Is there a person?"]);
    manager.markJobStopped(jobId, "max_duration_reached");
    const job = db.prepare("SELECT status, stop_reason FROM trio_jobs WHERE job_id = ?").get(jobId) as { status: string; stop_reason: string };
    expect(job.status).toBe("stopped");
    expect(job.stop_reason).toBe("max_duration_reached");
  });

  // -- getAllRunningJobs --

  it("getAllRunningJobs returns jobs across sessions", async () => {
    const s1 = await manager.createSession(buildSessionConfig());
    await manager.startSession(s1);
    await manager.startMonitoringJob(s1, ["Is there a person?"]);

    mockTrio.startLiveMonitor.mockResolvedValue({ job_id: "job-2", status: "started" });
    mockTrio.validateUrl.mockResolvedValue({ valid: true, is_live: true, url: "", platform: "youtube" });
    const s2 = await manager.createSession(buildSessionConfig());
    await manager.startSession(s2);
    await manager.startMonitoringJob(s2, ["Is it raining?"]);

    const allJobs = manager.getAllRunningJobs();
    expect(allJobs).toHaveLength(2);
  });

  // -- restartJob error branch --

  it("restartJob marks job as error when Trio call fails", async () => {
    const sessionId = await manager.createSession(buildSessionConfig());
    await manager.startSession(sessionId);
    const jobId = await manager.startMonitoringJob(sessionId, ["Is there a person?"]);

    mockTrio.startLiveMonitor.mockRejectedValue(new Error("Trio down"));
    const result = await manager.restartJob(jobId);
    expect(result).toBeNull();
    const job = db.prepare("SELECT status, stop_reason FROM trio_jobs WHERE job_id = ?").get(jobId) as { status: string; stop_reason: string };
    expect(job.status).toBe("error");
    expect(job.stop_reason).toBe("restart_failed");
  });

  // -- startSession validation error path --

  it("startSession sets error state when Trio validateUrl rejects", async () => {
    mockTrio.validateUrl.mockResolvedValue({ valid: false, is_live: false, url: "", platform: "youtube", error: "bad url" });
    const id = await manager.createSession(buildSessionConfig());
    await expect(manager.startSession(id)).rejects.toThrow();
    expect(manager.getSession(id)!.state).toBe("error");
  });
});
