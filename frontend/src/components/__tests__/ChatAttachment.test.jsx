import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const download = vi.fn(async () => ({ data: new Blob(['hello'], { type: 'text/plain' }), error: null }));
vi.mock('../../supabaseClient', () => ({
  default: {
    storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: 'https://x/storage/sign/secret-path' } }), download }) },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel: () => {},
  },
}));
vi.mock('../../AuthContext', () => ({ useAuth: () => ({ profile: { id: 'u1' } }) }));
vi.mock('../../useRealtime', () => ({ useLiveRefresh: () => {} }));
vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import { Attachment } from '../ChatPage';

describe('chat attachment', () => {
  it('opens a document in the in-app viewer, with no link to the raw storage address', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const msg = { attachment_path: 'a/b.txt', attachment_name: 'notes.txt', attachment_type: 'text/plain', attachment_size: 5 };
    const { container } = render(<Attachment msg={msg} />);
    const open = await screen.findByLabelText('Preview notes.txt');
    expect(container.querySelector('a[href]')).toBeNull();
    fireEvent.click(open);
    await waitFor(() => expect(download).toHaveBeenCalledWith('a/b.txt'));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(await screen.findByText('hello')).toBeTruthy();
  });
});
