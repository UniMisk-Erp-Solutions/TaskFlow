import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageRow, splitCodeBlocks, autoFenceCode, foldMessage } from '../ChatPage';

const base = { id: 'm1', sender_id: 'u1', created_at: '2026-11-18T10:00:00Z', reply_to_id: null };
const row = (body) => <MessageRow msg={{ ...base, body }} mine={false} showName={false} senderName="A" quoted={null} quotedName="" highlighted={false} onReply={() => {}} onEdit={() => {}} onDelete={() => {}} onJumpTo={() => {}} />;

const CODE = 'function add(a, b) {\n  if (a > b) {\n    return a;\n  }\n  return b;\n}';

describe('chat code formatting', () => {
  it('splits fenced blocks from text', () => {
    const parts = splitCodeBlocks('Look:\n```js\nconst x = 1;\n```\nthanks');
    expect(parts.map((p) => p.type)).toEqual(['text', 'code', 'text']);
    expect(parts[1]).toMatchObject({ lang: 'js', code: 'const x = 1;' });
  });

  it('keeps indentation and line breaks inside a code block, in a monospace pre', () => {
    const { container } = render(row('```\n' + CODE + '\n```'));
    const pre = container.querySelector('pre');
    expect(pre.textContent).toBe(CODE);
    expect(pre.style.whiteSpace).toBe('pre');
    expect(pre.style.fontFamily).toMatch(/mono|Menlo|Consolas/i);
  });

  it('renders `inline code` as code and leaves other text alone', () => {
    const { container } = render(row('run `npm test` now'));
    expect(container.querySelector('code').textContent).toBe('npm test');
    expect(container.textContent).toContain('run ');
  });

  it('wraps pasted multi-line code in a code block automatically', () => {
    expect(autoFenceCode(CODE)).toBe('```\n' + CODE + '\n```');
  });

  it('does not wrap ordinary multi-line text', () => {
    const plain = 'Hi team,\nthe meeting moved to 4 pm.\nPlease confirm.';
    expect(autoFenceCode(plain)).toBe(plain);
  });

  it('never leaves a code block open when a long message is folded', () => {
    const f = foldMessage('```\n' + 'x = 1\n'.repeat(300) + '```');
    expect((f.preview.match(/```/g) || []).length % 2).toBe(0);
  });

  it('has a Copy button on each code block', () => {
    render(row('```\na\n```'));
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
  });
});
