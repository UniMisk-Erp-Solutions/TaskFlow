import React, { useCallback, useEffect, useState } from 'react';
import { X, Pencil } from 'lucide-react';
import api from '../api';
import supabase from '../supabaseClient';
import MultiEmployeeSelect from './MultiEmployeeSelect';
import ProjectSelect from './ProjectSelect';
import { PriorityBadge } from './StatusBadge';
import HistoryTimeline from './HistoryTimeline';
import AttachmentsSection from './AttachmentsSection';
import { formatDate, formatDateTime } from '../lib/dateFormat';

function assigneeNames(meeting, profileById) {
  const ids = meeting.assignee_ids?.length
    ? meeting.assignee_ids
    : meeting.assignee_id
      ? [meeting.assignee_id]
      : [];
  if (!ids.length) return '—';
  return ids.map((id) => profileById[id] || id.slice(0, 8)).join(', ');
}

function fmtDate(d) {
  if (!d) return '';
  const out = formatDate(d);
  return out === '—' ? '' : out;
}

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = String(t).split(':');
  const date = new Date();
  date.setHours(Number(h || 0), Number(m || 0), 0, 0);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function whenLabel(d, t) {
  const dp = fmtDate(d);
  const tp = fmtTime(t);
  if (dp && tp) return `${dp} · ${tp}`;
  if (dp) return dp;
  if (tp) return tp;
  return '—';
}

function fmtCreatedAt(ts) {
  return formatDateTime(ts);
}

function toDateInputValue(v) {
  if (v == null || v === '') return '';
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

function toTimeInputValue(v) {
  if (v == null || v === '') return '';
  const s = String(v).trim();
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2}:\d{2})/);
  return m ? m[1] : '';
}

