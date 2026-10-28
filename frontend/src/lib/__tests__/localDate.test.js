import { describe, it, expect } from 'vitest';
import { localYmd } from '../localDate';

describe('localYmd', () => {
  it('keeps the local calendar day, even right after local midnight', () => {
    expect(localYmd(new Date(2026, 9, 30, 0, 5))).toBe('2026-10-30');
    expect(localYmd(new Date(2026, 9, 30, 23, 59))).toBe('2026-10-30');
  });

  it('pads single digit months and days', () => {
    expect(localYmd(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
