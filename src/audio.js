/**
 * Local audio boundary.
 *
 * The browser SpeechRecognition API is deliberately NOT used here: in Chrome
 * it streams microphone audio to Google's servers, which breaks the
 * network-off requirement. Speech-to-text and text-to-speech both go through
 * this file so a local pipeline can be dropped in without touching the views.
 *
 * Right now startListening() replays a canned transcript and speak() is a
 * no-op log. No microphone is opened and no audio leaves the machine.
 */

const LocalAudio = (() => {
  const MOCK_TRANSCRIPT =
    "This is a mock transcript from the stubbed local audio pipeline. " +
    "Replace it once speech-to-text runs against a local model.";

  // Feed the mock transcript back word by word so the UI sees the same
  // incremental updates a real streaming recogniser would produce.
  const MOCK_WORD_MS = 90;

  let listening = false;
  let tickHandle = null;
  let speaking = false;

  /**
   * Start (mock) transcription.
   * @param {(transcript: string) => void} onTranscript called with the full
   *        transcript so far, each time it grows.
   */
  function startListening(onTranscript) {
    // TODO: wire to local audio pipeline
    if (listening) return;
    listening = true;

    const words = MOCK_TRANSCRIPT.split(" ");
    let i = 0;
    tickHandle = setInterval(() => {
      i++;
      if (i > words.length) {
        stopListening();
        onTranscript(MOCK_TRANSCRIPT);
        return;
      }
      onTranscript(words.slice(0, i).join(" "));
    }, MOCK_WORD_MS);
  }

  function stopListening() {
    // TODO: wire to local audio pipeline
    if (tickHandle) clearInterval(tickHandle);
    tickHandle = null;
    listening = false;
  }

  function isListening() {
    return listening;
  }

  /**
   * Read text aloud.
   * @param {string} text
   */
  function speak(text) {
    // TODO: wire to local audio pipeline
    speaking = true;
    console.log("[audio stub] speak:", text);
  }

  function stopSpeaking() {
    // TODO: wire to local audio pipeline
    speaking = false;
  }

  function isSpeaking() {
    return speaking;
  }

  return { startListening, stopListening, isListening, speak, stopSpeaking, isSpeaking };
})();

if (typeof window !== "undefined") window.LocalAudio = LocalAudio;
if (typeof module !== "undefined" && module.exports) module.exports = LocalAudio;
