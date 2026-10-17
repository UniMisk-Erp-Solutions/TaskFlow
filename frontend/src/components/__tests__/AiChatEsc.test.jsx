import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

vi.mock('../../api', () => ({ default: { post: vi.fn() } }));
vi.mock('../AiMessage', () => ({ default: () => <div /> }));

import AiChat from '../AiChat';

describe('AiChat', () => {
  it('closes when Escape is pressed and stops listening after unmount', () => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    const onClose = vi.fn();
    const { unmount } = render(<AiChat onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'a' });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
