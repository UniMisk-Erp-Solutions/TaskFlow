export function elapsedSecondsForSession(session, now = Date.now()) {
  const start = Date.parse(session.started_at || '');
  if (!Number.isFinite(start)) return 0;
  const end = session.ended_at ? Date.parse(session.ended_at) : now;
  return Math.max(0, Math.floor((end - start) / 1000));
}

export function formatElapsedSeconds(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}
