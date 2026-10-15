import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight, Download, File as FileIcon, FileImage, FileText, FileArchive, FileVideo, FileAudio, FolderPlus,
  Folder, Globe, Home, Lock, Pencil, Search, Trash2, Upload, X, ArrowUp,
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

  async function openFile(item, download = false) {
    try {
      const { data: signed } = await api.get(`/drive/files/${item.id}/url`, { params: download ? { download: 1 } : {} });
      window.open(signed.url, '_blank', 'noopener');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not open the file.');
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
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCreating(true)}><FolderPlus size={14} /> New folder</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => fileInputRef.current?.click()}><Upload size={14} /> Upload</button>
          <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => uploadFiles(e.target.files)} />
        </div>
      </div>

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
                  {item.kind === 'file' && <button type="button" className="fx-icon-btn" onClick={() => openFile(item, true)} aria-label={`Download ${item.name}`} title="Download"><Download size={15} /></button>}
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
      <p className="fx-hint">New items are public by default; switch an item to Private when only you should see it. Public items are visible to everyone in your organization. Files are stored separately per organization and per person. There is no file-size limit in the app; very large files go straight to storage.</p>
    </section>
  );
}
