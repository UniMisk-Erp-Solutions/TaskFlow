// Signed storage URLs can come back with the server's internal address (e.g. http://supabase-kong:8000),
// which browsers cannot resolve. Point them at the public Supabase origin the app already uses.
export function toPublicStorageUrl(url) {
  try {
    const target = new URL(url);
    const pub = new URL(import.meta.env.VITE_SUPABASE_URL);
    const host = target.hostname;
    const internal = host === 'supabase-kong' || host === 'localhost' || host.startsWith('127.') || !host.includes('.');
    if (internal && target.host !== pub.host) {
      target.protocol = pub.protocol;
      target.host = pub.host;
      return target.toString();
    }
    return url;
  } catch {
    return url;
  }
}
