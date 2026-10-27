import React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const createSignedUrl = vi.fn(async () => ({ data: { signedUrl: 'https://files.test/pic.png' } }));
vi.mock('../../supabaseClient', () => ({
  default: { storage: { from: () => ({ createSignedUrl: (...args) => createSignedUrl(...args) }) } },
}));
vi.mock('../../AuthContext', () => ({ useAuth: () => ({ profile: null }) }));
vi.mock('../../useRealtime', () => ({ useLiveRefresh: () => {} }));

import { MessageRow } from '../ChatPage';

// What kind of device the test pretends to be: 'phone' (touch is the main input), 'installed' (installed app), 'desktop'.
let device = 'phone';
function fakeMatchMedia(query) {
  const matches = (device === 'phone' && query === '(hover: none) and (pointer: coarse)') || (device === 'installed' && query === '(display-mode: standalone)');
  return { matches, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} };
}

// jsdom has no PointerEvent: a MouseEvent that also carries pointerType / pointerId is enough for these handlers.
beforeAll(() => {
  window.matchMedia = fakeMatchMedia;
  window.PointerEvent = class extends MouseEvent {
    constructor(type, init = {}) { super(type, init); this.pointerType = init.pointerType; this.pointerId = init.pointerId ?? 1; }
  };
});

const baseMsg = { id: 'm1', sender_id: 'u2', body: 'hello there', created_at: '2026-10-27T10:00:00Z', kind: 'text' };
const imageMsg = { ...baseMsg, id: 'm2', body: '', attachment_path: 'a/b.png', attachment_name: 'pic.png', attachment_type: 'image/png', attachment_size: 1000 };

function setup(msg) {
  const onReply = vi.fn();
  const { container } = render(
    <MessageRow msg={msg} mine={false} showName={false} senderName="Mithil" quoted={null} quotedName="" highlighted={false}
      onReply={onReply} onEdit={vi.fn()} onDelete={vi.fn()} onJumpTo={vi.fn()} />,
  );
  return { onReply, row: container.querySelector('.tf-chat-msg') };
}

function drag(target, row, pointerType, dx) {
  fireEvent.pointerDown(target, { pointerType, clientX: 10, clientY: 10, pointerId: 1, bubbles: true });
  fireEvent.pointerMove(row, { pointerType, clientX: 10 + dx / 2, clientY: 12, pointerId: 1, bubbles: true });
  fireEvent.pointerMove(row, { pointerType, clientX: 10 + dx, clientY: 12, pointerId: 1, bubbles: true });
  fireEvent.pointerUp(row, { pointerType, clientX: 10 + dx, clientY: 12, pointerId: 1, bubbles: true });
}

describe('swipe right to reply', () => {
  beforeEach(() => { device = 'phone'; });

  it('is off on a desktop, even for a touchscreen laptop or a pen', () => {
    device = 'desktop';
    for (const pointerType of ['touch', 'pen', 'mouse']) {
      const { onReply, row } = setup({ ...baseMsg, id: `d-${pointerType}` });
      const bubble = row.querySelector('div > div');
      const text = screen.getAllByText('hello there').at(-1);
      fireEvent.pointerDown(text, { pointerType, clientX: 10, clientY: 10, pointerId: 1, bubbles: true });
      fireEvent.pointerMove(row, { pointerType, clientX: 70, clientY: 12, pointerId: 1, bubbles: true });
      fireEvent.pointerMove(row, { pointerType, clientX: 130, clientY: 12, pointerId: 1, bubbles: true });
      expect(bubble.style.transform).toBe('');
      fireEvent.pointerUp(row, { pointerType, clientX: 130, clientY: 12, pointerId: 1, bubbles: true });
      expect(onReply).not.toHaveBeenCalled();
    }
  });

  it('works in the installed app', () => {
    device = 'installed';
    const { onReply, row } = setup({ ...baseMsg, id: 'inst' });
    drag(screen.getAllByText('hello there').at(-1), row, 'touch', 120);
    expect(onReply).toHaveBeenCalled();
  });
  it('is a touch gesture: a finger swipe replies', () => {
    const { onReply, row } = setup(baseMsg);
    drag(screen.getByText('hello there'), row, 'touch', 120);
    expect(onReply).toHaveBeenCalledWith(baseMsg);
  });

  it('is off for the mouse, so dragging to select text never moves the message', () => {
    const { onReply, row } = setup(baseMsg);
    const bubble = row.querySelector('div > div');
    const text = screen.getByText('hello there');
    fireEvent.pointerDown(text, { pointerType: 'mouse', clientX: 10, clientY: 10, pointerId: 1, bubbles: true });
    fireEvent.pointerMove(row, { pointerType: 'mouse', clientX: 70, clientY: 12, pointerId: 1, bubbles: true });
    fireEvent.pointerMove(row, { pointerType: 'mouse', clientX: 130, clientY: 12, pointerId: 1, bubbles: true });
    expect(bubble.style.transform).toBe(''); // still in place while the mouse is dragging
    fireEvent.pointerUp(row, { pointerType: 'mouse', clientX: 130, clientY: 12, pointerId: 1, bubbles: true });
    expect(onReply).not.toHaveBeenCalled();
  });

  it('works when the swipe starts on an image, and does not open the image', async () => {
    const { onReply, row } = setup(imageMsg);
    const image = await screen.findByAltText('pic.png');
    drag(image, row, 'touch', 120);
    expect(onReply).toHaveBeenCalledWith(imageMsg);
    const link = image.closest('a');
    fireEvent.click(link); // the click that follows a swipe is swallowed
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => { fireEvent.click(link); expect(screen.getByRole('dialog')).toBeTruthy(); }, { timeout: 1500 }); // a normal tap later still opens it
  });

  it('keeps a plain tap on an image working', async () => {
    const { onReply, row } = setup(imageMsg);
    const image = await screen.findByAltText('pic.png');
    fireEvent.pointerDown(image, { pointerType: 'touch', clientX: 10, clientY: 10, pointerId: 1, bubbles: true });
    fireEvent.pointerUp(row, { pointerType: 'touch', clientX: 10, clientY: 10, pointerId: 1, bubbles: true });
    expect(onReply).not.toHaveBeenCalled();
    fireEvent.click(image.closest('a'));
    expect(await screen.findByRole('dialog')).toBeTruthy(); // a tap opens the viewer
  });
});


