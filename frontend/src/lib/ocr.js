// In-browser OCR (Tesseract). The photo never leaves the device; the worker, WASM core and English
// language data are served from /ocr (see public/ocr/README.txt), so there are no external requests or keys.
let workerPromise = null;

async function getWorker(onProgress) {
  if (!workerPromise) {
    workerPromise = import('tesseract.js').then(({ createWorker }) =>
      createWorker('eng', 1, {
        workerPath: '/ocr/worker.min.js',
        corePath: '/ocr/tesseract-core-lstm.wasm.js',
        langPath: '/ocr',
        gzip: true,
        workerBlobURL: false,
        logger: (m) => { if (typeof onProgress === 'function' && m.status === 'recognizing text') onProgress(m.progress || 0); },
      }),
    ).catch((err) => { workerPromise = null; throw err; });
  }
  return workerPromise;
}

// Bigger, grayscale, contrast-stretched input reads noticeably better than a phone photo as-is.
async function prepareCanvas(file, maxSide = 2400) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode that image.'));
      el.src = url;
    });
    const scale = Math.min(maxSide / Math.max(img.width, img.height), 2);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const px = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = px.data;
    let lo = 255, hi = 0;
    for (let i = 0; i < d.length; i += 4) {
      const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
      d[i] = d[i + 1] = d[i + 2] = g;
      if (g < lo) lo = g;
      if (g > hi) hi = g;
    }
    const range = Math.max(1, hi - lo);
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / range));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(px, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Returns { text, confidence } (confidence 0-100). Throws if the engine cannot start or read the image. */
export async function ocrImageFile(file, onProgress) {
  const [worker, canvas] = await Promise.all([getWorker(onProgress), prepareCanvas(file)]);
  const { data } = await worker.recognize(canvas);
  return { text: String(data.text || ''), confidence: Number(data.confidence) || 0 };
}
