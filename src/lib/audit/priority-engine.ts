import { Priority, AuditStatus, UXIssue } from '@/lib/schema/ux-issue';
import { ProductContext } from '@/lib/schema/product-context';

export const PRIORITY_ENGINE_VERSION = '1.0.0';

export interface PriorityEvaluation {
  priority: Priority;
  rationale: string;
  severityScore: number; // 0 to 100, deterministic and reproducible
  factors: string[];
  ruleEngineVersion: string;
}

export interface PriorityMetadata {
  label: string;
  shortDescription: string;
  fullDescription: string;
  badgeStyle: {
    bg: string;
    text: string;
    border: string;
  };
}

export const PRIORITY_RANKS: Record<Priority, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

export const PRIORITY_METADATA: Record<Priority, PriorityMetadata> = {
  P0: {
    label: 'P0 — Critical Blocker',
    shortDescription: 'Critical blocker or completely obscured control',
    fullDescription: 'Essential functionality is broken or interactive controls are completely unreachable/obscured.',
    badgeStyle: {
      bg: 'bg-rose-100',
      text: 'text-rose-900',
      border: 'border-rose-300',
    },
  },
  P1: {
    label: 'P1 — High Priority',
    shortDescription: 'Severe deficit on primary or interactive content',
    fullDescription: 'Major violation with high barrier to user completion or extreme contrast/sizing deficit.',
    badgeStyle: {
      bg: 'bg-orange-100',
      text: 'text-orange-900',
      border: 'border-orange-300',
    },
  },
  P2: {
    label: 'P2 — Medium Priority',
    shortDescription: 'Moderate deficit on secondary elements',
    fullDescription: 'Measurable violation that causes noticeable friction but content remains partially decipherable.',
    badgeStyle: {
      bg: 'bg-amber-100',
      text: 'text-amber-900',
      border: 'border-amber-300',
    },
  },
  P3: {
    label: 'P3 — Low / Advisory',
    shortDescription: 'Minor deficit, review item, or compliant pass',
    fullDescription: 'Advisory item, potential exception requiring human review, or fully compliant evidence.',
    badgeStyle: {
      bg: 'bg-zinc-100',
      text: 'text-zinc-700',
      border: 'border-zinc-300',
    },
  },
};

export const PRIORITY_DISCLAIMER =
  'Project Heuristic (Not WCAG Severity): P0–P3 priorities are internal team triage heuristics and not defined by the WCAG specification. Designer reprioritization is supported.';

/**
 * Compare two priorities for sorting (P0 comes first, then P1, P2, P3).
 */
export function comparePriority(a: Priority, b: Priority): number {
  return PRIORITY_RANKS[a] - PRIORITY_RANKS[b];
}

/**
 * Multilingual keywords for accessibility-sensitive user cohorts (Thai and English).
 * Irrelevant keywords must not trigger priority escalation.
 */
const HIGH_SENSITIVITY_AUDIENCE_REGEX = /(?:elderly|senior|older|low[\s-]vision|visual(?:ly)?[\s-]impaired|touch[\s-]first|ผู้สูงอายุ|คนชรา|สูงวัย|สายตาเลือนราง|ผู้มีความบกพร่องทางการมองเห็น)/i;

/**
 * Deterministically calculates a 0–100 severity score and priority band.
 * Version: 1.0.0
 * Score Bands:
 *   P0: 90–100 (Critical Blocker)
 *   P1: 70–89  (High Priority)
 *   P2: 40–69  (Medium Priority)
 *   P3: 0–39   (Low / Advisory / Pass)
 */
