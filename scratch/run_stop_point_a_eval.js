const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const LLM = require('../src/llm.js');

const fixtures = [
  // --- CONTRADICTING FIXTURES (10) ---
  {
    id: "C1",
    type: "contradicting",
    prior: ["I worked as a lead engineer at Google for 4 years."],
    speechText: "I have never worked at Google, I was only at Microsoft."
  },
  {
    id: "C2",
    type: "contradicting",
    prior: ["Our backend service was written entirely in Python."],
    speechText: "We never used Python for the backend; everything was built in Java."
  },
  {
    id: "C3",
    type: "contradicting",
    prior: ["We used PostgreSQL as our primary database for transactional consistency."],
    speechText: "Our main database was MongoDB and we didn't use any relational databases like Postgres."
  },
  {
    id: "C4",
    type: "contradicting",
    prior: ["I managed a team of 15 software developers and 3 product managers."],
    speechText: "I was an individual contributor working alone with no team members."
  },
  {
    id: "C5",
    type: "contradicting",
    prior: ["We deployed our microservices using Kubernetes on AWS."],
    speechText: "We only used a single bare metal Linux server on premise without any container orchestration or AWS."
  },
  {
    id: "C6",
    type: "contradicting",
    prior: ["I have 5 years of experience with React and modern frontend development."],
    speechText: "I am strictly a backend developer and I have zero experience with React or frontend frameworks."
  },
  {
    id: "C7",
    type: "contradicting",
    prior: ["Our API handled over 100,000 requests per minute during peak traffic."],
    speechText: "Our application was very low volume, handling at most 10 requests per day."
  },
  {
    id: "C8",
    type: "contradicting",
    prior: ["We used Redis as a caching layer to reduce database load."],
    speechText: "We never implemented any caching layer or Redis in our architecture."
  },
  {
    id: "C9",
    type: "contradicting",
    prior: ["I led the redesign of the user authentication system using OAuth 2.0."],
    speechText: "I didn't work on authentication at all, someone else built that module."
  },
  {
    id: "C10",
    type: "contradicting",
    prior: ["We maintained 99.99% uptime throughout the entire year."],
    speechText: "Our server crashed daily and had severe downtime every single week."
  },

  // --- NON-CONTRADICTING FIXTURES (10) ---
  {
    id: "N1",
    type: "non_contradicting",
    prior: ["I worked as a lead engineer at Google for 4 years."],
    speechText: "During my time at Google, I focused heavily on system architecture."
  },
  {
    id: "N2",
    type: "non_contradicting",
    prior: ["Our backend service was written entirely in Python."],
    speechText: "Using Python allowed us to iterate quickly on new features."
  },
  {
    id: "N3",
    type: "non_contradicting",
    prior: ["We used PostgreSQL as our primary database for transactional consistency."],
    speechText: "PostgreSQL handled our ACID transactions reliably at scale."
  },
  {
    id: "N4",
    type: "non_contradicting",
    prior: ["I managed a team of 15 software developers and 3 product managers."],
    speechText: "Leading those 15 engineers required regular 1-on-1s and sprint planning."
  },
  {
    id: "N5",
    type: "non_contradicting",
    prior: ["We deployed our microservices using Kubernetes on AWS."],
    speechText: "Kubernetes on AWS made auto scaling during traffic spikes seamless."
  },
  {
    id: "N6",
    type: "non_contradicting",
    prior: ["I have 5 years of experience with React and modern frontend development."],
    speechText: "Over those 5 years with React, I mastered hooks and state management."
  },
  {
    id: "N7",
    type: "non_contradicting",
    prior: ["Our API handled over 100,000 requests per minute during peak traffic."],
    speechText: "Handling 100k requests per minute required heavy load testing."
  },
  {
    id: "N8",
    type: "non_contradicting",
    prior: ["We used Redis as a caching layer to reduce database load."],
    speechText: "Redis cached popular database queries and kept latency under 5ms."
  },
  {
    id: "N9",
    type: "non_contradicting",
    prior: ["I led the redesign of the user authentication system using OAuth 2.0."],
    speechText: "Implementing OAuth 2.0 significantly improved our security posture."
  },
  {
    id: "N10",
    type: "non_contradicting",
    prior: ["We maintained 99.99% uptime throughout the entire year."],
    speechText: "Achieving four nines of availability was a major accomplishment for our SRE team."
  }
];

