import React, { useMemo, useState } from 'react';
import { X, AlertTriangle, Calendar as CalendarIcon } from 'lucide-react';
import MultiEmployeeSelect from './MultiEmployeeSelect';
import ProjectSelect from './ProjectSelect';
import ClockTimePicker from './ClockTimePicker';
import AttachmentPicker, { uploadStagedAttachments } from './AttachmentPicker';
import GoogleConnectCard from './GoogleConnectCard';
import { EOD_TIME } from '../lib/dateFormat';
import { useAuth } from '../AuthContext';
import {
  isConnected as gcalIsConnected,
  isConfigured as gcalConfigured,
  getConnectedEmail as gcalEmail,
  createEvent as gcalCreateEvent,
  ensureToken as gcalEnsureToken,
  buildEventWindow,
} from '../lib/googleCalendar';

/**
 * Normalise meeting_time values for conflict comparison. Backend may return
 * "09:00" or "09:00:00"; we compare by HH:MM only.
 */
function hhmm(t) {
  if (!t) return '';
  const m = String(t).match(/^(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : '';
}

function fmtTime12(t) {
  const v = hhmm(t);
  if (!v) return '';
  const [h, m] = v.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

const DEFAULT = {
  title: '',
  description: '',
  assignee_ids: [],
  priority: 'medium',
  meeting_date: '',
  meeting_time: '',
  project_id: '',
};

export default function MeetingForm({
  onSubmit,
  onClose,
  projects = [],
  defaultProjectId = '',
  parentMeetingId = '',
  initialAssigneeIds = [],
  existingMeetings = [],
}) {
  const [form, setForm] = useState({
    ...DEFAULT,
    project_id: defaultProjectId || '',
    assignee_ids: initialAssigneeIds?.length ? [...initialAssigneeIds] : [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState([]);
  // Re-render trigger so the Google card flips connected/disconnected live.
  const [gcalTick, setGcalTick] = useState(0);

  const { profile } = useAuth();
  const userId = profile?.id || 'anon';
  const gcalConfiguredFlag = gcalConfigured();
  const gcalConnected = gcalConfiguredFlag && gcalIsConnected(userId);
  const gcalReady = gcalConnected; // alias used below
  const connectedEmail = gcalConnected ? gcalEmail(userId) : null;
  // Default the toggle ON if the user has already connected — assume they
  // want everything in their personal calendar by default.
  const [syncToGoogle, setSyncToGoogle] = useState(gcalConnected);

  const set = (k, v) => setForm((ff) => ({ ...ff, [k]: v }));

  // Detect schedule clash: an already-scheduled meeting on the same date+time
  // that shares any assignee with the one we're about to create. Ignores
  // cancelled meetings.
  const conflict = useMemo(() => {
    if (!form.meeting_date || !form.meeting_time) return null;
    const myAssignees = new Set(form.assignee_ids || []);
    const targetTime = hhmm(form.meeting_time);
    for (const m of existingMeetings) {
      if (!m || !m.meeting_date || !m.meeting_time) continue;
      if (m.status === 'cancelled') continue;
      if (m.meeting_date !== form.meeting_date) continue;
      if (hhmm(m.meeting_time) !== targetTime) continue;
      if (myAssignees.size > 0) {
        const others = new Set([
          ...(m.assignee_ids || []),
          ...(m.assignee_id ? [m.assignee_id] : []),
        ]);
        const overlap = [...myAssignees].some((id) => others.has(id));
        if (!overlap) continue;
      }
      return m;
    }
    return null;
  }, [form.meeting_date, form.meeting_time, form.assignee_ids, existingMeetings]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!form.assignee_ids?.length) {
      setError('Select at least one participant');
      return;
    }
    if (conflict) {
      setError(`Meeting already booked at this time: “${conflict.title}”. Change the date, time, or participants to continue.`);
      return;
    }
    setLoading(true);
    setError('');

    const wantSync = syncToGoogle && gcalConnected && form.meeting_date;

    // STEP 1 — if syncing, acquire a valid Google token NOW, while we still
    // have the click gesture (a popup after `await onSubmit` would be blocked).
    if (wantSync) {
      try {
        await gcalEnsureToken(userId);
      } catch (gerr) {
        setError(`Couldn't connect Google Calendar: ${gerr.message || gerr}. Turn off the toggle to create the meeting without syncing.`);
        setLoading(false);
        return;
      }
    }

    try {
      // STEP 2 — create the meeting in TaskFlow.
      const created = await onSubmit({
        ...form,
        title: form.title.trim(),
        meeting_date: form.meeting_date || null,
        meeting_time: form.meeting_date ? (form.meeting_time || null) : null,
        project_id: form.project_id || null,
        assignee_ids: form.assignee_ids,
        parent_meeting_id: parentMeetingId || null,
      });

      // STEP 3 — upload any staged attachments to the new meeting.
      if (files.length && created?.id) {
        const res = await uploadStagedAttachments('meeting', created.id, files);
        if (res.failed.length) {
          window.alert(`Meeting created. ${res.uploaded} file(s) uploaded, ${res.failed.length} failed:\n` +
            res.failed.map((f) => `• ${f.name}: ${f.reason}`).join('\n'));
        }
      }

      // STEP 4 — push to Google Calendar (token already valid from step 1).
      if (wantSync && created) {
        try {
          if (form.meeting_time) {
            const win = buildEventWindow(form.meeting_date, form.meeting_time, 60);
            await gcalCreateEvent({
              userId,
              summary: form.title.trim(),
              description: form.description || '',
              startISO: win.startISO,
              endISO: win.endISO,
            });
          } else {
            // No time → all-day event on the meeting date.
            await gcalCreateEvent({
              userId,
              summary: form.title.trim(),
              description: form.description || '',
              allDayDate: form.meeting_date,
            });
          }
        } catch (gerr) {
          console.warn('[gcal] event push failed:', gerr?.message || gerr);
          window.alert(`Meeting saved, but adding it to Google Calendar failed: ${gerr.message || 'unknown error'}.\nYou can reconnect Google Calendar from the Calendar page and try again.`);
        }
      }
      onClose();
      return created;
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      return undefined;
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="overlay" role="presentation">
      <div className="modal" role="dialog" aria-modal="true">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2>{parentMeetingId ? 'New sub-meeting' : 'New Meeting'}</h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-muted-48)', display: 'flex', padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {parentMeetingId && (
            <div style={{ fontSize: 13, color: 'var(--tf-muted)', lineHeight: 1.5 }}>
              This meeting will nest under the selected parent meeting.
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Title</label>
            <input className="input" placeholder="e.g. Sprint planning" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="input" placeholder="Optional details..." rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Priority</label>
            <select className="select" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* Meeting Date — own full-width row, always visible */}
          <div className="form-group tf-date-field">
            <label className="form-label">Meeting Date (optional)</label>
            <input
              className="input input-date"
              type="date"
              value={form.meeting_date}
              onChange={(e) => {
                const v = e.target.value;
                setForm((ff) => ({
                  ...ff,
                  meeting_date: v,
                  // Pick a date → if no time yet, default to end-of-day (6:00 PM).
                  meeting_time: v ? (ff.meeting_time || EOD_TIME) : '',
                }));
              }}
            />
          </div>

          {/* Meeting Time — own full-width row, always visible (clock face popover) */}
          <div className="form-group">
            <label className="form-label">Meeting Time (optional)</label>
            <ClockTimePicker
              value={form.meeting_time}
              onChange={(v) => set('meeting_time', v)}
              disabled={!form.meeting_date}
              placeholder={form.meeting_date ? 'Pick a time' : 'Pick a date first'}
            />
          </div>

          {conflict && (
            <div
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(221,91,0,0.30)',
                background: 'var(--status-warning-bg)',
                color: 'var(--status-warning)',
                fontSize: 13,
                lineHeight: 1.45,
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>Meeting already booked</div>
                <div style={{ color: 'var(--tf-text)', marginTop: 2 }}>
                  “{conflict.title}” is already scheduled at {fmtTime12(conflict.meeting_time)} on this date with at least one of the selected participants.
                </div>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Project (optional)</label>
            <ProjectSelect projects={projects} value={form.project_id} onChange={(v) => set('project_id', v || '')} />
          </div>

          <div className="form-group">
            <label className="form-label">Participants</label>
            <MultiEmployeeSelect value={form.assignee_ids} onChange={(ids) => set('assignee_ids', ids)} />
          </div>

          {/* Files: stage now, uploaded right after the meeting is created. */}
          <AttachmentPicker files={files} onChange={setFiles} />

          {/* Google Calendar — inline. Not connected → "Sign in with Google".
              Connected → a yes/no toggle. */}
          {gcalConfiguredFlag && !gcalConnected && (
            <div
              key={gcalTick}
              style={{
                padding: 14,
                border: '1px solid var(--tf-border)',
                borderRadius: 12,
                background: 'var(--tf-pearl)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(86,69,212,0.10)', color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CalendarIcon size={16} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tf-text)' }}>Add this meeting to Google Calendar</div>
                  <div style={{ fontSize: 12, color: 'var(--tf-muted)', marginTop: 2 }}>Sign in once — then we'll sync it to your calendar.</div>
                </div>
              </div>
              <div onClick={() => { setSyncToGoogle(true); setTimeout(() => setGcalTick((t) => t + 1), 400); }}>
                <GoogleConnectCard variant="inline" />
              </div>
            </div>
          )}

          {gcalConfiguredFlag && gcalConnected && (
            <label
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', border: '1px solid var(--tf-border)',
                borderRadius: 12, background: 'var(--tf-pearl)', cursor: 'pointer',
              }}
            >
              <span style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(86,69,212,0.10)', color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CalendarIcon size={16} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--tf-text)' }}>
                  Also add to my Google Calendar
                </span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--tf-muted)', marginTop: 2 }}>
                  Connected as {connectedEmail || 'your Google account'}
                  {form.meeting_date ? '' : ' · pick a date to enable'}
                </span>
              </span>
              <span
                role="switch"
                aria-checked={syncToGoogle}
                onClick={(e) => { e.preventDefault(); if (form.meeting_date) setSyncToGoogle((v) => !v); }}
                style={{
                  position: 'relative', display: 'inline-block', width: 36, height: 20,
                  borderRadius: 999,
                  background: syncToGoogle && form.meeting_date ? 'var(--color-primary)' : 'var(--tf-border)',
                  transition: 'background 150ms',
                  cursor: form.meeting_date ? 'pointer' : 'not-allowed',
                  flexShrink: 0,
                  opacity: form.meeting_date ? 1 : 0.6,
                }}
              >
                <span style={{ position: 'absolute', top: 2, left: syncToGoogle && form.meeting_date ? 18 : 2, width: 16, height: 16, borderRadius: 999, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 150ms' }} />
              </span>
            </label>
          )}

          {error && <div className="form-error">{error}</div>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Create Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
