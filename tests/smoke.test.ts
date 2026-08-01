import { describe, expect, it } from 'vitest';

describe('smoke', () => {
  it('vitest runs under the project toolchain', () => {
    expect(1 + 1).toBe(2);
  });
});
