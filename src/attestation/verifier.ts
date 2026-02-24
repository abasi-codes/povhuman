import { logger } from "../logger.js";

export interface AttestationResult {
  valid: boolean;
  device_type: string;
  integrity_level: string;
  timestamp: string;
  raw_verdict?: unknown;
}

/**
 * Device attestation verifier with mock/live modes.
 * Phase 6 ships mock mode only; live API integration requires
 * app store listing (Play Integrity) and Apple Developer account (App Attest).
 */
export class AttestationVerifier {
  private liveMode: boolean;

  constructor(liveMode: boolean = false) {
    this.liveMode = liveMode;
  }

  async verify(
    platform: "android" | "ios" | "web",
    token: string,
    nonce: string,
  ): Promise<AttestationResult> {
    if (!this.liveMode) {
      return this.mockVerify(platform);
    }

    switch (platform) {
      case "android":
        return this.verifyPlayIntegrity(token, nonce);
      case "ios":
        return this.verifyAppAttest(token, nonce);
      case "web":
        return this.verifyWebAuthn(token, nonce);
    }
  }

  private mockVerify(platform: string): AttestationResult {
    logger.debug({ platform }, "Mock attestation verification");
    return {
      valid: true,
      device_type: "mock",
      integrity_level: "BASIC",
      timestamp: new Date().toISOString(),
    };
  }

  // Stubs for live mode (to be implemented with actual API integration)

  private async verifyPlayIntegrity(
    _token: string,
    _nonce: string,
  ): Promise<AttestationResult> {
    logger.warn("Play Integrity live verification not yet implemented");
    return {
      valid: false,
      device_type: "android",
      integrity_level: "NONE",
      timestamp: new Date().toISOString(),
    };
  }

  private async verifyAppAttest(
    _token: string,
    _nonce: string,
  ): Promise<AttestationResult> {
    logger.warn("App Attest live verification not yet implemented");
    return {
      valid: false,
      device_type: "ios",
      integrity_level: "NONE",
      timestamp: new Date().toISOString(),
    };
  }

  private async verifyWebAuthn(
    _token: string,
    _nonce: string,
  ): Promise<AttestationResult> {
    logger.warn("WebAuthn live verification not yet implemented");
    return {
      valid: false,
      device_type: "web",
      integrity_level: "NONE",
      timestamp: new Date().toISOString(),
    };
  }
}
