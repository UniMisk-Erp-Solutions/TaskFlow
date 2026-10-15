import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Hash, Lock, Search, Send, Trash2, ArrowLeft, MessageSquarePlus, Paperclip, Mic, Square, Pencil, X,
  FileText, Download, Reply, Users, Plus, Check, LogOut, Crown, UserPlus, Info,
} from 'lucide-react';
import supabase from '../supabaseClient';
import { useAuth } from '../AuthContext';
import { useLiveRefresh } from '../useRealtime';

const MESSAGE_LIMIT = 300;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const SWIPE_TRIGGER = 56;
const MSG_COLS = 'id, conversation_id, sender_id, body, created_at, edited_at, kind, reply_to_id, attachment_path, attachment_name, attachment_type, attachment_size';

function initials(name) {
  return (name || '?').trim()[0]?.toUpperCase() || '?';
}

function formatSize(n) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function timeLabel(iso) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}

function attachmentLabel(m) {
  const t = m.attachment_type || '';
  if (t.startsWith('image/')) return '📷 Photo';
  if (t.startsWith('audio/')) return '🎤 Voice message';
  if (t.startsWith('video/')) return '🎞 Video';
  return `📄 ${m.attachment_name || 'File'}`;
}

function Avatar({ name, size = 34, group = false, team = false }) {
  return (
    <span
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        display: 'grid', placeItems: 'center', fontSize: size * 0.4, fontWeight: 600,
        background: group || team ? 'var(--color-primary)' : 'var(--tf-pearl)',
        color: group || team ? '#fff' : 'var(--tf-text)',
        border: '1px solid var(--tf-border)',
      }}
    >
      {group ? <Hash size={size * 0.5} /> : team ? <Users size={size * 0.5} /> : initials(name)}
    </span>
  );
}

function Attachment({ msg }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    supabase.storage.from('chat-files').createSignedUrl(msg.attachment_path, 3600)
      .then(({ data }) => { if (alive) setUrl(data?.signedUrl || null); });
    return () => { alive = false; };
  }, [msg.attachment_path]);
  const type = msg.attachment_type || '';
  if (!url) return <div style={{ fontSize: 12, opacity: 0.7 }}>Loading attachment…</div>;
  if (type.startsWith('image/')) {
    return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={msg.attachment_name} style={{ maxWidth: 260, maxHeight: 260, borderRadius: 10, display: 'block' }} /></a>;
  }
  if (type.startsWith('audio/')) return <audio src={url} controls preload="metadata" style={{ maxWidth: 260 }} />;
  if (type.startsWith('video/')) return <video src={url} controls preload="metadata" style={{ maxWidth: 280, borderRadius: 10 }} />;
  return (
    <a href={url} target="_blank" rel="noreferrer" download={msg.attachment_name}
      style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'inherit', textDecoration: 'none' }}>
      <FileText size={20} />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 600, overflowWrap: 'anywhere' }}>{msg.attachment_name}</span>
        <span style={{ fontSize: 11, opacity: 0.75 }}>{formatSize(msg.attachment_size)}</span>
      </span>
      <Download size={15} />
    </a>
  );
}

