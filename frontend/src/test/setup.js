import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

// jsdom does not implement these browser APIs.
window.HTMLElement.prototype.scrollIntoView = window.HTMLElement.prototype.scrollIntoView || (() => {});
URL.createObjectURL = URL.createObjectURL || (() => 'blob:test');
URL.revokeObjectURL = URL.revokeObjectURL || (() => {});
