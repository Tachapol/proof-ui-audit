import { describe, it, expect } from 'vitest';
import { calculateContrastRatio, calculateRelativeLuminance, parseColor } from '../color-math';

describe('WCAG 2.2 Relative Luminance and Contrast Math', () => {
  it('computes 21:1 contrast ratio between pure black and pure white', () => {
    const ratio = calculateContrastRatio('#000000', '#ffffff');
    expect(ratio).toBe(21);
  });

  it('computes 1:1 contrast ratio between identical colors', () => {
    const ratio = calculateContrastRatio('#ffffff', '#ffffff');
    expect(ratio).toBe(1);
  });

  it('correctly calculates known contrast ratios', () => {
    // #767676 on #ffffff is known WCAG 4.54:1 (passes normal text)
    const ratio1 = calculateContrastRatio('#767676', '#ffffff');
    expect(ratio1).toBeGreaterThanOrEqual(4.5);

    // #999999 on #ffffff is ~2.84:1 (fails normal text)
    const ratio2 = calculateContrastRatio('#999999', '#ffffff');
    expect(ratio2).toBeLessThan(3.0);
    expect(ratio2).toBeGreaterThan(2.5);
  });

  it('handles semi-transparent foreground blended over white background', () => {
    // rgba(0, 0, 0, 0.5) over white is effectively gray #7f7f7f
    const ratio = calculateContrastRatio('rgba(0, 0, 0, 0.5)', '#ffffff');
    expect(ratio).toBeGreaterThan(3.5);
    expect(ratio).toBeLessThan(4.5);
  });
});
