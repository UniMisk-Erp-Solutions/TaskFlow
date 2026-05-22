import React, { useRef } from 'react';
import { Paperclip, FileAudio, FileText, File as FileIcon, X } from 'lucide-react';
import api from '../api';

/**
 * Lets the user stage local files (audio / document / other) while CREATING a
 * task or meeting. The files are NOT uploaded here — they're held in parent
 * state and uploaded by `uploadStagedAttachments()` after the task/meeting
 * row exists (we need its id for the attachment FK).
 *
 *   const [files, setFiles] = useState([]);
 *   <AttachmentPicker files={files} onChange={setFiles} />
 *   // after create:
 *   await uploadStagedAttachments('meeting', created.id, files);
 */

function classify(file) {
  const t = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  if (t.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|aac|flac)$/.test(name)) return 'audio';
  if (
    t.includes('pdf') || t.includes('word') || t.includes('document') ||
    t.includes('text') || t.includes('sheet') || t.includes('presentation') ||
    /\.(pdf|docx?|txt|csv|xlsx?|pptx?|md|rtf)$/.test(name)
  ) return 'transcript';
  return 'other';
}

function iconFor(type) {
  if (type === 'audio') return <FileAudio size={15} />;
  if (type === 'transcript') return <FileText size={15} />;
  return <FileIcon size={15} />;
}

function fmtSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export default function AttachmentPicker({ files = [], onChange, label = 'Attachments (optional)' }) {
  const inputRef = useRef(null);

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []).map((f) => ({
      file: f,
      type: classify(f),
      id: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
    }));
    if (incoming.length) onChange?.([...files, ...incoming]);
  }

  function removeAt(id) {
    onChange?.(files.filter((f) => f.id !== id));
  }

  function setType(id, type) {
    onChange?.(files.map((f) => (f.id === id ? { ...f, type } : f)));
  }

  return (
    <div className="form-group">
      <label className="form-label">{label}</label>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
        style={{
          border: '1.5px dashed var(--tf-border)',
          borderRadius: 10,
          padding: '14px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
          color: 'var(--tf-muted)',
          fontSize: 13,
          background: 'var(--tf-pearl)',
        }}
      >
        <Paperclip size={15} style={{ color: 'var(--color-primary)' }} />
        <span>Click or drop files — audio, documents, anything</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
          {files.map((f) => (
            <div
              key={f.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '7px 10px',
                border: '1px solid var(--tf-border)',
                borderRadius: 8,
                background: 'var(--tf-panel)',
              }}
            >
              <span style={{ color: 'var(--color-primary)', display: 'flex' }}>{iconFor(f.type)}</span>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--tf-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.file.name}
              </span>
              <span style={{ fontSize: 11, color: 'var(--tf-muted)' }}>{fmtSize(f.file.size)}</span>
              <select
                className="tf-select-inline"
                value={f.type}
                onChange={(e) => setType(f.id, e.target.value)}
                style={{ width: 110, fontSize: 12 }}
                onClick={(e) => e.stopPropagation()}
              >
                <option value="audio">Audio</option>
                <option value="transcript">Document</option>
                <option value="other">Other</option>
              </select>
              <button
                type="button"
                onClick={() => removeAt(f.id)}
                title="Remove"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tf-muted)', display: 'flex', padding: 2 }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Upload staged files to a freshly-created task or meeting.
 * Returns { uploaded, failed: [{ name, reason }] } — never throws, so a
 * file failure doesn't undo the created task/meeting.
 */
export async function uploadStagedAttachments(kind, id, files) {
  const base = kind === 'task' ? `/tasks/${id}/attachments` : `/meetings/${id}/attachments`;
  let uploaded = 0;
  const failed = [];
  for (const f of files || []) {
    try {
      const fd = new FormData();
      fd.append('type', f.type || 'other');
      fd.append('file', f.file);
      await api.post(base, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      uploaded++;
    } catch (err) {
      failed.push({ name: f.file?.name || 'file', reason: err.response?.data?.error || err.message });
    }
  }
  return { uploaded, failed };
}
