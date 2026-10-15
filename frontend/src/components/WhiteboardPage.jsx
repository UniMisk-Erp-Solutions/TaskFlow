import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Excalidraw, reconcileElements, CaptureUpdateAction } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { Globe, Users, Plus, X } from 'lucide-react';
import supabase from '../supabaseClient';
import { useAuth } from '../AuthContext';
import { useTheme } from '../ThemeContext';

const BUCKET = 'whiteboard-files';
const SAVE_DEBOUNCE_MS = 1200;
const BROADCAST_MS = 60;
const POINTER_MS = 50;
const POINTER_TTL_MS = 8000;

const PALETTE = ['#e03131', '#2f9e44', '#1971c2', '#f08c00', '#9c36b5', '#0c8599', '#c2255c', '#5f3dc4'];
function colorFor(id) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const c = PALETTE[h % PALETTE.length];
  return { background: c, stroke: c };
}

/* ───────────────────────── Board (canvas) ───────────────────────── */

function sniffImageType(b, fallback) {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57) return 'image/webp';
  if (b[0] === 0x3c) return 'image/svg+xml';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp';
  return /^image\//.test(fallback || '') ? fallback : 'image/png';
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function Board({ boardId }) {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const [board, setBoard] = useState(null);
  const [error, setError] = useState('');
  const [online, setOnline] = useState(1);
  const [saveState, setSaveState] = useState('saved');

  const apiRef = useRef(null);
  const channelRef = useRef(null);
  const syncedRef = useRef(new Map());     // element id -> last version known to be shared
  const outboxRef = useRef(new Map());     // element id -> element waiting to broadcast
  const outboxTimer = useRef(null);
  const saveTimer = useRef(null);
  const dirtyRef = useRef(false);
  const uploadedRef = useRef(new Set());
  const fetchingRef = useRef(new Set());
  const pointersRef = useRef(new Map());
  const lastPointerSent = useRef(0);
  const readyRef = useRef(false);
  const meId = profile?.id;
  const meName = profile?.full_name || profile?.email || 'Someone';

  useEffect(() => {
    let alive = true;
    supabase.from('whiteboards').select('id, name, visibility, owner_id, scene').eq('id', boardId).maybeSingle()
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err || !data) { setError(err?.message || 'Board not found or you do not have access.'); return; }
        setBoard(data);
      });
    return () => { alive = false; };
  }, [boardId]);

  const initialData = useMemo(() => {
    if (!board) return null;
    const elements = Array.isArray(board.scene?.elements) ? board.scene.elements : [];
    elements.forEach((e) => syncedRef.current.set(e.id, e.version));
    return { elements, scrollToContent: true, appState: { theme } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board?.id]);

  const fetchMissingFiles = useCallback(async (elements, attempt = 0) => {
    const api = apiRef.current;
    if (!api) return;
    const have = api.getFiles();
    const missing = elements.filter((e) => e.type === 'image' && e.fileId && !e.isDeleted
      && !have[e.fileId] && !fetchingRef.current.has(e.fileId));
    if (!missing.length) return;
    const failed = [];
    await Promise.all(missing.map(async (e) => {
      fetchingRef.current.add(e.fileId);
      try {
        const { data, error: err } = await supabase.storage.from(BUCKET).download(`${boardId}/${e.fileId}`);
        if (err || !data) throw err || new Error('missing');
        // Storage may return a generic content-type; Excalidraw only accepts real image types,
        // so detect the type from the file's own bytes.
        const buf = await data.arrayBuffer();
        const mimeType = sniffImageType(new Uint8Array(buf.slice(0, 16)), data.type);
        const dataURL = await blobToDataURL(new Blob([buf], { type: mimeType }));
        api.addFiles([{ id: e.fileId, dataURL, mimeType, created: Date.now() }]);
        uploadedRef.current.add(e.fileId);
      } catch {
        failed.push(e);
      } finally {
        fetchingRef.current.delete(e.fileId);
      }
    }));
    if (failed.length && attempt < 10) {
      window.setTimeout(() => fetchMissingFiles(failed, attempt + 1), 1000 * (attempt + 1));
    }
  }, [boardId]);

  const save = useCallback(async () => {
    const api = apiRef.current;
    if (!api || !dirtyRef.current) return;
    dirtyRef.current = false;
    setSaveState('saving');
    const elements = api.getSceneElementsIncludingDeleted().filter((e) => !e.isDeleted);
    const { error: err } = await supabase.from('whiteboards').update({ scene: { elements } }).eq('id', boardId);
    if (err) { dirtyRef.current = true; setSaveState('error'); } else setSaveState(dirtyRef.current ? 'saving' : 'saved');
  }, [boardId]);

  const flushOutbox = useCallback(() => {
    outboxTimer.current = null;
    const channel = channelRef.current;
    if (!channel || !outboxRef.current.size) return;
    const elements = Array.from(outboxRef.current.values());
    outboxRef.current.clear();
    channel.send({ type: 'broadcast', event: 'scene', payload: { from: meId, elements } });
  }, [meId]);

  const uploadNewFiles = useCallback((files) => {
    Object.values(files || {}).forEach(async (f) => {
      if (!f?.id || uploadedRef.current.has(f.id)) return;
      uploadedRef.current.add(f.id);
      try {
        const blob = await (await fetch(f.dataURL)).blob();
        const { error: err } = await supabase.storage.from(BUCKET).upload(`${boardId}/${f.id}`, blob, { contentType: f.mimeType, upsert: false });
        if (err && !/exists|Duplicate/i.test(err.message)) uploadedRef.current.delete(f.id);
      } catch {
        uploadedRef.current.delete(f.id);
      }
    });
  }, [boardId]);

  // Realtime channel: scene diffs, pointers and presence.
  useEffect(() => {
    if (!board || !meId) return undefined;
    const channel = supabase.channel(`whiteboard:${boardId}`, {
      config: { broadcast: { self: false }, presence: { key: meId } },
    });
    channelRef.current = channel;

    channel.on('broadcast', { event: 'scene' }, ({ payload }) => {
      const api = apiRef.current;
      if (!api || !readyRef.current || payload.from === meId) return;
      const remote = payload.elements || [];
      const reconciled = reconcileElements(api.getSceneElementsIncludingDeleted(), remote, api.getAppState());
      remote.forEach((e) => syncedRef.current.set(e.id, e.version));
      api.updateScene({ elements: reconciled, captureUpdate: CaptureUpdateAction.NEVER });
      fetchMissingFiles(remote);
    });

    channel.on('broadcast', { event: 'pointer' }, ({ payload }) => {
      pointersRef.current.set(payload.id, { ...payload, at: Date.now() });
      const api = apiRef.current;
      if (!api) return;
      const collaborators = new Map();
      pointersRef.current.forEach((p, id) => {
        collaborators.set(id, { pointer: { x: p.x, y: p.y, tool: p.tool }, button: p.button, username: p.name, color: colorFor(id), id });
      });
      api.updateScene({ collaborators });
    });

    channel.on('presence', { event: 'sync' }, () => {
      setOnline(Object.keys(channel.presenceState()).length || 1);
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') channel.track({ name: meName });
    });

    const retryFiles = window.setInterval(() => {
      const api = apiRef.current;
      if (api) fetchMissingFiles(api.getSceneElements());
    }, 5000);

    const prune = window.setInterval(() => {
      const now = Date.now();
      let changed = false;
      pointersRef.current.forEach((p, id) => {
        if (now - p.at > POINTER_TTL_MS) { pointersRef.current.delete(id); changed = true; }
      });
      if (changed && apiRef.current) {
        const collaborators = new Map();
        pointersRef.current.forEach((p, id) => {
          collaborators.set(id, { pointer: { x: p.x, y: p.y, tool: p.tool }, button: p.button, username: p.name, color: colorFor(id), id });
        });
        apiRef.current.updateScene({ collaborators });
      }
    }, 2000);

    return () => {
      window.clearInterval(prune);
      window.clearInterval(retryFiles);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [board, boardId, meId, meName, fetchMissingFiles]);

  // Persist pending edits when leaving.
  useEffect(() => () => {
    window.clearTimeout(saveTimer.current);
    save();
  }, [save]);

  useEffect(() => {
    const onHide = () => { if (dirtyRef.current) save(); };
    window.addEventListener('beforeunload', onHide);
    return () => window.removeEventListener('beforeunload', onHide);
  }, [save]);

  const onChange = useCallback((elements, _appState, files) => {
    if (!readyRef.current) return;
    let changed = false;
    for (const el of elements) {
      if (syncedRef.current.get(el.id) !== el.version) {
        syncedRef.current.set(el.id, el.version);
        outboxRef.current.set(el.id, el);
        changed = true;
      }
    }
    uploadNewFiles(files);
    if (!changed) return;
    if (!outboxTimer.current) outboxTimer.current = window.setTimeout(flushOutbox, BROADCAST_MS);
    dirtyRef.current = true;
    setSaveState('saving');
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(save, SAVE_DEBOUNCE_MS);
  }, [flushOutbox, save, uploadNewFiles]);

  const onPointerUpdate = useCallback(({ pointer, button }) => {
    const now = Date.now();
    if (now - lastPointerSent.current < POINTER_MS || !channelRef.current) return;
    lastPointerSent.current = now;
    channelRef.current.send({
      type: 'broadcast', event: 'pointer',
      payload: { id: meId, name: meName, x: pointer.x, y: pointer.y, tool: pointer.tool, button },
    });
  }, [meId, meName]);

  const onApi = useCallback((api) => {
    apiRef.current = api;
    if (!api) return;
    readyRef.current = true;
    fetchMissingFiles(api.getSceneElements());
  }, [fetchMissingFiles]);

  if (error) {
    return (
      <div>
        <div style={{ color: 'var(--status-danger)' }}>{error}</div>
      </div>
    );
  }
  if (!board) return <div className="spinner" style={{ width: 22, height: 22 }} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 220px)', minHeight: 420 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--tf-muted)', padding: '3px 9px', border: '1px solid var(--tf-border)', borderRadius: 20 }}>
          <Globe size={12} /> Live for everyone
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--tf-muted)' }}>
          <Users size={13} /> {online} online
        </span>
        <span style={{ fontSize: 12, color: saveState === 'error' ? 'var(--status-danger)' : 'var(--tf-muted)' }}>
          {saveState === 'saved' ? 'All changes saved' : saveState === 'saving' ? 'Saving…' : 'Save failed — retrying on next change'}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0, border: '1px solid var(--tf-border)', borderRadius: 14, overflow: 'hidden' }}>
        <Excalidraw
          excalidrawAPI={onApi}
          initialData={initialData}
          onChange={onChange}
          onPointerUpdate={onPointerUpdate}
          isCollaborating
          theme={theme === 'dark' ? 'dark' : 'light'}
          name={board.name}
          UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false } }}
        />
      </div>
    </div>
  );
}

