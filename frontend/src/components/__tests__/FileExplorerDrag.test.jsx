import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const listing = {
  breadcrumbs: [],
  folders: [{ id: 'f1', kind: 'folder', name: 'Reports', visibility: 'public', is_owner: true, created_at: '2026-10-16' }],
  files: [
    { id: 'a1', kind: 'file', name: 'mine.pdf', visibility: 'public', is_owner: true, size_bytes: 10, created_at: '2026-10-16' },
    { id: 'b1', kind: 'file', name: 'theirs.pdf', visibility: 'public', is_owner: false, owner_name: 'Bo', size_bytes: 10, created_at: '2026-10-16' },
  ],
};

vi.mock('../../api', () => ({
  default: { get: vi.fn(async () => ({ data: listing })), patch: vi.fn(async () => ({ data: {} })), post: vi.fn() },
}));
vi.mock('../../supabaseClient', () => ({
  default: { channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel: () => {} },
}));
vi.mock('../../AuthContext', () => ({ useAuth: () => ({ profile: { id: 'u1', role: 'admin' } }) }));
vi.mock('../../useRealtime', () => ({ useLiveRefresh: () => {} }));

import api from '../../api';
import FileExplorer from '../FileExplorer';

const dt = () => ({ types: [], setData: vi.fn(), effectAllowed: '', dropEffect: '' });

describe('FileExplorer drag and drop', () => {
  beforeEach(() => vi.clearAllMocks());

  it('moves an owned file into a folder when dropped on it', async () => {
    render(<FileExplorer />);
    const file = (await screen.findByText('mine.pdf')).closest('.fx-row');
    const folder = screen.getByText('Reports').closest('.fx-row');
    const data = dt();
    fireEvent.dragStart(file, { dataTransfer: data });
    fireEvent.dragOver(folder, { dataTransfer: data });
    fireEvent.drop(folder, { dataTransfer: data });
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/drive/files/a1', { folder_id: 'f1' }));
  });

  it('does not let you drag files you do not own', async () => {
    render(<FileExplorer />);
    const theirs = (await screen.findByText('theirs.pdf')).closest('.fx-row');
    expect(theirs.getAttribute('draggable')).toBe('false');
  });

  it('does not treat a folder dropped on itself as a move', async () => {
    render(<FileExplorer />);
    const folder = (await screen.findByText('Reports')).closest('.fx-row');
    const data = dt();
    fireEvent.dragStart(folder, { dataTransfer: data });
    fireEvent.dragOver(folder, { dataTransfer: data });
    fireEvent.drop(folder, { dataTransfer: data });
    expect(api.patch).not.toHaveBeenCalled();
  });
});
