import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { formatDateTime } from '../lib/dateFormat';

function fmtSize(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function fmtDate(ts) {
  return formatDateTime(ts);
}

export default function MeetingFilesModal({ open, meeting, isAdmin, onClose }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState('audio');
  const [file, setFile] = useState(null);

  const title = useMemo(() => meeting?.title || 'Meeting files', [meeting]);

  async function load() {
    if (!meeting?.id) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/meetings/${meeting.id}/attachments`);
      setItems(data || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      setFile(null);
      setUploadType('audio');
      load();
    }
  }, [open, meeting?.id]);

  async function handleUpload() {
    if (!file) { setError('Select a file first'); return; }
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('type', uploadType);
      fd.append('file', file);
      await api.post(`/meetings/${meeting.id}/attachments`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFile(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setUploading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="overlay" role="presentation">
      <div className="modal" style={{ maxWidth: 760, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16 }}>{title}</h2>
          <button onClick={onClose} disabled={uploading} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-ink-muted-48)', display: 'flex', padding: 4, fontSize: 20, lineHeight: 1 }}>
            ×
          </button>
        </div>

        {isAdmin && (
          <div style={{ border: '1px solid var(--tf-border)', background: 'var(--tf-pearl)', borderRadius: 11, padding: 12, marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <select className="select" value={uploadType} onChange={(e) => setUploadType(e.target.value)} style={{ width: 160 }}>
                <option value="audio">Audio (mp3)</option>
                <option value="transcript">Transcript</option>
                <option value="other">Other</option>
              </select>
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                style={{ color: 'var(--tf-muted)' }}
                accept={uploadType === 'audio' ? 'audio/*' : '.txt,.doc,.docx,.pdf,.md,.rtf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'}
              />
              <button className="btn btn-primary btn-sm" type="button" onClick={handleUpload} disabled={uploading || !file}>
                {uploading ? <span className="spinner" /> : 'Upload'}
              </button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={load} disabled={loading || uploading}>
                Refresh
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--tf-muted)', marginTop: 8 }}>
              Only admins can upload. Employees can download.
            </div>
          </div>
        )}

        {error && (
          <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--status-danger)' }}>
            {error}
          </div>
        )}

        <div style={{ border: '1px solid var(--tf-border)', borderRadius: 18, overflow: 'hidden', background: 'var(--tf-panel)' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--tf-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tf-muted)', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
              Files ({items.length})
            </span>
          </div>

          {loading ? (
            <div style={{ padding: 28, display: 'flex', justifyContent: 'center' }}><span className="spinner" /></div>
          ) : items.length === 0 ? (
            <div className="empty">
              <div style={{ fontSize: 13, color: 'var(--tf-muted)' }}>No files uploaded yet.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: 'var(--tf-panel)' }}>
                  <tr style={{ borderBottom: '1px solid var(--tf-border)' }}>
                    <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, color: 'var(--tf-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Type</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, color: 'var(--tf-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Name</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, color: 'var(--tf-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Size</th>
                    <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, color: 'var(--tf-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Uploaded</th>
                    <th style={{ padding: '9px 12px' }} />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} style={{ borderBottom: '1px solid var(--tf-border)' }}>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--tf-muted)', textTransform: 'capitalize' }}>{it.type}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--tf-text)' }}>{it.original_name || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--tf-muted)' }}>{fmtSize(it.size_bytes)}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--tf-muted)' }}>{fmtDate(it.created_at)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <a
                          className="btn btn-ghost btn-sm"
                          href={`${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/meetings/attachments/${it.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Download
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

