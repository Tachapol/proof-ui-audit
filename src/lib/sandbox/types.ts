import type { UXIssue } from '@/lib/schema/ux-issue';
import type { RegressionComparison } from './regression';

export type IterationConstraint =
  | 'preserve_colors'
  | 'preserve_layout'
  | 'target_size_only'
  | 'contrast_only'
  | 'minimal_invasive';

export interface IterationOptions {
  constraints?: IterationConstraint[];
  customDirective?: string;
}

export interface CandidateCheck {
  id: string;
  label: string;
  passed: boolean;
  deltaText: string;
}

export type VerificationStatus = 'verified' | 'failed' | 'unable_to_verify';

export interface CandidateMeasurement {
  ruleId: string;
  selector: string;
  viewport: UXIssue['viewport'];
  before: Record<string, unknown>;
  after?: Record<string, unknown>;
  expected: Record<string, unknown>;
  status: UXIssue['status'] | 'unable_to_verify';
}

export interface SandboxCandidate {
  id: string;
  name: string;
  badge: string;
  description: string;
  code: string;
  verified: boolean;
  verificationStatus: VerificationStatus;
  verificationErrors: string[];
  measurements: CandidateMeasurement[];
  regression: RegressionComparison;
  checks: CandidateCheck[];
  metrics: {
    targetSize?: { before: string; after: string; passed: boolean };
    contrast?: { before: string; after: string; passed: boolean };
    spacing?: { before: string; after: string; passed: boolean };
  };
  summary: {
    passCount: number;
    candidateFailCount: number;
    needsReviewCount: number;
  };
}
