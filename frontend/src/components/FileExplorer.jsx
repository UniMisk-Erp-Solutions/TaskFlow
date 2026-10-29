import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { zipSync } from 'fflate';
import { downloadFromApi, fetchFileBlob, fileErrorMessage, previewKind, saveBlob } from '../lib/fileAccess';
import FilePreviewModal from './FilePreviewModal';
import {
  ChevronRight, Download, File as FileIcon, FileImage, FileText, FileArchive, FileVideo, FileAudio, FolderPlus,
  Folder, Eye, Globe, Home, Info, Lock, Pencil, Search, Trash2, Upload, X, ArrowUp, FileSpreadsheet, History, Plus, FolderUp,
} from 'lucide-react';
import api from '../api';
import supabase from '../supabaseClient';
import { useAuth } from '../AuthContext';
import { useLiveRefresh } from '../useRealtime';
import Pagination, { usePagination } from './Pagination';
import SelectMenu from './SelectMenu';

function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatDate(iso) {
  const ms = Date.parse(iso || '');
  if (!Number.isFinite(ms)) return '';
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatExact(iso) {
  const ms = Date.parse(iso || '');
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function exactSize(bytes) {
  if (!bytes) return '0 bytes';
  return `${formatSize(bytes)} (${Number(bytes).toLocaleString()} bytes)`;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const ACTION_LABELS = {
  uploaded: 'Uploaded', created: 'Folder created', renamed: 'Renamed', moved: 'Moved', visibility_changed: 'Access changed',
  opened: 'Opened', downloaded: 'Downloaded', deleted: 'Deleted',
};

function describeActivity(entry) {
  const d = entry.details || {};
  switch (entry.action) {
    case 'renamed': return `"${d.from}" → "${d.to}"`;
    case 'moved': return d.to_folder ? 'Moved into a folder' : 'Moved to My files';
    case 'visibility_changed': return `${d.from === 'public' ? 'Public' : 'Private'} → ${d.to === 'public' ? 'Public' : 'Private'}`;
    case 'uploaded': return [d.size_bytes ? formatSize(d.size_bytes) : '', d.content_type || '', d.visibility ? (d.visibility === 'public' ? 'Public' : 'Private') : ''].filter(Boolean).join(' · ');
    case 'created': return d.visibility ? (d.visibility === 'public' ? 'Public' : 'Private') : '';
    case 'deleted': return d.files_removed !== undefined ? `${d.files_removed} file${d.files_removed === 1 ? '' : 's'} removed` : (d.with_folder ? `with folder "${d.with_folder}"` : (d.size_bytes ? formatSize(d.size_bytes) : ''));
    default: return '';
  }
}

function iconFor(item) {
  if (item.kind === 'folder') return Folder;
  const type = item.content_type || '';
  const name = (item.name || '').toLowerCase();
  if (type.startsWith('image/')) return FileImage;
  if (type.startsWith('video/')) return FileVideo;
  if (type.startsWith('audio/')) return FileAudio;
  if (type === 'application/pdf' || type.startsWith('text/') || /\.(docx?|xlsx?|pptx?|txt|csv|md)$/.test(name)) return FileText;
  if (/\.(zip|rar|7z|tar|gz)$/.test(name)) return FileArchive;
  return FileIcon;
}

function VisibilityBadge({ visibility, onClick, disabled }) {
  const isPublic = visibility === 'public';
  const Icon = isPublic ? Globe : Lock;
  const label = isPublic ? 'Public' : 'Private';
  const hint = isPublic ? 'Everyone in your organization can see this' : 'Only you can see this';
  const content = <><Icon size={12} aria-hidden="true" />{label}</>;
  if (disabled) return <span className={`fx-visibility is-${visibility}`} title={hint}>{content}</span>;
  return (
    <button type="button" className={`fx-visibility is-${visibility} is-button`} onClick={onClick} title={`${hint}. Click to make it ${isPublic ? 'private' : 'public'}.`}>
      {content}
    </button>
  );
}

const ACCESS_OPTIONS = [
  { value: 'all', label: 'Public & private' },
  { value: 'public', label: 'Public only' },
  { value: 'private', label: 'Private only' },
];

// Operating-system junk that should never be uploaded with a folder.
const IGNORED_FILE_NAMES = new Set(['.ds_store', 'thumbs.db', 'desktop.ini']);
const MAX_FOLDER_UPLOAD_FILES = 10000;
// Several files are sent at the same time; more than this mostly just queues in the browser.
const UPLOAD_CONCURRENCY = 8;
// Files per prepare / complete request to the API.
const UPLOAD_CHUNK = 40;
// Folders that are never uploaded with a dropped/picked folder (dependencies and version-control data).
const SKIPPED_FOLDER_NAMES = new Set(['node_modules', '.git', '__pycache__', '.venv', 'venv', '.pytest_cache', '.gradle']);

/** Adds up every file inside a folder, subfolders included, by listing each level. Stops after a short time budget (partial = true)
 *  and reports a running total through onProgress, so a huge folder shows "≥ X" instead of calculating for minutes. */
async function sumFolderTree(rootId, onProgress) {
  const started = Date.now();
  let bytes = 0;
  let files = 0;
  let requests = 0;
  let partial = false;
  const overBudget = () => requests >= 150 || Date.now() - started > 15000;
  const queue = [rootId];
  while (queue.length) {
    const batch = queue.splice(0, 6);
    await Promise.all(batch.map(async (id) => {
      if (overBudget()) { partial = true; return; }
      requests += 1;
      try {
        const { data } = await api.get('/drive', { params: { folder_id: id } });
        (data.files || []).forEach((f) => { bytes += Number(f.size_bytes) || 0; files += 1; });
        (data.folders || []).forEach((f) => queue.push(f.id));
        onProgress?.({ bytes, files });
      } catch {
        partial = true;
      }
    }));
  }
  return { bytes, files, partial };
}

/** Lists every file and folder under a folder, with its path inside the folder: { files: [{ id, path, size }], folders: [path] }. */
async function collectFolderTree(rootId, rootName, limits) {
  const files = [];
  const folders = [rootName];
  const queue = [{ id: rootId, path: rootName }];
  let bytes = 0;
  while (queue.length) {
    const batch = queue.splice(0, 6);
    await Promise.all(batch.map(async ({ id, path }) => {
      const { data } = await api.get('/drive', { params: { folder_id: id } });
      (data.files || []).forEach((f) => {
        files.push({ id: f.id, path: `${path}/${f.name}`, size: Number(f.size_bytes) || 0 });
        bytes += Number(f.size_bytes) || 0;
      });
      (data.folders || []).forEach((f) => { folders.push(`${path}/${f.name}`); queue.push({ id: f.id, path: `${path}/${f.name}` }); });
    }));
    if (files.length > limits.maxFiles || bytes > limits.maxBytes) return { files, folders, bytes, tooBig: true };
  }
  return { files, folders, bytes, tooBig: false };
}

/** Runs `worker` over `items`, at most `limit` at a time. Never rejects: workers handle their own errors. */
async function runPool(items, limit, worker) {
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await worker(item);
    }
  });
  await Promise.all(lanes);
}
// Same cleaning the API applies to folder names, so we can find a folder that already exists.
const cleanFolderName = (name) => String(name ?? '').replace(/[\\/\u0000-\u001f]+/g, ' ').trim().slice(0, 120);

