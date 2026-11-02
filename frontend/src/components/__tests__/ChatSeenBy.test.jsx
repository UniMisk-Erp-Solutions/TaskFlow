import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../supabaseClient', () => ({ default: { storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: 'x' } }) }) } } }));
vi.mock('../../AuthContext', () => ({ useAuth: () => ({ profile: null }) }));
vi.mock('../../useRealtime', () => ({ useLiveRefresh: () => {} }));

import { MessageRow } from '../ChatPage';

const msg = { id: 'm1', sender_id: 'me', body: 'plan is ready', created_at: '2026-11-02T10:00:00Z', kind: 'text' };

function row(props) {
  return render(
    <MessageRow msg={msg} mine showName={false} senderName="Me" quoted={null} quotedName="" highlighted={false}
      onReply={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onJumpTo={vi.fn()} {...props} />,
  );
}

describe('read receipts under your own message', () => {
  it('lists who has seen it in a group', () => {
    row({ seenBy: ['Maya', 'Ravi', 'Sam'] });
    expect(screen.getByTestId('seen-by').textContent).toBe('Seen by Maya, Ravi, Sam');
  });

  it('shortens a long list', () => {
    row({ seenBy: ['A', 'B', 'C', 'D', 'E', 'F'] });
    expect(screen.getByTestId('seen-by').textContent).toBe('Seen by A, B, C +3 more');
  });

  it('opens the full list when you click "+N more", and closes it again', () => {
    row({ seenBy: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] });
    fireEvent.click(screen.getByRole('button', { name: '+4 more' }));
    expect(screen.getByTestId('seen-by').textContent).toBe('Seen by A, B, C, D, E, F, G Show less');
    fireEvent.click(screen.getByRole('button', { name: 'Show less' }));
    expect(screen.getByTestId('seen-by').textContent).toBe('Seen by A, B, C +4 more');
  });

  it('says just "Seen" in a private chat', () => {
    row({ seenBy: ['Maya'], direct: true });
    expect(screen.getByTestId('seen-by').textContent).toBe('Seen');
  });

  it('shows nothing when nobody has read it yet, or on someone else’s message', () => {
    const { unmount } = row({ seenBy: null });
    expect(screen.queryByTestId('seen-by')).toBeNull();
    unmount();
    row({ seenBy: ['Maya'], mine: false });
    expect(screen.queryByTestId('seen-by')).toBeNull();
  });
});
