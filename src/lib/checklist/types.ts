export type ChecklistGroup = 'ux' | 'ui';

export type ChecklistPillarId =
  | 'interaction'
  | 'accessibility'
  | 'structure'
  | 'color'
  | 'typography'
  | 'layout';

export type ChecklistStatus = 'pass' | 'fail' | 'needsReview' | 'notApplicable';

export type PriorityLevel = 'P0' | 'P1' | 'P2' | 'P3';

export interface ChecklistMetricDefinition {
  id: string;
  group: ChecklistGroup;
  pillar: ChecklistPillarId;
  title: string;
  criterion: string;
  priority: PriorityLevel;
  source: 'audit-rule' | 'dom-check';
}

export interface ChecklistItemResult {
  id: string;
  group: ChecklistGroup;
  pillar: ChecklistPillarId;
  title: string;
  criterion: string;
  priority: PriorityLevel;
  status: ChecklistStatus;
  viewport: string;
  measuredSummary: string;
  affectedCount: number;
  samples: string[];
  rawSelectors?: string[];
  recommendation: string;
}

export interface ChecklistPillarSummary {
  id: ChecklistPillarId;
  group: ChecklistGroup;
  label: string;
  passed: number;
  total: number;
  items: ChecklistItemResult[];
}

export interface ChecklistSummary {
  totalPassed: number;
  totalFailed: number;
  totalNeedsReview: number;
  totalNotApplicable: number;
  totalMetrics: number;
  passRate: number;
  ux: { passed: number; total: number };
  ui: { passed: number; total: number };
  pillars: ChecklistPillarSummary[];
  items: ChecklistItemResult[];
  priorityList: ChecklistItemResult[];
}

export interface AuditContextInput {
  productGoal?: string;
  targetAudience?: string;
  theme?: string;
  customPrompt?: string;
}

export interface FeedbackIssue {
  id: string;
  metricId: string;
  status: ChecklistStatus;
  priority: PriorityLevel;
  group: ChecklistGroup;
  selector: string;
  measured: string;
  expected: string;
  problem: string;
  suggested_fix: string;
}

export interface FeedbackWorksheet {
  summary: {
    totalFailing: number;
    context?: AuditContextInput;
  };
  issues: FeedbackIssue[];
}

export interface AttributePatch {
  metricId?: string;
  selector: string;
  setAttributes?: Record<string, string>;
  removeAttributes?: string[];
}

export interface PatchOperationLog {
  op: 'css' | 'attribute' | 'tagRename' | 'wrapMain';
  metricId?: string;
  selector?: string;
  matchedCount: number;
  status: 'applied' | 'rejected';
  reason?: string;
}

export interface ChecklistJsonPatch {
  cssAdditions: string[];
  attributePatches: AttributePatch[];
  tagRenames?: Array<{ metricId?: string; selector: string; newTag: string }>;
  wrapMain?: boolean;
  notes?: string;
  operationLogs?: PatchOperationLog[];
}

export interface IterationUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd?: number;
}

export interface IterationSnapshot {
  iteration: number;
  label: string;
  branchedFromIteration?: number;
  summary: ChecklistSummary;
  html: string;
  deltaFromBase: number;
  deltaFromBaseline: number;
  resolvedIds: string[];
  regressedIds: string[];
  fixerMode: 'baseline' | 'llm-api' | 'gemini-llm' | 'deterministic-fallback';
  notes: string;
  appliedPatch?: ChecklistJsonPatch;
  usage?: IterationUsage;
}

export type StopReason =
  | 'all_passed'
  | 'targets_passed'
  | 'no_improvement'
  | 'max_iterations'
  | 'audit_only';

export interface AutoIterationResult {
  bestIteration: number;
  stopReason: StopReason;
  hasRemainingNeedsReview?: boolean;
  constructionPlan?: string;
  feedback?: FeedbackWorksheet;
  totalUsage?: IterationUsage;
  iterations: IterationSnapshot[];
}

