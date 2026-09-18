export interface FixtureDefinition {
  id: string;
  name: string;
  category: 'target-size' | 'contrast' | 'reflow' | 'text-spacing';
  description: string;
  path: string;
}

export const FIXTURES: FixtureDefinition[] = [
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
    name: 'Reflow (320px) Test Suite',
    category: 'reflow',
    description: 'Responsive layout with pass, horizontal overflow candidate failure, and data table review cases.',
    path: '/fixtures/reflow-demo',
  },
  {
    id: 'text-spacing-demo',
    name: 'Text Spacing Override Suite',
    category: 'text-spacing',
    description: 'Containers subjected to line-height 1.5x, paragraph 2x, letter 0.12x, word 0.16x with fixed height clipping.',
    path: '/fixtures/text-spacing-demo',
  },
];
