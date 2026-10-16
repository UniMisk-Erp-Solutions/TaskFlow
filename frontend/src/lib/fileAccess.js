import api from '../api';

const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|xml|yml|yaml|log|ini|conf|js|jsx|ts|tsx|css|sql|py|java|c|cpp|h|cs|go|rs|rb|php|sh|bat|env)$/i;
const MAX_TEXT_PREVIEW = 2 * 1024 * 1024; // 2 MB
const MAX_BLOB_PREVIEW = 150 * 1024 * 1024; // 150 MB

/** What the in-app viewer can show for a file; null means "download only". */
export function previewKind(contentType, name = '', size = 0) {
  const type = String(contentType || '').toLowerCase();
  const lower = String(name || '').toLowerCase();
  if (size && size > MAX_BLOB_PREVIEW) return null;
  if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg|ico|avif)$/.test(lower)) return 'image';
  if (type === 'application/pdf' || lower.endsWith('.pdf')) return 'pdf';
  if (type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogv)$/.test(lower)) return 'video';
  if (type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|aac|flac|opus)$/.test(lower)) return 'audio';
  if ((type.startsWith('text/') || type === 'application/json' || type === 'application/xml' || TEXT_EXT.test(lower))
    && (!size || size <= MAX_TEXT_PREVIEW)) return 'text';
  return null;
}

/** Axios errors for blob responses carry the JSON error inside a Blob; unwrap it for display. */
export async function fileErrorMessage(err, fallback = 'Could not load the file.') {
  try {
    const data = err?.response?.data;
    if (data instanceof Blob) {
      const text = await data.text();
      try { return JSON.parse(text).error || fallback; } catch { return text || fallback; }
    }
    return data?.error || err?.message || fallback;
  } catch {
    return fallback;
  }
}

/** Fetches a file through the API (authenticated, same origin as every other call). */
export async function fetchFileBlob(path, params, onProgress) {
  const res = await api.get(path, {
    params,
    responseType: 'blob',
    timeout: 0,
    onDownloadProgress: onProgress,
  });
  const header = res.headers?.['content-type'];
  const blob = res.data instanceof Blob && header && !res.data.type ? new Blob([res.data], { type: header }) : res.data;
  return blob;
}

/** Saves a blob to the user's device using a real download (never blocked like window.open). */
export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name || 'download';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadFromApi(path, name, params) {
  const blob = await fetchFileBlob(path, params);
  saveBlob(blob, name);
}
