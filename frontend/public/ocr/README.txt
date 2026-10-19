Self-hosted OCR assets for the AI chat (no external requests at runtime):
- worker.min.js              from npm package tesseract.js (Apache-2.0)
- tesseract-core-lstm.wasm.js from npm package tesseract.js-core (Apache-2.0)
- eng.traineddata.gz          from npm package @tesseract.js-data/eng, 4.0.0_best_int (Apache-2.0)
Refresh by copying the same files from node_modules after upgrading those packages.