export default function WhiteboardPage() {
  const { profile } = useAuth();
  const [mainId, setMainId] = useState(null);
  const [screens, setScreens] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [error, setError] = useState('');
  const channelRef = useRef(null);
  const activeRef = useRef(null);
  activeRef.current = activeId;

  const loadScreens = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('whiteboards')
      .select('id, name, is_main, owner_id, created_at')
      .eq('visibility', 'public')
      .order('created_at', { ascending: true });
    if (err) { setError(err.message); return; }
    const list = data || [];
    setScreens(list);
    // The screen I was on was deleted by someone else: go back to the first one.
    setActiveId((cur) => (cur && list.some((b) => b.id === cur) ? cur : list[0]?.id || null));
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.rpc('wb_ensure_main').then(async ({ data, error: err }) => {
      if (!alive) return;
      if (err) { setError(err.message); return; }
      setMainId(data);
      await loadScreens();
      if (alive) setActiveId((cur) => cur || data);
    });
    return () => { alive = false; };
  }, [loadScreens]);

  // Everyone's screen list stays in sync (broadcast + slow poll as a safety net).
  useEffect(() => {
    if (!mainId) return undefined;
    const channel = supabase.channel(`whiteboard-screens:${mainId}`, { config: { broadcast: { self: false } } });
    channel.on('broadcast', { event: 'changed' }, () => loadScreens());
    channel.subscribe();
    channelRef.current = channel;
    const timer = window.setInterval(loadScreens, 15000);
    return () => {
      window.clearInterval(timer);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [mainId, loadScreens]);

  const announce = () => channelRef.current?.send({ type: 'broadcast', event: 'changed', payload: {} });

  async function addScreen() {
    const { data, error: err } = await supabase.rpc('wb_create_screen');
    if (err) { setError(err.message); return; }
    await loadScreens();
    setActiveId(data);
    announce();
  }

  async function removeScreen(screen) {
    if (!window.confirm(`Delete "${screen.name}" for everyone? Its drawing will be lost.`)) return;
    const { error: err } = await supabase.from('whiteboards').delete().eq('id', screen.id);
    if (err) { setError(err.message); return; }
    await loadScreens();
    announce();
  }

  if (error && !screens.length) return <div style={{ color: 'var(--status-danger)' }}>{error}</div>;
  if (!activeId) return <div className="spinner" style={{ width: 22, height: 22 }} />;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, overflowX: 'auto', paddingBottom: 2 }}>
        {screens.map((sc) => {
          const on = sc.id === activeId;
          const canDelete = !sc.is_main && sc.owner_id === profile?.id;
          return (
            <span key={sc.id} style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, borderRadius: 10, border: `1px solid ${on ? 'var(--color-primary)' : 'var(--tf-border)'}`, background: on ? 'var(--tf-pearl)' : 'transparent' }}>
              <button type="button" onClick={() => setActiveId(sc.id)} style={{ padding: '6px 12px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: on ? 600 : 500, color: on ? 'var(--color-primary)' : 'var(--tf-text)' }}>
                {sc.is_main ? 'Main' : sc.name}
              </button>
              {canDelete && (
                <button type="button" aria-label={`Delete ${sc.name}`} onClick={() => removeScreen(sc)} style={{ padding: '4px 6px 4px 0', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--tf-muted)' }}>
                  <X size={13} />
                </button>
              )}
            </span>
          );
        })}
        <button type="button" className="btn btn-primary btn-sm" onClick={addScreen} style={{ flexShrink: 0 }}>
          <Plus size={14} /> New screen
        </button>
      </div>
      {error && <div style={{ color: 'var(--status-danger)', fontSize: 13, marginBottom: 6 }}>{error}</div>}
      <Board key={activeId} boardId={activeId} />
    </div>
  );
}
