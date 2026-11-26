import { test, expect } from '@playwright/test';
const issue={id:'raw-test',ruleId:'text-contrast',wcagCriterion:'1.4.3',status:'candidateFail',title:'Text contrast below 4.5:1',description:'Measured contrast',url:'http://localhost:3123/fixtures/mvp-contrast-demo',viewport:{width:375,height:667},selector:'#normal-fail',element:'p',measured:{contrastRatio:2.32,color:'#aaaaaa',backgroundColor:'#ffffff'},expected:{minRatio:4.5},initialPriority:'P1',priorityRationale:'Project heuristic'};
const run={id:'run-studio-ui',fixtureId:'mvp-contrast-demo',targetUrl:issue.url,timestamp:new Date().toISOString(),viewports:[issue.viewport],rawIssues:[issue],groupedIssues:[{fingerprint:'fp',representative:issue,status:'candidateFail',occurrences:[issue],rawOccurrencesCount:1,currentPriority:'P1',initialPriority:'P1',decisionHistory:[]}],summary:{totalRawFindings:1,totalGroupedIssues:1,passCount:0,candidateFailCount:1,needsReviewCount:0}};
const session={id:'studio-ui-test',version:1,createdAt:new Date().toISOString(),model:'test-model',runs:[run],roles:['ux','product','engineering'],agenda:[{id:'issue-ui-test',runId:run.id,fingerprint:'fp',title:issue.title,status:'candidateFail',notes:[{role:'ux',comment:'A measured readability issue.',recommendation:'Explore a darker text color.',tradeoff:'Preserve brand intent while meeting contrast.'}]}],roleSummaries:{ux:'Readability'},leadSummary:'Review this measured finding.',roleErrors:{},messages:[],candidates:{}};
test('Studio setup validates context and remains contained at mobile width',async({page})=>{
 await page.setViewportSize({width:375,height:812});await page.goto('/studio');await expect(page.getByRole('heading',{name:'Create a new critique',exact:true})).toBeVisible();
 await page.getByLabel('Theme Color',{exact:true}).fill('invalid');await page.getByRole('button',{name:'Start critique',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'hex color'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('Saved Studio exposes agenda, role discussion and gated preview without source editing',async({page})=>{
 await page.setViewportSize({width:1000,height:900});
 await page.route('**/api/studio*',route=>route.fulfill({json:{session,sessions:[]}}));
 await page.goto('/studio?session=studio-ui-test');await expect(page.getByRole('heading',{name:'Critique agenda',exact:true})).toBeVisible();
 await page.getByRole('tab',{name:'Discussion',exact:true}).click();await expect(page.getByText('A measured readability issue.',{exact:true})).toBeVisible();await expect(page.getByLabel('Discussion role')).toHaveValue('lead');
 await page.getByRole('tab',{name:'Preview',exact:true}).click();await expect(page.getByRole('button',{name:'Preview & measure',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Apply to preview',exact:true})).toHaveCount(0);
 await expect(page.getByText('Apply updates this session’s preview. Original source files remain unchanged.',{exact:true})).toBeVisible();
});

test('Website input sends URL, localhost consent and context into the audit workflow',async({page})=>{
 let request:any;
 await page.route('**/api/audit',async route=>{request=route.request().postDataJSON();await route.fulfill({json:{run}});});
 await page.route('**/api/studio*',async route=>route.fulfill({json:route.request().method()==='POST'?{session}:{sessions:[]}}));
 await page.goto('/studio');await page.getByRole('button',{name:'Website URL',exact:true}).click();
 await page.getByLabel('Website URL',{exact:true}).fill('http://localhost:3210/design');
 await page.getByLabel('Allow this localhost target (local development only)').check();
 await page.getByRole('button',{name:'Start critique',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Design review',exact:true})).toBeVisible();
 expect(request.target).toBe('http://localhost:3210/design');expect(request.allowLocalhost).toBe(true);
});
