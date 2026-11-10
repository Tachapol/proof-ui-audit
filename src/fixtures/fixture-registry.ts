export interface FixtureDefinition {
  id: string;
  name: string;
  category: 'target-size' | 'contrast' | 'reflow' | 'text-spacing';
  description: string;
  path: string;
}

export const FIXTURES: FixtureDefinition[] = [
  { id: 'mvp-contrast-demo', name: 'Text Contrast MVP — Happy Path', category: 'contrast',
    description: 'Four controlled text cases: code measures, CPE LLM critiques one candidate issue, designer reviews.', path: '/fixtures/mvp-contrast-demo' },
  {
    id: 'target-size-demo',
    name: 'Target Size Test Suite',
    category: 'target-size',
    description: 'Interactive buttons and links with pass (>=24px), candidateFail (<24px), and inline/spacing review cases.',
    path: '/fixtures/target-size-demo',
  },
  {
    id: 'text-contrast-demo',
    name: 'Text & Non-Text Contrast Suite',
    category: 'contrast',
    description: 'Normal text (4.5:1), large text (3:1), UI components, and gradient background review cases.',
    path: '/fixtures/text-contrast-demo',
  },
  {
    id: 'reflow-demo',
    name: 'Reflow (320px) Composite Suite',
    category: 'reflow',
    description: 'Composite responsive layout showing pass, horizontal overflow candidate failure, and data table review cases.',
    path: '/fixtures/reflow-demo',
  },
  {
    id: 'reflow-pass',
    name: 'Reflow: Isolated Clean Pass',
    category: 'reflow',
    description: 'Isolated fluid layout with zero horizontal overflow at 320 CSS px.',
    path: '/fixtures/reflow-pass',
  },
  {
    id: 'reflow-fail',
    name: 'Reflow: Isolated Overflow Candidate Failure',
    category: 'reflow',
    description: 'Isolated fixed 460px banner causing document horizontal scroll.',
    path: '/fixtures/reflow-fail',
  },
  {
    id: 'reflow-review',
    name: 'Reflow: Isolated Essential 2D Review',
    category: 'reflow',
    description: 'Isolated data table where 2D presentation is essential.',
    path: '/fixtures/reflow-review',
  },
  {
    id: 'reflow-nested-fail',
    name: 'Reflow: Isolated Nested Scroll & Ancestor Clip Failure',
    category: 'reflow',
    description: 'Isolated nested horizontal scroll strip and ancestor-clipped overflow without document scroll.',
    path: '/fixtures/reflow-nested-fail',
  },
  {
    id: 'reflow-controls-fail',
    name: 'Reflow: Isolated Off-Screen Controls Failure',
    category: 'reflow',
    description: 'Interactive control positioned outside 320px viewport.',
    path: '/fixtures/reflow-controls-fail',
  },
  {
    id: 'reflow-decorative-pass',
    name: 'Reflow: Isolated Decorative Bleed Pass',
    category: 'reflow',
    description: 'Decorative element bleeding past 320px with aria-hidden="true" (excluded from failure).',
    path: '/fixtures/reflow-decorative-pass',
  },
  {
    id: 'text-spacing-demo',
    name: 'Text Spacing Composite Suite',
    category: 'text-spacing',
    description: 'Composite suite showing clean pass, fixed height clipping, and ambiguous overlap.',
    path: '/fixtures/text-spacing-demo',
  },
  {
    id: 'text-spacing-pass',
    name: 'Text Spacing: Isolated Clean Pass',
    category: 'text-spacing',
    description: 'Fluid container that wraps and expands height naturally without clipping.',
    path: '/fixtures/text-spacing-pass',
  },
  {
    id: 'text-spacing-fail',
    name: 'Text Spacing: Isolated Vertical Clipping Failure',
    category: 'text-spacing',
    description: 'Fixed-height container with overflow: hidden truncating text.',
    path: '/fixtures/text-spacing-fail',
  },
  {
    id: 'text-spacing-horiz-fail',
    name: 'Text Spacing: Isolated Horizontal Clipping Failure',
    category: 'text-spacing',
    description: 'Fixed-width nowrap container horizontally clipping text.',
    path: '/fixtures/text-spacing-horiz-fail',
  },
  {
    id: 'text-spacing-obscured-fail',
    name: 'Text Spacing: Isolated Obscured Control Failure',
    category: 'text-spacing',
    description: 'Expanding text container obscuring adjacent interactive button.',
    path: '/fixtures/text-spacing-obscured-fail',
  },
  {
    id: 'text-spacing-review',
    name: 'Text Spacing: Isolated Sibling Collision Review',
    category: 'text-spacing',
    description: 'Colliding adjacent badges under expanded letter-spacing.',
    path: '/fixtures/text-spacing-review',
  },
  {
    id: 'text-spacing-preserved',
    name: 'Text Spacing: Minimum-Preserving Demonstration',
    category: 'text-spacing',
    description: 'Pre-existing styles exceeding minimums (line-height: 2.4, letter-spacing: 0.25em) that must not be reduced.',
    path: '/fixtures/text-spacing-preserved',
  },
  {
    id: 'occurrence-demo',
    name: 'Multi-Occurrence Grouping Suite',
    category: 'target-size',
    description: 'Multiple identical target size and contrast failures verifying deterministic fingerprint collapsing and occurrence inspection.',
    path: '/fixtures/occurrence-demo',
  },
];
