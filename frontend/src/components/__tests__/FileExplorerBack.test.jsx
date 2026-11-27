import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';

vi.mock('../../api', () => {
  const get = vi.fn(async (url, { params } = {}) => ({
    data: params?.folder_id
      ? { breadcrumbs: [{ id: 'f1', name: 'Docs' }], folders: [], files: [] }
      : { breadcrumbs: [], folders: [{ id: 'f1', kind: 'folder', name: 'Docs', visibility: 'public', is_owner: true }], files: [] },
  }));
  return { default: { get, post: vi.fn(), patch: vi.fn(), delete: vi.fn(), defaults: { baseURL: '' } } };
});
vi.mock('../../supabaseClient', () => ({ default: { channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel: () => {}, storage: { from: () => ({}) } } }));
vi.mock('../../AuthContext', () => ({ useAuth: () => ({ profile: { id: 'u1', role: 'employee' } }) }));
vi.mock('../../useRealtime', () => ({ useLiveRefresh: () => {} }));

import FileExplorer from '../FileExplorer';

function Where() { const l = useLocation(); const nav = useNavigate(); return <><span data-testid="where">{l.pathname}{l.search}</span><button onClick={() => nav(-1)}>history-back</button></>; }

describe('Files: Back button', () => {
  it('Back from a folder returns to Files, not to the page before it', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/kanban', '/dashboard/files']} initialIndex={1}>
        <Where />
        <Routes><Route path="/dashboard/files" element={<FileExplorer />} /></Routes>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Docs' }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/dashboard/files?folder=f1'));
    fireEvent.click(screen.getByText('history-back'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/dashboard/files'));
  });
});
