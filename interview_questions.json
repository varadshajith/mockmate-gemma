{
  "_meta": {
    "purpose": "Deep question bank for MockMate — Privacy-First Interviewer (Build with Gemma, ML Nashik)",
    "structure_note": "This mirrors the deep-6 format described in the team brief. Swap keys to match the exact role->level->round file if teammates already have one — ask in group chat before merging.",
    "shape_legend": {
      "STAR": "Situation, Task, Action, Result — behavioral questions",
      "Technical": "Definition, Mechanism, Tradeoff, Experience — technical questions"
    },
    "score_legend": {
      "9": "Specific actions, owned the decision, real numbers",
      "6": "Talks about what the team did, vague on their own part",
      "3": "Describes the situation/definition only, no action — correct but empty, not wrong"
    }
  },
  "domains": {

    "backend": [
      {
        "id": "backend_easy_1",
        "question": "What's the difference between SQL and NoSQL databases?",
        "shape": "Technical",
        "difficulty": "easy",
        "expected_answer_length_sec": "30-60",
        "reference_answers": {
          "score_9": "So SQL is your relational stuff — Postgres, MySQL — fixed schema, tables, joins, and it's strict about that schema which is great until you need to change it. NoSQL like Mongo just stores documents, no fixed shape, so it's faster to iterate early on. We started a project in Mongo because the data model kept changing in the first few weeks, then actually migrated to Postgres once things stabilized because we needed real joins and transactions.",
          "score_6": "SQL databases have tables and a fixed schema, NoSQL is more flexible, like JSON documents. We used MongoDB on a project for some of the data.",
          "score_3": "SQL is structured, NoSQL is not structured, like Mongo isn't structured."
        },
        "probes": {
          "definition_missing": "Before we go on — what actually makes a database relational?",
          "mechanism_missing": "How does a NoSQL store like Mongo actually organize the data internally?",
          "tradeoff_missing": "When would picking NoSQL over SQL bite you later?",
          "experience_missing": "Have you actually worked with one of these on a real project?"
        }
      },
      {
        "id": "backend_easy_2",
        "question": "What does an index do in a database, and why can't you just index everything?",
        "shape": "Technical",
        "difficulty": "easy",
        "expected_answer_length_sec": "30-60",
        "reference_answers": {
          "score_9": "An index is basically a sorted lookup structure, usually a B-tree, so instead of scanning every row the database jumps straight to what it needs. But every index you add slows down writes, because now every insert or update has to update the index too, plus it eats disk. We had a table where someone had indexed like six columns and inserts were crawling — we dropped three we weren't actually querying on and insert time dropped noticeably.",
          "score_6": "It makes reads faster because the database doesn't have to scan the whole table. But you shouldn't index every column because it slows down writes.",
          "score_3": "It makes queries faster."
        },
        "probes": {
          "definition_missing": "Okay, but what actually is an index under the hood?",
          "mechanism_missing": "How does the database use the index to speed things up?",
          "tradeoff_missing": "So what's the catch with adding more indexes?",
          "experience_missing": "Have you run into an indexing problem yourself?"
        }
      },
      {
        "id": "backend_moderate_1",
        "question": "How does a message queue like RabbitMQ or Kafka help decouple services?",
        "shape": "Technical",
        "difficulty": "moderate",
        "expected_answer_length_sec": "60-90",
        "reference_answers": {
          "score_9": "Basically instead of service A calling service B directly and waiting on it, A just drops a message on the queue and moves on, B picks it up whenever it's ready. So if B is slow or down for a bit, A doesn't fall over with it. We used RabbitMQ for sending emails after signup — email service went down for like ten minutes once and nobody noticed because messages just queued up and drained once it came back. The catch is you now have to think about message ordering and what happens if something processes twice.",
          "score_6": "It lets services talk to each other without being directly connected, so if one service is down the other keeps working. We used it in a project for background jobs.",
          "score_3": "It's used to send messages between services asynchronously."
        },
        "probes": {
          "definition_missing": "What is a message queue actually doing, in your own words?",
          "mechanism_missing": "Walk me through what happens step by step when a message gets published.",
          "tradeoff_missing": "What gets harder once you introduce a queue into your system?",
          "experience_missing": "Did you set one of these up yourself, or use one on a real project?"
        }
      },
      {
        "id": "backend_moderate_2",
        "question": "Tell me about a time a production issue happened on your watch. What did you do?",
        "shape": "STAR",
        "difficulty": "moderate",
        "expected_answer_length_sec": "60-120",
        "reference_answers": {
          "score_9": "So this was during finals week, our API started throwing 500s around 2am — I was the only one online. Turned out a cron job we'd added was locking a table that the main app also needed. I killed the cron job manually, users were unblocked in about eight minutes, then the next day I rewrote it to run in batches instead of one giant transaction so it wouldn't hold the lock as long. Also added an alert so we'd know before users complained next time.",
          "score_6": "Yeah, we had an outage once, the database was locking up. The team looked into it and we fixed the query that was causing it.",
          "score_3": "We had a production issue once and it got resolved eventually."
        },
        "probes": {
          "situation_missing": "What was actually going on when this happened — set the scene for me.",
          "task_missing": "What were you specifically responsible for handling here?",
          "action_missing": "What did you personally do, step by step?",
          "result_missing": "How did you know it was actually fixed — what changed afterward?"
        }
      },
      {
        "id": "backend_hard_1",
        "question": "When would you not use Redis?",
        "shape": "Technical",
        "difficulty": "hard",
        "expected_answer_length_sec": "60-120",
        "reference_answers": {
          "score_9": "So Redis is in-memory, which is the whole point but also the catch. If your dataset's bigger than RAM you're either sharding or you're evicting stuff you actually needed. We hit that on a session store — worked great until we grew, then we were paying for a lot of memory. Also it's not durable by default, so anything you can't afford to lose shouldn't live only in Redis. And honestly if your reads aren't hot, a Postgres index is fine and it's one less thing to run.",
          "score_6": "Redis is an in-memory key-value store, so it's really fast for caching. You wouldn't use it for stuff you need to keep permanently because it's not really a database. It's more for temporary data like sessions or caching.",
          "score_3": "Redis is a caching thing. It makes stuff faster. I think we used it in a project once for caching."
        },
        "probes": {
          "definition_missing": "Before we go on — how would you describe what Redis actually is?",
          "mechanism_missing": "How does it get that speed?",
          "tradeoff_missing": "When would you avoid it?",
          "experience_missing": "Have you used it on something real?"
        }
      },
      {
        "id": "backend_hard_2",
        "question": "How would you design rate limiting for a public API?",
        "shape": "Technical",
        "difficulty": "hard",
        "expected_answer_length_sec": "90-150",
        "reference_answers": {
          "score_9": "I'd go with a token bucket, per API key, sitting in Redis so it works across multiple server instances instead of just one process's memory. Each key gets a bucket that refills at a fixed rate, request comes in, you try to take a token, no token means 429 with a Retry-After header. We built something like this for a project where one client was hammering us with retries and taking down the service for everyone else — after we added per-key limits their bad behavior only throttled them, not the whole system. Tradeoff is you add a Redis round trip to every request, so you want that check to be fast and fail open if Redis itself is down, otherwise your rate limiter becomes the outage.",
          "score_6": "You'd track how many requests each user makes and block them if they go over a limit in a time window. We'd probably use something like Redis to keep count.",
          "score_3": "You limit how many requests someone can make so they don't overload the server."
        },
        "probes": {
          "definition_missing": "What does rate limiting actually mean here — what's it protecting against?",
          "mechanism_missing": "Walk me through how you'd track and enforce the limit technically.",
          "tradeoff_missing": "What could go wrong with the approach you just described?",
          "experience_missing": "Have you built or dealt with rate limiting on an actual system?"
        }
      }
    ],

    "frontend": [
      {
        "id": "frontend_easy_1",
        "question": "What's the difference between let, const, and var in JavaScript?",
        "shape": "Technical",
        "difficulty": "easy",
        "expected_answer_length_sec": "30-60",
        "reference_answers": {
          "score_9": "var is function-scoped and gets hoisted in a weird way where it's technically accessible before it's declared, just undefined. let and const are block-scoped, so they only exist inside the {} they're declared in, and they throw an error if you touch them before declaration. const just means you can't reassign the variable — doesn't mean the value's frozen, an array or object can still be mutated. I basically never use var anymore, we had a bug once where a var leaked out of a for loop and caused an off-by-one issue we didn't catch for a while.",
          "score_6": "var is older and function-scoped, let and const are block-scoped and newer. const can't be reassigned.",
          "score_3": "let and const are newer ways to declare variables instead of var."
        },
        "probes": {
          "definition_missing": "What does scoping actually mean in this context?",
          "mechanism_missing": "How does hoisting work with var versus let?",
          "tradeoff_missing": "Is there ever a reason you'd still reach for var?",
          "experience_missing": "Has scoping ever actually bitten you in real code?"
        }
      },
      {
        "id": "frontend_easy_2",
        "question": "What is the virtual DOM and why does React use it?",
        "shape": "Technical",
        "difficulty": "easy",
        "expected_answer_length_sec": "30-60",
        "reference_answers": {
          "score_9": "It's basically a lightweight JS copy of the actual DOM tree. When state changes, React builds a new virtual DOM, diffs it against the old one, and only pushes the actual minimal changes to the real DOM, because touching the real DOM is expensive. We had a list component re-rendering on every keystroke in a search box, and it was noticeably laggy — turned out we weren't using keys properly so React was diffing wrong and re-rendering the whole list instead of just the changed row.",
          "score_6": "It's a copy of the DOM that React keeps in memory, and it updates that instead of the real DOM directly because that's faster.",
          "score_3": "It's a virtual version of the DOM that React uses."
        },
        "probes": {
          "definition_missing": "What exactly is the virtual DOM, in your own words?",
          "mechanism_missing": "How does React decide what actually needs to change on screen?",
          "tradeoff_missing": "Is the virtual DOM always faster than just updating the real DOM directly?",
          "experience_missing": "Have you run into a rendering performance issue yourself?"
        }
      },
      {
        "id": "frontend_moderate_1",
        "question": "How would you optimize a web page that's loading slowly?",
        "shape": "Technical",
        "difficulty": "moderate",
        "expected_answer_length_sec": "60-90",
        "reference_answers": {
          "score_9": "First I'd actually check what's slow — Lighthouse or the network tab, not guess. Usually it's either a huge JS bundle, unoptimized images, or too many render-blocking requests. We had a landing page loading in like six seconds, turned out it was pulling in a full charting library for one small graph. Swapped it for a lighter library, lazy-loaded it so it only downloads when that section scrolls into view, and compressed the hero image — got it down to under two seconds.",
          "score_6": "You'd want to reduce the JS bundle size and optimize images, and maybe lazy load things that aren't needed right away.",
          "score_3": "You'd make the images smaller and the code smaller."
        },
        "probes": {
          "definition_missing": "What does 'slow loading' actually mean here — what's the user seeing?",
          "mechanism_missing": "How would you go about figuring out what's actually causing the slowness?",
          "tradeoff_missing": "Is there a downside to lazy loading everything?",
          "experience_missing": "Have you actually optimized a slow page before?"
        }
      },
      {
        "id": "frontend_moderate_2",
        "question": "Tell me about a time you had to fix a bug that was hard to reproduce.",
        "shape": "STAR",
        "difficulty": "moderate",
        "expected_answer_length_sec": "60-120",
        "reference_answers": {
          "score_9": "So we had a bug report saying the checkout button sometimes just didn't work, but I couldn't reproduce it on my machine at all. Turned out it only happened on Safari, and only when a browser extension the user had was blocking a specific script. I added Sentry logging around that click handler so we'd actually capture the error client-side instead of guessing, and within a day had enough reports to confirm it was Safari plus an ad blocker stripping our analytics script, which was throwing before the actual handler ran. Wrapped the handler in a try-catch so it wouldn't get blocked by that.",
          "score_6": "There was a bug that only some users hit, we couldn't reproduce it at first. Eventually the team figured out it was browser-specific and fixed it.",
          "score_3": "Yeah we had a bug like that once, it took a while but it got fixed."
        },
        "probes": {
          "situation_missing": "What was the bug actually doing — how did you first hear about it?",
          "task_missing": "What was your part in tracking this down?",
          "action_missing": "Walk me through what you actually did to narrow it down.",
          "result_missing": "How did you confirm it was actually fixed?"
        }
      },
      {
        "id": "frontend_hard_1",
        "question": "When would you not use a single-page application (SPA) architecture?",
        "shape": "Technical",
        "difficulty": "hard",
        "expected_answer_length_sec": "60-120",
        "reference_answers": {
          "score_9": "SPAs are great for app-like interactions but they're bad for SEO and first-load performance because the browser has to download and run a bunch of JS before anything's on screen. If it's a content site — blog, marketing pages, news — I'd go with server-rendered or static, like Next.js in SSG mode. We rebuilt a marketing site that was a client-rendered React SPA and Google basically wasn't indexing half the pages properly. Moved it to static generation, load time dropped from like 3 seconds to under 500ms and organic traffic actually went up over the next month.",
          "score_6": "SPAs aren't great for SEO because search engines have trouble with content that's rendered by JavaScript. You'd want server-side rendering for content-heavy sites instead.",
          "score_3": "SPAs are bad for SEO."
        },
        "probes": {
          "definition_missing": "What actually makes something a single-page application versus a regular site?",
          "mechanism_missing": "Why exactly does that hurt SEO or load time?",
          "tradeoff_missing": "What would you use instead, and what do you give up by switching?",
          "experience_missing": "Have you actually worked on a site where this mattered?"
        }
      },
      {
        "id": "frontend_hard_2",
        "question": "How do you handle state management in a large React app, and what are the tradeoffs of your choice?",
        "shape": "Technical",
        "difficulty": "hard",
        "expected_answer_length_sec": "90-150",
        "reference_answers": {
          "score_9": "I try not to reach for a global store immediately — most state is local to a component or can live in the URL. For actual shared app state we used Zustand on one project instead of Redux because it needed way less boilerplate, no providers wrapping everything, just a hook. For server data specifically we kept it out of the global store entirely and used React Query instead, since caching and refetching that stuff manually in Redux was getting messy and we had stale-data bugs because two components had their own copies of the same server data going out of sync. The tradeoff with Zustand is less structure than Redux, so on a bigger team it's easier for state shape to get inconsistent if nobody enforces a pattern.",
          "score_6": "We usually use something like Redux or Context for global state, and keep local state in components with useState. It gets messy sometimes when there's too much in the global store.",
          "score_3": "We use Redux for state management."
        },
        "probes": {
          "definition_missing": "What actually counts as 'global' state versus something that should just be local?",
          "mechanism_missing": "How does the tool you chose actually share that state across components?",
          "tradeoff_missing": "What's the downside of the approach you picked?",
          "experience_missing": "Have you actually managed state on a large app, not just a small project?"
        }
      }
    ],

    "genai": [
      {
        "id": "genai_easy_1",
        "question": "What is a prompt, and why does the same prompt sometimes give different outputs?",
        "shape": "Technical",
        "difficulty": "easy",
        "expected_answer_length_sec": "30-60",
        "reference_answers": {
          "score_9": "A prompt's just the input text you give the model to steer what it generates. It varies run to run because these models sample from a probability distribution over the next token instead of always picking the single most likely one — there's a temperature setting controlling how random that sampling is. We had a demo break once because temperature was set too high and the model gave a wildly different answer during rehearsal than it did the day before, so we dropped it close to zero for anything that needed to be consistent.",
          "score_6": "A prompt is the text you send the model. It gives different answers sometimes because there's randomness in how it picks the next word.",
          "score_3": "A prompt is what you type into the AI."
        },
        "probes": {
          "definition_missing": "What exactly do you mean by prompt?",
          "mechanism_missing": "Why does randomness even come into it — what's actually happening under the hood?",
          "tradeoff_missing": "Is that randomness always a bad thing?",
          "experience_missing": "Have you actually noticed this inconsistency yourself while building something?"
        }
      },
      {
        "id": "genai_easy_2",
        "question": "What's the difference between fine-tuning and prompt engineering?",
        "shape": "Technical",
        "difficulty": "easy",
        "expected_answer_length_sec": "30-60",
        "reference_answers": {
          "score_9": "Prompt engineering is just changing your instructions and examples to get better output from the model as-is, no training involved. Fine-tuning is actually updating the model's weights on your own examples so the behavior is baked in. We started with prompt engineering for a classification task, few-shot examples in the prompt, and it worked fine until our input format got more specific — at that point fine-tuning a small model on maybe 500 labeled examples actually got us more consistent output than adding more and more examples to the prompt.",
          "score_6": "Prompt engineering means writing better prompts to get better results. Fine-tuning means training the model on your own data.",
          "score_3": "Fine-tuning is training the model and prompt engineering is writing good prompts."
        },
        "probes": {
          "definition_missing": "What actually happens during fine-tuning versus just prompting?",
          "mechanism_missing": "How does fine-tuning change the model's behavior?",
          "tradeoff_missing": "Why would you pick one over the other?",
          "experience_missing": "Have you actually tried either of these yourself?"
        }
      },
      {
        "id": "genai_moderate_1",
        "question": "What is RAG (Retrieval-Augmented Generation) and why would you use it over fine-tuning?",
        "shape": "Technical",
        "difficulty": "moderate",
        "expected_answer_length_sec": "60-90",
        "reference_answers": {
          "score_9": "RAG is when you retrieve relevant chunks of your own documents, usually with a vector search, and stuff them into the prompt so the model answers using that context instead of just what it memorized in training. We used it for a support bot over internal docs — fine-tuning would've meant retraining every time the docs changed, which was basically every week, so RAG let us just update the vector index instead and the bot's answers stayed current without touching the model at all.",
          "score_6": "RAG means you pull in relevant documents and give them to the model as context before it answers. It's useful when your data changes a lot because you don't have to retrain anything.",
          "score_3": "RAG is when the model looks things up before answering."
        },
        "probes": {
          "definition_missing": "What actually gets retrieved, and from where?",
          "mechanism_missing": "Walk me through what happens between the user's question and the model's answer.",
          "tradeoff_missing": "When would fine-tuning actually be the better call instead?",
          "experience_missing": "Have you built something with RAG yourself?"
        }
      },
      {
        "id": "genai_moderate_2",
        "question": "Tell me about a time an LLM-based feature you built didn't work as expected.",
        "shape": "STAR",
        "difficulty": "moderate",
        "expected_answer_length_sec": "60-120",
        "reference_answers": {
          "score_9": "We built a summarization feature and in testing it kept dropping the one specific number that actually mattered — like it'd summarize a support ticket but leave out the order number. I logged a bunch of failing examples, noticed the pattern was that numbers buried mid-paragraph got dropped more than ones at the start or end. Fixed it by explicitly instructing the model to preserve any IDs or numbers verbatim, and added a simple regex check afterward that flags if a number in the input doesn't appear anywhere in the summary. Dropped rate went from something like 1 in 10 to basically zero in our test set.",
          "score_6": "We built a feature using an LLM and it wasn't giving great results at first, some outputs were off. We tweaked the prompt and it got better.",
          "score_3": "Yeah we had an LLM feature that didn't work great at first, but we fixed it eventually."
        },
        "probes": {
          "situation_missing": "What was the feature supposed to do, and what tipped you off it was broken?",
          "task_missing": "What was your role in fixing it?",
          "action_missing": "What did you actually change, step by step?",
          "result_missing": "How do you know it actually got better — did you measure it?"
        }
      },
      {
        "id": "genai_hard_1",
        "question": "When would you not use an LLM for a task?",
        "shape": "Technical",
        "difficulty": "hard",
        "expected_answer_length_sec": "60-120",
        "reference_answers": {
          "score_9": "Anywhere you need deterministic, auditable output — like exact math, or anything with legal or financial consequences where you can't have it confidently make something up. LLMs are also just slower and more expensive than a lookup or a regex for stuff that's actually simple pattern matching. We were tempted to use an LLM to parse structured form fields once, and it worked most of the time, but 'most of the time' isn't good enough when it's feeding a database — a plain parser or regex was both faster and never silently wrong, so we used that instead and kept the LLM for the genuinely unstructured parts.",
          "score_6": "You wouldn't use an LLM for something that needs to be exact every time, like calculations, because it can make mistakes or hallucinate.",
          "score_3": "LLMs aren't good for math."
        },
        "probes": {
          "definition_missing": "What do you mean by hallucination or unreliable output here?",
          "mechanism_missing": "Why does an LLM actually fail at something like exact math or exact lookups?",
          "tradeoff_missing": "What would you use instead, and is it strictly better?",
          "experience_missing": "Have you actually hit this limitation on a real project?"
        }
      },
      {
        "id": "genai_hard_2",
        "question": "How do you evaluate whether an LLM's output is good, especially when there's no single correct answer?",
        "shape": "Technical",
        "difficulty": "hard",
        "expected_answer_length_sec": "90-150",
        "reference_answers": {
          "score_9": "For stuff with a clear right answer, you can just check exact match or use a rubric with a scoring function. But for open-ended output, what actually worked for us was using a second, stronger model as a judge — give it the rubric, the input, and the output, ask it to score against specific criteria instead of just 'is this good.' We did that for grading interview answers actually, gave the judge model example answers at a 9, a 6, and a 3, and it stayed way more consistent than just asking it to rate something out of 10 cold, which is exactly the problem you run into with small models — no anchor, everything gets a 7.",
          "score_6": "You could have another model check the output, or write some test cases and see if the answers make sense. It's harder than checking for one right answer.",
          "score_3": "You just read the output and see if it looks right."
        },
        "probes": {
          "definition_missing": "What does 'good' even mean for the task you're describing?",
          "mechanism_missing": "How exactly would you set up an evaluation for something with no single right answer?",
          "tradeoff_missing": "What's the risk of using another LLM to judge the first one?",
          "experience_missing": "Have you actually built an eval for something like this?"
        }
      }
    ],

    "hr": [
      {
        "id": "hr_easy_1",
        "question": "Tell me about yourself.",
        "shape": "STAR",
        "difficulty": "easy",
        "expected_answer_length_sec": "45-60",
        "reference_answers": {
          "score_9": "So I'm a final year CS student, mostly focused on backend and a bit of ML lately. Last year I interned at a small startup building their internal tooling — started off just fixing bugs, ended up owning a whole internal dashboard that the ops team still uses. Outside of that I've been part of a couple of hackathon teams, which is honestly where I learned to actually ship fast instead of over-engineering things. Right now I'm looking for something backend-heavy where I can keep growing into more of a full-stack role.",
          "score_6": "I'm a student studying computer science, I've done some internships and projects, mostly backend stuff. I'm looking for a role where I can learn more.",
          "score_3": "I'm a student and I like coding."
        },
        "probes": {
          "situation_missing": "What's your background, briefly — what have you been doing so far?",
          "task_missing": "What are you actually looking for right now?",
          "action_missing": "What have you specifically worked on or built?",
          "result_missing": "What came out of that — what did you actually accomplish or learn?"
        }
      },
      {
        "id": "hr_easy_2",
        "question": "Describe a time you worked in a team to complete a project.",
        "shape": "STAR",
        "difficulty": "easy",
        "expected_answer_length_sec": "60-90",
        "reference_answers": {
          "score_9": "For our final year project, four of us built a food delivery clone in about six weeks. I took backend and database design since that's my strength, we split frontend and ML recommendation between the other three. Around week four we were behind because the recommendation piece was taking longer than planned, so I actually jumped in and helped simplify the API contract so the frontend person could keep building against mock data instead of waiting. We shipped on time and it actually placed in our department's project showcase.",
          "score_6": "We worked on a group project together, split up the tasks, and finished it on time. It went pretty well overall.",
          "score_3": "Yeah we did a group project once, it was fine."
        },
        "probes": {
          "situation_missing": "What was the project, and what was the team working toward?",
          "task_missing": "What part was actually yours to own?",
          "action_missing": "What did you personally do when things got tight or someone was stuck?",
          "result_missing": "How did it turn out in the end?"
        }
      },
      {
        "id": "hr_moderate_1",
        "question": "Tell me about a time you disagreed with a teammate or manager. What did you do?",
        "shape": "STAR",
        "difficulty": "moderate",
        "expected_answer_length_sec": "60-120",
        "reference_answers": {
          "score_9": "On a team project a teammate wanted to build our own auth system from scratch to 'learn more,' but we had like ten days left and I was worried about security bugs and just running out of time. Instead of just shutting it down, I asked him to timebox it — spend a day prototyping it, and if it wasn't solid by end of day we'd switch to Firebase Auth. He agreed, it took longer than a day, we switched, and he actually ended up owning the Firebase integration and it went smoothly. We shipped with two days to spare.",
          "score_6": "We disagreed on an approach once, I explained my reasoning and we ended up going with a compromise. It worked out fine.",
          "score_3": "Yeah I've disagreed with someone before, we talked it through."
        },
        "probes": {
          "situation_missing": "What exactly were you disagreeing about?",
          "task_missing": "What was at stake, or what were you responsible for in that decision?",
          "action_missing": "What did you actually say or do to work through it?",
          "result_missing": "How did it actually get resolved, and how did that turn out?"
        }
      },
      {
        "id": "hr_moderate_2",
        "question": "Tell me about a time you failed at something. What did you learn?",
        "shape": "STAR",
        "difficulty": "moderate",
        "expected_answer_length_sec": "60-120",
        "reference_answers": {
          "score_9": "I once promised a working demo for a hackathon without actually testing the integration between two APIs beforehand — turned out they weren't compatible the way I assumed, and we found out twelve hours before the deadline. We ended up scrambling and shipping a much scaled-down version. What I actually changed after that is I always do a thin end-to-end test of the riskiest integration first, before building any of the polish around it, even if it's ugly. Used that exact approach on the next two projects and it saved us from a similar last-minute surprise once.",
          "score_6": "I once didn't plan well enough for a project and we were rushing at the end. I learned to plan better and start earlier.",
          "score_3": "Yeah I've failed at things, you learn from it."
        },
        "probes": {
          "situation_missing": "What was the situation — what were you trying to do?",
          "task_missing": "What was your responsibility in that?",
          "action_missing": "What actually went wrong, and what did you do about it at the time?",
          "result_missing": "What specifically changed in how you work afterward?"
        }
      },
      {
        "id": "hr_hard_1",
        "question": "Tell me about a time you had to lead a team through a tight deadline.",
        "shape": "STAR",
        "difficulty": "hard",
        "expected_answer_length_sec": "90-150",
        "reference_answers": {
          "score_9": "For a 24-hour hackathon, I ended up as the de facto lead of a five-person team because I'd scoped the idea. Around hour twelve we were behind — the ML piece wasn't converging and two people were blocked waiting on it. I made the call to cut the ML entirely and hardcode three realistic demo scenarios instead, reallocated the two blocked people to polish the UI and write the pitch, and kept a shared checklist visible so everyone knew exactly what was left. We submitted with twenty minutes to spare and actually won 'Best Demo' — mostly because the polish held up even though the actual ML was fake for the demo.",
          "score_6": "We had a tight deadline once and I helped organize the team, assigned tasks and checked in on progress. We finished on time.",
          "score_3": "Yeah I've led a team under a deadline before, it worked out."
        },
        "probes": {
          "situation_missing": "What was the deadline, and what made it tight?",
          "task_missing": "What was your role specifically — how did you end up leading?",
          "action_missing": "What decisions did you actually make when things were falling behind?",
          "result_missing": "How did it turn out, concretely?"
        }
      },
      {
        "id": "hr_hard_2",
        "question": "Tell me about a time you had to make a decision with incomplete information.",
        "shape": "STAR",
        "difficulty": "hard",
        "expected_answer_length_sec": "90-150",
        "reference_answers": {
          "score_9": "We had to pick a database for a project with basically no idea what our real query patterns would look like yet — requirements were still shifting. Instead of researching forever, I gave us a two-hour cap: picked Postgres because it's flexible enough to handle either relational or semi-structured data via JSONB columns, so if we guessed wrong on the shape we wouldn't have to migrate engines entirely, just restructure tables. That turned out right — we ended up needing both a relational piece and some flexible metadata, and JSONB covered the gap without a second database.",
          "score_6": "We had to make a call without knowing everything, so I looked at what we did know and went with the safest option. It worked out okay.",
          "score_3": "Yeah, sometimes you just have to decide without all the info."
        },
        "probes": {
          "situation_missing": "What was the decision, and what information was actually missing?",
          "task_missing": "Why did it fall to you to decide?",
          "action_missing": "How did you actually make the call — what did you weigh?",
          "result_missing": "Did it turn out to be the right call? How do you know?"
        }
      }
    ],

    "system_design": [
      {
        "id": "sysdesign_easy_1",
        "question": "What's the difference between vertical and horizontal scaling?",
        "shape": "Technical",
        "difficulty": "easy",
        "expected_answer_length_sec": "30-60",
        "reference_answers": {
          "score_9": "Vertical scaling is just throwing a bigger machine at the problem — more CPU, more RAM, same one server. Horizontal is adding more machines and spreading load across them. Vertical is simpler since your app doesn't need to change, but there's a hard ceiling and it's a single point of failure. We hit that limit on a small project's database — kept bumping the instance size until it was just expensive, eventually had to add a read replica instead, which is horizontal scaling for reads.",
          "score_6": "Vertical scaling means making one server bigger, horizontal means adding more servers. Horizontal is usually better for handling a lot of traffic.",
          "score_3": "Vertical is a bigger server, horizontal is more servers."
        },
        "probes": {
          "definition_missing": "Can you define what each of these actually means?",
          "mechanism_missing": "How does horizontal scaling actually spread the load?",
          "tradeoff_missing": "Why wouldn't you just always scale vertically since it's simpler?",
          "experience_missing": "Have you actually run into a scaling limit yourself?"
        }
      },
      {
        "id": "sysdesign_easy_2",
        "question": "What is a load balancer and why do you need one?",
        "shape": "Technical",
        "difficulty": "easy",
        "expected_answer_length_sec": "30-60",
        "reference_answers": {
          "score_9": "It's the thing sitting in front of your servers that spreads incoming requests across multiple instances instead of all traffic hitting one machine. Without it, one server gets overwhelmed while others sit idle, and if that one server dies your whole app is down. On a small project we put Nginx in front of two app instances mainly so we could deploy one at a time without downtime — traffic just shifted to the other instance while we updated the first.",
          "score_6": "It distributes traffic across multiple servers so one server doesn't get overloaded. It also helps if one server goes down.",
          "score_3": "It balances traffic between servers."
        },
        "probes": {
          "definition_missing": "What exactly does a load balancer do?",
          "mechanism_missing": "How does it decide which server gets which request?",
          "tradeoff_missing": "Does adding a load balancer introduce any new problems?",
          "experience_missing": "Have you actually set one up or used one on a project?"
        }
      },
      {
        "id": "sysdesign_moderate_1",
        "question": "How would you design a URL shortener?",
        "shape": "Technical",
        "difficulty": "moderate",
        "expected_answer_length_sec": "90-150",
        "reference_answers": {
          "score_9": "Core of it is a table mapping a short code to the long URL, plus a redirect endpoint that looks it up and does a 301 or 302. For generating the short code, I'd use base62 encoding of an auto-incrementing ID rather than random strings, so you avoid collision checks entirely. Reads massively outnumber writes here — everyone clicking a link versus someone creating one — so I'd cache hot URLs in Redis in front of the database, and expire entries that haven't been hit in a while. We actually built a scaled-down version of this in a class project and the thing that bit us was not indexing the short code column, lookups were doing a full table scan once we seeded a few hundred thousand fake rows.",
          "score_6": "You'd have a database that maps short codes to the long URL, and generate a random or incremented code for each new link. You'd probably want caching since lookups happen a lot.",
          "score_3": "You'd store the short URL and the long URL in a database."
        },
        "probes": {
          "definition_missing": "What are the core pieces this system actually needs?",
          "mechanism_missing": "How would you actually generate the short codes so they don't collide?",
          "tradeoff_missing": "What's the bottleneck here, and how would you address it?",
          "experience_missing": "Have you built anything with a similar read/write pattern?"
        }
      },
      {
        "id": "sysdesign_moderate_2",
        "question": "Tell me about a time you had to make a system faster under real constraints (time, budget, team size).",
        "shape": "STAR",
        "difficulty": "moderate",
        "expected_answer_length_sec": "60-120",
        "reference_answers": {
          "score_9": "Our project's search page was taking almost four seconds to load results, and we had like two days left before the demo, no budget for infra changes. I profiled it and found we were running an unindexed query for every single search plus fetching way more columns than the UI actually used. Added an index on the search column and trimmed the query to only the fields we displayed — took it down to under 400ms with maybe two hours of work total, no infra changes needed.",
          "score_6": "We had a slow feature and limited time to fix it, so the team looked into the query and made it faster by adding an index.",
          "score_3": "Yeah, we made something faster once under a deadline."
        },
        "probes": {
          "situation_missing": "What exactly was slow, and what constraint were you under?",
          "task_missing": "What was your specific piece of fixing this?",
          "action_missing": "What did you actually change?",
          "result_missing": "How much faster did it actually get — did you measure it?"
        }
      },
      {
        "id": "sysdesign_hard_1",
        "question": "When would you not use a microservices architecture?",
        "shape": "Technical",
        "difficulty": "hard",
        "expected_answer_length_sec": "60-120",
        "reference_answers": {
          "score_9": "If you're a small team, honestly almost always avoid it early on — microservices trade code complexity for operational complexity, now you've got network calls where you used to have function calls, distributed tracing, service discovery, more places for things to fail. We were tempted to split a hackathon project into microservices because it 'seemed more scalable,' but with three of us and 24 hours we'd have spent half the time on deployment plumbing instead of the actual product. Kept it as a monolith, split it into clean internal modules instead so we could pull pieces out later if we ever actually needed to.",
          "score_6": "You wouldn't use microservices for a small team or a small project, because the extra complexity of managing multiple services isn't worth it yet. A monolith is simpler to start with.",
          "score_3": "Microservices are complicated so small projects shouldn't use them."
        },
        "probes": {
          "definition_missing": "What actually makes an architecture 'microservices' versus a monolith?",
          "mechanism_missing": "What specifically gets harder once you split into services?",
          "tradeoff_missing": "So what would you use instead, and what do you lose by not going microservices?",
          "experience_missing": "Have you actually worked with either architecture on a real project?"
        }
      },
      {
        "id": "sysdesign_hard_2",
        "question": "How would you design a system to handle 1 million concurrent users for a chat application?",
        "shape": "Technical",
        "difficulty": "hard",
        "expected_answer_length_sec": "120-180",
        "reference_answers": {
          "score_9": "First thing is you can't hold a million open connections on one server, so you'd shard connections across many WebSocket servers behind a load balancer that supports sticky sessions or connection-aware routing. For actually delivering messages between users on different servers, you need a pub-sub layer in between — something like Redis pub-sub or Kafka — so when server A gets a message for a user connected to server B, it publishes to a channel server B is subscribed to. Message history itself I'd keep separate from the real-time path entirely, write it async to a database so a slow disk write never blocks message delivery. The actual bottleneck at that scale usually isn't the messages themselves, it's the sheer number of open connections and the fan-out when someone's in a group with thousands of people — for that I'd cap large group broadcasts or batch them instead of trying to push instantly to everyone.",
          "score_6": "You'd need multiple servers handling connections since one server can't handle that many, and use something to pass messages between servers. You'd also want to store messages in a database.",
          "score_3": "You'd need a lot of servers and a database to store messages."
        },
        "probes": {
          "definition_missing": "What does 'handling a million concurrent users' actually require technically?",
          "mechanism_missing": "How would messages actually get from one user to another across different servers?",
          "tradeoff_missing": "Where's the actual bottleneck going to be, and what's the cost of fixing it?",
          "experience_missing": "Have you built anything with real-time connections at any scale, even small?"
        }
      }
    ]
  }
}
