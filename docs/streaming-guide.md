# Getting Started with YouTube Live

World Through My Eyes is device-agnostic — any YouTube Live URL works regardless of how the stream was created. Below are the most common setups.

## Device Options

| Device | YouTube Live? | Quality | Battery | Setup Difficulty |
|--------|:---:|---------|---------|-----------------|
| **Phone (YouTube app)** | Native | 1080p+ | 3-5 hrs | Very Low |
| **GoPro Hero 13** | Native RTMP | 1080p | 1.5-2 hrs | Low |
| **Webcam + OBS** | Via OBS RTMP | Up to 4K | N/A (plugged in) | Medium |
| **IP camera (RTSP)** | Via OBS/relay | Varies | N/A | Medium-High |
| **Ray-Ban Meta Gen 1** | Facebook/IG only (relay needed) | ~720p | 30 min | High |
| **Ray-Ban Meta Gen 2** | No livestream capability | N/A | N/A | Not viable |

## Phone (Recommended for getting started)

1. Open the YouTube app on your phone
2. Tap the **+** button > **Go live**
3. Choose "Stream" (not "Create a Short")
4. Set your title and privacy (Unlisted is fine)
5. Tap **Go Live**
6. Copy the stream URL and paste it into World Through My Eyes

## GoPro

1. Open the GoPro app > Preferences > Connections > Live Stream
2. Select YouTube as the platform
3. Sign in and configure resolution (1080p recommended)
4. Start streaming from the GoPro
5. Copy the YouTube URL from your GoPro app or YouTube Studio

## Webcam + OBS

1. Install [OBS Studio](https://obsproject.com/)
2. In OBS: Settings > Stream > Service: YouTube - RTMPS
3. Connect your YouTube account
4. Add your webcam as a video source
5. Click "Start Streaming"
6. Your stream URL will be in YouTube Studio

## Ray-Ban Meta Glasses

**Gen 2 (current): Does NOT support livestreaming.** The livestreaming feature was removed.

**Gen 1:** Can stream to Facebook/Instagram only. To reach YouTube:
1. Stream to Facebook Live
2. Use [Restream.io](https://restream.io) to relay Facebook Live to YouTube Live
3. Use the YouTube URL from Restream

**Future:** Meta's Wearables Device Access Toolkit (2026) may enable direct RTMP streaming from Gen 2 glasses via third-party apps.

## Battery-Aware Session Guidance

For mobile devices, plan your monitoring sessions around battery life:

| Device | Estimated Battery While Streaming |
|--------|----------------------------------|
| Phone | 3-5 hours (keep plugged in if possible) |
| GoPro | 1.5-2 hours (carry spare batteries) |
| Ray-Ban Meta Gen 1 | ~30 minutes (very limited) |

**Tip:** If you're on battery, increase `interval_seconds` to 60 or higher to reduce how often the VLM analyzes frames. This doesn't affect battery directly (that's the stream itself), but reduces your API costs per session.

## YouTube Latency Mode

For the fastest agent perception, set your stream to **Ultra-low latency**:

| YouTube Latency Mode | Delay | Recommended? |
|---------------------|-------|:---:|
| Ultra-low latency | 2-5 seconds | Best for agent perception |
| Low latency | 5-15 seconds | Good default |
| Normal latency | 15-60 seconds | Not recommended |

Set this in YouTube Studio > Stream Settings > Latency before going live.
