export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Parses color strings supported by browsers:
 * - Hex: #rgb, #rgba, #rrggbb, #rrggbbaa
 * - Comma syntax: rgb(r, g, b), rgba(r, g, b, a)
 * - Modern space/slash syntax (CSS Color 4): rgb(r g b / a), rgba(r g b / a)
 * - Named colors
 * - transparent
 */
export function parseColor(colorStr: string): RGBA | null {
  if (!colorStr || typeof colorStr !== 'string') return null;
  const str = colorStr.trim().toLowerCase();

  // Transparent / empty
  if (str === 'transparent' || str === 'rgba(0, 0, 0, 0)' || str === 'rgba(0 0 0 / 0)') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  // Hex (#fff, #ffffff, #ffffffff)
  if (str.startsWith('#')) {
    const hex = str.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: 1,
      };
    }
    if (hex.length === 4) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: parseInt(hex[3] + hex[3], 16) / 255,
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: 1,
      };
    }
    if (hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: parseInt(hex.slice(6, 8), 16) / 255,
      };
    }
  }

  // Comma-separated: rgb(r, g, b) or rgba(r, g, b, a)
  const commaMatch = str.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.%]+))?\s*\)/);
  if (commaMatch) {
    const aVal = parseAlpha(commaMatch[4]);
    return {
      r: Math.min(255, Math.max(0, parseFloat(commaMatch[1]))),
      g: Math.min(255, Math.max(0, parseFloat(commaMatch[2]))),
      b: Math.min(255, Math.max(0, parseFloat(commaMatch[3]))),
      a: aVal,
    };
  }

  // Space/slash modern syntax (CSS Color 4): rgb(r g b / a) or rgb(r g b)
  const spaceMatch = str.match(/rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.%]+))?\s*\)/);
  if (spaceMatch) {
    const aVal = parseAlpha(spaceMatch[4]);
    return {
      r: Math.min(255, Math.max(0, parseFloat(spaceMatch[1]))),
      g: Math.min(255, Math.max(0, parseFloat(spaceMatch[2]))),
      b: Math.min(255, Math.max(0, parseFloat(spaceMatch[3]))),
      a: aVal,
    };
  }

  // Common named colors
  const named: Record<string, RGBA> = {
    white: { r: 255, g: 255, b: 255, a: 1 },
    black: { r: 0, g: 0, b: 0, a: 1 },
    red: { r: 255, g: 0, b: 0, a: 1 },
    green: { r: 0, g: 128, b: 0, a: 1 },
    blue: { r: 0, g: 0, b: 255, a: 1 },
    gray: { r: 128, g: 128, b: 128, a: 1 },
    grey: { r: 128, g: 128, b: 128, a: 1 },
    silver: { r: 192, g: 192, b: 192, a: 1 },
    navy: { r: 0, g: 0, b: 128, a: 1 },
    purple: { r: 128, g: 0, b: 128, a: 1 },
    yellow: { r: 255, g: 255, b: 0, a: 1 },
    orange: { r: 255, g: 165, b: 0, a: 1 },
  };
  if (named[str]) return named[str];

  return null;
}

function parseAlpha(alphaStr?: string): number {
  if (alphaStr === undefined) return 1;
  const trimmed = alphaStr.trim();
  if (trimmed.endsWith('%')) {
    return Math.min(1, Math.max(0, parseFloat(trimmed.slice(0, -1)) / 100));
  }
  return Math.min(1, Math.max(0, parseFloat(trimmed)));
}

/**
 * Composites a source color (top) over a destination background color (bottom).
 * Standard alpha blending:
 * outA = srcA + dstA * (1 - srcA)
 * outRGB = (srcRGB * srcA + dstRGB * dstA * (1 - srcA)) / outA
 */
export function blendColors(src: RGBA, dst: RGBA): RGBA {
  const srcA = src.a;
  const dstA = dst.a;
  const outA = srcA + dstA * (1 - srcA);

  if (outA === 0) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const outR = Math.round((src.r * srcA + dst.r * dstA * (1 - srcA)) / outA);
  const outG = Math.round((src.g * srcA + dst.g * dstA * (1 - srcA)) / outA);
  const outB = Math.round((src.b * srcA + dst.b * dstA * (1 - srcA)) / outA);

  return {
    r: Math.min(255, Math.max(0, outR)),
    g: Math.min(255, Math.max(0, outG)),
    b: Math.min(255, Math.max(0, outB)),
    a: Math.min(1, Math.max(0, outA)),
  };
}

/**
 * Computes WCAG 2.2 relative luminance for a fully opaque sRGB color.
 */
export function calculateRelativeLuminance(rgba: RGBA): number {
  const [r, g, b] = [rgba.r, rgba.g, rgba.b].map((channel) => {
    const sRGB = channel / 255;
    return sRGB <= 0.04045 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Computes the exact WCAG 2.2 contrast ratio: (L1 + 0.05) / (L2 + 0.05).
 * Uses full floating point precision for classification.
 */
export function calculateContrastRatioRaw(color1: RGBA | string, color2: RGBA | string): number {
  const c1 = typeof color1 === 'string' ? parseColor(color1) : color1;
  const c2 = typeof color2 === 'string' ? parseColor(color2) : color2;

  if (!c1 || !c2) return 1.0;

  // Auto-composite if one color is semi-transparent over an opaque background
  const effC1 = c1.a < 0.999 && c2.a >= 0.999 ? blendColors(c1, c2) : c1;
  const effC2 = c2.a < 0.999 && c1.a >= 0.999 ? blendColors(c2, c1) : c2;

  const l1 = calculateRelativeLuminance(effC1);
  const l2 = calculateRelativeLuminance(effC2);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Contrast ratio rounded to 2 decimal places strictly for presentation.
 */
export function calculateContrastRatio(color1: RGBA | string, color2: RGBA | string): number {
  const raw = calculateContrastRatioRaw(color1, color2);
  return Math.round(raw * 100) / 100;
}

/**
 * Multiplies an RGBA color's alpha by ancestor or element opacity.
 */
export function applyElementOpacity(color: RGBA, totalOpacity: number): RGBA {
  const clampedOpacity = Math.max(0, Math.min(1, totalOpacity));
  return {
    ...color,
    a: Math.max(0, Math.min(1, color.a * clampedOpacity)),
  };
}

/**
 * Composites multiple background layers from top to bottom.
 * Layers array: [elementBg, parentBg, grandparentBg, ..., rootBg]
 * Returns the final blended color and whether the stack reached full opacity (a >= 0.999).
 */
export function compositeLayers(layers: (RGBA | string)[]): { color: RGBA; isOpaque: boolean } {
  const parsedLayers = layers
    .map((l) => (typeof l === 'string' ? parseColor(l) : l))
    .filter((l): l is RGBA => l !== null);

  if (parsedLayers.length === 0) {
    return { color: { r: 0, g: 0, b: 0, a: 0 }, isOpaque: false };
  }

  // Start with top layer
  let accumulated = parsedLayers[0];

  for (let i = 1; i < parsedLayers.length; i++) {
    if (accumulated.a >= 0.999) {
      break; // Already fully opaque, lower layers are occluded
    }
    accumulated = blendColors(accumulated, parsedLayers[i]);
  }

  return {
    color: accumulated,
    isOpaque: accumulated.a >= 0.999,
  };
}

