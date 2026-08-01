/**
 * Local model boundary.
 *
 * Every call the UI makes to a language model goes through this file and
 * nowhere else. evaluate(), followup(), and recommend() are all wired to
 * llama-server.
 *
 * The only network calls in this file target llama-server —
 * there must never be a call to any other host.
 */

const LLM = (() => {
  const LLAMA_SERVER_URL = "http://192.168.137.123:8080";
  const EVALUATE_GRAMMAR_PATH = "grammars/evaluate.gbnf";
  const FOLLOWUP_GRAMMAR_PATH = "grammars/followup.gbnf";
  const RECOMMEND_GRAMMAR_PATH = "grammars/recommend.gbnf";

  // Generous on purpose. A warm request is ~2.3s, but the first call after
  // llama-server starts also pays for model warmup, and a tight timeout
  // would fire on every cold start.
  const REQUEST_TIMEOUT_MS = 60000;

  // Substituted only if an empty array somehow survives the min-1-item
  // grammar rule. Deliberately neutral: inventing praise or inventing a
  // criticism to fill the slot would be a fabricated evaluation.
  const NO_STRENGTHS_PLACEHOLDER = "No specific strengths identified in this answer.";
  const NO_IMPROVEMENTS_PLACEHOLDER = "No specific improvements identified for this answer.";
  const NO_FOCUS_AREAS_PLACEHOLDER = "No specific focus areas identified from this session.";

  // Longest slice of a bad response body worth putting in an error message.
  const ERROR_BODY_EXCERPT_CHARS = 300;

  /**
   * POST to llama-server's native /completion endpoint with a timeout.
   * Throws a clear, caller-named error on timeout, transport failure, or a
   * non-2xx status. Never returns a partial or synthesised result.
   * @param {string} fnName name of the calling LLM function, for error text
   * @param {object} body request payload
   * @returns {Promise<object>} parsed llama-server envelope
   */
  async function postCompletion(fnName, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res;
    try {
      res = await fetch(`${LLAMA_SERVER_URL}/completion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } catch (err) {
      if (err && err.name === "AbortError") {
        throw new Error(
          `${fnName}(): llama-server did not respond within ${REQUEST_TIMEOUT_MS}ms — request timed out.`
        );
      }
      throw new Error(`${fnName}(): could not reach llama-server at ${LLAMA_SERVER_URL} — ${err.message}`);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new Error(`${fnName}(): llama-server /completion failed: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  /**
   * POST to llama-server's OpenAI-compatible chat endpoint. This is used only
   * when evaluate() is given local WAV audio; every other text-model request
   * remains on /completion.
   */
  async function postChatCompletion(fnName, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res;
    try {
      res = await fetch(`${LLAMA_SERVER_URL}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } catch (err) {
      if (err && err.name === "AbortError") {
        throw new Error(
          `${fnName}(): llama-server did not respond within ${REQUEST_TIMEOUT_MS}ms — request timed out.`
        );
      }
      throw new Error(`${fnName}(): could not reach llama-server at ${LLAMA_SERVER_URL} — ${err.message}`);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw new Error(`${fnName}(): llama-server /v1/chat/completions failed: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  /**
   * Pull the generated text out of a llama-server response and JSON.parse it.
   * Both steps can fail on a well-formed HTTP 200 (unexpected envelope shape,
   * or output truncated at the n_predict ceiling mid-object), so both are
   * reported with the function name and a truncated excerpt of what came back.
   */
  function parseCompletionContent(fnName, data) {
    if (typeof data?.content !== "string") {
      throw new Error(
        `${fnName}(): llama-server response had no "content" string — got ${excerpt(JSON.stringify(data))}`
      );
    }
    try {
      return JSON.parse(data.content);
    } catch (err) {
      throw new Error(
        `${fnName}(): could not parse model output as JSON (${err.message}) — raw response: ${excerpt(data.content)}`
      );
    }
  }

  function parseChatCompletionContent(fnName, data) {
    const choice = data?.choices?.[0];
    if (!choice || typeof choice.message?.content !== "string") {
      throw new Error(
        `${fnName}(): llama-server response had no choices[0].message.content string — got ${excerpt(JSON.stringify(data))}`
      );
    }
    if (choice.finish_reason !== "stop") {
      throw new Error(
        `${fnName}(): llama-server chat response finished as "${choice.finish_reason}" instead of "stop" — refusing partial grading output.`
      );
    }
    try {
      return JSON.parse(choice.message.content);
    } catch (err) {
      throw new Error(
        `${fnName}(): could not parse model output as JSON (${err.message}) — raw response: ${excerpt(choice.message.content)}`
      );
    }
  }

  function excerpt(text) {
    const s = String(text ?? "");
    return s.length > ERROR_BODY_EXCERPT_CHARS
      ? `${s.slice(0, ERROR_BODY_EXCERPT_CHARS)}… (truncated)`
      : s;
  }

  // The grammar requires at least one item, so this is a backstop rather than
  // the primary defence. Passing [] to the UI renders a section heading over
  // an empty list, which reads as a bug rather than as a finding.
  function withPlaceholder(items, placeholder) {
    const cleaned = Array.isArray(items) ? items.filter((s) => typeof s === "string" && s.trim()) : [];
    return cleaned.length ? cleaned : [placeholder];
  }

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

  // STAR, for the Behavioral round. The "I" vs "we" instruction matters more
  // than it looks: a candidate describing a team's work in the first person
  // plural is the most common way an answer sounds strong while saying nothing
  // about what the candidate themselves actually did.
  const BEHAVIORAL_RUBRIC = [
    "Grade this Behavioral answer against the STAR framework. Score each dimension, then weigh them into one 0-100 score:",
    "- Situation: is the context concrete and specific, or generic and hypothetical?",
    "- Task: is the candidate's own responsibility clear, as distinct from the team's?",
    "- Action: what did THEY personally do, step by step — not what the team did?",
    "- Result: is there a stated outcome, ideally with a measurable number?",
    "",
    "Penalise vagueness heavily. Penalise \"we\" where \"I\" is expected: if the candidate describes the team's actions instead of their own, the Action dimension scores low no matter how impressive the project sounds."
  ].join("\n");

  // definition / mechanism / tradeoff / experience, for the Technical
  // round. Tradeoff is called out as the discriminator on purpose — it is the
  // dimension a candidate cannot pass by reciting a memorised definition.
  const TECHNICAL_RUBRIC = [
    "Grade this Technical answer against four dimensions. Score each, then weigh them into one 0-100 score:",
    "- Definition: do they define the thing correctly?",
    "- Mechanism: can they explain how it actually works, not just what it is called?",
    "- Tradeoff: do they name what it COSTS, not only what it gives?",
    "- Experience: do they ground it in something they have actually built or operated?",
    "",
    "Tradeoff is the discriminator between a memorised answer and an understood one. An answer that defines the concept fluently but names no cost, no failure mode, and no alternative it was chosen over has not demonstrated understanding — score it accordingly."
  ].join("\n");

  // Applies to both rubrics. Without this, the min-1-item grammar rule turns
  // into pressure to invent a compliment for a bad answer, which would be a
  // fabricated evaluation in the same way a fabricated score is.
  const HONESTY_INSTRUCTION = [
    "If a dimension is absent from the answer, say so plainly in \"improvements\" — name the dimension and what was missing.",
    "Do NOT manufacture a compliment to fill the \"strengths\" requirement. If the answer is weak, an honest neutral observation about what the candidate did attempt is the correct strength to record. Never praise something that is not there."
  ].join("\n");

  function buildEvaluatePrompt(req) {
    const isTechnical = req.category === "Technical" || req.category === "System Design";
    const probeUsed = req.probeUsed === true;
    return [
      "You are an interview coach grading a candidate's spoken interview answer.",
      "",
      `Category: ${req.category}`,
      `Question: ${req.question}`,
      `Reference answer: ${req.modelAnswer || "(none provided)"}`,
      `Candidate's answer: ${req.userAnswer}`,
      "The complete answer is the transcript above.",
      "An audio clip may also be attached. It is the closing portion of this answer; listen to it for what the transcript cannot carry. Do not treat it as the complete answer.",
      "",
      isTechnical ? TECHNICAL_RUBRIC : BEHAVIORAL_RUBRIC,
      "",
      HONESTY_INSTRUCTION,
      "",
      isTechnical
        ? "Set \"complexity\" to the real time/space complexity implied by the candidate's proposed design (e.g. \"O(n) time, O(1) space\"), derived from what they actually described. Do not use a placeholder value."
        : "Set \"complexity\" to null.",
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
   * @param {{question:string, userAnswer:string, modelAnswer:string, category:string, probeUsed?:boolean, audioB64?:string}} req
   *        category is "Behavioral", "Technical", or "System Design". probeUsed indicates whether a
   *        clarifying probe has already been used on the current topic (defaults to false).
   * @returns {Promise<{score:number, strengths:string[], improvements:string[], modelAnswer:string, complexity:string|null, feedback:string, levelSignal:("step_up"|"stay"|"probe"|"step_down"), gradedFrom:("text"|"audio+text")}>}
   */
  async function evaluate(req) {
    const grammar = await loadEvaluateGrammar();
    const prompt = buildEvaluatePrompt(req);
    let parsed;
    let gradedFrom = "text";

    if (typeof req.audioB64 === "string" && req.audioB64.trim()) {
      try {
        const data = await postChatCompletion("evaluate", {
          messages: [{
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "input_audio", input_audio: { data: req.audioB64, format: "wav" } }
            ]
          }],
          // Same grammar source and same prompt as the text-only path.
          grammar,
          temperature: 0.2,
          max_tokens: 700,
          stream: false,
          // Required: without this llama-server may spend its completion
          // budget on reasoning and return no usable JSON.
          chat_template_kwargs: { enable_thinking: false }
        });
        parsed = parseChatCompletionContent("evaluate", data);
        gradedFrom = "audio+text";
      } catch (audioError) {
        console.warn(`evaluate(): audio grading failed; falling back to text-only grading — ${audioError.message}`);
      }
    }

    if (!parsed) {
      const data = await postCompletion("evaluate", {
        prompt,
        grammar,
        temperature: 0.2,
        n_predict: 700,
        stream: false
      });
      parsed = parseCompletionContent("evaluate", data);
    }

    if (typeof parsed.score !== "number") {
      throw new Error(`evaluate(): model returned non-numeric score "${parsed.score}"`);
    }

    const isTechnical = req.category === "Technical" || req.category === "System Design";
    const levelSignal = deriveLevelSignal(parsed.score, req.probeUsed === true);

    // The model also emits a levelSignal, but the JS derivation above is
    // authoritative — see deriveLevelSignal(). Logged rather than silently
    // dropped so a systematic disagreement is visible during testing.
    if (parsed.levelSignal && parsed.levelSignal !== levelSignal) {
      console.warn(
        `evaluate(): model levelSignal "${parsed.levelSignal}" disagrees with derived "${levelSignal}" ` +
        `for score ${parsed.score} (probeUsed=${req.probeUsed === true}); using derived value.`
      );
    }

    return {
      score: parsed.score,
      strengths: withPlaceholder(parsed.strengths, NO_STRENGTHS_PLACEHOLDER),
      improvements: withPlaceholder(parsed.improvements, NO_IMPROVEMENTS_PLACEHOLDER),
      // The authored reference answer from question-bank.js is the trustworthy
      // one; the model's generated version is only a fallback when a question
      // ships without one.
      modelAnswer: req.modelAnswer || parsed.modelAnswer || "",
      complexity: req.category === "System Design" ? (parsed.complexity || null) : null,
      feedback: parsed.feedback || "",
      levelSignal,
      gradedFrom
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
      const data = await postCompletion("followup", {
        prompt,
        grammar,
        temperature: 0.2,
        n_predict: 300,
        stream: false
      });
      const parsed = parseCompletionContent("followup", data);

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
    let lastParseError = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const data = await postCompletion("recommend", {
        prompt,
        grammar,
        temperature: 0.2,
        n_predict: 700,
        stream: false
      });

      let parsed;
      try {
        parsed = parseCompletionContent("recommend", data);
      } catch (err) {
        // Malformed/truncated output — retry, but keep the reason in case
        // this turns out to be the last attempt.
        lastParseError = err;
        continue;
      }

      if (!isDegenerateRecommendation(parsed)) {
        return {
          levelAdvice: parsed.levelAdvice,
          strengths: withPlaceholder(parsed.strengths, NO_STRENGTHS_PLACEHOLDER),
          focusAreas: withPlaceholder(parsed.focusAreas, NO_FOCUS_AREAS_PLACEHOLDER),
          nextSteps: parsed.nextSteps
        };
      }
    }

    // Every attempt was unusable — either unparseable or placeholder text.
    if (lastParseError) throw lastParseError;
    throw new Error(`recommend(): model returned placeholder text on all ${MAX_ATTEMPTS} attempts`);
  }

  return { evaluate, followup, recommend };
})();

if (typeof window !== "undefined") window.LLM = LLM;
if (typeof module !== "undefined" && module.exports) module.exports = LLM;
