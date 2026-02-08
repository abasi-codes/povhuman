import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import type {
  SessionDetail,
  ValidateResponse,
  ConditionPreset,
  SharingScope,
  RetentionMode,
  RedactionPolicy,
} from "../api/types";
import * as sessionsApi from "../api/sessions";
import { useSession } from "../hooks/useSession";
import { useEvents } from "../hooks/useEvents";
import { useToast } from "../components/Toast";
import type { PerceptionEvent } from "../api/types";

interface SessionContextValue {
  // Session state
  sessionId: string | null;
  session: SessionDetail | null;
  sessionLoading: boolean;

  // Stream
  streamUrl: string;
  setStreamUrl: (url: string) => void;
  streamMeta: ValidateResponse | null;
  validating: boolean;
  validateStream: () => Promise<void>;
  validationError: string | null;

  // Presets & conditions
  presets: ConditionPreset[];
  loadPresets: () => Promise<void>;
  selectedPresetIds: Set<string>;
  togglePreset: (id: string) => void;
  customConditions: string[];
  addCustomCondition: (cond: string) => void;
  removeCondition: (index: number) => void;

  // Config
  sharingScope: SharingScope;
  setSharingScope: (s: SharingScope) => void;
  redactionPolicy: RedactionPolicy;
  setRedactionPolicy: (p: RedactionPolicy) => void;
  retentionMode: RetentionMode;
  setRetentionMode: (m: RetentionMode) => void;

  // Actions
  startSession: () => Promise<void>;
  pauseSession: () => Promise<void>;
  stopSession: () => Promise<void>;
  createError: string | null;

  // Events
  events: PerceptionEvent[];
  eventsLoading: boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { addToast } = useToast();

  // Session ID
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Stream
  const [streamUrl, setStreamUrl] = useState("");
  const [streamMeta, setStreamMeta] = useState<ValidateResponse | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Presets
  const [presets, setPresets] = useState<ConditionPreset[]>([]);
  const [selectedPresetIds, setSelectedPresetIds] = useState<Set<string>>(new Set());
  const [customConditions, setCustomConditions] = useState<string[]>([]);

  // Config
  const [sharingScope, setSharingScope] = useState<SharingScope>("events_only");
  const [redactionPolicy, setRedactionPolicy] = useState<RedactionPolicy>({
    blur_faces: true,
    blur_screens: false,
    blur_text: false,
    block_private_locations: true,
  });
  const [retentionMode, setRetentionMode] = useState<RetentionMode>("short_lived");
  const [createError, setCreateError] = useState<string | null>(null);

  // Polling hooks
  const { data: session, loading: sessionLoading } = useSession(sessionId);
  const { events, loading: eventsLoading } = useEvents(sessionId);

  // Track previous session state for toast notifications
  const prevStateRef = useRef<string | null>(null);
  useEffect(() => {
    if (!session) return;
    const currentState = session.state;
    if (prevStateRef.current && prevStateRef.current !== currentState) {
      if (currentState === "live") addToast("success", "Session is now live");
      else if (currentState === "paused") addToast("warning", "Session paused");
      else if (currentState === "stopped") addToast("info", "Session stopped");
    }
    prevStateRef.current = currentState;
  }, [session, addToast]);

  const loadPresets = useCallback(async () => {
    try {
      const { presets: p } = await sessionsApi.getPresets();
      setPresets(p);
    } catch (err) {
      addToast("error", "Failed to load presets");
      console.error(err);
    }
  }, [addToast]);

  const validateStream = useCallback(async () => {
    if (!streamUrl) return;
    setValidating(true);
    setValidationError(null);
    try {
      const result = await sessionsApi.validateUrl(streamUrl);
      if (!result.valid) {
        setValidationError(result.error || "Invalid URL");
        setStreamMeta(null);
        addToast("error", result.error || "Stream URL is invalid");
      } else {
        setStreamMeta(result);
        addToast("success", "Stream validated successfully");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Validation failed";
      setValidationError(msg);
      addToast("error", msg);
    } finally {
      setValidating(false);
    }
  }, [streamUrl, addToast]);

  const togglePreset = useCallback((id: string) => {
    setSelectedPresetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const addCustomCondition = useCallback((cond: string) => {
    if (cond.trim()) {
      setCustomConditions((prev) => [...prev, cond.trim()]);
    }
  }, []);

  const removeCondition = useCallback((index: number) => {
    setCustomConditions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const startSession = useCallback(async () => {
    setCreateError(null);
    try {
      const result = await sessionsApi.createSession({
        stream_url: streamUrl,
        preset_ids: [...selectedPresetIds],
        conditions: customConditions,
        sharing_scope: sharingScope,
        redaction_policy: redactionPolicy,
        retention_mode: retentionMode,
      });
      if (result.error) {
        setCreateError(result.error);
        addToast("error", result.error);
      } else {
        setSessionId(result.session_id);
        addToast("success", "Session created");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create session";
      setCreateError(msg);
      addToast("error", msg);
    }
  }, [streamUrl, selectedPresetIds, customConditions, sharingScope, redactionPolicy, retentionMode, addToast]);

  const doPause = useCallback(async () => {
    if (!sessionId) return;
    try {
      await sessionsApi.pauseSession(sessionId);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to pause session");
    }
  }, [sessionId, addToast]);

  const doStop = useCallback(async () => {
    if (!sessionId) return;
    try {
      await sessionsApi.stopSession(sessionId);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to stop session");
    }
  }, [sessionId, addToast]);

  return (
    <SessionContext.Provider
      value={{
        sessionId,
        session,
        sessionLoading,
        streamUrl,
        setStreamUrl,
        streamMeta,
        validating,
        validateStream,
        validationError,
        presets,
        loadPresets,
        selectedPresetIds,
        togglePreset,
        customConditions,
        addCustomCondition,
        removeCondition,
        sharingScope,
        setSharingScope,
        redactionPolicy,
        setRedactionPolicy,
        retentionMode,
        setRetentionMode,
        startSession,
        pauseSession: doPause,
        stopSession: doStop,
        createError,
        events,
        eventsLoading,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionContext(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSessionContext must be used within SessionProvider");
  return ctx;
}
