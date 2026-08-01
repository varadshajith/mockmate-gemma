/**
 * src/memory_persist.js — Weak-answer persistence gate.
 *
 * Callers: app.js (generateFinalAnalysisReport) and testing/t5_memory.js.
 * This module is the ONLY place the maybeStoreWeakAnswer logic lives.
 * Do NOT copy the gate conditions into tests — require this file instead.
 *
 * Depends on: InterviewMemory (src/memory.js must be loaded first in the browser).
 */

const MemoryPersist = (() => {
  /**
   * Persist a weak answer into interview memory after genuine grading.
   *
   * Hard skip conditions (ALL must pass to store):
   *   - answer was not an evalError
   *   - answer was not skipped
   *   - score is a real finite number below 60
   *   - topic is a non-empty string  (no topic → no way to match later → skip)
   *   - improvements[0] exists       (weakness text is the embed content)
   *
   * Never throws: any failure is a console.warn only.
   *
   * @param {{ evalError?, userAnswer, score, topic, improvements, question, roundType }} gradedAns
   * @param {{ roleId, roundType? }} session
   * @returns {Promise<void>}
   */
  async function maybeStoreWeakAnswer(gradedAns, session) {
    try {
      if (gradedAns.evalError) return;
      if (gradedAns.userAnswer === "[Question Skipped]") return;
      if (!Number.isFinite(gradedAns.score) || gradedAns.score >= 60) return;
      if (!gradedAns.topic || !gradedAns.topic.trim()) return;
      const weakness = (gradedAns.improvements || [])[0];
      if (!weakness || !weakness.trim()) return;

      await InterviewMemory.storeWeakAnswer({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        roleId: session.roleId,
        round: gradedAns.roundType || session.roundType || "behavioral",
        topic: gradedAns.topic.trim(),
        question: gradedAns.question,
        score: gradedAns.score,
        weakness: weakness.trim()
      });
      console.log(`[memory] Stored weak answer: topic="${gradedAns.topic}" score=${gradedAns.score}`);
    } catch (e) {
      console.warn("[memory] maybeStoreWeakAnswer failed — record not stored:", e.message);
    }
  }

  return { maybeStoreWeakAnswer };
})();

if (typeof window !== "undefined") window.MemoryPersist = MemoryPersist;
if (typeof module !== "undefined") module.exports = MemoryPersist;
