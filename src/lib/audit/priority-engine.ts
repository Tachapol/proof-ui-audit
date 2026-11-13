import { Priority, AuditStatus, UXIssue } from '@/lib/schema/ux-issue';
import { ProductContext } from '@/lib/schema/product-context';

export interface PriorityEvaluation {
  priority: Priority;
  rationale: string;
  severityScore: number; // 0 to 100
  factors: string[];
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
 * Deterministically evaluates the priority and rationale for an issue based on:
 * 1. Rule type & measured evidence severity
 * 2. Status (pass / candidateFail / needsReview)
 * 3. Element interactivity / role
 * 4. Product context (e.g. mobile-first, target audience)
 */
export function evaluateIssuePriority(params: {
  ruleId: string;
  status: AuditStatus;
  measured: Record<string, unknown>;
  element?: string;
  role?: string;
  productContext?: Partial<ProductContext>;
}): PriorityEvaluation {
  const { ruleId, status, measured, element, role, productContext } = params;
  const factors: string[] = [];

  // Pass and needsReview have predetermined priority baselines
  if (status === 'pass') {
    return {
      priority: 'P3',
      rationale: `Project Heuristic P3 (Not WCAG Severity): Element meets automated measurement criteria.`,
      severityScore: 10,
      factors: ['Automated check passed'],
    };
  }

  if (status === 'needsReview') {
    return {
      priority: 'P3',
      rationale: `Project Heuristic P3 (Not WCAG Severity): Finding requires designer inspection for contextual or essential exceptions.`,
      severityScore: 25,
      factors: ['Requires manual designer review', 'Potential WCAG exception'],
    };
  }

  // Evaluate candidateFail across rules
  let priority: Priority = 'P2';
  let severityScore = 50;
  let rationaleDetail = '';

  switch (ruleId) {
    case 'target-size': {
      const w = typeof measured.width === 'number' ? measured.width : 24;
      const h = typeof measured.height === 'number' ? measured.height : 24;
      const minDim = Math.min(w, h);

      if (minDim < 12) {
        priority = 'P0';
        severityScore = 95;
        rationaleDetail = `Interactive target is severely undersized (${Math.round(w)}×${Math.round(h)} px < 12px), causing severe touch-target failure.`;
        factors.push('Severe touch-target deficit (< 12px)');
      } else if (minDim < 24) {
        priority = 'P1';
        severityScore = 75;
        rationaleDetail = `Interactive target is undersized (${Math.round(w)}×${Math.round(h)} px < 24px) without sufficient spacing.`;
        factors.push('Touch-target below minimum 24px threshold');
      }
      break;
    }

    case 'text-contrast': {
      const ratio = typeof measured.contrastRatio === 'number' ? measured.contrastRatio : 4.5;
      const isLarge = !!measured.isLargeText;
      const req = isLarge ? 3.0 : 4.5;

      if (ratio < 2.0) {
        priority = 'P1';
        severityScore = 85;
        rationaleDetail = `Critical text contrast deficit (${ratio.toFixed(2)}:1 vs ${req}:1). Text is virtually unreadable for low-vision users.`;
        factors.push('Severe contrast ratio deficit (< 2.0:1)');
      } else if (ratio < req) {
        priority = 'P2';
        severityScore = 60;
        rationaleDetail = `Moderate text contrast deficit (${ratio.toFixed(2)}:1 vs ${req}:1).`;
        factors.push(`Contrast ratio below ${req}:1 threshold`);
      }
      break;
    }

    case 'non-text-contrast': {
      const ratio = typeof measured.contrastRatio === 'number' ? measured.contrastRatio : 3.0;
      if (ratio < 2.0) {
        priority = 'P1';
        severityScore = 80;
        rationaleDetail = `Critical non-text contrast deficit (${ratio.toFixed(2)}:1 vs 3:1). Component boundary or state indicator is nearly invisible.`;
        factors.push('Severe indicator contrast deficit (< 2.0:1)');
      } else {
        priority = 'P2';
        severityScore = 55;
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
        severityScore = 80;
        rationaleDetail = isClipped
          ? `Content clipped by ancestor overflow restriction (${Math.round(Number(measured.clipDeficitPx))}px clipped).`
          : `Severe horizontal overflow (${Math.round(overflow)}px > 50px) forcing bidirectional scrolling at 320px.`;
        factors.push(isClipped ? 'Content clipped by overflow:hidden' : 'Major horizontal overflow (> 50px)');
      } else {
        priority = 'P2';
        severityScore = 60;
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
        severityScore = 80;
        rationaleDetail = isHorizClipped
          ? `Text horizontally clipped under text-spacing overrides.`
          : `Significant vertical clipping (${Math.round(verticalClip)}px > 15px) under text-spacing overrides.`;
        factors.push(isHorizClipped ? 'Horizontal text truncation' : 'Severe vertical text clipping (> 15px)');
      } else {
        priority = 'P2';
        severityScore = 60;
        rationaleDetail = `Moderate text clipping or bounding box escape under text-spacing overrides.`;
        factors.push('Moderate text expansion clipping');
      }
      break;
    }

    default:
      rationaleDetail = 'Automated check identified a candidate failure.';
      break;
  }

  // Contextual weighting: if target audience or goal emphasizes touch/mobile or accessibility
  if (productContext?.targetAudience) {
    const audienceLower = productContext.targetAudience.toLowerCase();
    if (audienceLower.includes('elderly') || audienceLower.includes('senior') || audienceLower.includes('low vision')) {
      if (priority === 'P2' && (ruleId === 'text-contrast' || ruleId === 'target-size')) {
        priority = 'P1';
        severityScore += 15;
        factors.push(`Priority elevated for target audience: ${productContext.targetAudience}`);
      }
    }
  }

  const rationale = `Project Heuristic ${priority} (Not WCAG Severity): ${rationaleDetail} Designer reprioritization supported.`;

  return {
    priority,
    rationale,
    severityScore: Math.min(100, severityScore),
    factors,
  };
}

/**
 * Resolves priority for a grouped set of occurrences across viewports.
 * Upgrades priority if the issue spans multiple viewports or affects a high number of instances.
 */
export function resolveGroupedPriority(occurrences: UXIssue[]): {
  priority: Priority;
  rationale: string;
} {
  if (!occurrences.length) {
    return {
      priority: 'P3',
      rationale: 'Project Heuristic P3 (Not WCAG Severity): No occurrences recorded.',
    };
  }

  // Find highest individual occurrence priority
  let highest = occurrences[0].initialPriority;
  for (const occ of occurrences) {
    if (PRIORITY_RANKS[occ.initialPriority] < PRIORITY_RANKS[highest]) {
      highest = occ.initialPriority;
    }
  }

  // Multi-viewport escalation check:
  // If an issue is P2 candidateFail but appears across all 3 viewports (e.g. 320, 375, 1440),
  // it is pervasive and impacts mobile, tablet, and desktop users.
  const uniqueViewports = new Set(occurrences.map((o) => `${o.viewport.width}x${o.viewport.height}`));
  let effectivePriority = highest;
  const compositeFactors: string[] = [];

  if (uniqueViewports.size >= 3 && highest === 'P2') {
    effectivePriority = 'P1';
    compositeFactors.push(`Pervasive across ${uniqueViewports.size} distinct viewports`);
  }

  if (occurrences.length >= 5) {
    compositeFactors.push(`High recurrence (${occurrences.length} instances)`);
  }

  const baseRationale = occurrences.find((o) => o.initialPriority === highest)?.priorityRationale
    || `Project Heuristic ${effectivePriority} (Not WCAG Severity): Evaluated from ${occurrences.length} occurrence(s).`;

  const finalRationale = compositeFactors.length
    ? `${baseRationale} [Composite escalation: ${compositeFactors.join(', ')}]`
    : baseRationale;

  return {
    priority: effectivePriority,
    rationale: finalRationale,
  };
}
