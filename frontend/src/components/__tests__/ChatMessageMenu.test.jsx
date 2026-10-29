import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../supabaseClient', () => ({ default: {} }));
vi.mock('../../AuthContext', () => ({ useAuth: () => ({ profile: null }) }));
vi.mock('../../useRealtime', () => ({ useLiveRefresh: () => {} }));

import { MessageMenu } from '../ChatPage';

const msg = { id: 'm1', body: 'https://github.com/preet1249/net-scrap.git', attachment_path: null };

function setup(over = {}) {
  const props = { msg, mine: true, onReply: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(), iconBtn: {}, ...over };
  render(<MessageMenu {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Message options' }));
  return props;
}

describe('chat message three-dot menu', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it('offers reply, copy, edit and delete on your own message', () => {
    const p = setup();
    expect(screen.getAllByRole('menuitem').map((el) => el.textContent.trim())).toEqual(['Reply', 'Copy', 'Edit', 'Delete']);
    fireEvent.click(screen.getByRole('menuitem', { name: /Edit/ }));
    expect(p.onEdit).toHaveBeenCalledWith(msg);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('copies the message text', async () => {
    setup();
    fireEvent.click(screen.getByRole('menuitem', { name: /Copy/ }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(msg.body));
    expect(await screen.findByText('Copied')).toBeTruthy();
  });

  it("only offers reply and copy on someone else's message, and delete calls with the id", () => {
    setup({ mine: false });
    expect(screen.getAllByRole('menuitem').map((el) => el.textContent.trim())).toEqual(['Reply', 'Copy']);
  });

  it('deletes with the message id', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete/ }));
    expect(p.onDelete).toHaveBeenCalledWith('m1');
  });

  it('hides edit for attachments and copy when there is no text', () => {
    setup({ msg: { id: 'm2', body: '', attachment_path: 'x/y.png' } });
    expect(screen.getAllByRole('menuitem').map((el) => el.textContent.trim())).toEqual(['Reply', 'Delete']);
  });
});