/** One chat bubble with swipe-right / double-click to reply and hover actions. */
function MessageRow({ msg, mine, showName, senderName, quoted, quotedName, highlighted, onReply, onEdit, onDelete, onJumpTo }) {
  const bubbleRef = useRef(null);
  const drag = useRef(null);

  function onPointerDown(e) {
    if (e.target.closest('button, a, audio, video, input')) return;
    drag.current = { x: e.clientX, y: e.clientY, active: false, pointerId: e.pointerId };
  }
  function onPointerMove(e) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.active) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { drag.current = null; return; }
      if (dx > 8 && Math.abs(dx) > Math.abs(dy)) {
        d.active = true;
        try { e.currentTarget.setPointerCapture(d.pointerId); } catch { /* ignore */ }
      } else return;
    }
    const shift = Math.max(0, Math.min(dx, 90));
    if (bubbleRef.current) bubbleRef.current.style.transform = `translateX(${shift}px)`;
    d.shift = shift;
  }
  function endDrag() {
    const d = drag.current;
    drag.current = null;
    if (bubbleRef.current) {
      bubbleRef.current.style.transition = 'transform 160ms ease';
      bubbleRef.current.style.transform = 'translateX(0)';
      window.setTimeout(() => { if (bubbleRef.current) bubbleRef.current.style.transition = ''; }, 180);
    }
    if (d?.active && d.shift >= SWIPE_TRIGGER) onReply(msg);
  }

  const iconBtn = { border: 'none', background: 'transparent', color: 'var(--tf-muted)', cursor: 'pointer', padding: 3 };

  return (
    <div
      id={`chatmsg-${msg.id}`}
      className="tf-chat-msg"
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%', display: 'flex', flexDirection: 'column',
        alignItems: mine ? 'flex-end' : 'flex-start', touchAction: 'pan-y',
        borderRadius: 12, transition: 'background 300ms ease',
        background: highlighted ? 'rgba(86,69,212,0.18)' : 'transparent',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={(e) => { if (!e.target.closest('button, a, audio, video')) onReply(msg); }}
    >
      {showName && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', margin: '6px 4px 2px' }}>{senderName}</span>}
      <div ref={bubbleRef} style={{ display: 'flex', alignItems: 'flex-end', gap: 4, flexDirection: mine ? 'row-reverse' : 'row' }}>
        <div
          style={{
            padding: '8px 12px', borderRadius: 14, fontSize: 14, lineHeight: 1.45,
            whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', userSelect: 'text',
            background: mine ? 'var(--color-primary)' : 'var(--tf-pearl)',
            color: mine ? '#fff' : 'var(--tf-text)',
            border: mine ? 'none' : '1px solid var(--tf-border)',
          }}
        >
          {msg.reply_to_id && (
            <button
              type="button"
              onClick={() => quoted && onJumpTo(quoted.id)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', marginBottom: 6, padding: '5px 8px',
                borderRadius: 8, border: 'none', borderLeft: '3px solid', cursor: quoted ? 'pointer' : 'default',
                borderLeftColor: mine ? 'rgba(255,255,255,0.8)' : 'var(--color-primary)',
                background: mine ? 'rgba(255,255,255,0.18)' : 'rgba(86,69,212,0.08)',
                color: 'inherit', font: 'inherit', fontSize: 12.5,
              }}
            >
              <span style={{ display: 'block', fontWeight: 600, marginBottom: 1 }}>{quoted ? quotedName : 'Original message'}</span>
              <span style={{ display: 'block', opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {quoted ? (quoted.body || attachmentLabel(quoted)) : 'Not available'}
              </span>
            </button>
          )}
          {msg.attachment_path && <div style={{ marginBottom: msg.body ? 6 : 0 }}><Attachment msg={msg} /></div>}
          {msg.body}
          {msg.edited_at && <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 6 }}>(edited)</span>}
        </div>
        <span className="tf-chat-actions" style={{ display: 'flex', flexShrink: 0 }}>
          <button type="button" aria-label="Reply" title="Reply" onClick={() => onReply(msg)} style={iconBtn}><Reply size={14} /></button>
          {mine && !msg.attachment_path && (
            <button type="button" aria-label="Edit message" title="Edit" onClick={() => onEdit(msg)} style={iconBtn}><Pencil size={13} /></button>
          )}
          {mine && (
            <button type="button" aria-label="Delete message" title="Delete" onClick={() => onDelete(msg.id)} style={iconBtn}><Trash2 size={13} /></button>
          )}
        </span>
      </div>
      <span style={{ fontSize: 11, color: 'var(--tf-muted)', margin: '2px 4px 0' }}>{timeLabel(msg.created_at)}</span>
    </div>
  );
}

