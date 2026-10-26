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
const prepareCalls = () => api.post.mock.calls.filter(([url]) => url === '/drive/files/prepare').map(([, body]) => body);
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
    await waitFor(() => expect(api.post.mock.calls.filter(([url]) => url === '/drive/files/complete')).toHaveLength(3));
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

  it('refuses an enormous folder with a clear message', async () => {
    render(<FileExplorer />);
    await screen.findByRole('button', { name: 'Add' });
    pickFolder(Array.from({ length: 2001 }, (_, i) => fileAt(`Big/f${i}.txt`)));
    expect(await screen.findByText(/upload at most 2000 files/i)).toBeInTheDocument();
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
