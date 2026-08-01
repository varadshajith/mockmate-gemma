/**
 * Local interview-memory boundary.
 *
 * Only this file talks to embedding server at 127.0.0.1:8081. It stores
 * compact weak-answer retrieval records in browser localStorage; no answer
 * transcript or audio is retained here.
 */

const InterviewMemory = (() => {
  const EMBEDDING_URL = "http://127.0.0.1:8081/embedding";
  const STORAGE_KEY = "gemma_v2_memory";
  const MAX_ENTRIES = 200;
  const DEFAULT_SIMILARITY_THRESHOLD = 0.45;
  const REQUEST_TIMEOUT_MS = 15000;

  function parseEmbeddingResponse(data) {
    let vector;
    if (Array.isArray(data) && data[0]?.embedding) {
      vector = Array.isArray(data[0].embedding[0]) ? data[0].embedding[0] : data[0].embedding;
    } else {
      vector = Array.isArray(data?.embedding)
        ? data.embedding
        : data?.data?.[0]?.embedding;
    }

    if (!Array.isArray(vector) || vector.length === 0 || !vector.every(Number.isFinite)) {
      throw new Error("embedText(): embedding server response contained no valid embedding vector.");
    }
    return vector;
  }

  async function embedText(text) {
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("embedText(): text must be a non-empty string.");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(EMBEDDING_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text.trim() }),
        signal: controller.signal
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error(`embedText(): embedding server did not respond within ${REQUEST_TIMEOUT_MS}ms.`);
      }
      throw new Error(`embedText(): could not reach embedding server at ${EMBEDDING_URL} — ${error.message}`);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new Error(`embedText(): embedding server /embedding failed: ${response.status} ${response.statusText}`);
    }

    let data;
    try {
      data = await response.json();
    } catch (error) {
      throw new Error(`embedText(): embedding server returned invalid JSON — ${error.message}`);
    }
    return parseEmbeddingResponse(data);
  }

  function getEntries() {
    let parsed;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      parsed = JSON.parse(raw);
    } catch (error) {
      return [];
    }
    return Array.isArray(parsed) ? parsed.filter(isValidEntry) : [];
  }

  function isValidEntry(entry) {
    return entry && typeof entry.id === "string" && Number.isFinite(entry.timestamp) &&
      typeof entry.roleId === "string" && typeof entry.round === "string" &&
      typeof entry.topic === "string" && typeof entry.question === "string" &&
      Number.isFinite(entry.score) && typeof entry.weakness === "string" &&
      Array.isArray(entry.embedding) && entry.embedding.length > 0 && entry.embedding.every(Number.isFinite);
  }

  function saveEntries(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  async function storeWeakAnswer(record) {
    if (!record || !Number.isFinite(record.score)) {
      throw new Error("storeWeakAnswer(): record must include numeric score.");
    }
    if (record.score >= 60) return null;

    const requiredStrings = ["id", "roleId", "round", "topic", "question", "weakness"];
    if (requiredStrings.some((key) => typeof record[key] !== "string" || !record[key].trim())) {
      throw new Error("storeWeakAnswer(): record is missing required text fields.");
    }
    if (!Number.isFinite(record.timestamp)) {
      throw new Error("storeWeakAnswer(): record must include numeric timestamp.");
    }

    const embedding = await embedText(`${record.topic} ${record.weakness}`);
    const entry = {
      id: record.id,
      timestamp: record.timestamp,
      roleId: record.roleId,
      round: record.round,
      topic: record.topic,
      question: record.question,
      score: record.score,
      weakness: record.weakness,
      embedding
    };
    const entries = [...getEntries(), entry]
      .sort((left, right) => left.timestamp - right.timestamp)
      .slice(-MAX_ENTRIES);
    saveEntries(entries);
    return entry;
  }

  function cosineSimilarity(left, right) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length === 0 || left.length !== right.length) {
      return null;
    }
    let dot = 0;
    let leftMagnitude = 0;
    let rightMagnitude = 0;
    for (let index = 0; index < left.length; index++) {
      const a = left[index];
      const b = right[index];
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      dot += a * b;
      leftMagnitude += a * a;
      rightMagnitude += b * b;
    }
    if (leftMagnitude === 0 || rightMagnitude === 0) return null;
    return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
  }

  async function retrieve(query, options = {}) {
    const threshold = Number.isFinite(options.threshold)
      ? options.threshold
      : DEFAULT_SIMILARITY_THRESHOLD;
    const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 3;
    const queryEmbedding = await embedText(query);

    return getEntries()
      .filter((entry) => !options.roleId || entry.roleId === options.roleId)
      .map((entry) => ({ ...entry, similarity: cosineSimilarity(queryEmbedding, entry.embedding) }))
      .filter((entry) => entry.similarity !== null && entry.similarity >= threshold)
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, limit);
  }

  function clear() {
    localStorage.removeItem(STORAGE_KEY);
  }

  return {
    STORAGE_KEY,
    DEFAULT_SIMILARITY_THRESHOLD,
    parseEmbeddingResponse,
    embedText,
    storeWeakAnswer,
    retrieve,
    clear,
    getEntries,
    cosineSimilarity
  };
})();

if (typeof window !== "undefined") window.InterviewMemory = InterviewMemory;