export function evaluateIssuePriority(params: {
  ruleId: string;
  status: AuditStatus;
  measured: Record<string, unknown>;
  element?: string;
  role?: string;
  productContext?: Partial<ProductContext>;
}): PriorityEvaluation {
  const { ruleId, status, measured = {}, element, role, productContext } = params;
  const factors: string[] = [];

  // 1. Pass status: Always P3, score 0
  if (status === 'pass') {
    return {
      priority: 'P3',
      rationale: `Project Heuristic P3 (Not WCAG Severity): Element meets automated measurement criteria. [Engine v${PRIORITY_ENGINE_VERSION}]`,
      severityScore: 0,
      factors: ['Automated check passed'],
      ruleEngineVersion: PRIORITY_ENGINE_VERSION,
    };
  }

  // 2. NeedsReview status: Always P3, score capped at 25 (Never elevated to confirmed severity)
  if (status === 'needsReview') {
    return {
      priority: 'P3',
      rationale: `Project Heuristic P3 (Not WCAG Severity): Finding is unconfirmed and requires designer inspection for contextual or essential exceptions. [Engine v${PRIORITY_ENGINE_VERSION}]`,
      severityScore: 25,
      factors: ['Requires manual designer review', 'Potential WCAG exception or ambiguous layout'],
      ruleEngineVersion: PRIORITY_ENGINE_VERSION,
    };
  }

  // 3. CandidateFail: Calculate deterministic score based on mathematical deficit
  let priority: Priority = 'P2';
  let severityScore = 50;
  let rationaleDetail = '';

  switch (ruleId) {
    case 'target-size': {
      const rawW = measured.width;
      const rawH = measured.height;
      const isValid = typeof rawW === 'number' && typeof rawH === 'number' && !isNaN(rawW) && !isNaN(rawH);

      if (!isValid) {
        // Missing or inconclusive measurement: must not assume high severity
        priority = 'P3';
        severityScore = 30;
        rationaleDetail = 'Target dimensions are indeterminate or missing. Flagged for verification.';
        factors.push('Inconclusive target measurements');
        break;
      }

      const w = Math.max(0, rawW);
      const h = Math.max(0, rawH);
      const minDim = Math.min(w, h);

      if (minDim < 12) {
        priority = 'P0';
        // 90 to 100 based on how close to 0 it is
        severityScore = Math.round(90 + (1 - minDim / 12) * 10);
        rationaleDetail = `Interactive target is severely undersized (${Math.round(w)}×${Math.round(h)} px < 12px), causing severe touch-target failure.`;
        factors.push('Severe touch-target deficit (< 12px)');
      } else if (minDim < 24) {
        priority = 'P1';
        // 70 to 89 based on deficit from 24
        const deficitFraction = (24 - minDim) / 12; // 0 to 1
        severityScore = Math.round(70 + deficitFraction * 19);
        rationaleDetail = `Interactive target is undersized (${Math.round(w)}×${Math.round(h)} px < 24px) without qualifying spacing.`;
        factors.push('Touch-target below minimum 24px threshold');
      }
      break;
    }

    case 'text-contrast': {
      const rawRatio = measured.contrastRatio;
      const isValid = typeof rawRatio === 'number' && !isNaN(rawRatio) && rawRatio > 0;

      if (!isValid) {
        priority = 'P3';
        severityScore = 30;
        rationaleDetail = 'Contrast ratio could not be determined deterministically. Flagged for verification.';
        factors.push('Inconclusive contrast measurement');
        break;
      }

      const ratio = rawRatio;
      const isLarge = !!measured.isLargeText;
      const req = isLarge ? 3.0 : 4.5;

      if (ratio < 2.0) {
        priority = 'P1';
        // 75 to 89 depending on how close to 1:1
        const severity = (2.0 - Math.max(1.0, ratio)) / 1.0;
        severityScore = Math.round(75 + severity * 14);
        rationaleDetail = `Critical text contrast deficit (${ratio.toFixed(2)}:1 vs ${req}:1). Text is virtually unreadable for low-vision users.`;
        factors.push('Severe contrast ratio deficit (< 2.0:1)');
      } else if (ratio < req) {
        priority = 'P2';
        // 40 to 69 depending on deficit
        const deficit = (req - ratio) / (req - 2.0);
        severityScore = Math.round(40 + deficit * 29);
        rationaleDetail = `Moderate text contrast deficit (${ratio.toFixed(2)}:1 vs ${req}:1).`;
        factors.push(`Contrast ratio below ${req}:1 threshold`);
      }
      break;
    }

    case 'non-text-contrast': {
      const rawRatio = measured.contrastRatio;
      const isValid = typeof rawRatio === 'number' && !isNaN(rawRatio) && rawRatio > 0;

      if (!isValid) {
        priority = 'P3';
        severityScore = 30;
        rationaleDetail = 'Non-text indicator contrast could not be determined. Flagged for verification.';
        factors.push('Inconclusive indicator contrast');
        break;
      }

      const ratio = rawRatio;
      if (ratio < 2.0) {
        priority = 'P1';
        severityScore = Math.round(75 + (2.0 - Math.max(1.0, ratio)) * 14);
        rationaleDetail = `Critical non-text contrast deficit (${ratio.toFixed(2)}:1 vs 3:1). Component boundary or state indicator is nearly invisible.`;
        factors.push('Severe indicator contrast deficit (< 2.0:1)');
      } else {
        priority = 'P2';
        severityScore = Math.round(45 + (3.0 - ratio) * 20);
        rationaleDetail = `Moderate non-text contrast deficit (${ratio.toFixed(2)}:1 vs 3:1).`;
        factors.push('Indicator contrast below 3:1 threshold');
      }
      break;
    }

    case 'reflow': {
      const overflow = typeof measured.horizontalOverflowPx === 'number' ? measured.horizontalOverflowPx : 0;
      const isClipped = typeof measured.clipDeficitPx === 'number' && measured.clipDeficitPx > 0;
      const isOutOfBounds = measured.violation === 'outside-viewport';

      if (isOutOfBounds || (isClipped && (element === 'button' || role === 'button'))) {
        priority = 'P0';
        severityScore = 95;
        rationaleDetail = `Interactive control is clipped or outside viewport at 320px, causing loss of functionality.`;
        factors.push('Interactive control out of bounds / completely clipped');
      } else if (isClipped || overflow > 50) {
        priority = 'P1';
        severityScore = Math.min(89, Math.round(70 + (overflow > 50 ? Math.min(19, (overflow - 50) / 5) : 10)));
        rationaleDetail = isClipped
          ? `Content clipped by ancestor overflow restriction (${Math.round(Number(measured.clipDeficitPx))}px clipped).`
          : `Severe horizontal overflow (${Math.round(overflow)}px > 50px) forcing bidirectional scrolling at 320px.`;
        factors.push(isClipped ? 'Content clipped by overflow:hidden' : 'Major horizontal overflow (> 50px)');
      } else {
        priority = 'P2';
        severityScore = Math.min(69, Math.round(40 + (overflow / 50) * 29));
        rationaleDetail = `Moderate horizontal overflow (${Math.round(overflow)}px) at 320px.`;
        factors.push('Moderate horizontal overflow (<= 50px)');
      }
      break;
    }

    case 'text-spacing': {
      const isObscured = !!measured.isControlObscured;
      const verticalClip = typeof measured.clipDeficitPx === 'number' ? measured.clipDeficitPx : 0;
      const isHorizClipped = !!measured.horizontalClipDeficitPx && Number(measured.horizontalClipDeficitPx) > 0;

      if (isObscured) {
        priority = 'P0';
        severityScore = 98;
        rationaleDetail = `Interactive control is obscured or overlapped by expanding text, causing critical loss of functionality.`;
        factors.push('Interactive control obscured by expanded text');
      } else if (isHorizClipped || verticalClip > 15) {
        priority = 'P1';
        severityScore = Math.min(89, Math.round(72 + Math.min(17, verticalClip / 2)));
        rationaleDetail = isHorizClipped
          ? `Text horizontally clipped under text-spacing overrides.`
          : `Significant vertical clipping (${Math.round(verticalClip)}px > 15px) under text-spacing overrides.`;
        factors.push(isHorizClipped ? 'Horizontal text truncation' : 'Severe vertical text clipping (> 15px)');
      } else {
        priority = 'P2';
        severityScore = Math.min(65, Math.round(45 + verticalClip * 3));
        rationaleDetail = `Moderate text clipping or bounding box escape under text-spacing overrides.`;
        factors.push('Moderate text expansion clipping');
      }
      break;
    }

    default:
      rationaleDetail = 'Automated check identified a candidate failure.';
      break;
  }

  // 4. Product Context Weighting (Tested with Thai, English, irrelevant, and empty inputs)
  // Contextual weighting ONLY applies to confirmed candidateFail (P2 -> P1), never to needsReview or pass.
  const audience = productContext?.targetAudience?.trim();
  if (audience && HIGH_SENSITIVITY_AUDIENCE_REGEX.test(audience)) {
    if (priority === 'P2' && (ruleId === 'text-contrast' || ruleId === 'target-size')) {
      priority = 'P1';
      severityScore = Math.min(85, severityScore + 15);
      factors.push(`Priority elevated from P2 to P1 for sensitive audience cohort: "${audience}"`);
    }
  }

  const rationale = `Project Heuristic ${priority} (Not WCAG Severity): ${rationaleDetail} Designer reprioritization supported. [Engine v${PRIORITY_ENGINE_VERSION}]`;

  return {
    priority,
    rationale,
    severityScore: Math.min(100, Math.max(0, severityScore)),
    factors,
    ruleEngineVersion: PRIORITY_ENGINE_VERSION,
  };
}

