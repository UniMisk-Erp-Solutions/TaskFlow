import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageRow, foldMessage } from '../ChatPage';

const base = { id: 'm1', sender_id: 'u1', created_at: '2026-11-18T10:00:00Z', reply_to_id: null };
const row = (body) => <MessageRow msg={{ ...base, body }} mine={false} showName={false} senderName="A" quoted={null} quotedName="" highlighted={false} onReply={() => {}} onEdit={() => {}} onDelete={() => {}} onJumpTo={() => {}} />;

describe('long chat messages', () => {
  it('leaves short messages alone', () => {
    expect(foldMessage('hello there').long).toBe(false);
  });

  it('folds long messages and ends the preview on a whole word', () => {
    const body = 'word '.repeat(400);
    const f = foldMessage(body);
    expect(f.long).toBe(true);
    expect(f.preview.length).toBeLessThanOrEqual(601);
    expect(f.preview.endsWith('word…')).toBe(true);
  });

  it('folds by line count too', () => {
    expect(foldMessage(Array.from({ length: 20 }, (_, i) => `line ${i}`).join('\n')).long).toBe(true);
  });

  it('shows Show more, then the whole message, then Show less', () => {
    const body = `${'a'.repeat(300)} ${'b'.repeat(300)} END_OF_MESSAGE`;
    const { container } = render(row(body));
    expect(container.textContent).not.toContain('END_OF_MESSAGE');
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(container.textContent).toContain('END_OF_MESSAGE');
    fireEvent.click(screen.getByRole('button', { name: 'Show less' }));
    expect(container.textContent).not.toContain('END_OF_MESSAGE');
  });

  it('has no 4,000 character limit on the message box in the source', async () => {
    const fs = await import('node:fs');
    expect(fs.readFileSync('src/components/ChatPage.jsx', 'utf8')).not.toMatch(/maxLength=\{4000\}/);
  });
});