describe('chat attachment links', () => {
  it('asks for one signed link per file, even when several messages show it', async () => {
    createSignedUrl.mockClear();
    const shared = { ...imageMsg, attachment_path: 'org/shared-photo.png' };
    render(
      <>
        <MessageRow msg={{ ...shared, id: 'x1' }} mine={false} showName={false} senderName="A" quoted={null} quotedName="" highlighted={false} onReply={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onJumpTo={vi.fn()} />
        <MessageRow msg={{ ...shared, id: 'x2' }} mine={false} showName={false} senderName="A" quoted={null} quotedName="" highlighted={false} onReply={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onJumpTo={vi.fn()} />
      </>,
    );
    expect(await screen.findAllByAltText('pic.png')).toHaveLength(2);
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
  });

  it('retries once when the first request fails (e.g. a lock error) and then shows the image', async () => {
    createSignedUrl.mockClear();
    createSignedUrl.mockRejectedValueOnce(new Error('AbortError: Lock broken by another request with the steal option.'));
    const msg = { ...imageMsg, id: 'y1', attachment_path: 'org/flaky-photo.png' };
    render(<MessageRow msg={msg} mine={false} showName={false} senderName="A" quoted={null} quotedName="" highlighted={false} onReply={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onJumpTo={vi.fn()} />);
    expect(await screen.findByAltText('pic.png', {}, { timeout: 3000 })).toBeTruthy();
    expect(createSignedUrl).toHaveBeenCalledTimes(2);
  });
});

describe('opening a chat image', () => {
  it('opens in the same tab in a viewer and closes with the X, Esc and a click outside', async () => {
    const { row } = setup({ ...imageMsg, id: 'lb1', attachment_path: 'org/viewer-photo.png' });
    const thumb = await screen.findByAltText('pic.png');
    const opened = vi.spyOn(window, 'open').mockImplementation(() => null);

    expect(fireEvent.click(thumb.closest('a'))).toBe(false); // the link's own navigation (new tab) is cancelled
    const dialog = await screen.findByRole('dialog', { name: 'pic.png' });
    expect(opened).not.toHaveBeenCalled();
    expect(row.contains(dialog)).toBe(false); // drawn over the page, not inside the message

    fireEvent.click(screen.getByRole('button', { name: 'Close image' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(thumb.closest('a'));
    await screen.findByRole('dialog');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(thumb.closest('a'));
    fireEvent.click(await screen.findByRole('dialog')); // the dark area around the picture
    expect(screen.queryByRole('dialog')).toBeNull();
    opened.mockRestore();
  });

  it('does not reply when the viewer is double-clicked, and Ctrl-click still opens a new tab', async () => {
    const { onReply } = setup({ ...imageMsg, id: 'lb2', attachment_path: 'org/viewer-photo2.png' });
    const thumb = await screen.findByAltText('pic.png');
    expect(fireEvent.click(thumb.closest('a'), { ctrlKey: true })).toBe(true); // browser default kept
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(thumb.closest('a'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.doubleClick(dialog);
    expect(onReply).not.toHaveBeenCalled();
  });
});
