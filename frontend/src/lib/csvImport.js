/**
 * Smart CSV parser + header normaliser for the admin "Import tasks/meetings"
 * feature. Designed to be forgiving:
 *   - any column-name spelling variant ("Due Date", "due_date", "deadline")
 *     gets mapped to the canonical field.
 *   - dates accept DD/MM/YYYY (default), YYYY-MM-DD, "20 May 2026", etc.
 *   - times accept "18:00", "6:00 PM", "6pm".
 *   - assignees accept comma-separated emails OR full names.
 *
 * No external library. Single-byte CSV with double-quote escaping is enough
 * for what users actually paste in.
 */

// ─── CSV parsing ────────────────────────────────────────────────────────

/** Parse CSV text into { header: string[], rows: string[][] }. */
export function parseCsv(text) {
  const out = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const s = String(text).replace(/^﻿/, '');
  while (i < s.length) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { row.push(field); field = ''; i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') {
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') out.push(row);
      row = []; i++; continue;
    }
    field += ch; i++;
  }
  if (field !== '' || row.length) { row.push(field); out.push(row); }
  if (!out.length) return { header: [], rows: [] };
  const header = out[0].map((h) => String(h || '').trim());
  const rows = out.slice(1).map((r) => {
    const obj = {};
    header.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim(); });
    return obj;
  });
  return { header, rows };
}

// ─── Header canonicalisation (matches what the backend expects) ─────────

function normKey(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const SYNONYMS = {
  title:        ['title', 'name', 'task', 'meeting', 'subject', 'summary'],
  description:  ['description', 'desc', 'details', 'notes', 'info', 'message', 'body'],
  priority:     ['priority', 'pri', 'importance', 'urgency'],
  status:       ['status', 'state'],
  due_date:     ['duedate', 'due', 'deadline', 'targetdate', 'date'],
  due_time:     ['duetime', 'time', 'hour'],
  meeting_date: ['meetingdate', 'scheduleddate', 'date', 'when'],
  meeting_time: ['meetingtime', 'time', 'hour', 'at'],
  assignees:    ['assignees', 'assignee', 'assignedto', 'owner', 'owners', 'members', 'people', 'who', 'emails', 'email'],
  project:      ['project', 'projectname'],
};

/**
 * Map a parsed-row object → canonical-field object.
 * Same logic as the backend's canonicalize(), so the preview matches.
 */
export function canonicalRow(row, kind) {
  const out = {};
  const want = kind === 'task'
    ? ['title', 'description', 'priority', 'status', 'due_date', 'due_time', 'assignees', 'project']
    : ['title', 'description', 'priority', 'status', 'meeting_date', 'meeting_time', 'assignees', 'project'];
  const keys = Object.keys(row);
  for (const field of want) {
    const synonyms = SYNONYMS[field] || [field];
    let v = '';
    for (const k of keys) {
      if (synonyms.includes(normKey(k))) {
        v = String(row[k] ?? '').trim();
        if (v) break;
      }
    }
    out[field] = v;
  }
  return out;
}

/** Best-effort header detection — useful for showing what the importer matched. */
export function detectMappedHeaders(headers, kind) {
  const want = kind === 'task'
    ? ['title', 'description', 'priority', 'status', 'due_date', 'due_time', 'assignees', 'project']
    : ['title', 'description', 'priority', 'status', 'meeting_date', 'meeting_time', 'assignees', 'project'];
  const mapped = {};
  for (const field of want) {
    const synonyms = SYNONYMS[field] || [field];
    const match = headers.find((h) => synonyms.includes(normKey(h)));
    mapped[field] = match || null;
  }
  return mapped;
}

// ─── Lightweight client-side validation for instant preview ─────────────

export function parseFlexDate(input) {
  const s = String(input || '').trim();
  if (!s) return '';
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) {
    const dd = Number(m[1]); const mm = Number(m[2]); const yyyy = m[3];
    if (mm > 12 && dd <= 12) return `${yyyy}-${String(dd).padStart(2, '0')}-${String(mm).padStart(2, '0')}`;
    return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  }
  const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  const lower = s.toLowerCase();
  m = lower.match(/^(\d{1,2})\s+([a-z]{3,9})\s+(\d{4})$/) || lower.match(/^(\d{1,2})-([a-z]{3,9})-(\d{4})$/);
  if (m) {
    const mon = months[m[2].slice(0, 3)];
    if (mon) return `${m[3]}-${mon}-${m[1].padStart(2, '0')}`;
  }
  m = lower.match(/^([a-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const mon = months[m[1].slice(0, 3)];
    if (mon) return `${m[3]}-${mon}-${m[2].padStart(2, '0')}`;
  }
  const d = new Date(s);
  if (Number.isFinite(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return '';
}

export function parseFlexTime(input) {
  const s = String(input || '').trim().toLowerCase();
  if (!s) return '';
  let m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m) {
    const h = Number(m[1]); const mm = Number(m[2]);
    if (h >= 0 && h < 24 && mm >= 0 && mm < 60) return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
  m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (m) {
    let h = Number(m[1]); const mm = Number(m[2] || '0'); const period = m[3];
    if (h < 1 || h > 12 || mm < 0 || mm > 59) return '';
    if (period === 'pm' && h !== 12) h += 12;
    if (period === 'am' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
  return '';
}

/**
 * Quick preview validation (frontend-side). Backend will validate again.
 * Returns { ok: boolean, reason?: string } per row.
 */
export function previewValidate(canonical, kind) {
  if (!canonical.title) return { ok: false, reason: 'Missing title' };
  const dateField = kind === 'task' ? 'due_date' : 'meeting_date';
  const timeField = kind === 'task' ? 'due_time' : 'meeting_time';
  if (canonical[dateField] && !parseFlexDate(canonical[dateField])) {
    return { ok: false, reason: `Bad ${dateField}: "${canonical[dateField]}"` };
  }
  if (canonical[timeField] && !parseFlexTime(canonical[timeField])) {
    return { ok: false, reason: `Bad ${timeField}: "${canonical[timeField]}"` };
  }
  if (!canonical.assignees) {
    return { ok: false, reason: kind === 'task' ? 'At least one assignee is required' : 'At least one participant is required' };
  }
  return { ok: true };
}

// ─── CSV template generator ─────────────────────────────────────────────

export function templateCsv(kind) {
  if (kind === 'task') {
    return (
      'title,description,priority,due_date,due_time,assignees,project\n' +
      'Prepare Q3 report,Initial draft,high,20/05/2026,18:00,maria@example.com; alex@example.com,Q3 Launch\n' +
      'Review marketing copy,,medium,21/05/2026,,Maria Lopez,Q3 Launch\n'
    );
  }
  return (
    'title,description,priority,meeting_date,meeting_time,assignees,project\n' +
    'Sprint planning,Bi-weekly,medium,22/05/2026,10:00,team@example.com,Q3 Launch\n' +
    'Design review,,high,23/05/2026,15:30,Maria Lopez; Alex Kim,\n'
  );
}

/** Trigger a CSV download in the browser. */
export function downloadCsv(filename, csvText) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
