import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const uploadToSignedUrl = vi.fn(async () => ({ error: null }));

vi.mock('../../api', () => {
  const get = vi.fn(async () => ({ data: { breadcrumbs: [], folders: [], files: [] } }));
  const post = vi.fn(async (url, body) => {
    if (url === '/drive/folders') return { data: { id: `folder-${body.name}` } };
    if (url === '/drive/files/prepare') return { data: { bucket: 'b', path: `p/${body.name}`, token: 't', file_id: `file-${body.name}` } };
    if (url === '/drive/files/prepare-batch') return { data: { results: body.files.map((f) => ({ bucket: 'b', path: `p/${f.name}`, token: 't', file_id: `file-${f.name}` })) } };
    if (url === '/drive/files/complete-batch') return { data: { results: body.files.map((f) => ({ id: f.file_id })) } };
    return { data: {} };
  });
  return { default: { get, post, patch: vi.fn(), delete: vi.fn(), defaults: { baseURL: '' } } };
});
vi.mock('../../supabaseClient', () => ({
  default: {
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: () => {},
    storage: { from: () => ({ uploadToSignedUrl: (...a) => uploadToSignedUrl(...a) }) },
  },
}));
vi.mock('../../AuthContext', () => ({ useAuth: () => ({ profile: { id: 'u1', role: 'employee' } }) }));
vi.mock('../../useRealtime', () => ({ useLiveRefresh: () => {} }));

import api from '../../api';
import FileExplorer, { entriesFromDrop, entriesFromPicker } from '../FileExplorer';

function fileAt(path, name = path.split('/').pop()) {
  const f = new File(['x'], name, { type: 'text/plain' });
  Object.defineProperty(f, 'webkitRelativePath', { value: path });
  return f;
}
const pickFolder = (files) => fireEvent.change(screen.getByTestId('folder-input'), { target: { files } });
const prepareCalls = () => api.post.mock.calls.filter(([url]) => url === '/drive/files/prepare-batch').flatMap(([, body]) => body.files);
const batchCalls = (url) => api.post.mock.calls.filter(([u]) => u === url);
const folderCalls = () => api.post.mock.calls.filter(([url]) => url === '/drive/folders').map(([, body]) => body);

