import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('../../supabaseClient', () => ({ default: {} }));
vi.mock('../../AuthContext', () => ({ useAuth: () => ({ profile: null }) }));
vi.mock('../../useRealtime', () => ({ useLiveRefresh: () => {} }));

import { Linkified } from '../ChatPage';

function anchors(text) {
  const { container } = render(<Linkified text={text} />);
  return [...container.querySelectorAll('a')].map((a) => ({ href: a.getAttribute('href'), text: a.textContent, target: a.target, rel: a.rel }));
}

describe('Linkified chat text', () => {
  it('makes https links clickable and opens them in a new tab safely', () => {
    const [link] = anchors('check https://service-wise-git-preet-patel-featur-1ad318-mithil1105s-projects.vercel.app/ now');
    expect(link.href).toBe('https://service-wise-git-preet-patel-featur-1ad318-mithil1105s-projects.vercel.app/');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
    expect(link.rel).toContain('noreferrer');
  });

  it('handles www. links and several links in one message', () => {
    const links = anchors('docs: www.example.com/a and http://localhost.test/x?y=1#z');
    expect(links.map((l) => l.href)).toEqual(['https://www.example.com/a', 'http://localhost.test/x?y=1#z']);
  });

  it('keeps trailing punctuation and unmatched brackets out of the link', () => {
    expect(anchors('see https://example.com/page.')[0].href).toBe('https://example.com/page');
    expect(anchors('(https://example.com/a)')[0].href).toBe('https://example.com/a');
    expect(anchors('https://en.wikipedia.org/wiki/Foo_(bar)')[0].href).toBe('https://en.wikipedia.org/wiki/Foo_(bar)');
    expect(anchors('really? https://example.com/q?x=1!')[0].href).toBe('https://example.com/q?x=1');
  });

  it('leaves normal text, numbers and other schemes alone', () => {
    expect(anchors('hello world 12.5 and a.b')).toEqual([]);
    expect(anchors('javascript:alert(1) and ftp://x.com and data:text/html,hi')).toEqual([]);
  });

  it('never turns message text into markup', () => {
    const { container } = render(<Linkified text={'<img src=x onerror=alert(1)> https://example.com/<b>'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
