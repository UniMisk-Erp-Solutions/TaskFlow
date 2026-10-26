import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Sparkles, Paperclip, RotateCcw, Trash2, FileText } from 'lucide-react';
import AiMessage from './AiMessage';
import api from '../api';
import { ocrImageFile } from '../lib/ocr';

const SUGGESTIONS = [
  'Who has overdue tasks?',
  'What tasks are blocked?',
  "Summarize this week's workload",
  'Create a task to send the invoice, assign to me, due Friday',
];

const WELCOME = {
  role: 'assistant',
  content:
    "Ask me about your team's tasks, or tell me what to create and update. You can also attach a photo, screenshot or PDF of a to-do list and I'll turn it into tasks.",
};
const MAX_IMAGES = 3;
const MAX_PDF_BYTES = 5 * 1024 * 1024;

function pdfToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_PDF_BYTES) { reject(new Error(`${file.name} is larger than 5 MB.`)); return; }
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Could not read that PDF.'));
    r.readAsDataURL(file);
  });
}

function assistantRequestError(err, hasImage = false) {
  const status = err.response?.status;
  const serverMessage = err.response?.data?.error;
  if (status === 400 && hasImage && /question is required/i.test(serverMessage || '')) {
    return 'The connected assistant server is outdated and does not accept a photo by itself yet. Update the TaskFlow AI Edge Function, then retry with the photo only.';
  }
  if (status === 401 || status === 403) {
    return 'The assistant service rejected this session (HTTP ' + status + '). Sign in again; if it continues, the hosted Supabase function key or access configuration needs to be corrected.';
  }
  if (status === 413) return 'That upload is too large for the assistant. Try a smaller or more closely cropped image.';
  if (serverMessage) return serverMessage;
  return err.message || 'The assistant request failed.';
}

// Downscale + re-encode so phone photos stay well under the server's size limit and OCR stays fast.
function fileToDataUrl(file, maxSide = 1600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image.')); };
    img.src = url;
  });
}

