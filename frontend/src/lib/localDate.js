// Calendar days as YYYY-MM-DD in the viewer's own time zone.
// Never use `date.toISOString().split('T')[0]` for this: it converts to UTC first, so in time zones ahead of UTC
// (India, UAE, Europe…) local midnight becomes the PREVIOUS day and dates shift by one.
export function localYmd(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
