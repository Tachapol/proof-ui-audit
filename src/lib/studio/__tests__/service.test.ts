import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStudio, discussStudio } from '../service';
import { saveStudio } from '../store';
import type { AuditRun } from '@/lib/schema/ux-issue';
vi.mock('../store', () => ({ saveStudio: vi.fn() }));
const finding = { id:'test-issue',ruleId:'text-contrast',wcagCriterion:'1.4.3',status:'candidateFail' as const,title:'Low contrast',description:'Normal text',url:'http://localhost:3123/fixtures/mvp-contrast-demo',viewport:{width:375,height:667},selector:'#normal-fail',element:'p',measured:{contrastRatio:2.32,color:'#aaaaaa',backgroundColor:'#ffffff'},expected:{minRatio:4.5},initialPriority:'P1' as const,priorityRationale:'Project heuristic' };
const run: AuditRun={id:'run-studio-test',targetUrl:finding.url,fixtureId:'mvp-contrast-demo',timestamp:new Date().toISOString(),viewports:[finding.viewport],rawIssues:[finding],groupedIssues:[{fingerprint:'test-fp',representative:finding,rawOccurrencesCount:1,occurrences:[finding],status:'candidateFail',initialPriority:'P1',currentPriority:'P1',decisionHistory:[]}],summary:{totalRawFindings:1,totalGroupedIssues:1,passCount:0,candidateFailCount:1,needsReviewCount:0}};
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('CPE_API_KEY','test-token');vi.stubEnv('CPE_MODEL','test-model');});
describe('Studio evidence orchestration',()=>{
 it('obtains distinct role outputs and lead ordering anchored to measured findings',async()=>{
  vi.stubEnv('CPE_MODEL','qwen3.8-27b');
  const request=vi.fn(async(_url,options)=>{const body=JSON.parse(options.body);const data=JSON.parse(body.messages[1].content);const id=data.evidence[0].issueId;
   const result=body.messages[0].content.includes('Role: Lead Coordinator')?{summary:'Review the measured contrast issue.',orderedIds:[id]}:{summary:'Review summary.',items:[{issueId:id,comment:'The measured ratio is 2.32:1.',recommendation:'Consider a darker foreground.',tradeoff:'Balance brand identity and readability.'}]};
   return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(result)}}]}));});
  vi.stubGlobal('fetch',request);const session=await createStudio([run],['ux','product','engineering']);
  expect(JSON.parse(request.mock.calls[0][1].body).chat_template_kwargs).toEqual({enable_thinking:false});
  expect(request).toHaveBeenCalledTimes(4);expect(session.agenda[0].notes.map(n=>n.role).sort()).toEqual(['engineering','product','ux']);expect(session.roleErrors).toEqual({});expect(saveStudio).toHaveBeenCalled();
  expect(run.rawIssues[0].measured.contrastRatio).toBe(2.32);
 });
 it('retains measured findings and labels failed roles instead of inventing their feedback',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('private upstream text',{status:503})));
  const session=await createStudio([run],['ux']);expect(session.agenda).toHaveLength(1);expect(session.agenda[0].notes).toEqual([]);expect(session.roleErrors.ux).toContain('HTTP 503');expect(JSON.stringify(session)).not.toContain('private upstream text');
 });
 it('does not critique or call a provider when no candidate findings exist',async()=>{
  const request=vi.fn();vi.stubGlobal('fetch',request);const session=await createStudio([{...run,groupedIssues:[]}],['ux']);expect(session.agenda).toEqual([]);expect(request).not.toHaveBeenCalled();
 });
 it('does not send a question to a role not selected for this session',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status:503})));const session=await createStudio([run],['ux']);const request=vi.fn();vi.stubGlobal('fetch',request);await expect(discussStudio(session,session.agenda[0].id,'engineering','Why?')).rejects.toThrow('not active');expect(request).not.toHaveBeenCalled();
 });
 it('sorts findings by priority, caps agenda at 8, and records findingStats and partialErrors', async () => {
  const priorities: Array<'P0' | 'P1' | 'P2' | 'P3'> = ['P3', 'P0', 'P2', 'P1', 'P3', 'P0', 'P2', 'P1', 'P3', 'P0'];
  const tenGrouped = priorities.map((p, idx) => ({
    fingerprint: `fp-${idx}-${p}`,
    representative: { ...finding, id: `iss-${idx}`, initialPriority: p },
    rawOccurrencesCount: 1,
    occurrences: [{ ...finding, id: `iss-${idx}`, initialPriority: p }],
    status: 'candidateFail' as const,
    initialPriority: p,
    currentPriority: p,
    decisionHistory: [],
  }));

  const runWithTen: AuditRun = {
    ...run,
    groupedIssues: tenGrouped,
    auditWarnings: ['Desktop viewport timed out'],
  };

  const request = vi.fn(async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ summary: 'Sum', items: [] }) } }] }))
  );
  vi.stubGlobal('fetch', request);

  const session = await createStudio(
    [runWithTen],
    ['ux'],
    undefined,
    { partialErrors: ['Selector #box failed to compute bounding rect'] }
  );

  expect(session.agenda).toHaveLength(8);
  expect(session.findingStats).toEqual({
    totalCandidateFindings: 10,
    analyzedCount: 8,
    omittedCount: 2,
    maxCap: 8,
    frameCount: 1,
    selectionStrategy: 'priority_order',
  });

  const firstItem = runWithTen.groupedIssues.find(g => g.fingerprint === session.agenda[0].fingerprint);
  expect(firstItem?.currentPriority).toBe('P0');

  expect(session.auditWarnings).toContain('Desktop viewport timed out');
  expect(session.auditWarnings).toContain('Selector #box failed to compute bounding rect');
  expect(session.partialErrors).toContain('Selector #box failed to compute bounding rect');
  expect(session.leadSummary).toContain('Finding Scope');
 });

 it('caps agenda at 8 findings in total across 2 frames and reports multi-frame findingStats', async () => {
  const makeIssues = (prefix: string, count: number, priority: 'P0' | 'P1' | 'P2' | 'P3') =>
    Array.from({ length: count }, (_, i) => ({
      fingerprint: `${prefix}-fp-${i}`,
      representative: { ...finding, id: `${prefix}-iss-${i}`, initialPriority: priority },
      rawOccurrencesCount: 1,
      occurrences: [{ ...finding, id: `${prefix}-iss-${i}`, initialPriority: priority }],
      status: 'candidateFail' as const,
      initialPriority: priority,
      currentPriority: priority,
      decisionHistory: [],
    }));

  const frame1Issues = makeIssues('frame1', 6, 'P0');
  const frame2Issues = makeIssues('frame2', 6, 'P1');

  const run1: AuditRun = { ...run, id: 'run-f1', fixtureId: 'mvp-contrast-demo', groupedIssues: frame1Issues };
  const run2: AuditRun = { ...run, id: 'run-f2', fixtureId: 'text-contrast-demo', groupedIssues: frame2Issues };

  const request = vi.fn(async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ summary: 'Sum', items: [] }) } }] }))
  );
  vi.stubGlobal('fetch', request);

  const session = await createStudio([run1, run2], ['ux']);

  // Total findings across 2 frames is 12, capped at 8 total
  expect(session.agenda).toHaveLength(8);
  expect(session.findingStats).toEqual({
    totalCandidateFindings: 12,
    analyzedCount: 8,
    omittedCount: 4,
    maxCap: 8,
    frameCount: 2,
    selectionStrategy: 'priority_order',
  });

  // All 6 P0 issues from frame1 should be included, plus 2 P1 issues from frame2
  const f1Count = session.agenda.filter(a => a.runId === 'run-f1').length;
  const f2Count = session.agenda.filter(a => a.runId === 'run-f2').length;
  expect(f1Count).toBe(6);
  expect(f2Count).toBe(2);

  expect(session.leadSummary).toContain('across 2 frames');
  expect(session.leadSummary).toContain('Analyzing top 8 of 12 findings');
 });
});
