#!/usr/bin/env bash
# Downloads model weights into ./models (never committed) and verifies them against models.lock.
# First run with RECORD=1 after reviewing the files to write models.lock; later runs fail on mismatch.
# Replace the *_REV defaults with exact commit hashes before production use.
set -euo pipefail
cd "$(dirname "$0")/.."
LOCK=models.lock
mkdir -p models/llm models/e5
E5_REV="${E5_REV:-main}"     # PIN: commit hash from huggingface.co/intfloat/multilingual-e5-small
QWEN_REV="${QWEN_REV:-main}" # PIN: commit hash from huggingface.co/Qwen/Qwen3-0.6B-GGUF
dl() { [ -s "$2" ] || curl -fL --retry 3 -o "$2" "$1"; }
dl "https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/resolve/${QWEN_REV}/Qwen3-0.6B-Q8_0.gguf" models/llm/Qwen3-0.6B-Q8_0.gguf
dl "https://huggingface.co/intfloat/multilingual-e5-small/resolve/${E5_REV}/onnx/model.onnx" models/e5/model.onnx
dl "https://huggingface.co/intfloat/multilingual-e5-small/resolve/${E5_REV}/tokenizer.json" models/e5/tokenizer.json
if [ "${RECORD:-0}" = "1" ]; then
  sha256sum models/llm/*.gguf models/e5/model.onnx models/e5/tokenizer.json > "$LOCK"
  echo "wrote $LOCK"
  exit 0
fi
[ -f "$LOCK" ] || { echo "no $LOCK - review the files then rerun with RECORD=1"; exit 1; }
sha256sum -c "$LOCK"
