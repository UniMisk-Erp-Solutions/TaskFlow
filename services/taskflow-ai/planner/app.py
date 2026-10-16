"""TaskFlow AI planner - private service that sits next to llama.cpp.

/healthz  liveness              /readyz  embedding model loaded and LLM reachable
/v1/route semantic intent       /v1/chat bounded, authenticated proxy to the local LLM
Embeddings: multilingual-e5-small (ONNX, CPU, 1 thread). No database access, no SQL, and no secrets
beyond the shared bearer tokens. All data access stays in the TaskFlow gateway (Edge Function).
"""
import asyncio
import os
import time

import httpx
import numpy as np
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from tools import TOOLS

TOKEN = os.environ["PLANNER_TOKEN"]
LLM_URL = os.environ.get("LLM_URL", "http://llm:8081")
LLM_KEY = os.environ.get("LLAMA_API_KEY", "")
EMB_DIR = os.environ.get("EMBEDDING_DIR", "/models/e5")
EMB_FILE = os.environ.get("EMBEDDING_FILE", "model.onnx")
MAX_QUEUE = int(os.environ.get("MAX_LLM_QUEUE", "4"))
QUEUE_WAIT = float(os.environ.get("LLM_QUEUE_WAIT_SECONDS", "4"))
LLM_TIMEOUT = float(os.environ.get("LLM_TIMEOUT_SECONDS", "40"))

app = FastAPI(title="taskflow-ai-planner")
_state = {"session": None, "tok": None, "centroids": None, "labels": None}
_slot = asyncio.Semaphore(1)  # one generation at a time on 2 CPUs
_waiting = 0
_fail_count, _open_until = 0, 0.0  # simple circuit breaker


def auth(authorization: str = Header(default="")):
    if authorization != f"Bearer {TOKEN}":
        raise HTTPException(401, "unauthorized")


def _embed(texts):
    tok, sess = _state["tok"], _state["session"]
    enc = tok.encode_batch([f"query: {t[:400]}" for t in texts])
    ids = np.array([e.ids for e in enc], dtype=np.int64)
    mask = np.array([e.attention_mask for e in enc], dtype=np.int64)
    feeds = {"input_ids": ids, "attention_mask": mask}
    if any(i.name == "token_type_ids" for i in sess.get_inputs()):
        feeds["token_type_ids"] = np.zeros_like(ids)
    hidden = sess.run(None, feeds)[0]
    m = mask[..., None].astype(np.float32)
    pooled = (hidden * m).sum(1) / np.clip(m.sum(1), 1e-9, None)
    return pooled / np.linalg.norm(pooled, axis=1, keepdims=True)


@app.on_event("startup")
def load():
    import onnxruntime as ort
    from tokenizers import Tokenizer

    opts = ort.SessionOptions()
    opts.intra_op_num_threads = int(os.environ.get("ONNX_INTRA_OP_THREADS", "1"))
    opts.inter_op_num_threads = int(os.environ.get("ONNX_INTER_OP_THREADS", "1"))
    _state["session"] = ort.InferenceSession(os.path.join(EMB_DIR, EMB_FILE), opts, providers=["CPUExecutionProvider"])
    tok = Tokenizer.from_file(os.path.join(EMB_DIR, "tokenizer.json"))
    tok.enable_padding()
    tok.enable_truncation(max_length=128)
    _state["tok"] = tok
    labels, vecs = [], []
    for name, spec in TOOLS.items():
        c = _embed(spec["examples"]).mean(0)
        labels.append(name)
        vecs.append(c / np.linalg.norm(c))
    _state["labels"], _state["centroids"] = labels, np.stack(vecs)


class RouteIn(BaseModel):
    text: str = Field(min_length=1, max_length=600)


@app.post("/v1/route", dependencies=[Depends(auth)])
def route(body: RouteIn):
    v = _embed([body.text])[0]
    sims = _state["centroids"] @ v
    order = np.argsort(-sims)
    top, second = int(order[0]), int(order[1])
    # Confidence: similarity of the best intent, penalised when the runner-up is close.
    conf = float(sims[top]) - max(0.0, 0.05 - float(sims[top] - sims[second]))
    intent = _state["labels"][top]
    # A long message is never treated as small talk.
    if intent == "smalltalk" and len(body.text.split()) > 5:
        conf = 0.0
    return {"intent": intent, "confidence": round(conf, 3), "risk": TOOLS[intent]["risk"]}


class ChatIn(BaseModel):
    system: str = Field(max_length=12000)
    user: str = Field(max_length=24000)
    max_tokens: int = Field(default=400, ge=1, le=700)


@app.post("/v1/chat", dependencies=[Depends(auth)])
async def chat(body: ChatIn):
    global _waiting, _fail_count, _open_until
    if time.time() < _open_until:
        raise HTTPException(503, "llm unavailable")
    if _waiting >= MAX_QUEUE:
        raise HTTPException(429, "busy")
    _waiting += 1
    try:
        try:
            await asyncio.wait_for(_slot.acquire(), QUEUE_WAIT + LLM_TIMEOUT)
        except asyncio.TimeoutError:
            raise HTTPException(429, "busy")
        try:
            async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as c:
                r = await c.post(
                    f"{LLM_URL}/v1/chat/completions",
                    headers={"Authorization": f"Bearer {LLM_KEY}"},
                    json={
                        "model": "qwen3-0.6b",
                        "messages": [
                            {"role": "system", "content": body.system + "\n/no_think"},
                            {"role": "user", "content": body.user},
                        ],
                        "max_tokens": body.max_tokens,
                        "temperature": 0,
                        "chat_template_kwargs": {"enable_thinking": False},
                    },
                )
            r.raise_for_status()
            _fail_count = 0
            return {"content": r.json()["choices"][0]["message"]["content"]}
        except HTTPException:
            raise
        except Exception:
            _fail_count += 1
            if _fail_count >= 3:
                _open_until = time.time() + 30
            raise HTTPException(503, "llm error")
        finally:
            _slot.release()
    finally:
        _waiting -= 1


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.get("/readyz")
async def readyz():
    if _state["session"] is None:
        raise HTTPException(503, "embeddings not loaded")
    try:
        async with httpx.AsyncClient(timeout=3) as c:
            (await c.get(f"{LLM_URL}/health")).raise_for_status()
    except Exception:
        raise HTTPException(503, "llm not ready")
    return {"ok": True}
