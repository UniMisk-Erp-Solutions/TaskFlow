import React, { useEffect, useRef, useState } from 'react';
import { Paperclip, FileAudio, FileText, File as FileIcon, Download, Trash2, Upload } from 'lucide-react';
import api from '../api';
import { getApiAccessToken } from '../sessionAccess';
import { formatDateTime } from '../lib/dateFormat';

/**
 * Attachments list + uploader shown inside a task or meeting detail modal,
 * so files can be added/viewed AFTER the item is created.
 *
 *   <AttachmentsSection kind="task" itemId={task.id} canEdit />
 *   <AttachmentsSection kind="meeting" itemId={meeting.id} canEdit />
 */

function iconFor(type, name = '') {
  const n = name.toLowerCase();
  if (type === 'audio' || /\.(mp3|wav|m4a|ogg|aac|flac)$/.test(n)) return <FileAudio size={15} />;
  if (type === 'transcript' || /\.(pdf|docx?|txt|csv|xlsx?|pptx?|md|rtf)$/.test(n)) return <FileText size={15} />;
  return <FileIcon size={15} />;
}

function fmtSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function classify(file) {
  const t = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  if (t.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|aac|flac)$/.test(name)) return 'audio';
  if (t.includes('pdf') || t.includes('word') || t.includes('document') || t.includes('text') ||
      t.includes('sheet') || t.includes('presentation') || /\.(pdf|docx?|txt|csv|xlsx?|pptx?|md|rtf)$/.test(name)) return 'transcript';
  return 'other';
}

export default function AttachmentsSection({ kind, itemId, canEdit = true }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const base = kind === 'task' ? `/tasks/${itemId}/attachments` : `/meetings/${itemId}/attachments`;
  const downloadBase = kind === 'task' ? '/tasks/attachments' : '/meetings/attachments';

  async function load() {
    if (!itemId) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(base);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [itemId, kind]);

  async function handleFiles(fileList) {
    const arr = Array.from(fileList || []);
    if (!arr.length) return;
    setUploading(true);
    setError('');
    try {
      for (const f of arr) {
        const fd = new FormData();
        fd.append('type', classify(f));
        fd.append('file', f);
        await api.post(base, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      await load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(attId) {
    const url = `${api.defaults.baseURL}${downloadBase}/${attId}/download`;
    try {
      // The endpoint requires auth and 302-redirects to a short-lived signed
      // Storage URL. Fetch it with the Bearer token, follow the redirect, then
      // open the final (public, tokenised) URL in a new tab.
      const token = getApiAccessToken();
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        redirect: 'follow',
      });
      if (res.ok && res.url) window.open(res.url, '_blank', 'noopener');
      else setError('Could not open the file.');
    } catch (e) {
      setError(e.message || 'Download failed');
    }
  }

  return (
    <div style={{ borderTop: '1px solid var(--tf-border)', paddingTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tf-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Paperclip size={13} /> Attachments {items.length > 0 ? `(${items.length})` : ''}
        </div>
        {canEdit && (
          <>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Upload size={13} />}
              Upload
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
            />
          </>
        )}
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--tf-muted)' }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--tf-muted)' }}>No files yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((a) => (
            <div
              key={a.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 10px', border: '1px solid var(--tf-border)',
                borderRadius: 8, background: 'var(--tf-pearl)',
              }}
            >
              <span style={{ color: 'var(--color-primary)', display: 'flex' }}>{iconFor(a.type, a.original_name)}</span>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--tf-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.original_name || '(unnamed)'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--tf-muted)' }}>{fmtSize(a.size_bytes)}</span>
              <span style={{ fontSize: 11, color: 'var(--tf-muted)' }}>{formatDateTime(a.created_at)}</span>
              <button
                type="button"
                onClick={() => handleDownload(a.id)}
                title="Download"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tf-muted)', display: 'flex', padding: 4 }}
              >
                <Download size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <div style={{ fontSize: 12, color: 'var(--status-danger)', marginTop: 6 }}>{error}</div>}
    </div>
  );
}