/** Turns the picker's FileList (webkitdirectory) into { file, dirs } entries; dirs = folder path above the file. */
export function entriesFromPicker(fileList) {
  return Array.from(fileList || []).map((file) => {
    const parts = String(file.webkitRelativePath || '').split('/').filter(Boolean);
    return { file, dirs: parts.length > 1 ? parts.slice(0, -1) : [] };
  });
}

/** Reads everything dropped on the page, descending into dropped folders. Must start synchronously inside the drop event. */
export async function entriesFromDrop(dataTransfer) {
  const roots = Array.from(dataTransfer?.items || []).map((item) => (item.webkitGetAsEntry ? item.webkitGetAsEntry() : null));
  if (!roots.length || roots.some((entry) => !entry)) {
    return Array.from(dataTransfer?.files || []).map((file) => ({ file, dirs: [] }));
  }
  const out = [];
  async function walk(entry, dirs) {
    if (entry.isFile) {
      const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
      out.push({ file, dirs });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      for (;;) {
        const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
        if (!batch.length) break;
        for (const child of batch) await walk(child, [...dirs, entry.name]);
      }
    }
  }
  for (const entry of roots) await walk(entry, []);
  return out;
}

export default function FileExplorer() {
  const { profile } = useAuth();
  const [folderId, setFolderId] = useState(null);
  const [data, setData] = useState({ breadcrumbs: [], folders: [], files: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('all'); // all | mine | shared
  const [access, setAccess] = useState('all'); // all | public | private
  const [uploadVisibility, setUploadVisibility] = useState('public');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [editVisibility, setEditVisibility] = useState('public');
  const [savingEdit, setSavingEdit] = useState(false);
  const [properties, setProperties] = useState(null);
  const [preview, setPreview] = useState(null);
  const [view, setView] = useState('files'); // files | activity
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityItem, setActivityItem] = useState(null); // { id, name } to focus on one item
  const [activityAction, setActivityAction] = useState('all');
  const [activityQuery, setActivityQuery] = useState('');
  const isAdmin = profile?.role === 'admin';
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false); // the "+" menu: New folder / Upload files
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    const onKeyDown = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);
  const draggedRef = useRef(null); // { kind, id, name } while an item is dragged inside the explorer
  const [dropTarget, setDropTarget] = useState(null); // folder id, '__root__' or null
  const folderInputRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false); // the "+" menu: New folder / Upload files
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    const onKeyDown = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const { data: payload } = await api.get('/drive', { params: folderId ? { folder_id: folderId } : {} });
      setData(payload);
      setError('');
    } catch (err) {
      if (err.response?.status === 404 && folderId) {
        // The folder was removed or made private while we were inside it.
        setFolderId(null);
      } else if (!silent) {
        setError(err.response?.data?.error || err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [folderId]);

  useEffect(() => { void load(); }, [load]);
  useLiveRefresh(useCallback(() => { if (!busy && !query) void load({ silent: true }); }, [load, busy, query]), 8000);

  // Debounced search across everything this person may see.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setSearchResults(null); return undefined; }
    const timer = window.setTimeout(async () => {
      try {
        const { data: found } = await api.get('/drive/search', { params: { q: term } });
        setSearchResults(found);
      } catch { setSearchResults({ folders: [], files: [] }); }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const showing = searchResults || data;
  const items = useMemo(() => {
    const all = [...(showing.folders || []), ...(showing.files || [])];
    return all
      .filter((item) => (filter === 'mine' ? item.is_owner : filter === 'shared' ? !item.is_owner : true))
      .filter((item) => access === 'all' || item.visibility === access);
  }, [showing, filter, access]);

  const paging = usePagination(items, { resetKey: `${folderId}|${filter}|${access}|${query.trim()}` });

  // Folder sizes. The API sends a folder's total when it can; otherwise the totals are added up here by walking the folder.
  const sizeCache = useRef(new Map()); // folder id -> 'loading' | { bytes, files, partial }
  const [, setSizeTick] = useState(0);
  function invalidateSizes() { sizeCache.current.clear(); setSizeTick((t) => t + 1); }
  useEffect(() => {
    const pending = paging.pageItems.filter((item) => item.kind === 'folder' && item.size_bytes === undefined && !sizeCache.current.has(item.id));
    if (!pending.length) return undefined;
    let cancelled = false;
    pending.forEach((item) => sizeCache.current.set(item.id, 'loading'));
    setSizeTick((t) => t + 1);
    (async () => {
      await runPool(pending, 3, async (item) => {
        const total = await sumFolderTree(item.id, (running) => {
          if (cancelled) return;
          sizeCache.current.set(item.id, { ...running, partial: true, loading: true });
          setSizeTick((t) => t + 1);
        });
        if (cancelled) { sizeCache.current.delete(item.id); return; }
        sizeCache.current.set(item.id, total);
        setSizeTick((t) => t + 1);
      });
    })();
    return () => { cancelled = true; };
  }, [paging.pageItems]);
  function folderSizeLabel(item) {
    if (item.size_bytes !== undefined) return item.file_count ? formatSize(item.size_bytes) : 'Empty';
    const entry = sizeCache.current.get(item.id);
    if (!entry || entry === 'loading') return 'Calculating…';
    if (entry.loading) return entry.files ? `≥ ${formatSize(entry.bytes)} …` : 'Calculating…';
    if (!entry.files) return entry.partial ? '—' : 'Empty';
    return `${entry.partial ? '≥ ' : ''}${formatSize(entry.bytes)}`;
  }

  // Click a file: preview it in the app when the type allows it, otherwise download it.
  function openFile(item) {
    if (previewKind(item.content_type, item.name, item.size_bytes)) {
      setPreview({ path: `/drive/files/${item.id}/content`, name: item.name, contentType: item.content_type, size: item.size_bytes });
    } else {
      void downloadFile(item);
    }
  }

  function previewOnly(item) {
    setPreview({ path: `/drive/files/${item.id}/content`, name: item.name, contentType: item.content_type, size: item.size_bytes });
  }

  // Folder download: every file is fetched and packed into one ZIP in the browser (no server-side zipping needed).
  const ZIP_LIMITS = { maxFiles: 3000, maxBytes: 1024 * 1024 * 1024 };
  async function downloadFolder(item) {
    setError('');
    setNotice('');
    setBusy(`Reading "${item.name}"…`);
    try {
      const tree = await collectFolderTree(item.id, cleanFolderName(item.name) || 'folder', ZIP_LIMITS);
      if (tree.tooBig) {
        setError(`"${item.name}" is too big to download as one ZIP (over ${ZIP_LIMITS.maxFiles} files or ${formatSize(ZIP_LIMITS.maxBytes)}). Open it and download its subfolders or files separately.`);
        return;
      }
      if (!tree.files.length) { setError(`"${item.name}" has no files to download.`); return; }
      const entries = {};
      tree.folders.forEach((path) => { entries[`${path}/`] = new Uint8Array(0); }); // keeps empty folders
      const taken = new Set();
      let done = 0;
      const failed = [];
      await runPool(tree.files, 4, async (f) => {
        try {
          const blob = await fetchFileBlob(`/drive/files/${f.id}/content`, { download: 1 });
          let path = f.path;
          for (let n = 2; taken.has(path); n += 1) path = f.path.replace(/(\.[^./]+)?$/, ` (${n})$1`);
          taken.add(path);
          entries[path] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }]; // stored, not compressed: much faster
        } catch {
          failed.push(f.path);
        } finally {
          done += 1;
          setBusy(`Preparing ZIP: ${done} of ${tree.files.length} files`);
        }
      });
      setBusy('Building ZIP…');
      saveBlob(new Blob([zipSync(entries)], { type: 'application/zip' }), `${cleanFolderName(item.name) || 'folder'}.zip`);
      if (failed.length) setError(`${failed.length} file${failed.length === 1 ? '' : 's'} could not be added to the ZIP: ${failed.slice(0, 5).join(', ')}${failed.length > 5 ? '…' : ''}`);
    } catch (err) {
      setError(await fileErrorMessage(err, 'Could not download the folder.'));
    } finally {
      setBusy('');
    }
  }

  async function downloadFile(item) {
    setError('');
    setBusy(`Downloading ${item.name}…`);
    try {
      await downloadFromApi(`/drive/files/${item.id}/content`, item.name, { download: 1 });
    } catch (err) {
      setError(await fileErrorMessage(err, 'Could not download the file.'));
    } finally {
      setBusy('');
    }
  }

  // Drag an item you own onto a folder (row, breadcrumb or the "Back" row) to move it there.
  const isInternalDrag = (e) => Boolean(draggedRef.current) && !e.dataTransfer?.types?.includes('Files');

  function dropProps(targetId) {
    const key = targetId ?? '__root__';
    return {
      onDragOver: (e) => {
        const dragged = draggedRef.current;
        if (!isInternalDrag(e) || (dragged.kind === 'folder' && dragged.id === targetId)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        if (dropTarget !== key) setDropTarget(key);
      },
      onDragLeave: (e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setDropTarget((current) => (current === key ? null : current));
      },
      onDrop: (e) => {
        if (!isInternalDrag(e)) return;
        e.preventDefault();
        e.stopPropagation();
        const dragged = draggedRef.current;
        draggedRef.current = null;
        setDropTarget(null);
        void moveItem(dragged, targetId);
      },
    };
  }

  async function moveItem(item, targetFolderId) {
    if (!item || (item.kind === 'folder' && item.id === targetFolderId)) return;
    if (item.parentId !== undefined && (item.parentId ?? null) === (targetFolderId ?? null)) return;
    setBusy(`Moving ${item.name}…`);
    setError('');
    try {
      await api.patch(`/drive/${item.kind === 'folder' ? 'folders' : 'files'}/${item.id}`, { folder_id: targetFolderId });
      invalidateSizes();
    await load({ silent: true });
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Could not move the item.');
    } finally {
      setBusy('');
    }
  }

  function enterFolder(id) {
    setQuery('');
    setSearchResults(null);
    setFolderId(id);
  }

  // Creates the folder, or reuses the one you already have with that name in the same place.
  async function ensureFolder(parentId, rawName) {
    const name = cleanFolderName(rawName);
    if (!name) throw new Error('Folder name is empty.');
    try {
      const { data: created } = await api.post('/drive/folders', { name, parent_id: parentId, visibility: uploadVisibility });
      return created.id;
    } catch (err) {
      if (err.response?.status !== 409) throw err;
      const { data: listing } = await api.get('/drive', { params: parentId ? { folder_id: parentId } : {} });
      const existing = (listing?.folders || []).find((f) => f.name === name && f.is_owner);
      if (!existing) throw err;
      return existing.id;
    }
  }

  // Uploads { file, dirs } entries into the current folder, recreating each file's folder path first.
  // Speed: folders are created level by level, then files are sent several at a time instead of one by one.
  async function uploadTree(entries) {
    const all = (entries || []).filter((entry) => entry?.file && !IGNORED_FILE_NAMES.has(String(entry.file.name).toLowerCase()));
    // Dependency / VCS folders are never worth uploading and are what usually makes a folder huge.
    const skippedByFolder = new Map();
    const list = all.filter((entry) => {
      const hit = entry.dirs.find((dir) => SKIPPED_FOLDER_NAMES.has(dir.toLowerCase()));
      if (hit) skippedByFolder.set(hit, (skippedByFolder.get(hit) || 0) + 1);
      return !hit;
    });
    const skippedNote = skippedByFolder.size
      ? `Skipped ${[...skippedByFolder.values()].reduce((a, b) => a + b, 0)} files in ${[...skippedByFolder.keys()].join(', ')}.`
      : '';
    if (!list.length) {
      if (skippedNote) setError(`Nothing to upload. ${skippedNote}`);
      return;
    }
    if (list.length > MAX_FOLDER_UPLOAD_FILES) {
      setError(`That is ${list.length} files${skippedNote ? ` (after skipping ${skippedNote.replace('Skipped ', '').replace(/\.$/, '')})` : ''}. Upload at most ${MAX_FOLDER_UPLOAD_FILES} files at a time (split the folder).`);
      return;
    }
    setError('');
    setNotice('');
    const failures = [];
    const folderCache = new Map([['', folderId]]); // 'a/b' -> folder id
    const failedFolders = new Set();

    // 1) Create every folder first, shallowest first, several at a time within one level.
    setBusy('Preparing folders…');
    const wanted = new Map(); // 'a/b' -> { parentKey, name }
    list.forEach(({ dirs }) => {
      let key = '';
      dirs.forEach((dir) => {
        const parentKey = key;
        key = key ? `${key}/${dir}` : dir;
        if (!wanted.has(key)) wanted.set(key, { parentKey, name: dir });
      });
    });
    const byDepth = new Map();
    wanted.forEach((info, key) => {
      const depth = key.split('/').length;
      byDepth.set(depth, [...(byDepth.get(depth) || []), key]);
    });
    for (const depth of [...byDepth.keys()].sort((a, b) => a - b)) {
      await runPool(byDepth.get(depth), UPLOAD_CONCURRENCY, async (key) => {
        const { parentKey, name } = wanted.get(key);
        if (failedFolders.has(parentKey)) { failedFolders.add(key); return; }
        try {
          folderCache.set(key, await ensureFolder(folderCache.get(parentKey), name));
        } catch (err) {
          failedFolders.add(key);
          failures.push(`folder "${key}": ${err.response?.data?.error || err.message}`);
        }
      });
    }

    // 2) Upload the files. The API is only asked once per chunk (prepare and complete in bulk); the bytes go straight to storage,
    //    several at a time.
    let done = 0;
    const total = list.length;
    const startedAt = Date.now();
    const progress = () => {
      const seconds = (Date.now() - startedAt) / 1000;
      const remaining = done > 3 ? Math.max(1, Math.round((seconds / done) * (total - done))) : null;
      const eta = remaining ? ` · about ${remaining >= 90 ? `${Math.round(remaining / 60)} min` : `${remaining}s`} left` : '';
      setBusy(`Uploading ${done} of ${total}${eta}`);
    };
    progress();
    const fail = (label, err) => failures.push(`${label}: ${typeof err === 'string' ? err : (err.response?.data?.error || err.message)}`);
    const contentTypeOf = (file) => file.type || 'application/octet-stream';

    // One file at a time through the single-file endpoints: used only when the server has no batch endpoints yet.
    async function uploadOneLegacy({ file, label, targetId }) {
      try {
        const { data: ticket } = await api.post('/drive/files/prepare', { name: file.name, folder_id: targetId, visibility: uploadVisibility });
        const { error: uploadError } = await supabase.storage.from(ticket.bucket).uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: contentTypeOf(file) });
        if (uploadError) throw new Error(uploadError.message);
        await api.post('/drive/files/complete', { file_id: ticket.file_id, name: file.name, folder_id: targetId, visibility: uploadVisibility, content_type: file.type || null });
      } catch (err) {
        fail(label, err);
      } finally {
        done += 1;
        progress();
      }
    }

    let legacy = false;
    const chunks = [];
    for (let i = 0; i < list.length; i += UPLOAD_CHUNK) chunks.push(list.slice(i, i + UPLOAD_CHUNK));
    await runPool(chunks, 2, async (chunk) => {
      const ready = [];
      chunk.forEach(({ file, dirs }) => {
        const key = dirs.join('/');
        const label = dirs.length ? `${dirs.join('/')}/${file.name}` : file.name;
        if (failedFolders.has(key) || !folderCache.has(key)) { fail(label, `its folder "${key}" could not be created`); done += 1; return; }
        ready.push({ file, label, targetId: folderCache.get(key) });
      });
      if (!ready.length) { progress(); return; }
      if (legacy) { await runPool(ready, UPLOAD_CONCURRENCY, uploadOneLegacy); return; }

      let tickets;
      try {
        const { data } = await api.post('/drive/files/prepare-batch', { files: ready.map((r) => ({ name: r.file.name, folder_id: r.targetId })) });
        tickets = data.results;
      } catch (err) {
        if (err.response?.status === 404) { legacy = true; await runPool(ready, UPLOAD_CONCURRENCY, uploadOneLegacy); return; }
        ready.forEach((r) => fail(r.label, err));
        done += ready.length;
        progress();
        return;
      }

      const uploaded = [];
      await runPool(ready.map((r, i) => ({ r, t: tickets?.[i] })), UPLOAD_CONCURRENCY, async ({ r, t }) => {
        try {
          if (!t || t.error) throw new Error(t?.error || 'could not be prepared');
          const { error: uploadError } = await supabase.storage.from(t.bucket).uploadToSignedUrl(t.path, t.token, r.file, { contentType: contentTypeOf(r.file) });
          if (uploadError) throw new Error(uploadError.message);
          uploaded.push({ r, t });
        } catch (err) {
          fail(r.label, err);
        } finally {
          done += 1;
          progress();
        }
      });
      if (uploaded.length) {
        try {
          const { data } = await api.post('/drive/files/complete-batch', {
            files: uploaded.map(({ r, t }) => ({ file_id: t.file_id, name: r.file.name, folder_id: r.targetId, content_type: r.file.type || null })),
            visibility: uploadVisibility,
          });
          (data.results || []).forEach((res, i) => { if (res?.error) fail(uploaded[i].r.label, res.error); });
        } catch (err) {
          uploaded.forEach(({ r }) => fail(r.label, err));
        }
      }
    });

    setBusy('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
    // Refresh first: a successful refresh clears the error banner, which would hide these failures.
    invalidateSizes();
    await load({ silent: true });
    if (failures.length) {
      const shown = failures.slice(0, 8).join(' | ');
      setError(`Could not upload ${failures.length} file${failures.length === 1 ? '' : 's'}. ${shown}${failures.length > 8 ? ` … and ${failures.length - 8} more` : ''}${skippedNote ? ` ${skippedNote}` : ''}`);
    } else if (skippedNote) {
      setNotice(`Uploaded ${total} files. ${skippedNote}`);
    }
  }

  // Drop zone = the whole page, not just the file list. A folder or file dropped anywhere else would otherwise be opened by the
  // browser itself; here it is uploaded into the folder you are viewing (folders keep their structure, no zipping needed).
  const uploadTreeRef = useRef(uploadTree);
  uploadTreeRef.current = uploadTree;
  const shellRef = useRef(null);
  useEffect(() => {
    const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');
    const onOver = (e) => { if (hasFiles(e)) { e.preventDefault(); setDragOver(true); } };
    const onLeave = (e) => { if (!e.relatedTarget) setDragOver(false); }; // left the browser window
    const onDrop = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setDragOver(false);
      if (shellRef.current?.contains(e.target)) return; // the list handles its own drops
      void entriesFromDrop(e.dataTransfer).then((entries) => uploadTreeRef.current(entries));
    };
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  const uploadFiles = (fileList) => uploadTree(Array.from(fileList || []).map((file) => ({ file, dirs: [] })));
  const uploadFolder = (fileList) => uploadTree(entriesFromPicker(fileList));

  async function createFolder(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy('Creating folder…');
    try {
      await api.post('/drive/folders', { name: newName.trim(), parent_id: folderId, visibility: uploadVisibility });
      setNewName('');
      setCreating(false);
      invalidateSizes();
    await load({ silent: true });
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setBusy('');
    }
  }

  async function toggleVisibility(item) {
    const next = item.visibility === 'public' ? 'private' : 'public';
    try {
      await api.patch(`/drive/${item.kind === 'folder' ? 'folders' : 'files'}/${item.id}`, { visibility: next });
      invalidateSizes();
    await load({ silent: true });
      if (searchResults) setSearchResults(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const { data: rows } = await api.get('/drive/activity', { params: activityItem ? { item_id: activityItem.id } : {} });
      setActivity(Array.isArray(rows) ? rows : []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setActivityLoading(false);
    }
  }, [activityItem]);

  useEffect(() => { if (view === 'activity') void loadActivity(); }, [view, loadActivity]);

  const filteredActivity = useMemo(() => {
    const term = activityQuery.trim().toLowerCase();
    return activity.filter((entry) => (activityAction === 'all' || entry.action === activityAction)
      && (!term || `${entry.item_name} ${entry.actor_name} ${JSON.stringify(entry.details)}`.toLowerCase().includes(term)));
  }, [activity, activityAction, activityQuery]);
  const activityPaging = usePagination(filteredActivity, { resetKey: `${activityAction}|${activityQuery}|${activityItem?.id || ''}` });

  function showHistory(item) {
    setActivityItem(item ? { id: item.id, name: item.name } : null);
    setView('activity');
  }

  function exportDetails() {
    const header = ['Name', 'Type', 'Content type', 'Size (bytes)', 'Owner', 'Owner email', 'Access', 'Location', 'Created', 'Modified', 'Last accessed', 'Last accessed by', 'Times opened'];
    const rows = items.map((item) => [
      item.name, item.kind === 'folder' ? 'Folder' : 'File', item.content_type || '', item.size_bytes ?? '',
      item.owner_name, item.details?.owner_email || '', item.visibility, item.details?.location || '',
      formatExact(item.created_at), formatExact(item.details?.updated_at), item.details?.last_accessed_at ? formatExact(item.details.last_accessed_at) : '',
      item.details?.last_accessed_by || '', item.details?.access_count ?? '',
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `taskflow-files-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  function openEdit(item) {
    setEditing(item);
    setEditName(item.name);
    setEditVisibility(item.visibility === 'private' ? 'private' : 'public');
  }

  async function submitEdit(e) {
    e.preventDefault();
    if (!editing || !editName.trim()) return;
    const patch = {};
    if (editName.trim() !== editing.name) patch.name = editName.trim();
    if (editVisibility !== editing.visibility) patch.visibility = editVisibility;
    if (!Object.keys(patch).length) { setEditing(null); return; }
    setSavingEdit(true);
    try {
      await api.patch(`/drive/${editing.kind === 'folder' ? 'folders' : 'files'}/${editing.id}`, patch);
      setEditing(null);
      if (searchResults) setSearchResults(null);
      invalidateSizes();
    await load({ silent: true });
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function removeItem(item) {
    const what = item.kind === 'folder' ? `the folder "${item.name}" and everything inside it` : `"${item.name}"`;
    if (!window.confirm(`Delete ${what}? This cannot be undone.`)) return;
    try {
      await api.delete(`/drive/${item.kind === 'folder' ? 'folders' : 'files'}/${item.id}`);
      invalidateSizes();
    await load({ silent: true });
      if (searchResults) setSearchResults(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }

  const parentCrumb = data.breadcrumbs.length > 1 ? data.breadcrumbs[data.breadcrumbs.length - 2].id : null;
  const inFolder = Boolean(folderId);

  return (
    <section
      ref={shellRef}
      className={`fx-shell${dragOver ? ' is-dragover' : ''}`}
      aria-label="File explorer"
      onDragOver={(e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); void entriesFromDrop(e.dataTransfer).then(uploadTree); }}
    >
      <div className="fx-toolbar">
        <nav className="fx-breadcrumbs" aria-label="Folder path">
          <button type="button" onClick={() => enterFolder(null)} className={`${!inFolder ? 'is-current' : ''}${dropTarget === '__root__' ? ' is-drop-target' : ''}`} {...dropProps(null)}><Home size={14} aria-hidden="true" /> My files</button>
          {data.breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.id}>
              <ChevronRight size={14} aria-hidden="true" />
              <button type="button" onClick={() => enterFolder(crumb.id)} className={`${index === data.breadcrumbs.length - 1 ? 'is-current' : ''}${dropTarget === crumb.id ? ' is-drop-target' : ''}`} {...dropProps(crumb.id)}>{crumb.name}</button>
            </React.Fragment>
          ))}
        </nav>
        <div className="fx-actions">
          <div className="fx-segmented" role="group" aria-label="New items are">
            <button type="button" className={uploadVisibility === 'private' ? 'is-active' : ''} aria-pressed={uploadVisibility === 'private'} onClick={() => setUploadVisibility('private')} title="New uploads and folders are only visible to you"><Lock size={13} aria-hidden="true" /> Private</button>
            <button type="button" className={uploadVisibility === 'public' ? 'is-active' : ''} aria-pressed={uploadVisibility === 'public'} onClick={() => setUploadVisibility('public')} title="New uploads and folders are visible to your whole organization"><Globe size={13} aria-hidden="true" /> Public</button>
          </div>
          {isAdmin && <button type="button" className="btn btn-ghost btn-sm" onClick={exportDetails} disabled={!items.length} title="Download a CSV with full details of the items listed below"><FileSpreadsheet size={14} /> Export details</button>}
          <div className="fx-plus" ref={menuRef}>
            <button
              type="button"
              className="btn btn-primary btn-sm fx-plus-button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Add"
              onClick={() => setMenuOpen((open) => !open)}
            ><Plus size={16} aria-hidden="true" /> New</button>
            {menuOpen && (
              <div className="fx-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setCreating(true); }}><FolderPlus size={15} aria-hidden="true" /> New folder</button>
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); fileInputRef.current?.click(); }}><Upload size={15} aria-hidden="true" /> Upload files</button>
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); folderInputRef.current?.click(); }}><FolderUp size={15} aria-hidden="true" /> Upload folder</button>
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => uploadFiles(e.target.files)} />
          <input ref={folderInputRef} type="file" multiple hidden webkitdirectory="true" data-testid="folder-input" aria-label="Upload folder" onChange={(e) => uploadFolder(e.target.files)} />
        </div>
      </div>

      <div className="fx-tabs" role="tablist" aria-label="Files view">
        <button type="button" role="tab" aria-selected={view === 'files'} className={view === 'files' ? 'is-active' : ''} onClick={() => setView('files')}><Folder size={14} aria-hidden="true" /> Files</button>
        <button type="button" role="tab" aria-selected={view === 'activity'} className={view === 'activity' ? 'is-active' : ''} onClick={() => showHistory(null)}><History size={14} aria-hidden="true" /> Activity log</button>
      </div>

      {view === 'activity' ? (
        <div className="fx-activity">
          <div className="fx-filterbar">
            <label className="fx-search">
              <Search size={15} aria-hidden="true" />
              <input value={activityQuery} onChange={(e) => setActivityQuery(e.target.value)} placeholder="Search the log" aria-label="Search the activity log" />
            </label>
            <select className="input fx-select" value={activityAction} onChange={(e) => setActivityAction(e.target.value)} aria-label="Filter by action">
              <option value="all">All actions</option>
              <option value="uploaded">Uploaded</option>
              <option value="created">Folder created</option>
              <option value="renamed">Renamed</option>
              <option value="visibility_changed">Access changed</option>
              <option value="opened">Opened</option>
              <option value="downloaded">Downloaded</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>
          {activityItem && (
            <div className="fx-activity-focus">History of <strong>{activityItem.name}</strong>
              <button type="button" onClick={() => showHistory(null)}>Show all</button>
            </div>
          )}
          <p className="fx-activity-note">{isAdmin
            ? 'You see the activity of your own items and of items that are public. Private items of other people are never shown to administrators.'
            : 'You see the activity of your own files and folders, including private ones.'}</p>
          <div className="fx-list" role="table" aria-label="Activity log">
            <div className="fx-act-row fx-head" role="row"><span>When</span><span>Who</span><span>Action</span><span>Item</span><span>Details</span></div>
            {activityLoading ? <div className="fx-empty"><span className="spinner" /></div> : activityPaging.pageItems.map((entry) => (
              <div className="fx-act-row" role="row" key={entry.id}>
                <span className="fx-muted" title={formatExact(entry.created_at)}>{formatExact(entry.created_at)}</span>
                <span>{entry.actor_name}</span>
                <span><span className={`fx-action is-${entry.action}`}>{ACTION_LABELS[entry.action] || entry.action}</span></span>
                <span className="fx-act-item" title={entry.item_name}>{entry.item_kind === 'folder' ? <Folder size={14} aria-hidden="true" /> : <FileIcon size={14} aria-hidden="true" />}{entry.item_name}</span>
                <span className="fx-muted">{describeActivity(entry)}</span>
              </div>
            ))}
            {!activityLoading && !filteredActivity.length && <div className="fx-empty"><History size={30} aria-hidden="true" /><p>No activity to show.</p></div>}
          </div>
          <Pagination page={activityPaging.page} pageCount={activityPaging.pageCount} total={activityPaging.total} pageSize={activityPaging.pageSize} onPage={activityPaging.setPage} />
        </div>
      ) : (<>
      <div className="fx-filterbar">
        <label className="fx-search">
          <Search size={15} aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search files and folders" aria-label="Search files and folders" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={14} /></button>}
        </label>
        <div className="fx-show">
          <div className="fx-segmented" role="group" aria-label="Show">
            {[['all', 'All'], ['mine', 'Mine'], ['shared', 'Shared with me']].map(([key, label]) => (
              <button type="button" key={key} className={filter === key ? 'is-active' : ''} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>
            ))}
          </div>
          <div className="fx-access">
            <SelectMenu value={access} onChange={setAccess} options={ACCESS_OPTIONS} ariaLabel="Filter by access" />
          </div>
        </div>
      </div>

      {error && <div className="fx-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError('')}>Dismiss</button></div>}
      {busy && <div className="fx-busy" role="status"><span className="spinner" /> {busy}</div>}
      {notice && !busy && <div className="fx-busy" role="status">{notice} <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNotice('')}>Dismiss</button></div>}

      {creating && (
        <form className="fx-newfolder" onSubmit={createFolder}>
          <Folder size={16} aria-hidden="true" />
          <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Folder name" aria-label="Folder name" maxLength={120} />
          <button type="submit" className="btn btn-primary btn-sm" disabled={!newName.trim()}>Create</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setCreating(false); setNewName(''); }}>Cancel</button>
        </form>
      )}

      {loading ? (
        <div className="fx-empty"><span className="spinner" /></div>
      ) : (
        <div className="fx-list" role="table" aria-label="Files and folders">
          <div className="fx-row fx-head" role="row">
            <span role="columnheader">Name</span><span role="columnheader">Owner</span><span role="columnheader">Access</span>
            <span role="columnheader">Size</span><span role="columnheader">Modified</span><span role="columnheader" className="fx-col-actions">Actions</span>
          </div>
          {inFolder && !searchResults && (
            <button type="button" className={`fx-row fx-up${dropTarget === (parentCrumb ?? '__root__') ? ' is-drop-target' : ''}`} onClick={() => enterFolder(parentCrumb)} {...dropProps(parentCrumb)}>
              <span className="fx-name"><ArrowUp size={16} aria-hidden="true" /> Back to {parentCrumb ? 'parent folder' : 'My files'}</span>
            </button>
          )}
          {paging.pageItems.map((item) => {
            const Icon = iconFor(item);
            return (
              <div
                className={`fx-row${item.is_owner ? ' is-draggable' : ''}${item.kind === 'folder' && dropTarget === item.id ? ' is-drop-target' : ''}`}
                role="row"
                key={`${item.kind}-${item.id}`}
                draggable={Boolean(item.is_owner)}
                onDragStart={(e) => {
                  if (!item.is_owner) return;
                  draggedRef.current = { kind: item.kind, id: item.id, name: item.name, parentId: searchResults ? undefined : folderId };
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', item.name);
                }}
                onDragEnd={() => { draggedRef.current = null; setDropTarget(null); }}
                {...(item.kind === 'folder' ? dropProps(item.id) : {})}
              >
                <span className="fx-name" role="cell">
                  <Icon size={18} aria-hidden="true" className={item.kind === 'folder' ? 'is-folder' : ''} />
                  <button type="button" className="fx-open" onClick={() => (item.kind === 'folder' ? enterFolder(item.id) : openFile(item))} title={item.name}>{item.name}</button>
                </span>
                <span role="cell" className="fx-muted">{item.is_owner ? 'You' : item.owner_name}</span>
                <span role="cell"><VisibilityBadge visibility={item.visibility} disabled={!item.is_owner} onClick={() => toggleVisibility(item)} /></span>
                <span role="cell" className="fx-muted">{item.kind === 'folder' ? folderSizeLabel(item) : formatSize(item.size_bytes)}</span>
                <span role="cell" className="fx-muted">{formatDate(item.created_at)}</span>
                <span role="cell" className="fx-col-actions">
                  {(item.is_owner || isAdmin) && <button type="button" className="fx-icon-btn" onClick={() => showHistory(item)} aria-label={`History of ${item.name}`} title="History"><History size={15} /></button>}
                  {isAdmin && item.details && <button type="button" className="fx-icon-btn" onClick={() => setProperties(item)} aria-label={`Properties of ${item.name}`} title="Properties"><Info size={15} /></button>}
                  {item.kind === 'file' && previewKind(item.content_type, item.name, item.size_bytes) && <button type="button" className="fx-icon-btn" onClick={() => previewOnly(item)} aria-label={`Preview ${item.name}`} title="Preview"><Eye size={15} /></button>}
                  {item.kind === 'folder' && <button type="button" className="fx-icon-btn" onClick={() => downloadFolder(item)} aria-label={`Download ${item.name} as ZIP`} title="Download folder as ZIP"><Download size={15} /></button>}
                  {item.kind === 'file' && <button type="button" className="fx-icon-btn" onClick={() => downloadFile(item)} aria-label={`Download ${item.name}`} title="Download"><Download size={15} /></button>}
                  {item.is_owner && <button type="button" className="fx-icon-btn" onClick={() => openEdit(item)} aria-label={`Edit ${item.name}`} title="Edit name and access"><Pencil size={15} /></button>}
                  {(item.is_owner || (profile?.role === 'admin' && item.visibility === 'public')) && (
                    <button type="button" className="fx-icon-btn is-danger" onClick={() => removeItem(item)} aria-label={`Delete ${item.name}`} title="Delete"><Trash2 size={15} /></button>
                  )}
                </span>
              </div>
            );
          })}
          {!items.length && (
            <div className="fx-empty">
              <Folder size={30} aria-hidden="true" />
              <p>{searchResults ? 'Nothing matches your search.' : access !== 'all' ? `No ${access} items here.` : filter === 'shared' ? 'No one has shared anything here yet.' : 'This folder is empty. Upload files or drag them here.'}</p>
            </div>
          )}
        </div>
      )}
      <FilePreviewModal source={preview} onClose={() => setPreview(null)} />
      {properties && (
        <div className="overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setProperties(null); }}>
          <div className="modal fx-props" role="dialog" aria-modal="true" aria-label={`Properties of ${properties.name}`}>
            <h2>{properties.kind === 'folder' ? 'Folder' : 'File'} properties</h2>
            <p className="fx-props-name">{properties.name}</p>
            <dl>
              <div><dt>Type</dt><dd>{properties.kind === 'folder' ? 'Folder' : (properties.content_type || 'File')}</dd></div>
              {properties.kind === 'file' && <div><dt>Size</dt><dd>{exactSize(properties.size_bytes)}</dd></div>}
              <div><dt>Location</dt><dd>{properties.details.location}</dd></div>
              <div><dt>Owner</dt><dd>{properties.owner_name}{properties.details.owner_email ? ` (${properties.details.owner_email})` : ''}</dd></div>
              <div><dt>Access</dt><dd>{properties.visibility === 'public' ? 'Public (whole organization)' : 'Private (owner only)'}</dd></div>
              <div className="fx-props-sep" />
              <div><dt>Created</dt><dd>{formatExact(properties.created_at)}</dd></div>
              <div><dt>Modified</dt><dd>{formatExact(properties.details.updated_at)}</dd></div>
              {properties.kind === 'file' && <div><dt>Accessed</dt><dd>{properties.details.last_accessed_at ? `${formatExact(properties.details.last_accessed_at)}${properties.details.last_accessed_by ? ` by ${properties.details.last_accessed_by}` : ''}` : 'Never opened'}</dd></div>}
              {properties.kind === 'file' && <div><dt>Times opened</dt><dd>{properties.details.access_count}</dd></div>}
              {properties.kind === 'file' && <div className="fx-props-sep" />}
              {properties.kind === 'file' && <div><dt>Storage path</dt><dd className="fx-props-mono">{properties.details.storage_path}</dd></div>}
              {properties.kind === 'file' && <div><dt>File ID</dt><dd className="fx-props-mono">{properties.details.file_id}</dd></div>}
            </dl>
            <div className="fx-edit-actions"><button type="button" className="btn btn-primary btn-sm" onClick={() => setProperties(null)}>Close</button></div>
          </div>
        </div>
      )}
      {editing && (
        <div className="overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !savingEdit) setEditing(null); }}>
          <form className="modal fx-edit" onSubmit={submitEdit} role="dialog" aria-modal="true" aria-label={`Edit ${editing.kind}`}>
            <h2>Edit {editing.kind === 'folder' ? 'folder' : 'file'}</h2>
            <label className="fx-edit-field">
              <span>Name</span>
              <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={editing.kind === 'folder' ? 120 : 255} autoFocus />
            </label>
            <div className="fx-edit-field">
              <span>Who can see this</span>
              <div className="fx-visibility-choice" role="radiogroup" aria-label="Visibility">
                <button type="button" role="radio" aria-checked={editVisibility === 'public'} className={editVisibility === 'public' ? 'is-active' : ''} onClick={() => setEditVisibility('public')}>
                  <Globe size={16} aria-hidden="true" />
                  <strong>Public</strong>
                  <small>Everyone in your organization</small>
                </button>
                <button type="button" role="radio" aria-checked={editVisibility === 'private'} className={editVisibility === 'private' ? 'is-active' : ''} onClick={() => setEditVisibility('private')}>
                  <Lock size={16} aria-hidden="true" />
                  <strong>Private</strong>
                  <small>Only you</small>
                </button>
              </div>
            </div>
            <div className="fx-edit-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)} disabled={savingEdit}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={savingEdit || !editName.trim()}>{savingEdit ? <span className="spinner" /> : 'Save changes'}</button>
            </div>
          </form>
        </div>
      )}
      <Pagination page={paging.page} pageCount={paging.pageCount} total={paging.total} pageSize={paging.pageSize} onPage={paging.setPage} />
      </>)}
      <p className="fx-hint">New items are public by default; switch an item to Private when only you should see it. Public items are visible to everyone in your organization. Files are stored separately per organization and per person. There is no file-size limit in the app; very large files go straight to storage.</p>
    </section>
  );
}
