import { logger } from "../logger.js";
import type { StreamSession } from "./types.js";

/**
 * WebRTC → RTSP relay stub.
 *
 * Real implementation will need a media server (Janus/mediasoup/Cloudflare WHIP).
 * For POC, this generates placeholder URLs and logs warnings.
 */
export class StreamRelay {
  private sessions = new Map<string, StreamSession>();

  /**
   * Create a stream session for a task.
   * Returns placeholder RTSP URL + WebRTC connection info.
   */
  createSession(taskId: string): StreamSession {
    const session: StreamSession = {
      task_id: taskId,
      rtsp_url: `rtsp://stream.verifyhuman.local/${taskId}`,
      webrtc_offer_url: `/api/v1/stream/${taskId}/offer`,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    this.sessions.set(taskId, session);
    logger.info({ taskId }, "Stream session created (stub)");
    return session;
  }

  /**
   * Handle a WebRTC offer SDP.
   * Stub: logs warning and returns a placeholder SDP answer.
   */
  handleOffer(taskId: string, _sdp: string): { answer_sdp: string; status: string } {
    logger.warn(
      { taskId },
      "WebRTC offer received but relay is not implemented. " +
      "Real implementation needs Janus/mediasoup/Cloudflare WHIP.",
    );

    const session = this.sessions.get(taskId);
    if (session) {
      session.status = "connected";
    }

    return {
      answer_sdp: "v=0\r\n" +
        "o=verifyhuman 0 0 IN IP4 0.0.0.0\r\n" +
        "s=VerifyHuman Stub\r\n" +
        "t=0 0\r\n",
      status: "stub_connected",
    };
  }

  getSession(taskId: string): StreamSession | undefined {
    return this.sessions.get(taskId);
  }

  removeSession(taskId: string): void {
    this.sessions.delete(taskId);
  }
}
