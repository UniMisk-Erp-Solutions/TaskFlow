/**
 * Centralized date / time formatters for TaskFlow.
 *
 * All user-visible dates render as DD/MM/YYYY (or DD/MM/YYYY HH:MM for
 * timestamps). Inputs accept either a yyyy-mm-dd string (Postgres DATE
 * column shape) or an ISO timestamp. Falsy inputs return an em-dash so
 * empty cells render gracefully.
 */

const DASH = '—';

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Parse a date input into a JS Date without timezone surprises.
 * "yyyy-mm-dd" — treated as a local date (avoids the off-by-one UTC shift
 * that `new Date("2026-05-16")` produces in -05:00 timezones).
 * Anything else — handed to the native Date constructor.
 */
function toDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v : null;
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isFinite(d.getTime()) ? d : null;
  }
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** DD/MM/YYYY — short calendar date. */
export function formatDate(v) {
  const d = toDate(v);
  if (!d) return DASH;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** DD/MM/YYYY HH:MM — full timestamp for history/timeline rows. */
export function formatDateTime(v) {
  const d = toDate(v);
  if (!d) return DASH;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 6:00 PM — accepts a Postgres `time` column ("HH:MM" or "HH:MM:SS"). */
export function formatTime12(v) {
  if (v == null || v === '') return '';
  const m = String(v).match(/^(\d{2}):(\d{2})/);
  if (!m) return String(v);
  const h = Number(m[1]);
  const mins = m[2];
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${mins} ${period}`;
}

/** "End of day" default we use when the user picks a date but no time. */
export const EOD_TIME = '18:00';
