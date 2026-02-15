export interface StreamSession {
  task_id: string;
  rtsp_url: string;
  webrtc_offer_url: string;
  status: "pending" | "connected" | "disconnected";
  created_at: string;
}