function Modal({ title, onClose, children, width = 440 }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(10,21,48,0.45)', display: 'grid', placeItems: 'center', padding: 16 }}
    >
      <div style={{ width: '100%', maxWidth: width, maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--tf-panel)', border: '1px solid var(--tf-border)', borderRadius: 18, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--tf-border)' }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--tf-text)' }}>{title}</span>
          <button type="button" onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--tf-muted)' }}><X size={18} /></button>
        </div>
        <div style={{ padding: 16, overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}

function MemberPicker({ people, selected, onToggle }) {
  const [q, setQ] = useState('');
  const shown = people.filter((u) => (u.full_name || u.email || '').toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search people…"
        aria-label="Search people"
        style={{ width: '100%', padding: '8px 12px', marginBottom: 8, border: '1px solid var(--tf-border)', borderRadius: 10, background: 'var(--tf-page)', color: 'var(--tf-text)', font: 'inherit', fontSize: 14 }}
      />
      <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--tf-border)', borderRadius: 12 }}>
        {shown.length === 0 && <div style={{ padding: 12, fontSize: 13, color: 'var(--tf-muted)' }}>No one to show.</div>}
        {shown.map((u) => {
          const on = selected.includes(u.id);
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => onToggle(u.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px', border: 'none', borderBottom: '1px solid var(--tf-border)', background: on ? 'var(--tf-pearl)' : 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: 'var(--tf-text)' }}
            >
              <Avatar name={u.full_name || u.email} size={30} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 500 }}>{u.full_name || u.email}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--tf-muted)' }}>{u.role}</span>
              </span>
              <span style={{ width: 20, height: 20, borderRadius: 6, border: '1.5px solid var(--tf-border)', display: 'grid', placeItems: 'center', background: on ? 'var(--color-primary)' : 'transparent', color: '#fff', borderColor: on ? 'var(--color-primary)' : undefined }}>
                {on && <Check size={13} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const { profile } = useAuth();
  const meId = profile?.id;
  const orgId = profile?.org_id;

  const [members, setMembers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [unread, setUnread] = useState({});
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [mobileThread, setMobileThread] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [pending, setPending] = useState([]);
  const [highlightId, setHighlightId] = useState(null);
  const [dropActive, setDropActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupSel, setGroupSel] = useState([]);
  const [addSel, setAddSel] = useState([]);
  const [addHistory, setAddHistory] = useState(true);
  const [renameVal, setRenameVal] = useState('');
  const [busy, setBusy] = useState(false);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const activeRef = useRef(null);
  const pendingRef = useRef([]);
  const recorderRef = useRef(null);
  const recChunksRef = useRef([]);
  const recCancelRef = useRef(false);
  const fileRef = useRef(null);
  activeRef.current = activeId;
  pendingRef.current = pending;

  const memberById = useMemo(() => {
    const m = {};
    members.forEach((u) => { m[u.id] = u; });
    return m;
  }, [members]);

  const nameOf = useCallback((id) => {
    const u = memberById[id];
    return u?.full_name || u?.email || 'Unknown user';
  }, [memberById]);

  const loadMembers = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('org_id', orgId)
      .order('full_name', { ascending: true });
    setMembers(data || []);
  }, [orgId]);

  const loadConversations = useCallback(async ({ ensure = false } = {}) => {
    let generalId = null;
    if (ensure) {
      const { data, error: genErr } = await supabase.rpc('chat_ensure_general');
      if (genErr) throw genErr;
      generalId = data;
    }
    const [{ data: convs, error: convErr }, { data: counts }] = await Promise.all([
      supabase
        .from('chat_conversations')
        .select('id, type, name, last_message_at, chat_participants(user_id, role, history_from)')
        .order('last_message_at', { ascending: false }),
      supabase.rpc('chat_unread_counts'),
    ]);
    if (convErr) throw convErr;
    const list = convs || [];
    setConversations(list);
    const map = {};
    (counts || []).forEach((c) => { map[c.conversation_id] = Number(c.unread); });
    setUnread(map);
    const general = generalId || list.find((c) => c.type === 'group')?.id;
    setActiveId((cur) => {
      if (!cur) return general || null;
      // Dropped out of a group (removed / left): fall back to General.
      return list.some((c) => c.id === cur) ? cur : (general || null);
    });
  }, []);

  const loadMessages = useCallback(async (id) => {
    if (!id) return;
    const { data, error: msgErr } = await supabase
      .from('chat_messages')
      .select(MSG_COLS)
      .eq('conversation_id', id)
      .order('created_at', { ascending: false })
      .limit(MESSAGE_LIMIT);
    if (msgErr) { setError(msgErr.message); return; }
    if (activeRef.current === id) setMessages((data || []).reverse());
  }, []);

  const markRead = useCallback(async (id) => {
    if (!id) return;
    setUnread((u) => (u[id] ? { ...u, [id]: 0 } : u));
    await supabase.rpc('chat_mark_read', { conv: id });
  }, []);

  const clearPending = useCallback(() => {
    pendingRef.current.forEach((p) => p.url && URL.revokeObjectURL(p.url));
    setPending([]);
  }, []);

  useEffect(() => {
    if (!meId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        await Promise.all([loadMembers(), loadConversations({ ensure: true })]);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load chat.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [meId, loadMembers, loadConversations]);

  // Switching conversation.
  useEffect(() => {
    if (!activeId) return;
    setMessages([]);
    setEditingId(null);
    setReplyTo(null);
    setShowInfo(false);
    clearPending();
    loadMessages(activeId);
    markRead(activeId);
  }, [activeId, loadMessages, markRead, clearPending]);

  // Realtime (RLS limits events to what the user may see).
  useEffect(() => {
    if (!meId || import.meta.env.VITE_DISABLE_REALTIME === 'true') return undefined;
    const channel = supabase
      .channel(`taskflow:chat:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, ({ new: msg }) => {
        const own = msg.sender_id === meId;
        if (msg.conversation_id === activeRef.current) {
          setMessages((list) => (list.some((m) => m.id === msg.id) ? list : [...list, msg]));
          if (!own) markRead(msg.conversation_id);
        } else if (!own && msg.kind !== 'system') {
          setUnread((u) => ({ ...u, [msg.conversation_id]: (u[msg.conversation_id] || 0) + 1 }));
        }
        if (msg.kind === 'system') loadConversations().catch(() => {});
        setConversations((list) => {
          if (!list.some((c) => c.id === msg.conversation_id)) {
            loadConversations().catch(() => {});
            return list;
          }
          return list
            .map((c) => (c.id === msg.conversation_id ? { ...c, last_message_at: msg.created_at } : c))
            .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, ({ new: msg }) => {
        setMessages((list) => list.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, ({ old }) => {
        setMessages((list) => list.filter((m) => m.id !== old.id));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_participants' }, () => {
        loadConversations().catch(() => {});
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [meId, markRead, loadConversations]);

  useLiveRefresh(useCallback(() => {
    loadMessages(activeRef.current);
    loadConversations().catch(() => {});
  }, [loadMessages, loadConversations]), 6000);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, activeId]);

  useEffect(() => () => {
    pendingRef.current.forEach((p) => p.url && URL.revokeObjectURL(p.url));
  }, []);

  const active = conversations.find((c) => c.id === activeId);
  const peerIdOf = useCallback((conv) => conv?.chat_participants?.find((p) => p.user_id !== meId)?.user_id, [meId]);
  const titleOf = useCallback((conv) => {
    if (!conv) return '';
    if (conv.type === 'group' || conv.type === 'team') return conv.name || 'Group';
    return nameOf(peerIdOf(conv));
  }, [nameOf, peerIdOf]);

  const general = conversations.find((c) => c.type === 'group');
  const teams = conversations.filter((c) => c.type === 'team');
  const directs = conversations.filter((c) => c.type === 'direct');
  const myRole = active?.chat_participants?.find((p) => p.user_id === meId)?.role;
  const isTeamAdmin = active?.type === 'team' && myRole === 'admin';
  const messageById = useMemo(() => {
    const m = {};
    messages.forEach((x) => { m[x.id] = x; });
    return m;
  }, [messages]);

  function selectConversation(id) {
    setActiveId(id);
    setMobileThread(true);
    setSearch('');
    setText('');
  }

  async function openDm(userId) {
    setError('');
    setSearch('');
    setText('');
    setMobileThread(true);
    const existing = directs.find((c) => peerIdOf(c) === userId);
    if (existing) { setActiveId(existing.id); return; }
    const { data, error: dmErr } = await supabase.rpc('chat_get_or_create_dm', { other: userId });
    if (dmErr) { setError(dmErr.message); return; }
    setConversations((list) => (list.some((c) => c.id === data) ? list : [
      { id: data, type: 'direct', name: null, last_message_at: new Date().toISOString(),
        chat_participants: [{ user_id: meId }, { user_id: userId }] }, ...list]));
    setActiveId(data);
    loadConversations().catch(() => {});
  }

  async function insertMessage(fields) {
    const { data, error: sendErr } = await supabase
      .from('chat_messages')
      .insert({ conversation_id: activeId, org_id: orgId, sender_id: meId, ...fields })
      .select(MSG_COLS)
      .single();
    if (sendErr) { setError(sendErr.message); return null; }
    setMessages((list) => (list.some((m) => m.id === data.id) ? list : [...list, data]));
    return data;
  }

  async function uploadAndSend(item, caption, replyId) {
    const { file, name } = item;
    const safe = (name || file.name || 'file').replace(/[^\w.\-]+/g, '_').slice(-80);
    const path = `${activeId}/${crypto.randomUUID()}-${safe}`;
    const { error: upErr } = await supabase.storage.from('chat-files').upload(path, file, { contentType: file.type || undefined });
    if (upErr) { setError(upErr.message); return false; }
    const sent = await insertMessage({
      body: caption || '', reply_to_id: replyId || null, attachment_path: path,
      attachment_name: name || file.name || safe,
      attachment_type: file.type || 'application/octet-stream', attachment_size: file.size,
    });
    return !!sent;
  }

  async function send(event) {
    event?.preventDefault();
    if (sending || !activeId) return;
    const body = text.trim();
    setError('');

    if (editingId) {
      if (!body) return;
      setSending(true);
      const edited_at = new Date().toISOString();
      const { error: updErr } = await supabase.from('chat_messages').update({ body, edited_at }).eq('id', editingId);
      setSending(false);
      if (updErr) { setError(updErr.message); return; }
      setMessages((list) => list.map((m) => (m.id === editingId ? { ...m, body, edited_at } : m)));
      setEditingId(null);
      setText('');
      return;
    }

    if (pending.length) {
      setSending(true);
      const queue = [...pending];
      let first = true;
      for (const item of queue) {
        const ok = await uploadAndSend(item, first ? body : '', first ? replyTo?.id : null);
        if (!ok) { setSending(false); return; }
        first = false;
        if (item.url) URL.revokeObjectURL(item.url);
        setPending((list) => list.filter((p) => p.id !== item.id));
      }
      setSending(false);
      setText('');
      setReplyTo(null);
      return;
    }

    if (!body || /^\/\S*$/.test(body)) return;
    setSending(true);
    const sent = await insertMessage({ body, reply_to_id: replyTo?.id || null });
    setSending(false);
    if (sent) { setText(''); setReplyTo(null); }
  }

  function stageFiles(files) {
    const staged = [];
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) { setError(`"${file.name}" is larger than 50 MB.`); continue; }
      staged.push({
        id: crypto.randomUUID(), file, name: file.name,
        url: /^(image|audio|video)\//.test(file.type) ? URL.createObjectURL(file) : null,
      });
    }
    if (staged.length) { setEditingId(null); setPending((list) => [...list, ...staged]); }
    inputRef.current?.focus();
  }

  function removePending(id) {
    setPending((list) => {
      const hit = list.find((p) => p.id === id);
      if (hit?.url) URL.revokeObjectURL(hit.url);
      return list.filter((p) => p.id !== id);
    });
  }

  async function startRecording() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Recording is not supported in this browser (it needs HTTPS or localhost).');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      recChunksRef.current = [];
      recCancelRef.current = false;
      rec.ondataavailable = (e) => { if (e.data.size) recChunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        if (recCancelRef.current || !recChunksRef.current.length) return;
        const type = rec.mimeType || 'audio/webm';
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        const blob = new Blob(recChunksRef.current, { type });
        stageFiles([new File([blob], `Voice message.${ext}`, { type })]);
      };
      recorderRef.current = rec;
      rec.start();
      setRecSeconds(0);
      setRecording(true);
    } catch {
      setError('Microphone access was denied.');
    }
  }

  function stopRecording(cancel = false) {
    recCancelRef.current = cancel;
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }

  useEffect(() => {
    if (!recording) return undefined;
    const t = window.setInterval(() => setRecSeconds((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [recording]);

  useEffect(() => () => stopRecording(true), []); // eslint-disable-line react-hooks/exhaustive-deps

  function startReply(m) {
    if (m.kind === 'system') return;
    setEditingId(null);
    setReplyTo(m);
    inputRef.current?.focus();
  }

  function startEdit(m) {
    clearPending();
    setReplyTo(null);
    setEditingId(m.id);
    setText(m.body);
    inputRef.current?.focus();
  }

  function cancelEdit() {
    setEditingId(null);
    setText('');
  }

  async function removeMessage(id) {
    setMessages((list) => list.filter((m) => m.id !== id));
    const { error: delErr } = await supabase.from('chat_messages').delete().eq('id', id);
    if (delErr) { setError(delErr.message); loadMessages(activeId); }
  }

  function jumpTo(id) {
    const el = document.getElementById(`chatmsg-${id}`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setHighlightId(id);
    window.setTimeout(() => setHighlightId(null), 1300);
  }

  async function createGroup() {
    if (busy) return;
    setBusy(true);
    setError('');
    const { data, error: gErr } = await supabase.rpc('chat_create_group', { p_name: groupName, p_members: groupSel });
    setBusy(false);
    if (gErr) { setError(gErr.message); return; }
    setShowCreate(false);
    setGroupName('');
    setGroupSel([]);
    await loadConversations();
    selectConversation(data);
  }

  async function addMembers() {
    if (busy || !addSel.length) return;
    setBusy(true);
    const { error: aErr } = await supabase.rpc('chat_add_members', { conv: activeId, p_members: addSel, p_show_history: addHistory });
    setBusy(false);
    if (aErr) { setError(aErr.message); return; }
    setAddSel([]);
    await loadConversations();
    loadMessages(activeId);
  }

  async function removeMember(userId) {
    setBusy(true);
    const { error: rErr } = await supabase.rpc('chat_remove_member', { conv: activeId, p_user: userId });
    setBusy(false);
    if (rErr) { setError(rErr.message); return; }
    if (userId === meId) {
      setShowInfo(false);
      setMobileThread(false);
    }
    await loadConversations();
    loadMessages(activeId);
  }

  async function renameGroup() {
    const val = renameVal.trim();
    if (!val || val === active?.name) return;
    setBusy(true);
    const { error: rnErr } = await supabase.rpc('chat_rename_group', { conv: activeId, p_name: val });
    setBusy(false);
    if (rnErr) { setError(rnErr.message); return; }
    await loadConversations();
    loadMessages(activeId);
  }

  const slashQuery = !pending.length && !editingId ? /^\/(\S*)$/.exec(text)?.[1] : undefined;
  const slashMatches = slashQuery === undefined
    ? []
    : members.filter((u) => u.id !== meId && (u.full_name || u.email || '').toLowerCase().includes(slashQuery.toLowerCase())).slice(0, 6);

  const people = members.filter((u) => u.id !== meId
    && (u.full_name || u.email || '').toLowerCase().includes(search.trim().toLowerCase()));
  const others = members.filter((u) => u.id !== meId);
  const activeMemberIds = new Set((active?.chat_participants || []).map((p) => p.user_id));
  const addable = members.filter((u) => !activeMemberIds.has(u.id));

  const rowStyle = (isActive) => ({
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px',
    border: 'none', borderRadius: 11, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
    background: isActive ? 'var(--tf-pearl)' : 'transparent', color: 'var(--tf-text)',
  });
  const sectionLabel = { fontSize: 11, fontWeight: 600, color: 'var(--tf-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' };
  const badge = (n) => n > 0 && (
    <span style={{ marginLeft: 'auto', minWidth: 18, padding: '1px 6px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', fontSize: 11, fontWeight: 600, textAlign: 'center' }}>{n}</span>
  );
  const fieldStyle = { width: '100%', padding: '9px 12px', border: '1px solid var(--tf-border)', borderRadius: 10, background: 'var(--tf-page)', color: 'var(--tf-text)', font: 'inherit', fontSize: 14 };

  const showList = !mobileThread;
  const composerDisabled = !active;

  return (
    <div className="tf-chat" style={{ display: 'flex', height: 'calc(100vh - 150px)', minHeight: 420, border: '1px solid var(--tf-border)', borderRadius: 18, overflow: 'hidden', background: 'var(--tf-panel)' }}>
      <style>{`
        .tf-chat-actions { opacity: 0; transition: opacity 120ms ease; }
        .tf-chat-msg:hover .tf-chat-actions, .tf-chat-msg:focus-within .tf-chat-actions { opacity: 1; }
        @media (hover: none) { .tf-chat-actions { opacity: 0.7; } }
        @media (max-width: 760px) {
          .tf-chat-list { width: 100% !important; display: ${showList ? 'flex' : 'none'} !important; }
          .tf-chat-thread { display: ${showList ? 'none' : 'flex'} !important; }
        }
      `}</style>

      {/* Conversation list */}
      <div className="tf-chat-list" style={{ width: 290, flexShrink: 0, borderRight: '1px solid var(--tf-border)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: 12, borderBottom: '1px solid var(--tf-border)', display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--tf-muted)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a person…"
              aria-label="Find a person"
              style={{ ...fieldStyle, padding: '8px 10px 8px 30px' }}
            />
          </div>
          <button type="button" className="btn btn-primary btn-sm btn-icon" title="Create group" aria-label="Create group" onClick={() => setShowCreate(true)}>
            <Plus size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {search.trim() ? (
            <>
              <div style={{ ...sectionLabel, padding: '6px 10px' }}>People</div>
              {people.length === 0 && <div style={{ padding: '8px 10px', fontSize: 13, color: 'var(--tf-muted)' }}>No one found.</div>}
              {people.map((u) => (
                <button key={u.id} type="button" style={rowStyle(false)} onClick={() => openDm(u.id)}>
                  <Avatar name={u.full_name || u.email} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.full_name || u.email}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--tf-muted)' }}>Start private chat</span>
                  </span>
                  <MessageSquarePlus size={15} style={{ marginLeft: 'auto', color: 'var(--tf-muted)' }} />
                </button>
              ))}
            </>
          ) : (
            <>
              <div style={{ ...sectionLabel, padding: '6px 10px' }}>Everyone</div>
              {general && (
                <button type="button" style={rowStyle(activeId === general.id)} onClick={() => selectConversation(general.id)}>
                  <Avatar group />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{general.name || 'General'}</span>
                  {badge(unread[general.id])}
                </button>
              )}
              <div style={{ ...sectionLabel, padding: '14px 10px 6px' }}>Groups</div>
              {teams.length === 0 && (
                <div style={{ padding: '4px 10px', fontSize: 13, color: 'var(--tf-muted)', lineHeight: 1.45 }}>
                  Use <b>+</b> to create a group with chosen people.
                </div>
              )}
              {teams.map((c) => (
                <button key={c.id} type="button" style={rowStyle(activeId === c.id)} onClick={() => selectConversation(c.id)}>
                  <Avatar team />
                  <span style={{ fontSize: 14, fontWeight: unread[c.id] ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                  {badge(unread[c.id])}
                </button>
              ))}
              <div style={{ ...sectionLabel, padding: '14px 10px 6px' }}>Private chats</div>
              {directs.length === 0 && (
                <div style={{ padding: '4px 10px', fontSize: 13, color: 'var(--tf-muted)', lineHeight: 1.45 }}>
                  Search for a person above, or type <b>/name</b> in a chat, to start a private conversation.
                </div>
              )}
              {directs.map((c) => (
                <button key={c.id} type="button" style={rowStyle(activeId === c.id)} onClick={() => selectConversation(c.id)}>
                  <Avatar name={titleOf(c)} />
                  <span style={{ fontSize: 14, fontWeight: unread[c.id] ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleOf(c)}</span>
                  {badge(unread[c.id])}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Thread */}
      <div
        className="tf-chat-thread"
        style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}
        onDragOver={(e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); setDropActive(true); } }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDropActive(false); }}
        onDrop={(e) => {
          if (!e.dataTransfer?.files?.length) return;
          e.preventDefault();
          setDropActive(false);
          if (active && !recording) stageFiles(Array.from(e.dataTransfer.files));
        }}
      >
        {dropActive && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'grid', placeItems: 'center', background: 'rgba(86,69,212,0.12)', border: '2px dashed var(--color-primary)', borderRadius: 14, color: 'var(--color-primary)', fontWeight: 600, pointerEvents: 'none' }}>
            Drop files to preview &amp; send
          </div>
        )}

        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--tf-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Back to chats" onClick={() => setMobileThread(false)} style={{ display: showList ? 'none' : undefined }}>
            <ArrowLeft size={16} />
          </button>
          {active && <Avatar name={titleOf(active)} group={active.type === 'group'} team={active.type === 'team'} />}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--tf-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{active ? titleOf(active) : 'Chat'}</div>
            <div style={{ fontSize: 12, color: 'var(--tf-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              {active?.type === 'direct' && <><Lock size={11} /> Private — only you two can see this</>}
              {active?.type === 'group' && 'Everyone in your organization'}
              {active?.type === 'team' && `${active.chat_participants?.length || 0} members`}
            </div>
          </div>
          {active?.type === 'team' && (
            <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Group info" title="Group info" onClick={() => { setRenameVal(active.name || ''); setShowInfo(true); }}>
              <Info size={17} />
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {loading && <div className="spinner" style={{ width: 20, height: 20, margin: 'auto' }} />}
          {!loading && messages.length === 0 && (
            <div style={{ margin: 'auto', color: 'var(--tf-muted)', fontSize: 14 }}>No messages yet. Say hello 👋</div>
          )}
          {messages.map((m, i) => {
            if (m.kind === 'system') {
              return (
                <div key={m.id} style={{ alignSelf: 'center', margin: '8px 0', padding: '4px 12px', borderRadius: 10, background: 'var(--tf-pearl)', color: 'var(--tf-muted)', fontSize: 12, textAlign: 'center' }}>
                  <b>{m.sender_id === meId ? 'You' : nameOf(m.sender_id)}</b> {m.body}
                </div>
              );
            }
            const mine = m.sender_id === meId;
            const prev = messages[i - 1];
            const quoted = m.reply_to_id ? messageById[m.reply_to_id] : null;
            return (
              <MessageRow
                key={m.id}
                msg={m}
                mine={mine}
                showName={!mine && active?.type !== 'direct' && (prev?.sender_id !== m.sender_id || prev?.kind === 'system')}
                senderName={nameOf(m.sender_id)}
                quoted={quoted}
                quotedName={quoted ? (quoted.sender_id === meId ? 'You' : nameOf(quoted.sender_id)) : ''}
                highlighted={highlightId === m.id}
                onReply={startReply}
                onEdit={startEdit}
                onDelete={removeMessage}
                onJumpTo={jumpTo}
              />
            );
          })}
          <div ref={bottomRef} />
        </div>

        {error && <div style={{ padding: '6px 16px', fontSize: 13, color: 'var(--status-danger)' }}>{error}</div>}

        {/* Reply / edit banner */}
        {(replyTo || editingId) && (
          <div style={{ padding: '8px 14px', borderTop: '1px solid var(--tf-border)', background: 'var(--tf-pearl)', display: 'flex', alignItems: 'center', gap: 10 }}>
            {editingId ? <Pencil size={15} color="var(--color-primary)" /> : <Reply size={15} color="var(--color-primary)" />}
            <div style={{ minWidth: 0, flex: 1, borderLeft: '3px solid var(--color-primary)', paddingLeft: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)' }}>
                {editingId ? 'Editing message' : `Replying to ${replyTo.sender_id === meId ? 'yourself' : nameOf(replyTo.sender_id)}`}
              </div>
              {replyTo && (
                <div style={{ fontSize: 13, color: 'var(--tf-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {replyTo.body || attachmentLabel(replyTo)}
                </div>
              )}
            </div>
            <button type="button" aria-label="Cancel" onClick={() => (editingId ? cancelEdit() : setReplyTo(null))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--tf-muted)' }}><X size={16} /></button>
          </div>
        )}

        {/* Attachment preview — nothing is sent until the user confirms. */}
        {pending.length > 0 && (
          <div style={{ padding: 12, borderTop: '1px solid var(--tf-border)', background: 'var(--tf-pearl)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tf-muted)', marginBottom: 8 }}>
              Ready to send {pending.length} {pending.length === 1 ? 'attachment' : 'attachments'} — add a caption below, then press Send
            </div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {pending.map((p) => {
                const type = p.file.type || '';
                return (
                  <div key={p.id} style={{ position: 'relative', flexShrink: 0, minWidth: 120, maxWidth: 240, padding: 8, borderRadius: 12, border: '1px solid var(--tf-border)', background: 'var(--tf-panel)' }}>
                    <button type="button" aria-label={`Remove ${p.name}`} onClick={() => removePending(p.id)} style={{ position: 'absolute', top: 4, right: 4, zIndex: 2, width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(10,21,48,0.65)', color: '#fff', display: 'grid', placeItems: 'center' }}>
                      <X size={13} />
                    </button>
                    {type.startsWith('image/') && <img src={p.url} alt={p.name} style={{ display: 'block', maxHeight: 150, maxWidth: 224, borderRadius: 8 }} />}
                    {type.startsWith('video/') && <video src={p.url} controls style={{ display: 'block', maxHeight: 150, maxWidth: 224, borderRadius: 8 }} />}
                    {type.startsWith('audio/') && (
                      <div style={{ paddingTop: 14 }}>
                        <audio src={p.url} controls style={{ maxWidth: 220 }} />
                      </div>
                    )}
                    {!/^(image|video|audio)\//.test(type) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 18 }}>
                        <FileText size={28} color="var(--color-primary)" />
                      </div>
                    )}
                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--tf-text)', overflowWrap: 'anywhere' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--tf-muted)' }}>{formatSize(p.file.size)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <form onSubmit={send} style={{ position: 'relative', padding: 12, borderTop: '1px solid var(--tf-border)', display: 'flex', gap: 8, alignItems: 'center' }}>
          {slashMatches.length > 0 && (
            <div style={{ position: 'absolute', left: 12, right: 12, bottom: '100%', background: 'var(--tf-panel)', border: '1px solid var(--tf-border)', borderRadius: 12, padding: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 5 }}>
              <div style={{ fontSize: 11, color: 'var(--tf-muted)', padding: '4px 8px' }}>Start a private chat with…</div>
              {slashMatches.map((u) => (
                <button key={u.id} type="button" style={rowStyle(false)} onClick={() => openDm(u.id)}>
                  <Avatar name={u.full_name || u.email} size={28} />
                  <span style={{ fontSize: 14 }}>{u.full_name || u.email}</span>
                </button>
              ))}
            </div>
          )}
          <input ref={fileRef} type="file" multiple onChange={(e) => { stageFiles(Array.from(e.target.files || [])); e.target.value = ''; }} style={{ display: 'none' }} />
          {recording ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', border: '1px solid var(--status-danger)', borderRadius: 12, fontSize: 14 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--status-danger)' }} />
              Recording… {Math.floor(recSeconds / 60)}:{String(recSeconds % 60).padStart(2, '0')}
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => stopRecording(true)}>Cancel</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => stopRecording(false)}><Square size={13} /> Done</button>
            </div>
          ) : (
            <>
              <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Attach file" title="Attach file" disabled={composerDisabled || sending || !!editingId} onClick={() => fileRef.current?.click()}>
                <Paperclip size={16} />
              </button>
              <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Record voice message" title="Record voice message" disabled={composerDisabled || sending || !!editingId} onClick={startRecording}>
                <Mic size={16} />
              </button>
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    if (editingId) cancelEdit();
                    else if (replyTo) setReplyTo(null);
                  }
                }}
                placeholder={pending.length ? 'Add a caption…' : active?.type === 'direct' ? `Message ${titleOf(active)}` : 'Message — or type /name for a private chat'}
                aria-label="Message"
                maxLength={4000}
                disabled={composerDisabled}
                style={{ ...fieldStyle, flex: 1, width: 'auto', padding: '10px 14px', borderRadius: 12 }}
              />
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={(!text.trim() && !pending.length) || sending || composerDisabled}
                aria-label={editingId ? 'Save edit' : 'Send message'}
              >
                {sending ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Send size={15} />}
              </button>
            </>
          )}
        </form>
      </div>

      {/* Create group */}
      {showCreate && (
        <Modal title="Create group" onClose={() => setShowCreate(false)}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tf-muted)', marginBottom: 6 }}>Group name</label>
          <input value={groupName} onChange={(e) => setGroupName(e.target.value)} maxLength={80} placeholder="e.g. Design team" aria-label="Group name" style={{ ...fieldStyle, marginBottom: 14 }} autoFocus />
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tf-muted)', marginBottom: 6 }}>
            Members ({groupSel.length} selected) — you are added automatically as admin
          </label>
          <MemberPicker people={others} selected={groupSel} onToggle={(id) => setGroupSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
            <button type="button" className="btn btn-primary btn-sm" disabled={!groupName.trim() || busy} onClick={createGroup}>
              {busy ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Create group'}
            </button>
          </div>
        </Modal>
      )}

      {/* Group info */}
      {showInfo && active?.type === 'team' && (
        <Modal title="Group info" onClose={() => setShowInfo(false)} width={480}>
          {isTeamAdmin ? (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input value={renameVal} onChange={(e) => setRenameVal(e.target.value)} maxLength={80} aria-label="Group name" style={fieldStyle} />
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy || !renameVal.trim() || renameVal.trim() === active.name} onClick={renameGroup}>Rename</button>
            </div>
          ) : (
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--tf-text)', marginBottom: 16 }}>{active.name}</div>
          )}

          <div style={{ ...sectionLabel, marginBottom: 6 }}>{active.chat_participants.length} members</div>
          <div style={{ border: '1px solid var(--tf-border)', borderRadius: 12, marginBottom: 16 }}>
            {active.chat_participants.map((p) => (
              <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid var(--tf-border)' }}>
                <Avatar name={nameOf(p.user_id)} size={30} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--tf-text)' }}>
                  {nameOf(p.user_id)}{p.user_id === meId && ' (you)'}
                  {p.history_from && <span style={{ display: 'block', fontSize: 11, color: 'var(--tf-muted)' }}>Joined {timeLabel(p.history_from)} · earlier history hidden</span>}
                </span>
                {p.role === 'admin' && <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--color-primary)', fontWeight: 600 }}><Crown size={12} /> Admin</span>}
                {isTeamAdmin && p.user_id !== meId && (
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => removeMember(p.user_id)}>Remove</button>
                )}
              </div>
            ))}
          </div>

          {isTeamAdmin && (
            <>
              <div style={{ ...sectionLabel, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><UserPlus size={13} /> Add members</div>
              {addable.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--tf-muted)', marginBottom: 16 }}>Everyone in your organization is already in this group.</div>
              ) : (
                <>
                  <MemberPicker people={addable} selected={addSel} onToggle={(id) => setAddSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))} />
                  <div style={{ margin: '12px 0', display: 'grid', gap: 8 }}>
                    {[
                      { v: true, t: 'Show previous chat history', d: 'New members can read everything sent before they joined.' },
                      { v: false, t: 'Hide previous chat history', d: 'New members only see messages sent after they join.' },
                    ].map((o) => (
                      <label key={String(o.v)} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 10, border: `1px solid ${addHistory === o.v ? 'var(--color-primary)' : 'var(--tf-border)'}`, cursor: 'pointer' }}>
                        <input type="radio" name="chat-add-history" checked={addHistory === o.v} onChange={() => setAddHistory(o.v)} style={{ marginTop: 3 }} />
                        <span>
                          <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--tf-text)' }}>{o.t}</span>
                          <span style={{ display: 'block', fontSize: 12, color: 'var(--tf-muted)' }}>{o.d}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <button type="button" className="btn btn-primary btn-sm" disabled={!addSel.length || busy} onClick={addMembers}>
                    {busy ? <span className="spinner" style={{ width: 14, height: 14 }} /> : `Add ${addSel.length || ''} ${addSel.length === 1 ? 'member' : 'members'}`}
                  </button>
                </>
              )}
            </>
          )}

          <div style={{ marginTop: 20, borderTop: '1px solid var(--tf-border)', paddingTop: 14 }}>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => removeMember(meId)} style={{ color: 'var(--status-danger)' }}>
              <LogOut size={14} /> Leave group
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
