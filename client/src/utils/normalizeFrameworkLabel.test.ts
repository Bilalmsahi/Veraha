import { describe, expect, it } from 'vitest';
import { normalizeFrameworkLabel } from './normalizeFrameworkLabel';

describe('normalizeFrameworkLabel', () => {
  it('normalizes SOC 2 variants for display', () => {
    expect(normalizeFrameworkLabel('SOC 2 Type 2')).toBe('SOC 2');
    expect(normalizeFrameworkLabel('SOC2 Type II')).toBe('SOC 2');
    expect(normalizeFrameworkLabel('SOC 2 Type I')).toBe('SOC 2');
    expect(normalizeFrameworkLabel('SOC2')).toBe('SOC 2');
    expect(normalizeFrameworkLabel('soc 2 type 2')).toBe('SOC 2');
  });
});