describe('Files toolbar "+" menu', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('replaces the separate buttons with one + that opens New folder, Upload files and Upload folder', async () => {
    const user = userEvent.setup();
    render(<FileExplorer />);
    const plus = await screen.findByRole('button', { name: 'Add' });
    expect(screen.queryByRole('menuitem', { name: /new folder/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^upload$/i })).toBeNull();
    await user.click(plus);
    expect(plus).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: /new folder/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /upload files/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /upload folder/i })).toBeInTheDocument();
  });

  it('creates a folder from the menu', async () => {
    const user = userEvent.setup();
    render(<FileExplorer />);
    await user.click(await screen.findByRole('button', { name: 'Add' }));
    await user.click(screen.getByRole('menuitem', { name: /new folder/i }));
    expect(screen.queryByRole('menu')).toBeNull();
    await user.type(screen.getByLabelText('Folder name'), 'Designs');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/drive/folders', expect.objectContaining({ name: 'Designs', parent_id: null })));
  });

  it('closes on Escape and when clicking elsewhere', async () => {
    const user = userEvent.setup();
    render(<FileExplorer />);
    const plus = await screen.findByRole('button', { name: 'Add' });
    await user.click(plus);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    await user.click(plus);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.click(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('Files access filter', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('narrows the list to public or private items from a dropdown under All / Mine / Shared', async () => {
    const file = (id, name, visibility) => ({ kind: 'file', id, name, visibility, is_owner: true, owner_name: 'Me', size_bytes: 10, content_type: 'text/plain', created_at: '2026-10-20T00:00:00Z' });
    api.get.mockImplementation(async () => ({ data: { breadcrumbs: [], folders: [], files: [file('1', 'open.txt', 'public'), file('2', 'secret.txt', 'private')] } }));
    render(<FileExplorer />);
    expect(await screen.findByText('open.txt')).toBeInTheDocument();
    expect(screen.getByText('secret.txt')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Filter by access' }));
    fireEvent.click(screen.getByRole('option', { name: 'Private only' }));
    expect(screen.queryByText('open.txt')).toBeNull();
    expect(screen.getByText('secret.txt')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Filter by access' }));
    fireEvent.click(screen.getByRole('option', { name: 'Public only' }));
    expect(screen.getByText('open.txt')).toBeInTheDocument();
    expect(screen.queryByText('secret.txt')).toBeNull();
    api.get.mockImplementation(async () => ({ data: { breadcrumbs: [], folders: [], files: [] } }));
  });
});

describe('Folder size', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  const MB = 1024 * 1024;
  const folder = (id, name) => ({ kind: 'folder', id, name, visibility: 'public', is_owner: true, owner_name: 'Me', created_at: '2026-10-20T00:00:00Z' });
  const file = (id, name, size) => ({ kind: 'file', id, name, visibility: 'public', is_owner: true, owner_name: 'Me', size_bytes: size, content_type: 'text/plain', created_at: '2026-10-20T00:00:00Z' });
  const reset = () => api.get.mockImplementation(async () => ({ data: { breadcrumbs: [], folders: [], files: [] } }));

  it('adds up every file inside a folder, subfolders included, when the server sends no total', async () => {
    api.get.mockImplementation(async (url, config) => {
      const id = config?.params?.folder_id;
      if (id === 'F1') return { data: { breadcrumbs: [], folders: [folder('F2', 'inner')], files: [file('a', 'a.txt', 1 * MB), file('b', 'b.txt', 2 * MB)] } };
      if (id === 'F2') return { data: { breadcrumbs: [], folders: [], files: [file('c', 'c.txt', 1 * MB)] } };
      return { data: { breadcrumbs: [], folders: [folder('F1', 'Project')], files: [] } };
    });
    render(<FileExplorer />);
    await screen.findByText('Project');
    expect(await screen.findByText('4.0 MB')).toBeInTheDocument();
    reset();
  });

  it('uses the total from the server when it is provided', async () => {
    api.get.mockImplementation(async () => ({ data: { breadcrumbs: [], folders: [{ ...folder('F1', 'Project'), size_bytes: 5 * MB, file_count: 3 }, { ...folder('F2', 'Nothing'), size_bytes: 0, file_count: 0 }], files: [] } }));
    render(<FileExplorer />);
    expect(await screen.findByText('5.0 MB')).toBeInTheDocument();
    expect(screen.getByText('Empty')).toBeInTheDocument();
    expect(api.get.mock.calls.filter(([, c]) => c?.params?.folder_id)).toHaveLength(0); // no extra listing needed
    reset();
  });
});

describe('Folder download', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  const folder = (id, name) => ({ kind: 'folder', id, name, visibility: 'public', is_owner: true, owner_name: 'Me', size_bytes: 10, file_count: 2, created_at: '2026-10-20T00:00:00Z' });
  const file = (id, name) => ({ kind: 'file', id, name, visibility: 'public', is_owner: true, owner_name: 'Me', size_bytes: 5, content_type: 'text/plain', created_at: '2026-10-20T00:00:00Z' });

  it('packs a folder, its subfolders and files into one ZIP', async () => {
    api.get.mockImplementation(async (url, config) => {
      if (String(url).endsWith('/content')) return { data: new Blob([`bytes of ${url}`]), headers: {} };
      const id = config?.params?.folder_id;
      if (id === 'F1') return { data: { breadcrumbs: [], folders: [folder('F2', 'inner')], files: [file('a', 'a.txt')] } };
      if (id === 'F2') return { data: { breadcrumbs: [], folders: [], files: [file('b', 'b.txt')] } };
      return { data: { breadcrumbs: [], folders: [folder('F1', 'Project')], files: [] } };
    });
    const made = [];
    URL.createObjectURL = vi.fn((blob) => { made.push(blob); return 'blob:zip'; });
    URL.revokeObjectURL = vi.fn();

    render(<FileExplorer />);
    await screen.findByText('Project');
    fireEvent.click(screen.getByRole('button', { name: 'Download Project as ZIP' }));
    await waitFor(() => expect(made).toHaveLength(1), { timeout: 4000 });

    expect(made[0].type).toBe('application/zip');
    const { unzipSync } = await import('fflate');
    const bytes = await new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(new Uint8Array(r.result)); r.readAsArrayBuffer(made[0]); });
    expect(Object.keys(unzipSync(bytes)).sort()).toEqual(['Project/', 'Project/a.txt', 'Project/inner/', 'Project/inner/b.txt']);
    api.get.mockImplementation(async () => ({ data: { breadcrumbs: [], folders: [], files: [] } }));
  });
});