export const CHECKLIST_PILLARS: Array<{ id: ChecklistPillarId; group: ChecklistGroup; label: string }> = [
  { id: 'interaction', group: 'ux', label: 'Interaction & Touch' },
  { id: 'accessibility', group: 'ux', label: 'Accessibility & Keyboard' },
  { id: 'structure', group: 'ux', label: 'Structure & Semantics' },
  { id: 'color', group: 'ui', label: 'Color & Contrast' },
  { id: 'typography', group: 'ui', label: 'Typography & Readability' },
  { id: 'layout', group: 'ui', label: 'Layout & Media' },
];

export const CHECKLIST_METRICS: ChecklistMetricDefinition[] = [
  // UX: Interaction & Touch (6)
  { id: 'target-size', group: 'ux', pillar: 'interaction', title: 'Target Size', criterion: 'WCAG 2.2 SC 2.5.8', priority: 'P1', source: 'audit-rule' },
  { id: 'touch-target-spacing', group: 'ux', pillar: 'interaction', title: 'Touch Target Spacing', criterion: 'Project Advisory', priority: 'P2', source: 'audit-rule' },
  { id: 'interactive-cursor', group: 'ux', pillar: 'interaction', title: 'Interactive Cursor', criterion: 'UX Affordance', priority: 'P2', source: 'dom-check' },
  { id: 'valid-interactive-actions', group: 'ux', pillar: 'interaction', title: 'Valid Links & Actions', criterion: 'UX Reliability', priority: 'P1', source: 'dom-check' },
  { id: 'active-state-indicator', group: 'ux', pillar: 'interaction', title: 'Active Navigation Indicator', criterion: 'Nielsen H1: System Status', priority: 'P2', source: 'dom-check' },
  { id: 'ergonomic-target-advisory', group: 'ux', pillar: 'interaction', title: 'Ergonomic Touch Target (44px)', criterion: 'Apple HIG / Material 3', priority: 'P3', source: 'dom-check' },

  // UX: Accessibility & Keyboard (6)
  { id: 'interactive-label', group: 'ux', pillar: 'accessibility', title: 'Interactive Labels', criterion: 'WCAG 2.2 SC 4.1.2', priority: 'P0', source: 'dom-check' },
  { id: 'focus-visible', group: 'ux', pillar: 'accessibility', title: 'Keyboard Focus Visible', criterion: 'WCAG 2.2 SC 2.4.7', priority: 'P1', source: 'dom-check' },
  { id: 'tab-order-sanity', group: 'ux', pillar: 'accessibility', title: 'Tab Order & No Hidden Focus', criterion: 'WCAG 2.2 SC 2.4.3', priority: 'P1', source: 'dom-check' },
  { id: 'image-alt', group: 'ux', pillar: 'accessibility', title: 'Image Alt Text', criterion: 'WCAG 2.2 SC 1.1.1', priority: 'P0', source: 'dom-check' },
  { id: 'modal-dismiss-affordance', group: 'ux', pillar: 'accessibility', title: 'Modal Dismiss Control', criterion: 'Nielsen H3: User Control', priority: 'P1', source: 'dom-check' },
  { id: 'placeholder-not-sole-label', group: 'ux', pillar: 'accessibility', title: 'Persistent Field Labels', criterion: 'Nielsen H6: Recognition', priority: 'P2', source: 'dom-check' },

  // UX: Structure & Semantics (6)
  { id: 'heading-hierarchy', group: 'ux', pillar: 'structure', title: 'Heading Hierarchy', criterion: 'Project Advisory', priority: 'P2', source: 'audit-rule' },
  { id: 'landmark-structure', group: 'ux', pillar: 'structure', title: 'Semantic Landmarks', criterion: 'WCAG 2.2 SC 1.3.1', priority: 'P2', source: 'dom-check' },
  { id: 'form-input-semantics', group: 'ux', pillar: 'structure', title: 'Form Input Semantics', criterion: 'WCAG 2.2 SC 1.3.5', priority: 'P2', source: 'dom-check' },
  { id: 'document-metadata', group: 'ux', pillar: 'structure', title: 'Page Title & Language', criterion: 'WCAG 2.2 SC 2.4.2 / 3.1.1', priority: 'P2', source: 'dom-check' },
  { id: 'form-required-clarity', group: 'ux', pillar: 'structure', title: 'Required Field Clarity', criterion: 'Nielsen H5: Error Prevention', priority: 'P2', source: 'dom-check' },
  { id: 'nav-item-count', group: 'ux', pillar: 'structure', title: 'Navigation Item Count', criterion: 'Apple HIG: Simplicity', priority: 'P3', source: 'dom-check' },

  // UI: Color & Contrast (6)
  { id: 'text-contrast', group: 'ui', pillar: 'color', title: 'Text Contrast', criterion: 'WCAG 2.2 SC 1.4.3', priority: 'P0', source: 'audit-rule' },
  { id: 'non-text-contrast', group: 'ui', pillar: 'color', title: 'Non-text Contrast', criterion: 'WCAG 2.2 SC 1.4.11', priority: 'P1', source: 'audit-rule' },
  { id: 'link-distinguishability', group: 'ui', pillar: 'color', title: 'Link Distinguishability', criterion: 'WCAG 2.2 SC 1.4.1', priority: 'P2', source: 'dom-check' },
  { id: 'status-not-color-only', group: 'ui', pillar: 'color', title: 'Status Not Color-Only', criterion: 'WCAG 2.2 SC 1.4.1', priority: 'P2', source: 'dom-check' },
  { id: 'card-surface-separation', group: 'ui', pillar: 'color', title: 'Card Surface Separation', criterion: 'Material Design 3: Elevation', priority: 'P3', source: 'dom-check' },
  { id: 'input-border-contrast', group: 'ui', pillar: 'color', title: 'Input Boundary Affordance', criterion: 'Material Design 3: Inputs', priority: 'P2', source: 'dom-check' },

  // UI: Typography & Readability (6)
  { id: 'text-spacing', group: 'ui', pillar: 'typography', title: 'Text Spacing Resilience', criterion: 'WCAG 2.2 SC 1.4.12', priority: 'P1', source: 'audit-rule' },
  { id: 'min-font-size', group: 'ui', pillar: 'typography', title: 'Readable Font Size', criterion: 'UI Readability', priority: 'P2', source: 'dom-check' },
  { id: 'line-height-measure', group: 'ui', pillar: 'typography', title: 'Line Height & Line Length', criterion: 'UI Readability', priority: 'P3', source: 'dom-check' },
  { id: 'font-consistency', group: 'ui', pillar: 'typography', title: 'Font Loading & Consistency', criterion: 'UI Consistency', priority: 'P3', source: 'dom-check' },
  { id: 'heading-body-scale', group: 'ui', pillar: 'typography', title: 'Heading-to-Body Scale', criterion: 'Apple HIG: Hierarchy', priority: 'P2', source: 'dom-check' },
  { id: 'content-density-spacing', group: 'ui', pillar: 'typography', title: 'Paragraph Breathing Space', criterion: 'Nielsen H8: Minimalism', priority: 'P3', source: 'dom-check' },

  // UI: Layout & Media (6)
  { id: 'reflow', group: 'ui', pillar: 'layout', title: 'Mobile Reflow (320px)', criterion: 'WCAG 2.2 SC 1.4.10', priority: 'P0', source: 'audit-rule' },
  { id: 'visual-overlap', group: 'ui', pillar: 'layout', title: 'No Visual Overlap', criterion: 'UI Layout', priority: 'P1', source: 'dom-check' },
  { id: 'broken-media', group: 'ui', pillar: 'layout', title: 'Media & SVG Integrity', criterion: 'UI Polish', priority: 'P1', source: 'dom-check' },
  { id: 'overflow-clipping', group: 'ui', pillar: 'layout', title: 'No Unintended Clipping', criterion: 'UI Layout', priority: 'P2', source: 'dom-check' },
  { id: 'button-consistency', group: 'ui', pillar: 'layout', title: 'Button Style Consistency', criterion: 'Nielsen H4: Consistency', priority: 'P3', source: 'dom-check' },
  { id: 'container-padding-breathing', group: 'ui', pillar: 'layout', title: 'Container Padding', criterion: 'Material Design 3: Spacing', priority: 'P3', source: 'dom-check' },
];
