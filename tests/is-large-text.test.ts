import { describe, expect, it } from 'vitest';
import { isLargeText } from '../utils/color';

describe('isLargeText (WCAG 1.4.3)', () => {
  it('normal weight below 24px is not large text', () => {
    expect(isLargeText(12, 400)).toBe(false);
    expect(isLargeText(16, 400)).toBe(false);
    expect(isLargeText(20, 400)).toBe(false);
  });

  it('bold below 18.66px is not large text', () => {
    expect(isLargeText(18.5, 700)).toBe(false);
  });

  it('bold at or above 18.66px is large text', () => {
    expect(isLargeText(18.66, 700)).toBe(true);
    expect(isLargeText(19, 700)).toBe(true);
  });

  it('normal weight at or above 24px is large text', () => {
    expect(isLargeText(24, 400)).toBe(true);
    expect(isLargeText(30, 400)).toBe(true);
  });
});
