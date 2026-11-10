import type { AuditRun, GroupedUXIssue } from '@/lib/schema/ux-issue';
export type StudioRole = 'ux' | 'product' | 'engineering';
export const ROLE_NAMES: Record<StudioRole | 'lead', string> = { ux: 'User Experience', product: 'Product Vision', engineering: 'Engineering', lead: 'Lead Coordinator' };
export interface RoleNote { role: StudioRole; comment: string; recommendation: string; tradeoff: string; }
export interface AgendaItem { id: string; runId: string; fingerprint: string; title: string; status: string; notes: RoleNote[]; decision?: 'accepted' | 'rejected'; }
export interface ChatMessage { id: string; issueId: string; sender: StudioRole | 'lead' | 'user'; text: string; timestamp: string; }
export interface ColorCandidate { issueId: string; color: string; beforeRatio: number; afterRatio: number; threshold: number; beforeScreenshot: string; afterScreenshot: string; verified: boolean; checks: { contrast: boolean; noNewOverflow: boolean; geometryUnchanged: boolean }; notChecked: string[]; applied: boolean; timestamp: string; }
export interface StudioSession { version: 1; id: string; createdAt: string; model: string; runs: AuditRun[]; roles: StudioRole[]; agenda: AgendaItem[]; roleSummaries: Partial<Record<StudioRole, string>>; leadSummary: string; roleErrors: Partial<Record<StudioRole | 'lead', string>>; messages: ChatMessage[]; candidates: Record<string, ColorCandidate>; }
export function findStudioIssue(session: StudioSession, item: AgendaItem): GroupedUXIssue | undefined { return session.runs.find(r => r.id === item.runId)?.groupedIssues.find(g => g.fingerprint === item.fingerprint); }
