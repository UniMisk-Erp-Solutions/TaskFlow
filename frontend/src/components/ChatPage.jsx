import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Hash, Lock, Search, Send, Trash2, ArrowLeft, MessageSquarePlus, Paperclip, Mic, Square, Pencil, X, FileText, Download } from 'lucide-react';
import supabase from '../supabaseClient';
import { useAuth } from '../AuthContext';
import { useLiveRefresh } from '../useRealtime';

const MESSAGE_LIMIT = 300;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MSG_COLS = 'id, conversation_id, sender_id, body, created_at, edited_at, attachment_path, attachment_name, attachment_type, attachment_size';

function formatSize(n) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
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

function initials(name) {
  return (name || '?').trim()[0]?.toUpperCase() || '?';
}

function timeLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return time;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}

function Avatar({ name, size = 34, group = false }) {
  return (
    <span
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        display: 'grid', placeItems: 'center', fontSize: size * 0.4, fontWeight: 600,
        background: group ? 'var(--color-primary)' : 'var(--tf-pearl)',
        color: group ? '#fff' : 'var(--tf-text)',
        border: '1px solid var(--tf-border)',
      }}
    >
      {group ? <Hash size={size * 0.5} /> : initials(name)}
    </span>
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
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const recorderRef = useRef(null);
  const recChunksRef = useRef([]);
  const recCancelRef = useRef(false);
  const fileRef = useRef(null);
  const bottomRef = useRef(null);
  const activeRef = useRef(null);
  activeRef.current = activeId;

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
        .select('id, type, name, last_message_at, chat_participants(user_id)')
        .order('last_message_at', { ascending: false }),
      supabase.rpc('chat_unread_counts'),
    ]);
    if (convErr) throw convErr;
    setConversations(convs || []);
    const map = {};
    (counts || []).forEach((c) => { map[c.conversation_id] = Number(c.unread); });
    setUnread(map);
    if (generalId) setActiveId((cur) => cur || generalId);
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

  // Initial load.
  useEffect(() => {
    if (!meId) return;
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
    loadMessages(activeId);
    markRead(activeId);
  }, [activeId, loadMessages, markRead]);

  // Realtime: new / deleted messages (RLS limits events to conversations the user can see).
  useEffect(() => {
    if (!meId || import.meta.env.VITE_DISABLE_REALTIME === 'true') return undefined;
    const channel = supabase
      .channel(`taskflow:chat:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, ({ new: msg }) => {
        if (msg.conversation_id === activeRef.current) {
          setMessages((list) => (list.some((m) => m.id === msg.id) ? list : [...list, msg]));
          if (msg.sender_id !== meId) markRead(msg.conversation_id);
        } else if (msg.sender_id !== meId) {
          setUnread((u) => ({ ...u, [msg.conversation_id]: (u[msg.conversation_id] || 0) + 1 }));
        }
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
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [meId, markRead, loadConversations]);

  // Safety net when websockets are unavailable.
  useLiveRefresh(useCallback(() => {
    loadMessages(activeRef.current);
    loadConversations().catch(() => {});
  }, [loadMessages, loadConversations]), 6000);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, activeId]);

  const active = conversations.find((c) => c.id === activeId);
  const peerIdOf = useCallback((conv) => conv?.chat_participants?.find((p) => p.user_id !== meId)?.user_id, [meId]);
  const titleOf = useCallback((conv) => {
    if (!conv) return '';
    if (conv.type === 'group') return conv.name || 'General';
    return nameOf(peerIdOf(conv));
  }, [nameOf, peerIdOf]);

  const general = conversations.find((c) => c.type === 'group');
  const directs = conversations.filter((c) => c.type === 'direct');

  async function openDm(userId) {
    setError('');
    setSearch('');
    setText('');
    setEditingId(null);
    setMobileThread(true);
    // Reuse an already-loaded private chat instantly.
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

  async function send(event) {
    event?.preventDefault();
    const body = text.trim();
    if (!body || !activeId || sending || /^\/\S*$/.test(body)) return;
    setSending(true);
    setError('');
    if (editingId) {
      const edited_at = new Date().toISOString();
      const { error: updErr } = await supabase.from('chat_messages').update({ body, edited_at }).eq('id', editingId);
      setSending(false);
      if (updErr) { setError(updErr.message); return; }
      setMessages((list) => list.map((m) => (m.id === editingId ? { ...m, body, edited_at } : m)));
      setEditingId(null);
      setText('');
      return;
    }
    const sent = await insertMessage({ body });
    setSending(false);
    if (sent) setText('');
  }

  async function uploadAndSend(file, name) {
    if (!file || !activeId) return;
    if (file.size > MAX_FILE_BYTES) { setError('Files must be 50 MB or smaller.'); return; }
    setSending(true);
    setError('');
    const safe = (name || file.name || 'file').replace(/[^\w.\-]+/g, '_').slice(-80);
    const path = `${activeId}/${crypto.randomUUID()}-${safe}`;
    const { error: upErr } = await supabase.storage.from('chat-files').upload(path, file, { contentType: file.type || undefined });
    if (upErr) { setSending(false); setError(upErr.message); return; }
    await insertMessage({
      body: '', attachment_path: path, attachment_name: name || file.name || safe,
      attachment_type: file.type || 'application/octet-stream', attachment_size: file.size,
    });
    setSending(false);
  }

  function onPickFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    files.reduce((p, f) => p.then(() => uploadAndSend(f)), Promise.resolve());
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
        if (recCancelRef.current) return;
        const type = rec.mimeType || 'audio/webm';
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        const blob = new Blob(recChunksRef.current, { type });
        uploadAndSend(new File([blob], `voice-${Date.now()}.${ext}`, { type }), `Voice message.${ext}`);
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

  function startEdit(m) {
    setEditingId(m.id);
    setText(m.body);
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

  // "/name" in the composer opens a picker of people to start a private chat with.
  const slashQuery = /^\/(\S*)$/.exec(text)?.[1];
  const slashMatches = slashQuery === undefined
    ? []
    : members.filter((u) => u.id !== meId && (u.full_name || u.email || '').toLowerCase().includes(slashQuery.toLowerCase())).slice(0, 6);

  const people = members.filter((u) => u.id !== meId
    && (u.full_name || u.email || '').toLowerCase().includes(search.trim().toLowerCase()));

  const rowStyle = (isActive) => ({
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 10px',
    border: 'none', borderRadius: 11, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
    background: isActive ? 'var(--tf-pearl)' : 'transparent', color: 'var(--tf-text)',
  });

  const badge = (n) => n > 0 && (
    <span style={{ marginLeft: 'auto', minWidth: 18, padding: '1px 6px', borderRadius: 9, background: 'var(--color-primary)', color: '#fff', fontSize: 11, fontWeight: 600, textAlign: 'center' }}>{n}</span>
  );

  const showList = !mobileThread;

  return (
    <div className="tf-chat" style={{ display: 'flex', height: 'calc(100vh - 150px)', minHeight: 420, border: '1px solid var(--tf-border)', borderRadius: 18, overflow: 'hidden', background: 'var(--tf-panel)' }}>
      <style>{`
        @media (max-width: 760px) {
          .tf-chat-list { width: 100% !important; display: ${showList ? 'flex' : 'none'} !important; }
          .tf-chat-thread { display: ${showList ? 'none' : 'flex'} !important; }
        }
      `}</style>

      {/* Conversation list */}
      <div className="tf-chat-list" style={{ width: 290, flexShrink: 0, borderRight: '1px solid var(--tf-border)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: 12, borderBottom: '1px solid var(--tf-border)' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--tf-muted)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a person to chat with…"
              aria-label="Find a person"
              style={{ width: '100%', padding: '8px 10px 8px 30px', border: '1px solid var(--tf-border)', borderRadius: 10, background: 'var(--tf-page)', color: 'var(--tf-text)', font: 'inherit', fontSize: 14 }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {search.trim() ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tf-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '6px 10px' }}>People</div>
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
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tf-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '6px 10px' }}>Group</div>
              {general && (
                <button type="button" style={rowStyle(activeId === general.id)} onClick={() => { setActiveId(general.id); setMobileThread(true); }}>
                  <Avatar group />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{general.name || 'General'}</span>
                  {badge(unread[general.id])}
                </button>
              )}
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tf-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '14px 10px 6px' }}>Private chats</div>
              {directs.length === 0 && (
                <div style={{ padding: '4px 10px', fontSize: 13, color: 'var(--tf-muted)', lineHeight: 1.45 }}>
                  Search for a person above, or type <b>/name</b> in the group chat, to start a private conversation.
                </div>
              )}
              {directs.map((c) => (
                <button key={c.id} type="button" style={rowStyle(activeId === c.id)} onClick={() => { setActiveId(c.id); setMobileThread(true); }}>
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
      <div className="tf-chat-thread" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--tf-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" className="btn btn-ghost btn-sm btn-icon tf-chat-back" aria-label="Back to chats" onClick={() => setMobileThread(false)} style={{ display: showList ? 'none' : undefined }}>
            <ArrowLeft size={16} />
          </button>
          {active && <Avatar name={titleOf(active)} group={active.type === 'group'} />}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--tf-text)' }}>{active ? titleOf(active) : 'Chat'}</div>
            <div style={{ fontSize: 12, color: 'var(--tf-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              {active?.type === 'direct'
                ? <><Lock size={11} /> Private — only you two can see this</>
                : 'Everyone in your organization'}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {loading && <div className="spinner" style={{ width: 20, height: 20, margin: 'auto' }} />}
          {!loading && messages.length === 0 && (
            <div style={{ margin: 'auto', color: 'var(--tf-muted)', fontSize: 14 }}>No messages yet. Say hello 👋</div>
          )}
          {messages.map((m, i) => {
            const mine = m.sender_id === meId;
            const prev = messages[i - 1];
            const showName = !mine && active?.type === 'group' && prev?.sender_id !== m.sender_id;
            return (
              <div key={m.id} className="tf-chat-msg" style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '75%', display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                {showName && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', margin: '6px 4px 2px' }}>{nameOf(m.sender_id)}</span>}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexDirection: mine ? 'row-reverse' : 'row' }}>
                  <div
                    style={{
                      padding: '8px 12px', borderRadius: 14, fontSize: 14, lineHeight: 1.45,
                      whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
                      background: mine ? 'var(--color-primary)' : 'var(--tf-pearl)',
                      color: mine ? '#fff' : 'var(--tf-text)',
                      border: mine ? 'none' : '1px solid var(--tf-border)',
                    }}
                  >
                    {m.attachment_path && <Attachment msg={m} />}
                    {m.body}
                    {m.edited_at && <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 6 }}>(edited)</span>}
                  </div>
                  {mine && !m.attachment_path && (
                    <button type="button" aria-label="Edit message" title="Edit" onClick={() => startEdit(m)} style={{ border: 'none', background: 'transparent', color: 'var(--tf-muted)', cursor: 'pointer', padding: 2, opacity: 0.6 }}>
                      <Pencil size={13} />
                    </button>
                  )}
                  {mine && (
                    <button type="button" aria-label="Delete message" title="Delete" onClick={() => removeMessage(m.id)} style={{ border: 'none', background: 'transparent', color: 'var(--tf-muted)', cursor: 'pointer', padding: 2, opacity: 0.6 }}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <span style={{ fontSize: 11, color: 'var(--tf-muted)', margin: '2px 4px 0' }}>{timeLabel(m.created_at)}</span>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {error && <div style={{ padding: '6px 16px', fontSize: 13, color: 'var(--status-danger)' }}>{error}</div>}

        <form onSubmit={send} style={{ position: 'relative', padding: 12, borderTop: '1px solid var(--tf-border)', display: 'flex', gap: 8 }}>
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
          {editingId && (
            <div style={{ position: 'absolute', left: 12, bottom: '100%', right: 12, padding: '6px 10px', fontSize: 12, color: 'var(--tf-muted)', display: 'flex', alignItems: 'center', gap: 6, background: 'var(--tf-pearl)', borderTop: '1px solid var(--tf-border)' }}>
              <Pencil size={12} /> Editing message
              <button type="button" onClick={cancelEdit} aria-label="Cancel edit" style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', color: 'inherit' }}><X size={14} /></button>
            </div>
          )}
          <input ref={fileRef} type="file" multiple onChange={onPickFiles} style={{ display: 'none' }} />
          {recording ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', border: '1px solid var(--status-danger)', borderRadius: 12, fontSize: 14 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--status-danger)' }} />
              Recording… {Math.floor(recSeconds / 60)}:{String(recSeconds % 60).padStart(2, '0')}
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => stopRecording(true)}>Cancel</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => stopRecording(false)}><Square size={13} /> Send</button>
            </div>
          ) : (
            <>
              <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Attach file" title="Attach file" disabled={!active || sending || !!editingId} onClick={() => fileRef.current?.click()}>
                <Paperclip size={16} />
              </button>
              <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Record voice message" title="Record voice message" disabled={!active || sending || !!editingId} onClick={startRecording}>
                <Mic size={16} />
              </button>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape' && editingId) cancelEdit(); }}
                placeholder={active?.type === 'direct' ? `Message ${titleOf(active)}` : 'Message everyone — or type /name for a private chat'}
                aria-label="Message"
                maxLength={4000}
                disabled={!active}
                style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--tf-border)', borderRadius: 12, background: 'var(--tf-page)', color: 'var(--tf-text)', font: 'inherit', fontSize: 14 }}
              />
              <button type="submit" className="btn btn-primary btn-sm" disabled={!text.trim() || sending || !active} aria-label={editingId ? 'Save edit' : 'Send message'}>
                <Send size={15} />
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
