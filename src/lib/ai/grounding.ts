import { AIExplanationInput } from '@/lib/schema/ai-response';

export interface GroundingValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates model output against deterministic audit evidence and WCAG thresholds.
 * If safe grounding cannot be established, the output is rejected and the service
 * seamlessly falls back to the deterministic explanation provider.
 */
export function validateAIGrounding(
  aiOutput: {
    explanation: string;
    recommendation: string;
    requiresDesignerReview: boolean;
    uncertaintyNote?: string;
  },
  input: AIExplanationInput
): GroundingValidationResult {
  const combinedText = `${aiOutput.explanation} ${aiOutput.recommendation} ${aiOutput.uncertaintyNote || ''}`.toLowerCase();

  // 1. UNCONDITIONAL needsReview ENFORCEMENT:
  // For every needsReview issue, requiresDesignerReview MUST be true and uncertaintyNote MUST be non-empty,
  // regardless of whether exception or reviewReason was populated in the evidence.
  if (input.status === 'needsReview') {
    if (!aiOutput.requiresDesignerReview) {
      return {
        valid: false,
        reason: 'Grounding failure: needsReview issue must set requiresDesignerReview to true.',
      };
    }
    if (!aiOutput.uncertaintyNote || aiOutput.uncertaintyNote.trim().length === 0) {
      return {
        valid: false,
        reason: 'Grounding failure: needsReview issue must provide an explicit non-empty uncertaintyNote.',
      };
    }

    // 1a. Must not claim definite failure for needsReview
    const definiteFailurePhrases = [
      'confirmed violation',
      'definitely fails',
      'definite failure',
      'absolute violation',
      'proven defect',
      'definite failure of accessibility',
      'is a definite failure',
      'confirmed failure',
    ];
    for (const phrase of definiteFailurePhrases) {
      if (combinedText.includes(phrase)) {
        return {
          valid: false,
          reason: `Grounding failure: needsReview issue incorrectly claimed definite failure ("${phrase}").`,
        };
      }
    }

    // 1b. Must not claim definite pass for needsReview
    const definitePassPhrases = [
      'is fully compliant',
      'passes accessibility',
      'definite pass',
      'confirmed pass',
      'is compliant',
      'conforms to wcag',
      'meets all requirements',
      'fully satisfies',
    ];
    for (const phrase of definitePassPhrases) {
      if (combinedText.includes(phrase)) {
        return {
          valid: false,
          reason: `Grounding failure: needsReview issue incorrectly claimed definite pass ("${phrase}").`,
        };
      }
    }

    // 1c. Must not claim confirmed exception for needsReview
    const confirmedExceptionPhrases = [
      'confirmed exception',
      'definitely exempt',
      'guaranteed exception',
      'qualifies without review',
      'confirmed exemption',
      'exception is confirmed',
      'definitely qualifies for an exception',
    ];
    for (const phrase of confirmedExceptionPhrases) {
      if (combinedText.includes(phrase)) {
        return {
          valid: false,
          reason: `Grounding failure: needsReview issue claimed confirmed exception ("${phrase}").`,
        };
      }
    }

    // 1d. Must not claim confirmed fix for needsReview
    const confirmedFixPhrases = [
      'fix is confirmed',
      'confirmed fix',
      'verified fix',
      'fix has been confirmed',
      'remediation verified',
      'fix has resolved the issue',
    ];
    for (const phrase of confirmedFixPhrases) {
      if (combinedText.includes(phrase)) {
        return {
          valid: false,
          reason: `Grounding failure: needsReview issue claimed confirmed fix ("${phrase}").`,
        };
      }
    }
  }

  // 2. Reject claims of full WCAG compliance or website-wide accessibility
  const complianceClaims = [
    'fully compliant',
    '100% compliant',
    'guarantees compliance',
    'guarantees full compliance',
    'certified accessible',
    'whole page is compliant',
    'entire site is compliant',
    'entire page is accessible',
    'complete wcag compliance',
  ];
  for (const claim of complianceClaims) {
    if (combinedText.includes(claim)) {
      return {
        valid: false,
        reason: `Grounding failure: output made unsupported compliance claim ("${claim}").`,
      };
    }
  }

  // 3. Reject claims that source code was modified or applied
  const modificationClaims = [
    'source code was modified',
    'source code has been modified',
    'code has been fixed',
    'we have applied the fix',
    'fix has been applied',
    'already updated the code',
    'updated the css rules in the codebase',
    'in the codebase',
    'updated the code',
    'modified the source',
    'updated the codebase',
  ];
  for (const claim of modificationClaims) {
    if (combinedText.includes(claim)) {
      return {
        valid: false,
        reason: `Grounding failure: output claimed source code was modified ("${claim}").`,
      };
    }
  }

  // 4. Reject claims that recommendation was tested or verified
  const testedClaims = [
    'recommendation was tested',
    'recommendation has been verified',
    'fix was verified in production',
    'tested and verified fix',
    'has been verified in testing',
    'verified in testing',
    'fix has been verified',
    'tested and verified',
  ];
  for (const claim of testedClaims) {
    if (combinedText.includes(claim)) {
      return {
        valid: false,
        reason: `Grounding failure: output claimed recommendation was tested ("${claim}").`,
      };
    }
  }

  // 5. Reject claims attributing P0–P3 to WCAG
  if (
    /\bwcag\b[^\n.]{0,30}\b(p0|p1|p2|p3)\b/i.test(combinedText) ||
    /\b(p0|p1|p2|p3)\b[^\n.]{0,30}\bwcag\b/i.test(combinedText) ||
    combinedText.includes('wcag priority')
  ) {
    return {
      valid: false,
      reason: 'Grounding failure: output conflated project priority heuristic with WCAG.',
    };
  }

  // 6. Reject citations of conflicting WCAG criteria
  // Known criteria in this PoC: 2.5.8, 1.4.3, 1.4.11, 1.4.10, 1.4.12
  const allCriteria = ['2.5.8', '1.4.3', '1.4.11', '1.4.10', '1.4.12'];
  const expectedCriterionNum = input.wcagCriterion.match(/\d+\.\d+\.\d+/)?.[0];
  if (expectedCriterionNum) {
    for (const crit of allCriteria) {
      if (crit !== expectedCriterionNum && combinedText.includes(crit)) {
        return {
          valid: false,
          reason: `Grounding failure: output cited conflicting WCAG criterion ${crit} instead of expected ${expectedCriterionNum}.`,
        };
      }
    }
  }

  // 7. EXPLICIT THRESHOLD GROUNDING PER RULE FAMILY
  // Validates that the model does not claim an incorrect threshold for any of the 5 criteria
  switch (input.ruleId) {
    case 'target-size': {
      // Must not claim threshold other than 24x24 px
      const thresholdClaim = combinedText.match(/threshold(?:\s+of)?\s+(\d+)(?:\s*[×x]\s*(\d+))?\s*(?:css\s*)?px/i);
      if (thresholdClaim) {
        const val1 = parseInt(thresholdClaim[1], 10);
        const val2 = thresholdClaim[2] ? parseInt(thresholdClaim[2], 10) : val1;
        if (val1 !== 24 || val2 !== 24) {
          return {
            valid: false,
            reason: `Grounding failure: incorrect threshold claimed for target-size (claimed ${thresholdClaim[0]}, expected 24×24 CSS px).`,
          };
        }
      }
      break;
    }

    case 'text-contrast': {
      const isLargeText = String(input.expected?.thresholdDescription || '').includes('3:1') ||
        String(input.description || '').toLowerCase().includes('large text');

      if (isLargeText) {
        // Large text threshold must be 3:1
        if (combinedText.includes('threshold of 4.5:1') || combinedText.includes('minimum of 4.5:1') || combinedText.includes('requires 4.5:1')) {
          return {
            valid: false,
            reason: 'Grounding failure: incorrect threshold claimed for text-contrast on large text (claimed 4.5:1, expected 3:1).',
          };
        }
      } else {
        // Normal text threshold must be 4.5:1
        if (combinedText.includes('threshold of 3:1') || combinedText.includes('minimum of 3:1') || combinedText.includes('requires 3:1')) {
          return {
            valid: false,
            reason: 'Grounding failure: incorrect threshold claimed for text-contrast on normal text (claimed 3:1, expected 4.5:1).',
          };
        }
      }
      break;
    }

    case 'non-text-contrast': {
      // Non-text contrast threshold is 3:1
      if (combinedText.includes('threshold of 4.5:1') || combinedText.includes('minimum of 4.5:1') || combinedText.includes('requires 4.5:1')) {
        return {
          valid: false,
          reason: 'Grounding failure: incorrect threshold claimed for non-text-contrast (claimed 4.5:1, expected 3:1).',
        };
      }
      break;
    }

    case 'reflow': {
      // Reflow threshold is 320px
      const reflowThresholdMatch = combinedText.match(/reflow(?:\s+threshold)?(?:\s+at|\s+of)?\s+(\d+)\s*(?:css\s*)?px/i);
      if (reflowThresholdMatch) {
        const px = parseInt(reflowThresholdMatch[1], 10);
        if (px !== 320) {
          return {
            valid: false,
            reason: `Grounding failure: incorrect threshold claimed for reflow (claimed ${px}px, expected 320 CSS px).`,
          };
        }
      }
      break;
    }

    case 'text-spacing': {
      // Text spacing thresholds: line-height 1.5, paragraph spacing 2, letter spacing 0.12, word spacing 0.16
      const lhMatch = combinedText.match(/line\s*[- ]?height(?:\s+of|\s+at|\s*[:=])?\s*(\d+(?:\.\d+)?)/i);
      if (lhMatch && parseFloat(lhMatch[1]) !== 1.5) {
        return {
          valid: false,
          reason: `Grounding failure: incorrect threshold claimed for line-height (claimed ${lhMatch[1]}, expected 1.5).`,
        };
      }

      const psMatch = combinedText.match(/paragraph\s+spacing(?:\s+of|\s+at|\s*[:=])?\s*(\d+(?:\.\d+)?)/i);
      if (psMatch && parseFloat(psMatch[1]) !== 2) {
        return {
          valid: false,
          reason: `Grounding failure: incorrect threshold claimed for paragraph spacing (claimed ${psMatch[1]}, expected 2).`,
        };
      }

      const lsMatch = combinedText.match(/letter\s+spacing(?:\s+of|\s+at|\s*[:=])?\s*(\d+(?:\.\d+)?)/i);
      if (lsMatch && parseFloat(lsMatch[1]) !== 0.12) {
        return {
          valid: false,
          reason: `Grounding failure: incorrect threshold claimed for letter spacing (claimed ${lsMatch[1]}, expected 0.12).`,
        };
      }

      const wsMatch = combinedText.match(/word\s+spacing(?:\s+of|\s+at|\s*[:=])?\s*(\d+(?:\.\d+)?)/i);
      if (wsMatch && parseFloat(wsMatch[1]) !== 0.16) {
        return {
          valid: false,
          reason: `Grounding failure: incorrect threshold claimed for word spacing (claimed ${wsMatch[1]}, expected 0.16).`,
        };
      }
      break;
    }
  }

  // 8. Reject invented measurements (with protection for harmless numbers)
  // Collect all known numbers from input evidence
  const allowedNumbers = new Set<string>();
  const standardConstants = [
    '24', '44', '4.5', '3', '7', '320', '1280', '1.5', '2', '0.12', '0.16', '1', '2.2', '2.1'
  ];
  standardConstants.forEach((n) => allowedNumbers.add(n));

  if (input.viewport) {
    allowedNumbers.add(String(input.viewport.width));
    allowedNumbers.add(String(input.viewport.height));
  }

  function extractNumbers(obj: Record<string, unknown>) {
    for (const val of Object.values(obj)) {
      if (typeof val === 'number') {
        allowedNumbers.add(String(val));
        allowedNumbers.add(val.toFixed(2));
      } else if (typeof val === 'string') {
        const matches = val.match(/\d+(?:\.\d+)?/g);
        if (matches) matches.forEach((m) => allowedNumbers.add(m));
      } else if (typeof val === 'object' && val !== null) {
        extractNumbers(val as Record<string, unknown>);
      }
    }
  }

  extractNumbers(input.measured);
  extractNumbers(input.expected);

  // Look specifically for dimensional or measurement claims:
  // e.g. "measured at 11.25px", "width of 13.75px", "ratio of 2.15:1"
  // Does NOT match harmless numbers like "step 1", "2 items", or selector IDs like "#btn-2"
  const measurementClaimRegex = /(?:measured(?:\s+at)?|dimensions?(?:\s+of)?|width(?:\s+of)?|height(?:\s+of)?|ratio(?:\s+of)?|overflow(?:\s+of)?|clipped(?:\s+by)?)\s*[:=]?\s*(\d+(?:\.\d+)?)(?:px|%|:1|em|rem)?\b/gi;
  let mClaim;
  while ((mClaim = measurementClaimRegex.exec(combinedText)) !== null) {
    const claimedNum = mClaim[1];
    if (!allowedNumbers.has(claimedNum) && !allowedNumbers.has(parseFloat(claimedNum).toString())) {
      return {
        valid: false,
        reason: `Grounding failure: Invented or unverified measurement "${mClaim[0]}" not present in evidence.`,
      };
    }
  }

  // Also match any explicit pixel or ratio literal (e.g. "11.25px", "13.75px")
  const unitRegex = /\b(\d+\.\d+)(?:px|:1)\b/g;
  let unitMatch;
  while ((unitMatch = unitRegex.exec(combinedText)) !== null) {
    const num = unitMatch[1];
    if (!allowedNumbers.has(num) && !allowedNumbers.has(parseFloat(num).toString())) {
      return {
        valid: false,
        reason: `Grounding failure: Invented or unverified measurement "${unitMatch[0]}" not present in evidence.`,
      };
    }
  }

  return { valid: true };
}