/**
 * Resolves priority for a grouped set of occurrences across evaluated viewports.
 * Requirements:
 * 1. Counts distinct evaluated viewports accurately.
 * 2. Phrasing strictly states: "พบใน X ขนาดหน้าจอที่ทดสอบ (Observed across X evaluated test viewports)",
 *    and does NOT claim it affects all devices in the wild.
 * 3. Preserves human designer overrides if already present.
 */
export function resolveGroupedPriority(
  occurrences: UXIssue[],
  existingDesignerOverride?: { priority: Priority; reason: string }
): {
  priority: Priority;
  initialPriority: Priority;
  rationale: string;
  isDesignerOverridden: boolean;
  distinctViewportCount: number;
} {
  if (!occurrences.length) {
    return {
      priority: 'P3',
      initialPriority: 'P3',
      rationale: `Project Heuristic P3 (Not WCAG Severity): No occurrences recorded. [Engine v${PRIORITY_ENGINE_VERSION}]`,
      isDesignerOverridden: false,
      distinctViewportCount: 0,
    };
  }

  // Calculate highest machine-computed priority among occurrences
  let highestCalculated = occurrences[0].initialPriority;
  for (const occ of occurrences) {
    if (PRIORITY_RANKS[occ.initialPriority] < PRIORITY_RANKS[highestCalculated]) {
      highestCalculated = occ.initialPriority;
    }
  }

  // Count distinct evaluated viewports
  const uniqueViewports = new Set(occurrences.map((o) => `${o.viewport.width}x${o.viewport.height}`));
  const distinctViewportCount = uniqueViewports.size;

  let calculatedPriority = highestCalculated;
  const compositeFactors: string[] = [];

  // Escalation policy: If a candidateFail is P2 but observed across >= 3 evaluated test viewports
  // Note: Only candidateFail is eligible; needsReview remains P3.
  const hasOnlyReviewOrPass = occurrences.every((o) => o.status === 'needsReview' || o.status === 'pass');
  if (distinctViewportCount >= 3 && highestCalculated === 'P2' && !hasOnlyReviewOrPass) {
    calculatedPriority = 'P1';
    compositeFactors.push(`พบใน ${distinctViewportCount} ขนาดหน้าจอที่ทดสอบ (Observed across ${distinctViewportCount} evaluated test viewports)`);
  }

  if (occurrences.length >= 5) {
    compositeFactors.push(`ความถี่สูง (${occurrences.length} จุดที่ตรวจพบในชุดทดสอบ / High recurrence: ${occurrences.length} instances)`);
  }

  const baseRationale = occurrences.find((o) => o.initialPriority === highestCalculated)?.priorityRationale
    || `Project Heuristic ${calculatedPriority} (Not WCAG Severity): Evaluated from ${occurrences.length} occurrence(s).`;

  const finalCalculatedRationale = compositeFactors.length
    ? `${baseRationale} [Composite escalation: ${compositeFactors.join('; ')}]`
    : baseRationale;

  // Designer Override Preservation:
  // If the human designer has overridden priority, preserve their decision while retaining the machine baseline.
  if (existingDesignerOverride && existingDesignerOverride.priority) {
    return {
      priority: existingDesignerOverride.priority,
      initialPriority: calculatedPriority,
      rationale: `${finalCalculatedRationale} (Designer Override: ${calculatedPriority} → ${existingDesignerOverride.priority}. Rationale: "${existingDesignerOverride.reason}")`,
      isDesignerOverridden: true,
      distinctViewportCount,
    };
  }

  return {
    priority: calculatedPriority,
    initialPriority: calculatedPriority,
    rationale: finalCalculatedRationale,
    isDesignerOverridden: false,
    distinctViewportCount,
  };
}