function statusLabel(s) {
  if (!s) return '—';
  return s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function userIsAssignee(record, profileId) {
  if (!record || !profileId) return false;
  if (record.assignee_id === profileId) return true;
  const ids = record.assignee_ids || [];
  return ids.includes(profileId);
}

export default function MeetingDetailModal({
  open,
  meeting,
  isAdmin = false,
  profile = null,
  projects = [],
  profileById = {},
  onClose,
  updateMeeting,
  submitMeeting,
  approveMeeting,
  requestMeetingChanges,
  getMeetingHistory,
  onNavigateMeeting,
  onAddSubmeeting,
}) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [history, setHistory] = useState([]);
  const [submitNote, setSubmitNote] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [actionBusy, setActionBusy] = useState('');
  const [draft, setDraft] = useState({
    title: '',
    description: '',
    priority: 'medium',
    meeting_date: '',
    meeting_time: '',
    project_id: '',
    assignee_ids: [],
  });

  const hydrateDraft = useCallback((data) => {
    setDraft({
      title: data.title || '',
      description: data.description ?? '',
      priority: data.priority || 'medium',
      meeting_date: toDateInputValue(data.meeting_date),
      meeting_time: toTimeInputValue(data.meeting_time),
      project_id: data.project_id || '',
      assignee_ids: data.assignee_ids?.length
        ? [...data.assignee_ids]
        : data.assignee_id
          ? [data.assignee_id]
          : [],
    });
  }, []);

  const loadHistory = useCallback(async (meetingId) => {
    if (!getMeetingHistory || !meetingId) return;
    try {
      const rows = await getMeetingHistory(meetingId);
      setHistory(Array.isArray(rows) ? rows : []);
    } catch {
      setHistory([]);
    }
  }, [getMeetingHistory]);

  useEffect(() => {
    if (!open || !meeting?.id) {
      setRecord(null);
      setHistory([]);
      setEditMode(false);
      setSubmitNote('');
      setReviewNote('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    setEditMode(false);
    api
      .get(`/meetings/${meeting.id}`)
      .then(({ data }) => {
        if (cancelled) return;
        setRecord(data);
        hydrateDraft(data);
      })
      .catch(() => {
        if (cancelled) return;
        setRecord(meeting);
        hydrateDraft(meeting);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    loadHistory(meeting.id);
    return () => {
      cancelled = true;
    };
  }, [open, meeting?.id, hydrateDraft, loadHistory]);

  useEffect(() => {
    if (!open || !meeting?.id) return undefined;
    if (import.meta.env.VITE_DISABLE_REALTIME === 'true') return undefined;
    const channel = supabase
      .channel(`meeting-history:${meeting.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'meeting_history', filter: `meeting_id=eq.${meeting.id}` },
        (payload) => {
          const row = payload?.new;
          if (!row) return;
          setHistory((prev) => {
            if (prev.some((h) => h.id === row.id)) return prev;
            return [...prev, row];
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, meeting?.id]);

  if (!open || !meeting?.id) return null;

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const canEdit = isAdmin && !!updateMeeting;
  const isMyMeeting = userIsAssignee(record, profile?.id);
  const status = record?.status || 'scheduled';
  const canSubmit = !!submitMeeting && isMyMeeting
    && (status === 'scheduled' || status === 'changes_requested');
  const canReview = isAdmin && !!approveMeeting && !!requestMeetingChanges && status === 'submitted';
  const canReopen = isAdmin && !!requestMeetingChanges && (status === 'completed' || status === 'changes_requested');

  async function handleSave(e) {
    e.preventDefault();
    if (!draft.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!draft.assignee_ids?.length) {
      setError('Select at least one participant');
      return;
    }
    if (!updateMeeting) return;
    setSaving(true);
    setError('');
    try {
      const updated = await updateMeeting(meeting.id, {
        title: draft.title.trim(),
        description: draft.description,
        priority: draft.priority,
        meeting_date: draft.meeting_date || null,
        meeting_time: draft.meeting_date ? (draft.meeting_time || null) : null,
        project_id: draft.project_id || null,
        assignee_ids: draft.assignee_ids,
      });
      if (updated) setRecord((prev) => ({ ...(prev || {}), ...updated }));
      setEditMode(false);
      loadHistory(meeting.id);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitWork() {
    if (!submitMeeting) return;
    setActionBusy('submit');
    setError('');
    try {
      const updated = await submitMeeting(meeting.id, submitNote.trim());
      if (updated) setRecord((prev) => ({ ...(prev || {}), ...updated }));
      setSubmitNote('');
      loadHistory(meeting.id);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setActionBusy('');
    }
  }

  async function handleApprove() {
    if (!approveMeeting) return;
    setActionBusy('approve');
    setError('');
    try {
      const updated = await approveMeeting(meeting.id, reviewNote.trim());
      if (updated) setRecord((prev) => ({ ...(prev || {}), ...updated }));
      setReviewNote('');
      loadHistory(meeting.id);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setActionBusy('');
    }
  }

  async function handleRequestChanges() {
    if (!requestMeetingChanges) return;
    const note = reviewNote.trim();
    if (!note) {
      setError('Please describe the changes you want.');
      return;
    }
    setActionBusy('request');
    setError('');
    try {
      const updated = await requestMeetingChanges(meeting.id, note);
      if (updated) setRecord((prev) => ({ ...(prev || {}), ...updated }));
      setReviewNote('');
      loadHistory(meeting.id);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setActionBusy('');
    }
  }

  async function handleReopen() {
    if (!requestMeetingChanges) return;
    const note = reviewNote.trim() || 'Reopened by admin';
    setActionBusy('reopen');
    setError('');
    try {
      const updated = await requestMeetingChanges(meeting.id, note);
      if (updated) setRecord((prev) => ({ ...(prev || {}), ...updated }));
      setReviewNote('');
      loadHistory(meeting.id);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setActionBusy('');
    }
  }

  const submeetings = record?.submeetings || [];

  return (
    <div className="overlay" role="presentation">
      <div className="modal" style={{ maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} role="dialog" aria-modal="true">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>{editMode ? 'Edit meeting' : 'Meeting'}</h2>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {!editMode && canEdit && (
              <button
                type="button"
                onClick={() => { setEditMode(true); setError(''); }}
                title="Edit"
                aria-label="Edit meeting"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tf-muted)', display: 'flex', padding: 6 }}
              >
                <Pencil size={16} />
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-muted-48)', display: 'flex', padding: 4 }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {loading && (
          <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}>
            <span className="spinner" />
          </div>
        )}

        {!loading && record && !editMode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-ink-muted-48)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Title</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-ink)', lineHeight: 1.4 }}>{record.title}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-ink-muted-48)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>Description</div>
              <div style={{ fontSize: 13, color: 'var(--tf-muted)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{record.description || '—'}</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', borderTop: '1px solid var(--tf-border)', paddingTop: 14 }}>
              <span style={{ fontSize: 12, color: 'var(--tf-muted)' }}>{statusLabel(record.status)}</span>
              <PriorityBadge priority={record.priority} />
              <span style={{ fontSize: 12, color: 'var(--tf-muted)' }}>
                {whenLabel(record.meeting_date, record.meeting_time)}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--tf-muted)' }}>
              <span>Created · </span>{fmtCreatedAt(record.created_at)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--tf-muted)' }}>
              <span style={{ color: 'var(--color-ink-muted-48)' }}>Project · </span>
              {record.project_name || '—'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--tf-muted)' }}>
              <span style={{ color: 'var(--color-ink-muted-48)' }}>Participants · </span>
              {assigneeNames(record, profileById)}
            </div>

            {record.submission_notes && (
              <div style={{ border: '1px solid var(--tf-border)', borderRadius: 8, padding: 10, background: 'var(--tf-pearl)' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--tf-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Submission notes</div>
                <div style={{ fontSize: 13, color: 'var(--tf-text)', whiteSpace: 'pre-wrap' }}>{record.submission_notes}</div>
              </div>
            )}
            {record.approval_notes && (
              <div style={{ border: '1px solid var(--tf-border)', borderRadius: 8, padding: 10, background: 'var(--tf-pearl)' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--tf-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                  {record.status === 'changes_requested' ? 'Changes requested' : 'Approval notes'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--tf-text)', whiteSpace: 'pre-wrap' }}>{record.approval_notes}</div>
              </div>
            )}

            {submeetings.length > 0 && (
              <div style={{ borderTop: '1px solid var(--tf-border)', paddingTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tf-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Sub-meetings</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                  {submeetings.map((s) => (
                    <li key={s.id} style={{ marginBottom: 6 }}>
                      {onNavigateMeeting ? (
                        <button type="button" className="btn btn-ghost btn-sm" style={{ padding: 0, height: 'auto', fontSize: 13 }} onClick={() => onNavigateMeeting(s)}>
                          {s.title}
                        </button>
                      ) : (
                        s.title
                      )}
                      <span style={{ color: 'var(--tf-muted)', marginLeft: 8 }}>{statusLabel(s.status)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(canSubmit || canReview || canReopen) && (
              <div style={{ borderTop: '1px solid var(--tf-border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {canSubmit && (
                  <>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">What did you change / complete? (optional)</label>
                      <textarea
                        className="input"
                        rows={3}
                        placeholder="Briefly describe what was done…"
                        value={submitNote}
                        onChange={(e) => setSubmitNote(e.target.value)}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={handleSubmitWork}
                        disabled={actionBusy === 'submit'}
                      >
                        {actionBusy === 'submit' ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Submit for review'}
                      </button>
                    </div>
                  </>
                )}
                {canReview && (
                  <>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Reviewer note (required to request changes)</label>
                      <textarea
                        className="input"
                        rows={3}
                        placeholder="Optional for approve · required when requesting changes…"
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={handleRequestChanges}
                        disabled={actionBusy === 'request'}
                      >
                        {actionBusy === 'request' ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Request changes'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={handleApprove}
                        disabled={actionBusy === 'approve'}
                      >
                        {actionBusy === 'approve' ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Approve'}
                      </button>
                    </div>
                  </>
                )}
                {!canReview && canReopen && (
                  <>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">
                        Reopen note <span style={{ color: 'var(--tf-muted)', fontWeight: 400 }}>(optional)</span>
                      </label>
                      <textarea
                        className="input"
                        rows={3}
                        placeholder="Why is this being reopened? (recorded in the timeline)"
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={handleReopen}
                        disabled={actionBusy === 'reopen'}
                      >
                        {actionBusy === 'reopen' ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Reopen meeting'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {error && <div className="form-error">{error}</div>}

            <AttachmentsSection kind="meeting" itemId={record.id} canEdit={isAdmin || isMyMeeting} />

            <HistoryTimeline entries={history} profileById={profileById} />
          </div>
        )}

        {!loading && record && editMode && (
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Title</label>
              <input className="input" value={draft.title} onChange={(e) => set('title', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="input" rows={4} value={draft.description} onChange={(e) => set('description', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="select" value={draft.priority} onChange={(e) => set('priority', e.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="form-group tf-date-field">
                <label className="form-label">Meeting date (optional)</label>
                <input className="input input-date" type="date" value={draft.meeting_date} onChange={(e) => set('meeting_date', e.target.value)} />
              </div>
            </div>
            {draft.meeting_date && (
              <div className="form-group tf-date-field">
                <label className="form-label">Meeting time (optional)</label>
                <input className="input input-time" type="time" value={draft.meeting_time} onChange={(e) => set('meeting_time', e.target.value)} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Project</label>
              <ProjectSelect projects={projects} value={draft.project_id} onChange={(v) => set('project_id', v || '')} />
            </div>
            <div className="form-group">
              <label className="form-label">Participants</label>
              <MultiEmployeeSelect value={draft.assignee_ids} onChange={(ids) => set('assignee_ids', ids)} />
            </div>

            {submeetings.length > 0 && (
              <div style={{ border: '1px solid var(--tf-border)', borderRadius: 11, padding: 12, background: 'var(--tf-pearl)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tf-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Sub-meetings</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                  {submeetings.map((s) => (
                    <li key={s.id} style={{ marginBottom: 6 }}>
                      {onNavigateMeeting ? (
                        <button type="button" className="btn btn-ghost btn-sm" style={{ padding: 0, height: 'auto', fontSize: 13 }} onClick={() => onNavigateMeeting(s)}>
                          {s.title}
                        </button>
                      ) : (
                        s.title
                      )}
                      <span style={{ color: 'var(--tf-muted)', marginLeft: 8 }}>{statusLabel(s.status)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {onAddSubmeeting && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() =>
                    onAddSubmeeting(record.id, {
                      projectId: record.project_id || '',
                    })
                  }
                >
                  + Add sub-meeting
                </button>
              </div>
            )}

            {error && <div className="form-error">{error}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEditMode(false); setError(''); if (record) hydrateDraft(record); }}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Save'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
