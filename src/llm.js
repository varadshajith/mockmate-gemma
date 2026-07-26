/**
 * Local model boundary.
 *
 * Every call the UI makes to a language model goes through this file and
 * nowhere else. Right now each function returns hardcoded mock data so the
 * app runs end-to-end offline with no model present.
 *
 * There are no network calls in this file and there must never be any to a
 * remote host — the target runtime is llama-server on localhost, nothing else.
 */

const LLM = (() => {
  // Mock latency so the loading states in the UI are actually exercised.
  const MOCK_DELAY_MS = 400;
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  /**
   * Score one answer.
   * @param {{question:string, userAnswer:string, modelAnswer:string, category:string}} req
   *        category is "Behavioral" or "System Design".
   * @returns {Promise<{score:number, strengths:string[], improvements:string[], modelAnswer:string, complexity:string|null, feedback:string}>}
   */
  async function evaluate(req) {
    // TODO: wire to llama-server
    await delay(MOCK_DELAY_MS);
    return {
      score: 72,
      strengths: [
        "Mock strength: answer addressed the question directly.",
        "Mock strength: used concrete terminology."
      ],
      improvements: [
        "Mock improvement: add a worked example.",
        "Mock improvement: state the trade-offs explicitly."
      ],
      modelAnswer: req.modelAnswer || "",
      complexity: req.category === "System Design" ? "O(n) time, O(n) space" : null,
      feedback: "Mock feedback from the stubbed local model."
    };
  }

  /**
   * Propose one adaptive follow-up question, or null for none.
   * @param {{questionText:string, userAnswer:string, category:string, role:string}} req
   * @returns {Promise<{followup:{id:string,text:string,category:string,hint:string}|null}>}
   */
  async function followup(req) {
    // TODO: wire to llama-server
    await delay(MOCK_DELAY_MS);
    return {
      followup: {
        id: "followup-mock",
        text: "Mock follow-up: what would you change about that answer if the constraints doubled?",
        category: "Adaptive Follow-up",
        hint: "Mock hint: talk about scaling and where the first bottleneck appears."
      }
    };
  }

  /**
   * Level-aware coaching summary for the results screen.
   * @param {{role:string, level:string, overallScore:number, roundScores:object, weakAreas:string[]}} req
   * @returns {Promise<{levelAdvice:string, strengths:string[], focusAreas:string[], nextSteps:string}>}
   */
  async function recommend(req) {
    // TODO: wire to llama-server
    await delay(MOCK_DELAY_MS);
    return {
      levelAdvice: `Mock coaching for a ${req.level} ${req.role} session scoring ${req.overallScore}%.`,
      strengths: [
        "Mock strength: consistent structure across answers.",
        "Mock strength: comfortable with the core vocabulary."
      ],
      focusAreas: [
        "Mock focus area: quantify claims with numbers.",
        "Mock focus area: close each answer with a summary sentence."
      ],
      nextSteps: "Mock next steps: run the same level again and compare the round scores."
    };
  }

  return { evaluate, followup, recommend };
})();

if (typeof window !== "undefined") window.LLM = LLM;
if (typeof module !== "undefined" && module.exports) module.exports = LLM;
