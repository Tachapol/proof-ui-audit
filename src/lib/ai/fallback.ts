import { ExplanationProvider } from './provider';
import { AIExplanationInput, AIExplanationResult, AIFallbackReason } from '@/lib/schema/ai-response';

export class DeterministicExplanationProvider implements ExplanationProvider {
  readonly id = 'fallback' as const;

  constructor(private fallbackReason: AIFallbackReason = 'no_api_key') {}

  async explain(input: AIExplanationInput): Promise<AIExplanationResult> {
    const { ruleId, status, measured, expected, element, selector, exception, reviewReason } = input;
    const isNeedsReview = status === 'needsReview';
    const isPass = status === 'pass';

    let explanation = '';
    let recommendation = '';
    let uncertaintyNote: string | undefined = undefined;

    switch (ruleId) {
      case 'target-size': {
        const width = measured.width ?? measured.actualWidth ?? 'unknown';
        const height = measured.height ?? measured.actualHeight ?? 'unknown';
        const minW = expected.minWidth ?? 24;
        const minH = expected.minHeight ?? 24;

        if (isPass) {
          explanation = `The interactive target "${selector}" measures ${width}×${height} CSS px, meeting or exceeding the minimum ${minW}×${minH} CSS px target size threshold.`;
          recommendation = 'Maintain existing interactive target dimensions and spacing to ensure continued touch accessibility.';
        } else if (isNeedsReview) {
          explanation = `The target "${selector}" measures ${width}×${height} CSS px (below ${minW}×${minH} px), but an exception may apply (${exception || reviewReason || 'inline target or spacing alternative candidate'}).`;
          recommendation = 'A designer must review whether this component qualifies as an inline link exception or provides sufficient 24px diameter clear spacing.';
          uncertaintyNote = exception || reviewReason || 'Target size exception cannot be verified without designer review of document flow context.';
        } else {
          explanation = `The interactive target "${selector}" measures ${width}×${height} CSS px, which is below the WCAG 2.2 SC 2.5.8 minimum threshold of ${minW}×${minH} CSS px.`;
          recommendation = `Consider increasing the component's min-width to ${minW}px and min-height to ${minH}px, or adding surrounding padding to expand the active target area.`;
        }
        break;
      }

      case 'text-contrast': {
        const ratio = typeof measured.contrastRatio === 'number' ? measured.contrastRatio.toFixed(2) : 'unknown';
        const fg = measured.color || 'specified color';
        const bg = measured.backgroundColor || 'specified background';
        const threshold = expected.thresholdDescription || '4.5:1 for normal text (or 3:1 for large text)';

        if (isPass) {
          explanation = `Text in "${selector}" has an evaluated contrast ratio of ${ratio}:1 (foreground: ${fg}, background: ${bg}), meeting the required threshold (${threshold}).`;
          recommendation = 'Maintain current foreground and background color combinations to preserve legibility.';
        } else if (isNeedsReview) {
          explanation = `Text in "${selector}" sits on a complex or translucent background (${exception || reviewReason || 'gradient, background image, or alpha transparency'}), preventing definitive automated ratio computation.`;
          recommendation = 'A designer must visually verify contrast across all parts of the background gradient or imagery to ensure readability.';
          uncertaintyNote = exception || reviewReason || 'Background complexity or opacity compositing requires designer visual verification.';
        } else {
          explanation = `Text in "${selector}" has an evaluated contrast ratio of ${ratio}:1, falling short of the WCAG 2.2 SC 1.4.3 minimum threshold (${threshold}).`;
          recommendation = `Adjust the foreground text color (${fg}) or background color (${bg}) to achieve at least a 4.5:1 contrast ratio (or 3:1 for large text).`;
        }
        break;
      }

      case 'non-text-contrast': {
        const ratio = typeof measured.contrastRatio === 'number' ? measured.contrastRatio.toFixed(2) : 'unknown';
        const threshold = expected.thresholdDescription || '3:1 against adjacent colors';

        if (isPass) {
          explanation = `UI component or graphical boundary in "${selector}" has an evaluated contrast ratio of ${ratio}:1, complying with the 3:1 threshold.`;
          recommendation = 'Maintain visual indicator and boundary contrast to preserve component identifiability.';
        } else if (isNeedsReview) {
          explanation = `The component "${selector}" presents ambiguous state or decorative styling (${exception || reviewReason || 'uncertain control meaning or dynamic state'}).`;
          recommendation = 'A designer should review whether this boundary or indicator is essential for user understanding and operation.';
          uncertaintyNote = exception || reviewReason || 'Essential visual affordance vs. decorative boundary distinction requires human confirmation.';
        } else {
          explanation = `The visual boundary or state indicator for "${selector}" has an evaluated contrast ratio of ${ratio}:1, which is below the WCAG 2.2 SC 1.4.11 threshold of 3:1.`;
          recommendation = 'Increase border or indicator contrast to achieve at least a 3:1 ratio against adjacent colors.';
        }
        break;
      }

      case 'reflow': {
        const overflow = measured.horizontalOverflowPx ?? 0;
        const scrollW = measured.scrollWidth ?? 'unknown';

        if (isPass) {
          explanation = `The page layout reflows cleanly at ${input.viewport.width}px without triggering unintended 2D horizontal scrolling (scrollWidth: ${scrollW}px).`;
          recommendation = 'Maintain flexible container dimensions and responsive wrapping patterns.';
        } else if (isNeedsReview) {
          explanation = `Horizontal scrolling was detected for "${selector}" at ${input.viewport.width}px, but this component may qualify as an essential 2D presentation (${exception || reviewReason || 'data table, canvas, or complex diagram'}).`;
          recommendation = 'A designer must determine whether the 2D layout is essential to content meaning or can be converted to single-column reflow.';
          uncertaintyNote = exception || reviewReason || 'Essential 2D exception status requires human confirmation.';
        } else {
          explanation = `At ${input.viewport.width}px, "${selector}" forces unintended horizontal scrolling (${overflow}px overflow, scrollWidth: ${scrollW}px), violating WCAG 2.2 SC 1.4.10.`;
          recommendation = 'Replace rigid fixed widths with relative units (e.g. max-width: 100%, flex-wrap, or CSS Grid) to allow single-axis vertical scrolling.';
        }
        break;
      }

      case 'text-spacing': {
        const isClipped = measured.isClipped;
        const clipDeficit = measured.clipDeficitPx ?? 0;

        if (isPass) {
          explanation = `The text container "${selector}" accommodates WCAG 2.2 SC 1.4.12 text spacing overrides without content clipping, overflow, or control collision.`;
          recommendation = 'Keep container heights flexible to maintain resilience to user-customized font metrics.';
        } else if (isNeedsReview) {
          explanation = `Under WCAG text spacing overrides, text in "${selector}" expanded and touches adjacent boundaries (${exception || reviewReason || 'potential glyph collision'}).`;
          recommendation = 'A designer should visually review whether glyph expansion impairs legibility or component operation.';
          uncertaintyNote = exception || reviewReason || 'Visual legibility under custom text spacing requires human inspection.';
        } else {
          explanation = `When WCAG 2.2 SC 1.4.12 text spacing overrides are applied, content in "${selector}" is clipped by its fixed container dimensions (${clipDeficit}px clipped).`;
          recommendation = 'Remove fixed height or max-height constraints (or set overflow: visible / min-height: auto) so the container expands fluidly with increased line and letter spacing.';
        }
        break;
      }
    }

    return {
      explanation,
      recommendation,
      requiresDesignerReview: isNeedsReview,
      uncertaintyNote,
      provenance: 'fallback',
      isFallback: true,
      fallbackReason: this.fallbackReason,
      timestamp: new Date().toISOString(),
      durationMs: 0,
    };
  }
}
