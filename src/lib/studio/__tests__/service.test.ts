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
});
