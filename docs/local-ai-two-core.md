# Local CPU-Only AI Assistant (2 logical CPUs)

Date: 16/10/2026. Based on `REUSABLE_LOCAL_AI_SETUP_AGENT_PROMPT.md` (ServiceWise pattern), adapted to TaskFlow.

**Status: code and deployment files are written; the stack was NOT deployed and NOT run.** This machine has no Docker and the server work was out of scope of the allowed access (only the TaskFlow project in Coolify and its Supabase DB). Everything under "Verified" below is limited to syntax checks.

## What exists in TaskFlow (audit)
- The assistant already lives in the Edge Function (`runAiAssistant` in `supabase/functions/api/index.ts`, `POST /ai/query` and WhatsApp). The model only returns a small JSON op; all execution and permission checks stay in the existing handlers via `aiDispatch` as the same user. That trusted gateway is kept unchanged.
- Before this change the model call went to OpenRouter (free models), which caused "The AI is busy".

## What was added
```
services/taskflow-ai/
  docker-compose.yml     llm (llama.cpp server, Qwen3-0.6B GGUF) + planner (FastAPI)
  planner/app.py         /healthz /readyz /v1/route /v1/chat
  planner/tools.py       reviewed intent registry (smalltalk, list_tasks, list_meetings, workload, create_task, update_task)
  scripts/fetch-models.sh  model download + sha256 lock check
  .env.example           placeholders only
```
- **Embeddings:** `intfloat/multilingual-e5-small`, ONNX Runtime CPU, 1 thread, mean pooling, normalised; intent centroids built from the example phrases in `tools.py` (English plus Hindi/Gujarati in Roman script).
- **LLM:** `Qwen/Qwen3-0.6B` GGUF (Q8_0) through llama.cpp `llama-server`, thinking disabled, single generation slot, 4096 context, max 400 output tokens.
- **Gateway change:** when `LOCAL_AI_URL` is set the Edge Function (1) calls `/v1/route` and answers greetings/thanks itself without the model, (2) the model order is OpenRouter (configured model) first, then the local model, then the other free OpenRouter models. If `LOCAL_AI_URL` is unset nothing changes.
- The planner has no database access and no SQL. The model never executes anything.

## CPU budget: 2 logical CPUs total
- One shared `AI_CPUSET` (exactly two logical CPU ids) is applied to **both** containers. Quotas add up to 2.0 (`llm` 1.6 + `planner` 0.4).
- Thread caps: llama.cpp `--threads 2 --threads-batch 2 --parallel 1`; ONNX intra/inter-op 1 thread; `OMP_NUM_THREADS` 2 (llm) / 1 (planner).
- Pick the CPU ids on the real host with `lscpu -e=CPU,CORE,SOCKET,NODE,ONLINE` (ideally the two hyperthreads of one core, or two free cores). Do not reuse CPUs used by other workloads. Do not assume any id exists.
- Hardening: RAM limits (1 GB / 768 MB), pids limits, read-only root, tmpfs `/tmp`, `cap_drop: ALL`, `no-new-privileges`, non-root planner user, models mounted read-only, no published ports; the LLM sits on an internal-only network.

## Setup (Linux host, requires Docker)
```bash
cd services/taskflow-ai
cp .env.example .env            # set AI_CPUSET (2 ids), LLAMA_IMAGE (pin a digest), LLAMA_API_KEY, PLANNER_TOKEN
docker network create taskflow_ai
bash scripts/fetch-models.sh    # first time: review files, then RECORD=1 bash scripts/fetch-models.sh
docker compose up -d --build
```
Attach the Supabase edge-functions container to the `taskflow_ai` network, then set on that container:
`LOCAL_AI_URL=http://planner:8090` and `LOCAL_AI_TOKEN=<PLANNER_TOKEN>`. Remove those two variables to roll back to OpenRouter.

## Checks to run after deployment (NOT yet run)
- `docker compose ps`, `docker stats --no-stream` (CPU must stay at or below 200 %).
- From inside the network: `GET /healthz`, `GET /readyz`, `POST /v1/route {"text":"hello"}` must return `smalltalk`.
- In each container `grep Cpus_allowed_list /proc/self/status` must show exactly the two chosen ids.
- In the app: ask "hello", "what tasks are pending", "create a task to call Ravi tomorrow"; stop the `llm` container and confirm the assistant falls back safely.

## Known limits and risks
- Qwen3-0.6B is small; the existing prompt (org data plus many operations) is long, so expect slow replies on 2 CPUs and weaker accuracy than the free OpenRouter models. Benchmark p50/p95 and task success before relying on it, and consider shrinking the data context.
- No benchmarks, accuracy numbers or latency figures exist yet. Model revisions and checksums are not pinned until `fetch-models.sh` is run with `RECORD=1`.
- `LLAMA_IMAGE` has no default on purpose: pin an image digest you have reviewed.
- Scope deliberately skipped: OCR, RAG, SQL generation, persistent Redis context, confirmation tokens (the existing ops run immediately as before).
- Model licences: Qwen3-0.6B is Apache-2.0; multilingual-e5-small is MIT (confirm on the model cards when pinning).