function generateAudioB64(text, id) {
  const rawWav = path.join(__dirname, `temp_${id}.wav`);
  const wav16k = path.join(__dirname, `temp_${id}_16k.wav`);
  try {
    execSync(`flite -t "${text.replace(/"/g, '\\"')}" -o "${rawWav}"`);
    execSync(`ffmpeg -y -i "${rawWav}" -ar 16000 -ac 1 -c:a pcm_s16le "${wav16k}" 2>/dev/null`);
    const audioBuffer = fs.readFileSync(wav16k);
    return audioBuffer.toString('base64');
  } finally {
    if (fs.existsSync(rawWav)) fs.unlinkSync(rawWav);
    if (fs.existsSync(wav16k)) fs.unlinkSync(wav16k);
  }
}

async function runEval() {
  console.log("=================================================");
  console.log("STOP POINT A: Contradiction Detection Evaluation");
  console.log("=================================================\n");

  const results = [];

  for (let i = 0; i < fixtures.length; i++) {
    const fix = fixtures[i];
    console.log(`[${i+1}/${fixtures.length}] Processing ${fix.id} (${fix.type})...`);
    console.log(`  Prior: "${fix.prior.join(' ')}"`);
    console.log(`  Audio Speech: "${fix.speechText}"`);

    const audioB64 = generateAudioB64(fix.speechText, fix.id);
    const start = Date.now();
    const res = await LLM.checkContradiction({
      priorAnswers: fix.prior,
      currentAnswerAudioB64: audioB64,
      currentTranscript: fix.speechText
    });
    const elapsed = Date.now() - start;

    console.log(`  Result: contradicts=${res.contradicts}, confidence=${res.confidence} (${elapsed}ms)`);
    if (res.contradicts) {
      console.log(`    Prior Claim: "${res.priorClaim}"`);
      console.log(`    Current Claim: "${res.currentClaim}"`);
    }

    results.push({
      ...fix,
      result: res,
      elapsedMs: elapsed
    });
    console.log("");
  }

  // Summary Metrics
  const contradictingCount = results.filter(r => r.type === "contradicting").length;
  const nonContradictingCount = results.filter(r => r.type === "non_contradicting").length;

  const truePositives = results.filter(r => r.type === "contradicting" && r.result.contradicts).length;
  const falseNegatives = results.filter(r => r.type === "contradicting" && !r.result.contradicts).length;

  const falsePositives = results.filter(r => r.type === "non_contradicting" && r.result.contradicts).length;
  const trueNegatives = results.filter(r => r.type === "non_contradicting" && !r.result.contradicts).length;

  const detectionRate = (truePositives / contradictingCount) * 100;
  const falsePositiveRate = (falsePositives / nonContradictingCount) * 100;

  console.log("=================================================");
  console.log("EVALUATION SUMMARY REPORT");
  console.log("=================================================");
  console.log(`Total Fixtures: ${results.length}`);
  console.log(`Audio Source: Offline Flite TTS + ffmpeg 16kHz WAV (Synthetic)`);
  console.log(`Contradicting Fixtures: ${contradictingCount}`);
  console.log(`Non-Contradicting Fixtures: ${nonContradictingCount}\n`);

  console.log(`True Positives (Correctly Flagged): ${truePositives}/${contradictingCount}`);
  console.log(`False Negatives (Missed Contradictions): ${falseNegatives}/${contradictingCount}`);
  console.log(`Detection Rate: ${detectionRate.toFixed(1)}%\n`);

  console.log(`False Positives (False Accusations): ${falsePositives}/${nonContradictingCount}`);
  console.log(`True Negatives (Correctly Ignored): ${trueNegatives}/${nonContradictingCount}`);
  console.log(`False Positive Rate: ${falsePositiveRate.toFixed(1)}%\n`);

  // Write detail JSON log
  const reportPath = path.join(__dirname, 'stop_point_a_results.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    metrics: {
      total: results.length,
      detectionRatePct: detectionRate,
      falsePositiveRatePct: falsePositiveRate,
      truePositives,
      falseNegatives,
      falsePositives,
      trueNegatives
    },
    fixtures: results
  }, null, 2));

  console.log(`Detailed results saved to: ${reportPath}`);
}

runEval().catch(err => {
  console.error("Evaluation script failed:", err);
});