export default function AiChat({ onClose }) {
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [images, setImages] = useState([]); // attachments waiting to be sent: { url, name, pdf }
  const [memories, setMemories] = useState([]);
  const [showMemory, setShowMemory] = useState(false);
  const [taskWorkflow, setTaskWorkflow] = useState(null);
  const [vision, setVision] = useState(false); // server has a vision model: send photos as-is instead of OCR-ing in the browser
  const [assignment, setAssignment] = useState({ assigneeId: '', dueDate: '', noDueDate: false });
  const bottomRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Restore the server-side conversation + saved notes so a refresh doesn't lose context.
  useEffect(() => {
    let cancelled = false;
    api.get('/ai/state').then(({ data }) => {
      if (cancelled) return;
      if (Array.isArray(data?.messages) && data.messages.length) setMessages([WELCOME, ...data.messages]);
      if (Array.isArray(data?.memories)) setMemories(data.memories);
      setTaskWorkflow(data?.task_workflow || null);
      setVision(data?.vision === true);
    }).catch(() => { /* memory is optional */ });
    return () => { cancelled = true; };
  }, []);

  const currentWorkflowTask = taskWorkflow?.tasks?.[0] || null;
  useEffect(() => {
    if (!currentWorkflowTask) {
      setAssignment({ assigneeId: '', dueDate: '', noDueDate: false });
      return;
    }
    setAssignment({
      assigneeId: currentWorkflowTask.assignee_id || '',
      dueDate: currentWorkflowTask.due_date || '',
      noDueDate: !!currentWorkflowTask.due_set && !currentWorkflowTask.due_date,
    });
  }, [currentWorkflowTask?.n, currentWorkflowTask?.title, currentWorkflowTask?.assignee_id, currentWorkflowTask?.due_date, currentWorkflowTask?.due_set]);

  async function refreshMemories() {
    try { const { data } = await api.get('/ai/memory'); setMemories(Array.isArray(data) ? data : []); } catch { /* ignore */ }
  }

  async function addFiles(fileList) {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/') || f.type === 'application/pdf').slice(0, MAX_IMAGES - images.length);
    if (!files.length) return;
    try {
      const added = await Promise.all(files.map(async (f) => (
        f.type === 'application/pdf'
          ? { url: await pdfToDataUrl(f), name: f.name, pdf: true }
          : { url: await fileToDataUrl(f), name: f.name, pdf: false, file: f }
      )));
      setImages((cur) => [...cur, ...added].slice(0, MAX_IMAGES));
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: `Error: ${err.message}` }]);
    }
  }

  async function send(q) {
    q = q.trim();
    if ((!q && !images.length) || loading) return;
    const sending = images;
    setInput('');
    setImages([]);
    setMessages((m) => [...m, { role: 'user', content: (sending.length ? `📎 ${sending.map((a) => a.name).join(', ')}\n` : '') + q, images: sending }]);
    setLoading(true);
    try {
      // Photos are read on this device (OCR) and only the recognised text is sent. PDFs, and photos OCR
      // cannot start on, are sent as files for a server-side vision model if one is configured.
      const ocr_text = [];
      const ocr_confidence = [];
      const files = [];
      for (const a of sending) {
        if (vision || a.pdf || !a.file) { files.push(a.url); continue; }
        try {
          setStatus(`Reading text from ${a.name}…`);
          const r = await ocrImageFile(a.file, (p) => setStatus(`Reading text from ${a.name}… ${Math.round(p * 100)}%`));
          if (r.text.trim()) { ocr_text.push(r.text); ocr_confidence.push(r.confidence); } else { files.push(a.url); }
        } catch {
          files.push(a.url);
        }
      }
      if (sending.length) setStatus(vision ? 'Sending the photo to the vision model…' : 'Reading your tasks…');
      const { data } = await api.post('/ai/query', {
        question: q,
        images: files,
        ocr_text,
        ocr_confidence,
        image_intent: sending.length > 0,
      }, { timeout: 120000 });
      // Do not let a generic answer about the Kanban board masquerade as image OCR.
      // The Edge Function sets this marker only after routing an explicit image request.
      if (sending.length && data?.image_processed !== true) {
        throw new Error('The connected assistant server did not confirm it processed the photo. Update the TaskFlow AI Edge Function, then retry; no task was changed.');
      }
      setTaskWorkflow(data.task_workflow || null);
      setMessages((m) => [...m, { role: 'assistant', content: data.answer }]);
      refreshMemories(); // the reply may have saved a note
    } catch (err) {
      const noReply = !err.response;
      setMessages((m) => [...m, {
        role: 'assistant',
        content: noReply && sending.length && err.message === 'Network Error'
          ? "Error: the server didn't accept that upload (network error). The file may be too large for the server, or the server doesn't support file reading yet."
          : `Error: ${assistantRequestError(err, sending.length > 0)}`,
      }]);
    } finally {
      setLoading(false);
      setStatus('');
    }
  }

  async function replyToWorkflow(question, displayText) {
    if (loading) return;
    setMessages((m) => [...m, { role: 'user', content: displayText }]);
    setLoading(true);
    try {
      const { data } = await api.post('/ai/query', { question }, { timeout: 120000 });
      setTaskWorkflow(data.task_workflow || null);
      setMessages((m) => [...m, { role: 'assistant', content: data.answer }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: `Error: ${assistantRequestError(err)}` }]);
    } finally {
      setLoading(false);
    }
  }

  function submitAssignment(e) {
    e.preventDefault();
    const task = taskWorkflow?.tasks?.[0];
    if (!task) return;
    const person = taskWorkflow.assignees.find((a) => a.id === assignment.assigneeId);
    if (task.needs_assignee && !person) return;
    const due = task.needs_due_date ? (assignment.noDueDate ? 'no due date' : assignment.dueDate) : '';
    if (task.needs_due_date && !due) return;
    const answer = [task.needs_assignee ? (person.email || person.name) : '', due].filter(Boolean).join(', ');
    const labels = [task.needs_assignee ? `Assigned to ${person.name}` : '', due ? (due === 'no due date' ? 'No end date' : `End date ${due}`) : ''].filter(Boolean);
    replyToWorkflow(answer, labels.join(' · '));
  }

  function skipWorkflowTask() {
    replyToWorkflow('skip', `Skipped: ${taskWorkflow?.tasks?.[0]?.title || 'task'}`);
  }

  async function newChat() {
    try { await api.post('/ai/reset'); } catch { /* ignore */ }
    setMessages([WELCOME]);
    setImages([]);
    setTaskWorkflow(null);
  }

  async function forget(id) {
    try { await api.delete(`/ai/memory/${id}`); setMemories((cur) => cur.filter((m) => m.id !== id)); } catch { /* ignore */ }
  }

  async function forgetAll() {
    try { await api.delete('/ai/memory'); setMemories([]); } catch { /* ignore */ }
  }

  const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tf-muted)', display: 'flex', padding: 6 };

  return (
    <div
      className="tf-ai-chat-panel"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 'min(400px, 100vw)',
        background: 'var(--tf-panel)',
        borderLeft: '1px solid var(--tf-border)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
        animation: 'slideIn 180ms ease',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.06)',
      }}
    >
      <div
        className="tf-ai-chat-header"
        style={{
          padding: '16px 18px',
          borderBottom: '1px solid var(--tf-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          background: 'var(--tf-pearl)',
        }}
      >
        <div className="tf-ai-chat-heading" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sparkles size={18} color="var(--color-primary)" strokeWidth={2} />
          <div className="tf-ai-chat-title">
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--tf-text)', letterSpacing: '-0.015em' }}>AI Assistant</div>
            <div style={{ fontSize: 12, color: 'var(--tf-muted)', marginTop: 2 }}>Reads images · remembers context · manages tasks</div>
          </div>
        </div>
        <div className="tf-ai-chat-controls" style={{ display: 'flex', alignItems: 'center' }}>
          <button type="button" onClick={onClose} className="tf-ai-back-button" aria-label="Back to Task Flow" title="Back">
            <X size={19} strokeWidth={2} />
          </button>
          <button type="button" onClick={() => setShowMemory((v) => !v)} style={{ ...iconBtn, fontSize: 12, fontFamily: 'inherit', color: showMemory ? 'var(--color-primary)' : 'var(--tf-muted)' }} aria-label="Saved memory">
            Memory{memories.length ? ` (${memories.length})` : ''}
          </button>
          <button type="button" onClick={newChat} style={iconBtn} aria-label="New chat" title="New chat">
            <RotateCcw size={16} strokeWidth={1.8} />
          </button>
          <button type="button" onClick={onClose} style={iconBtn} aria-label="Close">
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {showMemory && (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--tf-border)', background: 'var(--tf-pearl)', maxHeight: 180, overflowY: 'auto', flexShrink: 0 }}>
          {memories.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--tf-muted)' }}>
              Nothing saved yet. Say “remember that …” and I’ll keep it across sessions.
            </div>
          ) : (
            <>
              {memories.map((m) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--tf-text)', padding: '4px 0' }}>
                  <span style={{ flex: 1 }}>{m.content}</span>
                  <button type="button" onClick={() => forget(m.id)} style={iconBtn} aria-label={`Forget: ${m.content}`}>
                    <Trash2 size={14} strokeWidth={1.8} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={forgetAll} style={{ ...iconBtn, fontSize: 12, fontFamily: 'inherit', padding: '6px 0' }}>Forget everything</button>
            </>
          )}
        </div>
      )}

      <div className="tf-ai-chat-messages" style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--tf-page)' }}>
        {messages.map((m, i) => (
          <React.Fragment key={i}>
            <AiMessage role={m.role} content={m.content} />
            {m.images?.length > 0 && (
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                {m.images.map((a, k) => (a.pdf
                  ? <div key={k} style={{ width: 72, height: 72, borderRadius: 8, border: '1px solid var(--tf-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--tf-muted)', padding: 4, textAlign: 'center', overflow: 'hidden' }}><FileText size={20} />{a.name}</div>
                  : <img key={k} src={a.url} alt={`attachment ${k + 1}`} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--tf-border)' }} />
                ))}
              </div>
            )}
          </React.Fragment>
        ))}
        {taskWorkflow?.tasks?.length > 0 && currentWorkflowTask && (
          <div className="tf-ai-task-workflow" style={{ margin: '0 0 12px 42px', padding: 14, border: '1px solid var(--tf-border)', borderRadius: 14, background: 'var(--tf-panel)', color: 'var(--tf-text)' }}>
            <div style={{ fontSize: 14, fontWeight: 650, marginBottom: 8 }}>Assign tasks from your image</div>
            <div style={{ fontSize: 12, color: 'var(--tf-muted)', marginBottom: 8 }}>Task {taskWorkflow.current} of {taskWorkflow.total}: <strong style={{ color: 'var(--tf-text)' }}>{currentWorkflowTask.title}</strong></div>
            {currentWorkflowTask.issue === 'ambiguous' && <div style={{ color: 'var(--tf-danger, #b42318)', fontSize: 12, marginBottom: 8 }}>The name in the photo matches more than one teammate. Choose the correct person below.</div>}
            {currentWorkflowTask.issue === 'unregistered' && <div style={{ color: 'var(--tf-danger, #b42318)', fontSize: 12, marginBottom: 8 }}>The name in the photo isn’t in your Task Flow user list. Choose a registered teammate.</div>}
            <form onSubmit={submitAssignment} style={{ display: 'grid', gap: 10 }}>
              {currentWorkflowTask.needs_assignee ? (
                <label style={{ display: 'grid', gap: 5, fontSize: 12, color: 'var(--tf-muted)' }}>
                  Assign to
                  <select className="input" value={assignment.assigneeId} onChange={(e) => setAssignment((v) => ({ ...v, assigneeId: e.target.value }))} required>
                    <option value="">Choose a teammate…</option>
                    {taskWorkflow.assignees.map((person) => <option key={person.id} value={person.id}>{person.name}{person.email ? ` · ${person.email}` : ''}</option>)}
                  </select>
                </label>
              ) : <div style={{ fontSize: 13 }}>Assigned to <strong>{currentWorkflowTask.assignee}</strong></div>}
              {currentWorkflowTask.needs_due_date ? (
                <label style={{ display: 'grid', gap: 5, fontSize: 12, color: 'var(--tf-muted)' }}>
                  End date
                  <input className="input" type="date" value={assignment.dueDate} disabled={assignment.noDueDate} required={!assignment.noDueDate} onChange={(e) => setAssignment((v) => ({ ...v, dueDate: e.target.value }))} />
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--tf-text)' }}>
                    <input type="checkbox" checked={assignment.noDueDate} onChange={(e) => setAssignment((v) => ({ ...v, noDueDate: e.target.checked, dueDate: e.target.checked ? '' : v.dueDate }))} /> No end date
                  </span>
                </label>
              ) : currentWorkflowTask.due_date ? <div style={{ fontSize: 13 }}>End date from image: <strong>{currentWorkflowTask.due_date}</strong></div> : <div style={{ fontSize: 13 }}>No end date</div>}
              <div className="tf-ai-workflow-actions" style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" type="submit" disabled={loading || (currentWorkflowTask.needs_assignee && !assignment.assigneeId) || (currentWorkflowTask.needs_due_date && !assignment.noDueDate && !assignment.dueDate)}>
                  {loading ? 'Saving…' : 'Assign & continue'}
                </button>
                <button className="btn" type="button" onClick={skipWorkflowTask} disabled={loading}>Skip task</button>
              </div>
            </form>
          </div>
        )}
        {loading && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'var(--tf-panel)',
                border: '1px solid var(--tf-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Sparkles size={14} color="var(--color-primary)" strokeWidth={2} />
            </div>
            <div
              style={{
                padding: '10px 14px',
                background: 'var(--tf-panel)',
                border: '1px solid var(--tf-border)',
                borderRadius: 16,
                display: 'flex',
                gap: 5,
                alignItems: 'center',
              }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: 'var(--color-primary)',
                    animation: `blink 1.2s ease ${i * 0.2}s infinite`,
                  }}
                />
              ))}
              {status && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--tf-muted)' }}>{status}</span>}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && (
        <div style={{ padding: '10px 14px 0', display: 'flex', flexWrap: 'wrap', gap: 8, background: 'var(--tf-page)' }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              style={{
                background: 'var(--tf-pearl)',
                border: '1px solid var(--tf-border)',
                borderRadius: 999,
                padding: '8px 14px',
                fontSize: 13,
                color: 'var(--tf-text)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'border-color 120ms ease',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: 14, borderTop: '1px solid var(--tf-border)', flexShrink: 0, background: 'var(--tf-pearl)' }}>
        {images.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {images.map((a, k) => (
              <div key={k} style={{ position: 'relative' }}>
                {a.pdf
                  ? <div title={a.name} style={{ width: 56, height: 56, borderRadius: 8, border: '1px solid var(--tf-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tf-muted)' }}><FileText size={22} /></div>
                  : <img src={a.url} alt={`pending attachment ${k + 1}`} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--tf-border)' }} />}
                <button
                  type="button"
                  onClick={() => setImages((cur) => cur.filter((_, j) => j !== k))}
                  aria-label="Remove image"
                  style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', border: '1px solid var(--tf-border)', background: 'var(--tf-panel)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
        <form className="tf-ai-composer" onSubmit={(e) => { e.preventDefault(); send(input); }} style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            hidden
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
          />
          <button
            type="button"
            className="btn btn-icon"
            onClick={() => fileRef.current?.click()}
            disabled={loading || images.length >= MAX_IMAGES}
            style={{ alignSelf: 'stretch', minHeight: 44 }}
            aria-label="Add file"
            title="Add a photo, screenshot or PDF (up to 3)"
          >
            <Paperclip size={18} strokeWidth={1.8} />
            <span style={{ marginLeft: 6, fontSize: 13 }}>Add file</span>
          </button>
          <input
            className="input"
            placeholder={images.length ? 'Add a note (optional) and send…' : 'Ask or tell me what to do…'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={(e) => {
              const files = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith('image/') || f.type === 'application/pdf');
              if (files.length) { e.preventDefault(); addFiles(files); }
            }}
            disabled={loading}
            style={{ flex: 1, fontSize: 15 }}
          />
          <button
            type="submit"
            disabled={loading || (!input.trim() && !images.length)}
            className="btn btn-primary btn-icon"
            style={{ alignSelf: 'stretch', minHeight: 44 }}
            aria-label="Send"
          >
            <Send size={18} strokeWidth={1.8} />
          </button>
        </form>
      </div>
    </div>
  );
}