describe('Uploading a whole folder', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('recreates the folder tree and uploads every file into the right folder, skipping OS junk', async () => {
    render(<FileExplorer />);
    await screen.findByRole('button', { name: 'Add' });
    pickFolder([
      fileAt('Designs/a.png'),
      fileAt('Designs/sub/b.png'),
      fileAt('Designs/sub/c.png'),
      fileAt('Designs/.DS_Store'),
      fileAt('Designs/Thumbs.db'),
    ]);
    await waitFor(() => expect(prepareCalls()).toHaveLength(3));
    expect(folderCalls().map((b) => [b.name, b.parent_id])).toEqual([['Designs', null], ['sub', 'folder-Designs']]);
    const byName = Object.fromEntries(prepareCalls().map((b) => [b.name, b.folder_id]));
    expect(byName).toEqual({ 'a.png': 'folder-Designs', 'b.png': 'folder-sub', 'c.png': 'folder-sub' });
    expect(uploadToSignedUrl).toHaveBeenCalledTimes(3);
    await waitFor(() => expect(batchCalls('/drive/files/complete-batch').flatMap(([, b]) => b.files)).toHaveLength(3));
    // All three files are prepared and completed with one API request each, not one per file.
    expect(batchCalls('/drive/files/prepare-batch')).toHaveLength(1);
    expect(batchCalls('/drive/files/complete-batch')).toHaveLength(1);
  });

  it('uploads a big folder with a handful of API requests, not three per file', async () => {
    render(<FileExplorer />);
    await screen.findByRole('button', { name: 'Add' });
    pickFolder(Array.from({ length: 120 }, (_, i) => fileAt(`Big/f${i}.txt`)));
    await waitFor(() => expect(batchCalls('/drive/files/complete-batch').flatMap(([, b]) => b.files)).toHaveLength(120));
    expect(uploadToSignedUrl).toHaveBeenCalledTimes(120);
    expect(batchCalls('/drive/files/prepare-batch')).toHaveLength(3); // 40 files per request
  });

  it('falls back to one request per file when the server has no batch endpoints yet', async () => {
    const base = api.post.getMockImplementation();
    api.post.mockImplementation(async (url, body) => {
      if (url === '/drive/files/prepare-batch') { const e = new Error('nf'); e.response = { status: 404, data: { error: 'Not found' } }; throw e; }
      if (url === '/drive/files/prepare') return { data: { bucket: 'b', path: `p/${body.name}`, token: 't', file_id: `file-${body.name}` } };
      return base(url, body);
    });
    render(<FileExplorer />);
    await screen.findByRole('button', { name: 'Add' });
    pickFolder([fileAt('Old/a.txt'), fileAt('Old/b.txt')]);
    await waitFor(() => expect(api.post.mock.calls.filter(([u]) => u === '/drive/files/complete')).toHaveLength(2));
    expect(uploadToSignedUrl).toHaveBeenCalledTimes(2);
    api.post.mockImplementation(base);
  });

  it('reuses a folder you already have with the same name instead of failing', async () => {
    api.post.mockImplementationOnce(async () => { const e = new Error('dup'); e.response = { status: 409, data: { error: 'You already have a folder with that name here.' } }; throw e; });
    api.get.mockImplementation(async () => ({ data: { breadcrumbs: [], folders: [{ kind: 'folder', id: 'existing-1', name: 'Designs', is_owner: true }], files: [] } }));
    render(<FileExplorer />);
    await screen.findByRole('button', { name: 'Add' });
    pickFolder([fileAt('Designs/a.png')]);
    await waitFor(() => expect(prepareCalls()).toHaveLength(1));
    expect(prepareCalls()[0].folder_id).toBe('existing-1');
    expect(screen.queryByText(/could not upload/i)).toBeNull();
    api.get.mockImplementation(async () => ({ data: { breadcrumbs: [], folders: [], files: [] } }));
  });

  it('reports a file that fails without stopping the rest', async () => {
    uploadToSignedUrl.mockImplementationOnce(async () => ({ error: { message: 'storage down' } }));
    render(<FileExplorer />);
    await screen.findByRole('button', { name: 'Add' });
    pickFolder([fileAt('Docs/one.txt'), fileAt('Docs/two.txt')]);
    expect(await screen.findByText(/could not upload 1 file/i)).toBeInTheDocument();
    expect(screen.getByText(/Docs\/one\.txt: storage down/)).toBeInTheDocument();
    expect(prepareCalls()).toHaveLength(2);
  });

  it('skips node_modules and .git when uploading a project folder and says so', async () => {
    render(<FileExplorer />);
    await screen.findByRole('button', { name: 'Add' });
    pickFolder([fileAt('App/index.js'), fileAt('App/node_modules/lib/a.js'), fileAt('App/node_modules/lib/b.js'), fileAt('App/.git/HEAD')]);
    expect(await screen.findByText(/Uploaded 1 files\. Skipped 3 files in node_modules, \.git\./)).toBeInTheDocument();
    expect(prepareCalls()).toHaveLength(1);
  });

  it('refuses an enormous folder with a clear message', async () => {
    render(<FileExplorer />);
    await screen.findByRole('button', { name: 'Add' });
    pickFolder(Array.from({ length: 10001 }, (_, i) => fileAt(`Big/f${i}.txt`)));
    expect(await screen.findByText(/upload at most 10000 files/i)).toBeInTheDocument();
    expect(prepareCalls()).toHaveLength(0);
  });

  it('maps picker paths and dropped folders to the same { file, dirs } shape', async () => {
    expect(entriesFromPicker([fileAt('A/B/x.txt'), fileAt('', 'loose.txt')]).map((e) => [e.file.name, e.dirs])).toEqual([['x.txt', ['A', 'B']], ['loose.txt', []]]);

    const mk = (name, children) => children
      ? { isFile: false, isDirectory: true, name, createReader() { let done = false; return { readEntries: (ok) => { if (done) ok([]); else { done = true; ok(children); } } }; } }
      : { isFile: true, isDirectory: false, name, file: (ok) => ok(new File(['x'], name)) };
    const tree = mk('Photos', [mk('1.jpg'), mk('2024', [mk('2.jpg')])]);
    const dropped = await entriesFromDrop({ items: [{ webkitGetAsEntry: () => tree }], files: [] });
    expect(dropped.map((e) => [e.file.name, e.dirs])).toEqual([['1.jpg', ['Photos']], ['2.jpg', ['Photos', '2024']]]);
  });
});
