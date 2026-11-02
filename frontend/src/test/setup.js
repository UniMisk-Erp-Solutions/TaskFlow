import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

// jsdom does not implement these browser APIs.
window.HTMLElement.prototype.scrollIntoView = window.HTMLElement.prototype.scrollIntoView || (() => {});
URL.createObjectURL = URL.createObjectURL || (() => 'blob:test');
URL.revokeObjectURL = URL.revokeObjectURL || (() => {});

// Scroll animations and the home page's 3D hero observe elements; jsdom has no observers, so treat everything as visible.
class NoopObserver {
  constructor(callback) { this.callback = callback; }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}
window.IntersectionObserver = window.IntersectionObserver || NoopObserver;
window.ResizeObserver = window.ResizeObserver || NoopObserver;
