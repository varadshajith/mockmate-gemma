/**
 * Local audio boundary.
 *
 * Speech recognition is deliberately not used: in Chrome it streams
 * microphone audio to Google. The browser talks only to the local sidecar,
 * which captures and transcribes audio locally.
 */

const LocalAudio = (() => {
  const SIDECAR_URL = "ws://127.0.0.1:8765";
  const READY_TIMEOUT_MS = 5000;
  const DRAIN_TIMEOUT_MS = 30000;
  const FATAL_ERROR_CODES = new Set(["capture_failed", "bad_message", "unknown_command"]);

  let state = "idle";
  let socket = null;
  let readyTimer = null;
  let drainTimer = null;
  let onTranscript = null;
  let onPartialTranscript = null;
  let onEvent = null;
  let transcriptChunks = new Map();
  let speaking = false;
  let speakingSocket = null;

  function clearReadyTimer() {
    if (readyTimer !== null) clearTimeout(readyTimer);
    readyTimer = null;
  }

  function clearDrainTimer() {
    if (drainTimer !== null) clearTimeout(drainTimer);
    drainTimer = null;
  }

  function emitEvent(event) {
    if (onEvent) onEvent(event);
  }

  function resetConnection(ws) {
    if (ws && socket !== ws) return;
    clearReadyTimer();
    clearDrainTimer();
    socket = null;
    state = "idle";
  }

  function joinedTranscript() {
    return [...transcriptChunks.entries()]
      .sort(([first], [second]) => first - second)
      .map(([, text]) => text)
      .filter(Boolean)
      .join(" ");
  }

  /**
   * Start local transcription.
   * @param {(transcript: string) => void} transcriptCallback finalized transcript so far
   * @param {(event: object) => void} eventCallback sidecar status/error events
   * @param {(partial: {finalized: string, committed: string, tentative: string}) => void} partialTranscriptCallback
   * optional live transcript updates; never used to submit or evaluate an answer
   */
  function startListening(transcriptCallback, eventCallback, partialTranscriptCallback) {
    if (state !== "idle") {
      if (eventCallback) {
        eventCallback({
          type: "error",
          code: "busy",
          message: "Still finishing the previous recording.",
        });
      }
      return;
    }

    state = "connecting";
    onTranscript = transcriptCallback;
    onEvent = eventCallback || null;
    onPartialTranscript = partialTranscriptCallback || null;
    transcriptChunks = new Map();

    const ws = new WebSocket(SIDECAR_URL);
    socket = ws;

    readyTimer = setTimeout(() => {
      if (socket !== ws || state !== "connecting") return;
      resetConnection(ws);
      emitEvent({
        type: "error",
        code: "sidecar_unreachable",
        message: "The local audio sidecar did not become ready.",
      });
      ws.close();
    }, READY_TIMEOUT_MS);

    ws.onmessage = (message) => {
      if (socket !== ws) return;

      let event;
      try {
        event = JSON.parse(message.data);
      } catch (_err) {
        resetConnection(ws);
        ws.close();
        emitEvent({ type: "error", code: "bad_message", message: "Invalid response from local audio sidecar." });
        return;
      }

      if (event.type === "ready") {
        if (state !== "connecting") return;
        clearReadyTimer();
        state = "listening";
        ws.send(JSON.stringify({ type: "start" }));
        return;
      }

      if (event.type === "transcript") {
        transcriptChunks.set(event.chunkIndex, event.text);
        if (onTranscript) onTranscript(joinedTranscript());
        if (onPartialTranscript) {
          onPartialTranscript({ finalized: joinedTranscript(), committed: "", tentative: "" });
        }
        return;
      }

      if (event.type === "transcript_partial") {
        if (typeof event.committed !== "string" || typeof event.tentative !== "string") {
          emitEvent({ type: "error", code: "bad_message", message: "Invalid partial transcript from local sidecar." });
          return;
        }
        if (onPartialTranscript) {
          onPartialTranscript({
            finalized: joinedTranscript(),
            committed: event.committed,
            tentative: event.tentative,
          });
        }
        return;
      }

      if (event.type === "stopped") {
        if (state === "draining") {
          clearReadyTimer();
          clearDrainTimer();
          ws.close();
        }
        return;
      }

      // Tear down BEFORE emitting. app.js gates its button/orb reset on
      // isListening(), so the state has to be idle by the time the callback
      // runs or the UI keeps claiming it is listening over a dead capture.
      if (event.type === "error" && FATAL_ERROR_CODES.has(event.code)) {
        resetConnection(ws);
        ws.close();
      }
      emitEvent(event);
    };

    ws.onclose = (event) => {
      if (socket !== ws) return;
      const previousState = state;
      resetConnection(ws);

      if (previousState === "connecting") {
        const rejectedOrigin = event.code === 1008;
        emitEvent(rejectedOrigin
          ? {
              type: "error",
              code: "origin_not_allowed",
              message: "The audio sidecar rejected this page's origin. Serve the app from localhost:8000 or 127.0.0.1:8000.",
            }
          : { type: "error", code: "sidecar_unreachable", message: "Could not connect to the local audio sidecar." });
      } else if (previousState === "listening") {
        emitEvent({ type: "error", code: "connection_lost", message: "The local audio connection was lost." });
      }
      // A close while draining follows the sidecar's stopped acknowledgement.
    };
  }

  function stopListening() {
    if (state === "connecting") {
      const pendingSocket = socket;
      resetConnection(pendingSocket);
      if (pendingSocket) pendingSocket.close();
      return;
    }

    if (state !== "listening") return;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const drainingSocket = socket;
    state = "draining";
    drainTimer = setTimeout(() => {
      if (socket !== drainingSocket || state !== "draining") return;
      resetConnection(drainingSocket);
      drainingSocket.close();
      emitEvent({
        type: "error",
        code: "drain_timeout",
        message: "The sidecar did not finish transcribing. Your last words may be missing.",
      });
    }, DRAIN_TIMEOUT_MS);
    try {
      drainingSocket.send(JSON.stringify({ type: "stop" }));
    } catch (_err) {
      // The socket closed after the OPEN check; onclose reports the failure.
      clearDrainTimer();
      state = "listening";
    }
  }

  function isListening() {
    return state === "connecting" || state === "listening";
  }

  /**
   * Read text aloud.
   * @param {string} text
   */
  function speak(text) {
    if (!text || !text.trim()) return;
    stopSpeaking();
    speaking = true;
    const ws = new WebSocket(SIDECAR_URL);
    speakingSocket = ws;

    ws.onmessage = (message) => {
      if (speakingSocket !== ws) return;
      let event;
      try {
        event = JSON.parse(message.data);
      } catch (_err) {
        speaking = false;
        speakingSocket = null;
        ws.close();
        return;
      }
      if (event.type === "ready") {
        ws.send(JSON.stringify({ type: "speak", text }));
      } else if (event.type === "speaking_finished" || event.type === "error") {
        speaking = false;
        speakingSocket = null;
        ws.close();
      }
    };
    ws.onclose = () => {
      if (speakingSocket === ws) {
        speaking = false;
        speakingSocket = null;
      }
    };
  }

  function stopSpeaking() {
    const ws = speakingSocket;
    speaking = false;
    speakingSocket = null;
    if (!ws) return;
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "stop_speaking" }));
      } catch (_err) {
        // The close below completes cleanup if the socket raced closed.
      }
    }
    // The TTS connection is intentionally short-lived. Closing it also makes
    // the sidecar stop any playback if the stop command raced the handshake.
    ws.close();
  }

  function isSpeaking() {
    return speaking;
  }

  return { startListening, stopListening, isListening, speak, stopSpeaking, isSpeaking };
})();

if (typeof window !== "undefined") window.LocalAudio = LocalAudio;
if (typeof module !== "undefined" && module.exports) module.exports = LocalAudio;
