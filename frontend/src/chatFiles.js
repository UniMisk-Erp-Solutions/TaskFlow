import supabase from './supabaseClient';
import { saveBlob } from './lib/fileAccess';

// Signed links for chat attachments are cached (and shared between messages asking at the same time). A long chat otherwise
// requests one link per image on every open or refresh, which piles up behind the auth lock and slows everything down.
const chatUrlCache = new Map(); // path -> { promise, at }
const CHAT_URL_TTL_MS = 50 * 60 * 1000; // links are signed for an hour
export function chatFileUrl(path) {
  const hit = chatUrlCache.get(path);
  if (hit && Date.now() - hit.at < CHAT_URL_TTL_MS) return hit.promise;
  const promise = (async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const { data } = await supabase.storage.from('chat-files').createSignedUrl(path, 3600);
        if (data?.signedUrl) return data.signedUrl;
      } catch { /* try once more, then give up quietly */ }
      await new Promise((r) => { window.setTimeout(r, 400); });
    }
    chatUrlCache.delete(path); // do not remember a failure
    return null;
  })();
  chatUrlCache.set(path, { promise, at: Date.now() });
  return promise;
}

// The files are served from another address than the app, so the browser ignores <a download> and just opens them in a new tab.
// Fetching the file and saving the bytes makes the Download button really download.
export async function downloadChatFile(url, name, path) {
  // Best way: ask the storage server for a link that always arrives as a download (Content-Disposition: attachment). It works for
  // every file type (HTML, text, Office files...) and on every device, with no cross-site fetch needed.
  if (path) {
    try {
      const { data } = await supabase.storage.from('chat-files').createSignedUrl(path, 300, { download: name || true });
      if (data?.signedUrl) {
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
      }
    } catch { /* fall back to fetching the file below */ }
  }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('download failed');
    saveBlob(await res.blob(), name);
  } catch {
    window.open(url, '_blank', 'noopener'); // last resort: let the browser handle the link
  }
}
