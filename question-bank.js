/* ============================================================
   Question Bank — STRUCTURE ONLY, no content.
   Structure: QUESTION_BANK[roleId][level][round]
     round ∈ { behavioral, systemDesign }
     level ∈ { easy, medium, advanced }
   Behavioral:   { text, hint, modelAnswer }
   SystemDesign: { text, hint, modelAnswer }   (same shape; both rounds are spoken)

   Every array is empty — author one role deeply rather than filling all 14.
   Un-authored roles fall back to a related role via getRoundQuestions(),
   which returns [] when the fallback is empty too. Callers handle empty.
   ============================================================ */

// --- 14 roles (setup grid metadata) ---
const ROLES = [
  { id: "frontend",  name: "Frontend Developer",     icon: "code-2",      domain: "Web",         authored: true,  fallback: "frontend" },
  { id: "backend",   name: "Backend Developer",      icon: "database",    domain: "Web",         authored: true,  fallback: "backend"  },
  { id: "fullstack", name: "Full Stack Developer",   icon: "layers",      domain: "Web",         authored: false, fallback: "frontend" },
  { id: "data-analyst", name: "Data Analyst",        icon: "bar-chart-3", domain: "Data",        authored: false, fallback: "backend"  },
  { id: "data-scientist", name: "Data Scientist",    icon: "brain",       domain: "Data/ML",     authored: false, fallback: "genai"    },
  { id: "genai",     name: "GenAI / LLM Engineer",   icon: "sparkles",    domain: "AI",          authored: true,  fallback: "genai"    },
  { id: "agentic",   name: "Agentic AI Engineer",    icon: "bot",         domain: "AI",          authored: false, fallback: "genai"    },
  { id: "devops",    name: "DevOps / SRE",           icon: "server",      domain: "Infra",       authored: false, fallback: "backend"  },
  { id: "cyber",     name: "Cybersecurity Analyst",  icon: "shield",      domain: "Infra",       authored: false, fallback: "backend"  },
  { id: "mobile",    name: "Mobile Developer",       icon: "smartphone",  domain: "App",         authored: false, fallback: "frontend" },
  { id: "uiux",      name: "UI/UX Designer",         icon: "palette",     domain: "Design",      authored: false, fallback: "hr"       },
  { id: "cloud",     name: "Cloud / AWS Engineer",   icon: "cloud",       domain: "Infra",       authored: false, fallback: "backend"  },
  { id: "pm",        name: "Product Manager",        icon: "briefcase",   domain: "Product",     authored: false, fallback: "hr"       },
  { id: "hr",        name: "HR & Behavioral",        icon: "users",       domain: "Soft Skills", authored: true,  fallback: "hr"       }
];

// --- Level scaling rules (plan Part A table) ---
const LEVEL_RULES = {
  easy:     { label: "Easy",     tag: "Fresher / Entry Level", color: "green",
              behavioralCount: 2, behavioralTimer: 8 * 60,  systemDesignCount: 1, systemDesignTimer: 8 * 60,  pass: 50 },
  medium:   { label: "Medium",   tag: "Mid-Level / 1-3 Years", color: "amber",
              behavioralCount: 3, behavioralTimer: 12 * 60, systemDesignCount: 1, systemDesignTimer: 12 * 60, pass: 60 },
  advanced: { label: "Advanced", tag: "Senior / 3+ Years",     color: "red",
              behavioralCount: 4, behavioralTimer: 15 * 60, systemDesignCount: 2, systemDesignTimer: 20 * 60, pass: 70 }
};

// Short topic preview strings for the level-selection cards (per role).
const LEVEL_TOPICS = {
  frontend: { easy: "HTML tags, CSS selectors, JS basics, DOM", medium: "React hooks, closures, Flexbox/Grid, state", advanced: "SSR/CSR, Webpack, performance APIs, micro-frontends" },
  backend:  { easy: "HTTP methods, REST, JSON, status codes",   medium: "Middleware, JWT/OAuth, SQL joins, indexing",   advanced: "Microservices, queues, CQRS, rate limiting" },
  genai:    { easy: "Transformers, tokenization, prompt types", medium: "Attention, RAG, embeddings, vector DBs",       advanced: "LoRA/QLoRA, RLHF, agents, eval at scale" },
  hr:       { easy: "Etiquette, teamwork, self-intro",          medium: "Conflict resolution, STAR, leadership",       advanced: "Org culture, exec communication, negotiation" }
};

const QUESTION_BANK = {
  // ─────────────────────────────────────────────────────────────────────────
  // Every question array is intentionally EMPTY. The shape below is the
  // contract the UI reads; fill it in per role as you author content.
  //
  //   QUESTION_BANK[roleId][level][round]
  //     round ∈ { behavioral, systemDesign }
  //     level ∈ { easy, medium, advanced }
  //   Behavioral:   { text, hint, modelAnswer }
  //   SystemDesign: { text, hint, modelAnswer }   (same shape; both rounds are spoken)
  //
  // Counts must be ≥ the level's rule count in LEVEL_RULES:
  //   easy 2 behavioral / 1 systemDesign, medium 3/1, advanced 4/2.
  //
  // `frontend` below is kept as the one worked example of the shape.
  // ─────────────────────────────────────────────────────────────────────────
  frontend: {
    easy:     { behavioral: [], systemDesign: [] },
    medium:   { behavioral: [], systemDesign: [] },
    advanced: { behavioral: [], systemDesign: [] }
  },
  backend: {
    easy:     { behavioral: [], systemDesign: [] },
    medium:   { behavioral: [], systemDesign: [] },
    advanced: { behavioral: [], systemDesign: [] }
  },
  genai: {
    easy:     { behavioral: [], systemDesign: [] },
    medium:   { behavioral: [], systemDesign: [] },
    advanced: { behavioral: [], systemDesign: [] }
  },
  hr: {
    easy:     { behavioral: [], systemDesign: [] },
    medium:   { behavioral: [], systemDesign: [] },
    advanced: { behavioral: [], systemDesign: [] }
  }
};

/* ---------- Helpers ---------- */

function getRole(roleId) {
  return ROLES.find(r => r.id === roleId) || ROLES[0];
}

function getLevelRules(level) {
  return LEVEL_RULES[level] || LEVEL_RULES.easy;
}

// Returns the authored question array for a role/level/round, following the
// fallback chain when a role hasn't been authored yet. May return [] if even
// the fallback lacks that round (caller must handle empty).
function getRoundQuestions(roleId, level, round) {
  const role = getRole(roleId);
  const sourceId = QUESTION_BANK[roleId] ? roleId : role.fallback;
  const lvl = QUESTION_BANK[sourceId] && QUESTION_BANK[sourceId][level];
  const arr = lvl && lvl[round];
  return Array.isArray(arr) ? arr : [];
}

// Expose for both browser (script tag) and any Node-side test harness.
if (typeof window !== "undefined") {
  window.ROLES = ROLES;
  window.LEVEL_RULES = LEVEL_RULES;
  window.LEVEL_TOPICS = LEVEL_TOPICS;
  window.QUESTION_BANK = QUESTION_BANK;
  window.getRole = getRole;
  window.getLevelRules = getLevelRules;
  window.getRoundQuestions = getRoundQuestions;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { ROLES, LEVEL_RULES, LEVEL_TOPICS, QUESTION_BANK, getRole, getLevelRules, getRoundQuestions };
}
