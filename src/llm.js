/**
 * Local model boundary.
 *
 * Every call the UI makes to a language model goes through this file and
 * nowhere else. evaluate(), followup(), and recommend() are all wired to
 * llama-server.
 *
 * The only network calls in this file target llama-server on localhost —
 * there must never be a call to any other host.
 */

const LLM = (() => {
  const LLAMA_SERVER_URL = "http://localhost:8080";
  const EVALUATE_GRAMMAR_PATH = "grammars/evaluate.gbnf";
  const FOLLOWUP_GRAMMAR_PATH = "grammars/followup.gbnf";
  const RECOMMEND_GRAMMAR_PATH = "grammars/recommend.gbnf";

  // Fetched once and reused — the grammar files don't change at runtime.
  let evaluateGrammarPromise = null;
  function loadEvaluateGrammar() {
    if (!evaluateGrammarPromise) {
      evaluateGrammarPromise = fetch(EVALUATE_GRAMMAR_PATH).then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${EVALUATE_GRAMMAR_PATH}: ${res.status}`);
        return res.text();
      });
    }
    return evaluateGrammarPromise;
  }

  let followupGrammarPromise = null;
  function loadFollowupGrammar() {
    if (!followupGrammarPromise) {
      followupGrammarPromise = fetch(FOLLOWUP_GRAMMAR_PATH).then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${FOLLOWUP_GRAMMAR_PATH}: ${res.status}`);
        return res.text();
      });
    }
    return followupGrammarPromise;
  }

  let recommendGrammarPromise = null;
  function loadRecommendGrammar() {
    if (!recommendGrammarPromise) {
      recommendGrammarPromise = fetch(RECOMMEND_GRAMMAR_PATH).then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${RECOMMEND_GRAMMAR_PATH}: ${res.status}`);
        return res.text();
      });
    }
    return recommendGrammarPromise;
  }

  // Pure arithmetic on the score + probe state — computed here rather than
  // trusted from the model's own levelSignal field, because in testing the
  // model didn't reliably apply the "probe already used" clause (it kept
  // returning "probe" instead of "step_down"). The model still decides the
  // score itself; this just applies the fixed threshold rules to it.
  function deriveLevelSignal(score, probeUsed) {
    if (score > 75) return "step_up";
    if (score >= 50) return "stay";
    return probeUsed ? "step_down" : "probe";
  }

  function buildEvaluatePrompt(req) {
    const isSystemDesign = req.category === "System Design";
    const probeUsed = req.probeUsed === true;
    return [
      "You are an interview coach grading a candidate's spoken interview answer.",
      "",
      `Category: ${req.category}`,
      `Question: ${req.question}`,
      `Reference answer: ${req.modelAnswer || "(none provided)"}`,
      `Candidate's answer: ${req.userAnswer}`,
      "",
      "Score the candidate's answer from 0 to 100 based on correctness, depth, and clarity of communication.",
      isSystemDesign
        ? "This is a System Design question: set \"complexity\" to the real time/space complexity implied by the candidate's proposed design (e.g. \"O(n) time, O(1) space\"), derived from what they actually described. Do not use a placeholder value."
        : "This is a Behavioral question: set \"complexity\" to null.",
      "",
      "Decide \"levelSignal\" from the score you just assigned, applying these rules in order:",
      "- score > 75: \"step_up\"",
      "- score 50-75 inclusive: \"stay\"",
      "- score < 50 and a probe has NOT already been used on this topic: \"probe\"",
      "- score < 50 and a probe HAS already been used on this topic: \"step_down\"",
      `A probe has ${probeUsed ? "already been used" : "not been used"} on this topic.`,
      "",
      "Respond with a single JSON object matching the schema exactly, no extra text."
    ].join("\n");
  }

  /**
   * Score one answer.
   * @param {{question:string, userAnswer:string, modelAnswer:string, category:string, probeUsed?:boolean}} req
   *        category is "Behavioral" or "System Design". probeUsed indicates whether a
   *        clarifying probe has already been used on the current topic (defaults to false).
   * @returns {Promise<{score:number, strengths:string[], improvements:string[], modelAnswer:string, complexity:string|null, feedback:string, levelSignal:("step_up"|"stay"|"probe"|"step_down")}>}
   */
  async function evaluate(req) {
    const grammar = await loadEvaluateGrammar();
    const prompt = buildEvaluatePrompt(req);

    const res = await fetch(`${LLAMA_SERVER_URL}/completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        grammar,
        temperature: 0.2,
        n_predict: 700,
        stream: false
      })
    });

    if (!res.ok) {
      throw new Error(`llama-server /completion failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const parsed = JSON.parse(data.content);

    if (typeof parsed.score !== "number") {
      throw new Error(`evaluate(): model returned non-numeric score "${parsed.score}"`);
    }

    const isSystemDesign = req.category === "System Design";

    return {
      score: parsed.score,
      strengths: parsed.strengths || [],
      improvements: parsed.improvements || [],
      modelAnswer: parsed.modelAnswer || req.modelAnswer || "",
      complexity: isSystemDesign ? (parsed.complexity || null) : null,
      feedback: parsed.feedback || "",
      levelSignal: deriveLevelSignal(parsed.score, req.probeUsed === true)
    };
  }

  function buildFollowupPrompt(req) {
    return [
      "You are running a live mock interview. The candidate answer you just heard was too thin to score well, which is exactly why a follow-up is being requested right now.",
      "",
      `Role: ${req.role}`,
      `Category: ${req.category}`,
      `Original question: ${req.questionText}`,
      `Candidate's answer: ${req.userAnswer}`,
      "",
      "Ask ONE specific clarifying follow-up question, on the same topic, that pushes the candidate for the concrete detail their answer lacked — a real example, a number, a named mechanism, or a stated trade-off.",
      "Write out every field in full. Never use \"...\" or any other placeholder text.",
      "",
      "Respond with a single JSON object matching the schema exactly, no extra text."
    ].join("\n");
  }

  // In testing, the model occasionally emitted "..." placeholders instead of
  // real field content (~1 in 8 requests even with the anti-placeholder
  // prompt line above) — this catches that and triggers a retry.
  function isDegenerateFollowup(f) {
    if (!f) return false;
    const text = (f.text || "").trim();
    return text.length < 8 || /^\.+$/.test(text);
  }

  /**
   * Propose one adaptive follow-up question, or null for none.
   * @param {{questionText:string, userAnswer:string, category:string, role:string}} req
   * @returns {Promise<{followup:{id:string,text:string,category:string,hint:string}|null}>}
   */
  async function followup(req) {
    const grammar = await loadFollowupGrammar();
    const prompt = buildFollowupPrompt(req);
    const MAX_ATTEMPTS = 3;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const res = await fetch(`${LLAMA_SERVER_URL}/completion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          grammar,
          temperature: 0.2,
          n_predict: 300,
          stream: false
        })
      });

      if (!res.ok) {
        throw new Error(`llama-server /completion failed: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      const parsed = JSON.parse(data.content);

      if (!isDegenerateFollowup(parsed.followup)) {
        return { followup: parsed.followup || null };
      }
    }

    // Every attempt came back with placeholder text — no usable follow-up.
    return { followup: null };
  }

  function buildRecommendPrompt(req) {
    const roundSummary = Object.entries(req.roundScores || {})
      .map(([round, r]) => `${round}: ${r && typeof r.score === "number" ? r.score + "%" : "not completed"}`)
      .join(", ") || "(no rounds completed)";
    const weakAreas = (req.weakAreas || []).length ? req.weakAreas.join("; ") : "(none flagged)";

    return [
      "You are an interview coach writing a level-aware coaching summary for the candidate's results screen after a completed mock interview.",
      "",
      `Role: ${req.role}`,
      `Level: ${req.level}`,
      `Overall score: ${req.overallScore}%`,
      `Round scores: ${roundSummary}`,
      `Weakest-scoring questions: ${weakAreas}`,
      "",
      `Assess whether this candidate is ready for the ${req.level} bar for a ${req.role}, referencing their actual overall score and round performance. List their real strengths and the specific areas they should focus on next, grounded in the round scores and weak questions above — not generic advice. Give one concrete, actionable next step for their next practice session.`,
      "Write out every field in full, in complete sentences. Never use \"...\" or any other placeholder, and never write the field names themselves as content.",
      "",
      "Respond with a single JSON object matching the schema exactly, no extra text."
    ].join("\n");
  }

  function isDegenerateRecommendation(r) {
    if (!r) return true;
    const isPlaceholder = (s) => {
      const t = (s || "").trim();
      return t.length < 8 || /^\.+$/.test(t);
    };
    return isPlaceholder(r.levelAdvice) || isPlaceholder(r.nextSteps);
  }

  /**
   * Level-aware coaching summary for the results screen.
   * @param {{role:string, level:string, overallScore:number, roundScores:object, weakAreas:string[]}} req
   * @returns {Promise<{levelAdvice:string, strengths:string[], focusAreas:string[], nextSteps:string}>}
   */
  async function recommend(req) {
    const grammar = await loadRecommendGrammar();
    const prompt = buildRecommendPrompt(req);
    const MAX_ATTEMPTS = 3;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const res = await fetch(`${LLAMA_SERVER_URL}/completion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          grammar,
          temperature: 0.2,
          n_predict: 700,
          stream: false
        })
      });

      if (!res.ok) {
        throw new Error(`llama-server /completion failed: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      let parsed;
      try {
        parsed = JSON.parse(data.content);
      } catch {
        continue; // Malformed/truncated output — retry.
      }

      if (!isDegenerateRecommendation(parsed)) {
        return {
          levelAdvice: parsed.levelAdvice,
          strengths: parsed.strengths || [],
          focusAreas: parsed.focusAreas || [],
          nextSteps: parsed.nextSteps
        };
      }
    }

    // Every attempt came back with placeholder text.
    throw new Error("recommend(): model returned placeholder text on every attempt");
  }

  return { evaluate, followup, recommend };
})();

if (typeof window !== "undefined") window.LLM = LLM;
if (typeof module !== "undefined" && module.exports) module.exports = LLM;
