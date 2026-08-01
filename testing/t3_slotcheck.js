#!/usr/bin/env node
// T3 slot check validation — tests checkSlots() standalone against 5 labelled partial transcripts.
// Run: node testing/t3_slotcheck.js
//
// Tests 5 partial transcripts of varying quality:
//   - 2 behavioral (STAR), 3 technical (DMTE)
//   - Each has a known set of addressed/missing slots and a named key slot.
//
// Logs per-case accuracy and latency.

(async () => {
  const fs = require("fs");
  process.env.LLAMA_SERVER_URL = "http://127.0.0.1:8080";
  const LLM = require("../src/llm.js");
  const checkSlotsMock = LLM.checkSlots;

  const CASES = [
    // --- Behavioral (STAR) ---
    {
      label: "B1: Strong STAR, all slots covered",
      question: "Tell me about a time you had to resolve a conflict within your team.",
      requiredSlots: ["Situation", "Task", "Action", "Result"],
      keySlot: "Result",
      partialTranscript:
        "At my last company, two senior engineers disagreed on the database migration strategy. " +
        "One wanted a blue-green deployment, the other insisted on an in-place migration with feature flags. " +
        "My task was to break the deadlock since I was the tech lead. " +
        "I scheduled a 30-minute session where each presented their approach with a risk matrix. " +
        "I personally drafted a hybrid plan combining blue-green for the schema changes and feature flags for the application layer. " +
        "The result was we shipped the migration two weeks ahead of schedule with zero downtime incidents, " +
        "and the team adopted the risk-matrix format for future architectural decisions.",
      expectedAddressed: ["Situation", "Task", "Action", "Result"],
      expectedMissing: []
    },
    {
      label: "B2: Rambling, no Result — should trigger interruption",
      question: "Describe a situation where you had to learn a new technology quickly under pressure.",
      requiredSlots: ["Situation", "Task", "Action", "Result"],
      keySlot: "Result",
      partialTranscript:
        "So at my previous job we were using Java Spring Boot for everything, and then the company decided to " +
        "move to Kubernetes. I had never used Kubernetes before. My manager told me I needed to containerize " +
        "our main payment service within two weeks because the old VM infrastructure was being decommissioned. " +
        "I started reading the Kubernetes documentation, watched some YouTube videos, talked to a friend who " +
        "works at Google about how they do it. I tried setting up minikube on my laptop. The first few days " +
        "were really frustrating because the pods kept crashing. I think the issue was with the health checks. " +
        "Then I figured out the liveness probe configuration. I also had to learn about services and ingress. " +
        "The networking part was confusing, especially the difference between ClusterIP and NodePort. " +
        "I spent a lot of time on Stack Overflow reading about various configurations.",
      expectedAddressed: ["Situation", "Task", "Action"],
      expectedMissing: ["Result"]
    },

    // --- Technical (DMTE) ---
    {
      label: "T1: Solid technical, all slots",
      question: "Explain database indexing and when you would choose not to add an index.",
      requiredSlots: ["Definition", "Mechanism", "Tradeoff", "Experience"],
      keySlot: "Tradeoff",
      partialTranscript:
        "A database index is a data structure, usually a B-tree or B+ tree, that the database engine maintains " +
        "alongside the table data to speed up lookups. When you create an index on a column, the database " +
        "builds a sorted structure mapping column values to row pointers. For a SELECT with a WHERE clause " +
        "on an indexed column, the engine walks the tree in O(log n) instead of scanning every row. " +
        "The tradeoff is write amplification — every INSERT, UPDATE, or DELETE on the table also has to " +
        "update every index. On a high-write table like an event log doing 50k inserts per second, adding " +
        "a composite index dropped our write throughput by 30 percent. We ended up partitioning the table " +
        "by month and only indexing the current partition. That was at my last company working on the " +
        "audit logging pipeline.",
      expectedAddressed: ["Definition", "Mechanism", "Tradeoff", "Experience"],
      expectedMissing: []
    },
    {
      label: "T2: Definition only — key slot (Tradeoff) missing",
      question: "What is a message queue and how would you use one in a microservices architecture?",
      requiredSlots: ["Definition", "Mechanism", "Tradeoff", "Experience"],
      keySlot: "Tradeoff",
      partialTranscript:
        "A message queue is basically a system where you have producers sending messages and consumers " +
        "reading them. RabbitMQ and Kafka are examples. The producer pushes a message onto the queue " +
        "and the consumer pulls it off when it's ready. You can use it for async communication between " +
        "microservices. Like if you have an order service and a notification service, the order service " +
        "puts a message on the queue and the notification service picks it up and sends an email. " +
        "It decouples the services so they don't need to know about each other. You can also use it " +
        "for load leveling. If you have a burst of requests you can buffer them in the queue. " +
        "There are different patterns like pub-sub and point-to-point.",
      expectedAddressed: ["Definition", "Mechanism"],
      expectedMissing: ["Tradeoff", "Experience"]
    },
    {
      label: "T3: Has experience but no mechanism or tradeoff",
      question: "Explain how you would implement rate limiting for an API.",
      requiredSlots: ["Definition", "Mechanism", "Tradeoff", "Experience"],
      keySlot: "Tradeoff",
      partialTranscript:
        "Rate limiting is about controlling how many requests a client can make to your API within a " +
        "given time window. At my current company we use Kong API Gateway which has a rate limiting plugin. " +
        "We set it to 100 requests per minute per API key. When a client exceeds that they get a 429 status. " +
        "We also have different tiers — premium clients get 1000 requests per minute. The configuration " +
        "is in our Kong declarative config file. We had an incident where a partner's integration script " +
        "was hammering our endpoints and it was degrading service for everyone else. After we added the " +
        "rate limiting it stabilized. The partner was understanding about it.",
      expectedAddressed: ["Definition", "Experience"],
      expectedMissing: ["Mechanism", "Tradeoff"]
    }
  ];

  console.log("=== checkSlots() Stop Point A: Standalone Test ===\n");

  let totalCorrectKey = 0;
  let totalCases = CASES.length;
  const latencies = [];

  for (const tc of CASES) {
    console.log(`\n--- ${tc.label} ---`);
    const start = performance.now();
    let result;
    try {
      result = await checkSlotsMock({
        question: tc.question,
        partialTranscript: tc.partialTranscript,
        keySlot: tc.keySlot
      });
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
      continue;
    }
    const elapsed = performance.now() - start;
    latencies.push(elapsed);

    console.log(`  Key slot "${tc.keySlot}" missing: ${result.missing}`);
    console.log(`  Latency:   ${elapsed.toFixed(0)}ms`);

    const keyExpectedMissing = tc.expectedMissing.includes(tc.keySlot);

    if (result.missing === keyExpectedMissing) {
      console.log(`  Key slot "${tc.keySlot}": ✓ correctly classified as ${result.missing ? "MISSING" : "ADDRESSED"}`);
      totalCorrectKey++;
    } else {
      console.warn(`  Key slot "${tc.keySlot}": ✗ WRONG — expected ${keyExpectedMissing ? "missing" : "addressed"}, got ${result.missing ? "missing" : "addressed"}`);
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Key slot accuracy: ${totalCorrectKey}/${totalCases}`);
  if (latencies.length) {
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const max = Math.max(...latencies);
    console.log(`Latency — avg: ${avg.toFixed(0)}ms, max: ${max.toFixed(0)}ms`);
  }
  console.log("=== End ===");
})();
