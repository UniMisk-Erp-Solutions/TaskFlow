import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { downloadFromApi, fileErrorMessage, previewKind } from '../lib/fileAccess';
import FilePreviewModal from './FilePreviewModal';
import {
  ChevronRight, Download, File as FileIcon, FileImage, FileText, FileArchive, FileVideo, FileAudio, FolderPlus,
  Folder, Eye, Globe, Home, Info, Lock, Pencil, Search, Trash2, Upload, X, ArrowUp, FileSpreadsheet, History,
} from 'lucide-react';
import api from '../api';
import supabase from '../supabaseClient';
import { useAuth } from '../AuthContext';
import { useLiveRefresh } from '../useRealtime';
import Pagination, { usePagination } from './Pagination';

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
  uploaded: 'Uploaded', created: 'Folder created', renamed: 'Renamed', visibility_changed: 'Access changed',
  opened: 'Opened', downloaded: 'Downloaded', deleted: 'Deleted',
};

function describeActivity(entry) {
  const d = entry.details || {};
  switch (entry.action) {
    case 'renamed': return `"${d.from}" → "${d.to}"`;
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

export default function FileExplorer() {
  const { profile } = useAuth();
  const [folderId, setFolderId] = useState(null);
  const [data, setData] = useState({ breadcrumbs: [], folders: [], files: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [filter, setFilter] = useState('all'); // all | mine | shared
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
    return all.filter((item) => (filter === 'mine' ? item.is_owner : filter === 'shared' ? !item.is_owner : true));
  }, [showing, filter]);

  const paging = usePagination(items, { resetKey: `${folderId}|${filter}|${query.trim()}` });

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

  function enterFolder(id) {
    setQuery('');
    setSearchResults(null);
    setFolderId(id);
  }

  async function uploadFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setError('');
    const failures = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      setBusy(`Uploading ${index + 1} of ${files.length}: ${file.name}`);
      try {
        // Files go straight to storage, so size is not limited by the API.
        const { data: ticket } = await api.post('/drive/files/prepare', { name: file.name, folder_id: folderId, visibility: uploadVisibility });
        const { error: uploadError } = await supabase.storage
          .from(ticket.bucket)
          .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type || 'application/octet-stream' });
        if (uploadError) throw new Error(uploadError.message);
        await api.post('/drive/files/complete', {
          file_id: ticket.file_id, name: file.name, folder_id: folderId, visibility: uploadVisibility, content_type: file.type || null,
        });
      } catch (err) {
        failures.push(`${file.name}: ${err.response?.data?.error || err.message}`);
      }
    }
    setBusy('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (failures.length) setError(`Could not upload ${failures.length} file${failures.length === 1 ? '' : 's'}. ${failures.join(' | ')}`);
    await load({ silent: true });
  }

  async function createFolder(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy('Creating folder…');
    try {
      await api.post('/drive/folders', { name: newName.trim(), parent_id: folderId, visibility: uploadVisibility });
      setNewName('');
      setCreating(false);
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
      className={`fx-shell${dragOver ? ' is-dragover' : ''}`}
      aria-label="File explorer"
      onDragOver={(e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); void uploadFiles(e.dataTransfer.files); }}
    >
      <div className="fx-toolbar">
        <nav className="fx-breadcrumbs" aria-label="Folder path">
          <button type="button" onClick={() => enterFolder(null)} className={!inFolder ? 'is-current' : ''}><Home size={14} aria-hidden="true" /> My files</button>
          {data.breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.id}>
              <ChevronRight size={14} aria-hidden="true" />
              <button type="button" onClick={() => enterFolder(crumb.id)} className={index === data.breadcrumbs.length - 1 ? 'is-current' : ''}>{crumb.name}</button>
            </React.Fragment>
          ))}
        </nav>
        <div className="fx-actions">
          <div className="fx-segmented" role="group" aria-label="New items are">
            <button type="button" className={uploadVisibility === 'private' ? 'is-active' : ''} aria-pressed={uploadVisibility === 'private'} onClick={() => setUploadVisibility('private')} title="New uploads and folders are only visible to you"><Lock size={13} aria-hidden="true" /> Private</button>
            <button type="button" className={uploadVisibility === 'public' ? 'is-active' : ''} aria-pressed={uploadVisibility === 'public'} onClick={() => setUploadVisibility('public')} title="New uploads and folders are visible to your whole organization"><Globe size={13} aria-hidden="true" /> Public</button>
          </div>
          {isAdmin && <button type="button" className="btn btn-ghost btn-sm" onClick={exportDetails} disabled={!items.length} title="Download a CSV with full details of the items listed below"><FileSpreadsheet size={14} /> Export details</button>}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCreating(true)}><FolderPlus size={14} /> New folder</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => fileInputRef.current?.click()}><Upload size={14} /> Upload</button>
          <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => uploadFiles(e.target.files)} />
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
        <div className="fx-segmented" role="group" aria-label="Show">
          {[['all', 'All'], ['mine', 'Mine'], ['shared', 'Shared with me']].map(([key, label]) => (
            <button type="button" key={key} className={filter === key ? 'is-active' : ''} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>
          ))}
        </div>
      </div>

      {error && <div className="fx-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError('')}>Dismiss</button></div>}
      {busy && <div className="fx-busy" role="status"><span className="spinner" /> {busy}</div>}

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
            <button type="button" className="fx-row fx-up" onClick={() => enterFolder(parentCrumb)}>
              <span className="fx-name"><ArrowUp size={16} aria-hidden="true" /> Back to {parentCrumb ? 'parent folder' : 'My files'}</span>
            </button>
          )}
          {paging.pageItems.map((item) => {
            const Icon = iconFor(item);
            return (
              <div className="fx-row" role="row" key={`${item.kind}-${item.id}`}>
                <span className="fx-name" role="cell">
                  <Icon size={18} aria-hidden="true" className={item.kind === 'folder' ? 'is-folder' : ''} />
                  <button type="button" className="fx-open" onClick={() => (item.kind === 'folder' ? enterFolder(item.id) : openFile(item))} title={item.name}>{item.name}</button>
                </span>
                <span role="cell" className="fx-muted">{item.is_owner ? 'You' : item.owner_name}</span>
                <span role="cell"><VisibilityBadge visibility={item.visibility} disabled={!item.is_owner} onClick={() => toggleVisibility(item)} /></span>
                <span role="cell" className="fx-muted">{item.kind === 'folder' ? '—' : formatSize(item.size_bytes)}</span>
                <span role="cell" className="fx-muted">{formatDate(item.created_at)}</span>
                <span role="cell" className="fx-col-actions">
                  {(item.is_owner || isAdmin) && <button type="button" className="fx-icon-btn" onClick={() => showHistory(item)} aria-label={`History of ${item.name}`} title="History"><History size={15} /></button>}
                  {isAdmin && item.details && <button type="button" className="fx-icon-btn" onClick={() => setProperties(item)} aria-label={`Properties of ${item.name}`} title="Properties"><Info size={15} /></button>}
                  {item.kind === 'file' && previewKind(item.content_type, item.name, item.size_bytes) && <button type="button" className="fx-icon-btn" onClick={() => previewOnly(item)} aria-label={`Preview ${item.name}`} title="Preview"><Eye size={15} /></button>}
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
              <p>{searchResults ? 'Nothing matches your search.' : filter === 'shared' ? 'No one has shared anything here yet.' : 'This folder is empty. Upload files or drag them here.'}</p>
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
