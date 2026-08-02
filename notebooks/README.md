# Kaggle demo notebook

`mockmate_gemma_demo.ipynb` lets a judge evaluate MockMate Gemma without a GPU, without a local
install, and without ever giving us their voice.

> **The notebook has no microphone input, and no upload widget.** It reads only the fixture WAVs
> shipped in the `mockmate-fixtures` dataset. Internet is off. Nothing in it uploads audio,
> transcripts, or scores anywhere. The microphone path (`sidecar/`) exists only in the local
> install and is never started here. If you are editing the notebook and find yourself reaching
> for `ipywidgets.FileUpload` or a mic capture cell — stop. That breaks the track rule.

---

## What is in this directory

| File | What it is |
|---|---|
| `mockmate_gemma_demo.ipynb` | The notebook. 28 cells: 11 code, 17 markdown. |
| `kaggle_bridge.js` | Node pass-through so the Python notebook can call the real `src/llm.js` and `src/memory.js`. Contains no prompt, no rubric, no grammar, no threshold, no similarity formula — see below. |
| `fixtures/MANIFEST.md` | The fixture WAV set: format requirements, naming convention, and what each clip is for. |

### Why there is a Node bridge

Two of this project's tests silently broke because they built their own copy of a prompt
instead of importing the real one, and spent two rounds of debugging reporting drift between
two hand-maintained copies as if it were a regression (README → *"Two of our tests were
measuring themselves"*). The baseline score being defended had never measured anything.

The notebook is bound by the same rule. Every grading call goes through `src/llm.js` →
`evaluate()`; the threshold function is sliced out of `src/llm.js` **as source text** at run
time and evaluated; the similarity threshold is read from `src/memory.js`. If you add a prompt
string to `kaggle_bridge.js`, you have reintroduced the exact bug it exists to prevent.

---

## Datasets to attach

Six inputs, five datasets. Attach them all via **+ Add Input** in the notebook sidebar before
running. Cell 3 checks for each one by filename and names anything missing.

| Slug | Contents | Approx size | Fatal if missing? |
|---|---|---|---|
| `mockmate-gemma-src` | `mockmate.zip` — the repo at the demo commit (`45304d2` or later). Must contain `AGENTS.md` at its root. | small | **Yes** |
| `mockmate-fixtures` | 16 kHz mono WAVs, each ≤ 30 s. See `fixtures/MANIFEST.md`. | small | No — cells 7–9 skip and say so |
| `llamacpp-src` | `llama.cpp` source at a pinned commit, as a directory or a zip/tarball. | ~50 MB | **Yes** |
| Gemma 4 E4B | `gemma-4-E4B-it-Q4_0.gguf` **and** `mmproj-gemma-4-E4B-it-Q8_0.gguf` | ~4.5 GB | No — cells 7–10 skip and say so |
| `bge-small-en-v1.5-q8_0` | `bge-small-en-v1.5-q8_0.gguf` | ~150 MB | No — cell 11 skips and says so |

**Check Kaggle Models for Gemma first.** If a GGUF build of Gemma 4 E4B (with the matching
mmproj) is published there, attach it from Models rather than re-uploading 4.5 GB. If it is
only available in Hugging Face / SafeTensors form, upload the two GGUFs as a private Dataset.
Cell 3 locates the weights by **filename** with a recursive glob under `/kaggle/input`, so it
does not care whether they arrive from Models or Datasets, or how deep the mount path is.

### Notebook settings

| Setting | Value | Why |
|---|---|---|
| Accelerator | **GPU T4 ×1** (or P100) | The CUDA build targets whatever `nvidia-smi` reports; T4 is compute 75. |
| Internet | **Off** | This is the whole point. Cell 13 attempts an outbound request and prints the failure. |
| Persistence | Files only (optional) | Saves re-running the 8–15 minute build. |

**Nothing is downloaded at run time.** `llama.cpp` is built with `-DLLAMA_CURL=OFF` precisely so
the binary cannot fetch a model even if asked to.

---

## Node

Cells 8, 9, 10 and 11 shell out to `node`. Cell 2 probes for it and prints the version, and
each of those cells prints `DID NOT RUN — node is not installed on this image` rather than
falling back to a Python re-implementation. There is no Python re-implementation, deliberately:
a second copy of the grading path is the bug described above.

If the Kaggle image you draw does not ship Node, attach a Node binary as a small extra dataset
and set `NODE_BIN` by hand in cell 2 before running the rest:

```python
NODE_BIN = "/kaggle/input/nodejs-linux-x64/node-v22-linux-x64/bin/node"
```

---

## Reproducing it

1. Create the five datasets above. For `mockmate-gemma-src`:
   ```bash
   git archive --format=zip -o mockmate.zip HEAD
   ```
   from the repo root, at the commit you want the demo pinned to.
2. New notebook → **+ Add Input** → attach all five → set Accelerator to GPU T4 ×1 → set
   Internet to Off.
3. Upload `mockmate_gemma_demo.ipynb` (File → Import Notebook).
4. Run all. Budget roughly:

   | Phase | Time |
   |---|---|
   | Build `llama.cpp` (CUDA) | 8–15 min |
   | Gemma server load | 1–3 min |
   | Embedding server load | < 30 s |
   | Demo cells 7–11 | 2–5 min |

5. Read the **run checklist** printed by the final cell before claiming anything from the run.
   It reports, per cell, `LIVE` / `SKIPPED` / `FAILED` and lists what must not be claimed.

---

## Fallback ladder

The notebook degrades rather than lying. Pick the honest rung.

| | Condition | What happens |
|---|---|---|
| **L1** | Everything attached, CUDA build succeeds | Target. All demo cells run live. |
| **L2** | CUDA build fails | Cell 4 catches it, rebuilds with `-DGGML_CUDA=OFF`, prints a loud warning, and sets `LATENCY_CAVEAT`. **Every** latency figure printed afterwards carries a `[CPU-ONLY BUILD — not comparable to GPU numbers]` label. Cells 7–11 still run. |
| **L3** | No model attached, or the servers do not come up | Cells 7, 8, 9 and 11 print `DID NOT RUN` with the reason, and print no numbers. Cells 10 and 12 still run live — the threshold logic is pure arithmetic and needs no GPU. |

### About replay

L3 originally allowed replaying captured request/response pairs from the RTX 4050 box in place
of the missing live cells. **No replay fixtures are committed, and the notebook has no replay
path**, because a replay that is not clearly labelled is a fabricated result and the labelling
is the easy part to get wrong under deadline. If you add one later:

- Every replayed cell must be **titled** `REPLAY — captured on RTX 4050 on <date>, not executed
  in this notebook`, in the cell's own output, not only in a markdown cell above it.
- The run checklist must report it as `REPLAY`, never `LIVE`.
- Never present a replay as a live run. That is AGENTS.md Rule 1.

Right now, an L3 run simply shows less. That is the correct behaviour.

---

## Editing the notebook

Cell numbering in the markdown headings is the *section* number (1–13), not the JSON cell
index. If you add or reorder cells, update:

- the `ORDER` list in the final code cell (the run checklist), and
- the `log(...)` key in whichever cell you touched.

Anything that prints a number must print a number produced in that run. If a cell cannot do
its job, it prints why and prints nothing else — see AGENTS.md, Rule 1.
