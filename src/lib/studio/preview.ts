import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { calculateContrastRatioRaw } from '@/lib/audit/color-math';
import { saveStudio } from './store';
import { findStudioIssue, type StudioSession, type ColorCandidate, ROLE_NAMES } from './types';
export async function previewStudio(session:StudioSession,issueId:string,color:string|undefined,baseUrl:string,sourceLabel?:string){
 const item=session.agenda.find(a=>a.id===issueId);if(!item)throw new Error('Issue not found.');
 const run=session.runs.find(r=>r.id===item.runId)!;const group=findStudioIssue(session,item)!;const rep=group.representative;
 if(!run.fixtureId || !['mvp-contrast-demo','text-contrast-demo'].includes(run.fixtureId))throw new Error('Sandbox preview supports the controlled contrast fixtures only.');
 if(group.status!=='candidateFail' || rep.measured.hasComplexBackground || !/^#[a-zA-Z][\w-]*$/.test(rep.selector))throw new Error('This finding requires manual review; a verified color patch is unavailable.');
 const background=String(rep.measured.backgroundColor),threshold=Number(rep.expected.minRatio);
 if(!background || !threshold)throw new Error('Missing contrast evidence.');

 // Extract hex colors mentioned in role notes to know if AI explicitly recommended one
 const aiRecommendations: Array<{ role: string; color: string }> = [];
 for (const note of item.notes) {
   const matches = note.recommendation.match(/#[0-9a-fA-F]{6}\b/g) || [];
   for (const h of matches) {
     aiRecommendations.push({ role: note.role, color: h.toLowerCase() });
   }
 }

 let selected = color;
 let determinedSource = sourceLabel;

 if (!selected) {
   // 1. If an AI role specifically suggested a color that passes threshold, prioritize it
   const aiMatch = aiRecommendations.find(r => calculateContrastRatioRaw(r.color, background) >= threshold);
   if (aiMatch) {
     selected = aiMatch.color;
     const roleTitle = ROLE_NAMES[aiMatch.role as keyof typeof ROLE_NAMES] || aiMatch.role;
     determinedSource = `${roleTitle} recommendation (${selected})`;
   } else if (run.productContext?.themeColor && calculateContrastRatioRaw(run.productContext.themeColor, background) >= threshold) {
     // 2. Otherwise try brand token
     selected = run.productContext.themeColor;
     determinedSource = `Brand theme token (${selected})`;
   } else {
     // 3. Fallback to system high-contrast slate
     const options = ['#111827', '#000000', '#ffffff'];
     selected = options.find(c => calculateContrastRatioRaw(c, background) >= threshold) || '#111827';
     determinedSource = `System high-contrast fallback (${selected})`;
   }
 } else if (!determinedSource) {
   // If user provided a color, determine attribution
   const matchedAi = aiRecommendations.find(r => r.color.toLowerCase() === selected?.toLowerCase());
   if (matchedAi) {
     const roleTitle = ROLE_NAMES[matchedAi.role as keyof typeof ROLE_NAMES] || matchedAi.role;
     determinedSource = `${roleTitle} recommendation (${selected})`;
   } else if (run.productContext?.themeColor && run.productContext.themeColor.toLowerCase() === selected.toLowerCase()) {
     determinedSource = `Brand theme token (${selected})`;
   } else {
     determinedSource = `Custom designer selection (${selected})`;
   }
 }

 if(!/^#[0-9a-f]{6}$/i.test(selected))throw new Error('Use a six-digit hex color.');
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:rep.viewport});
 // Fixed local fixture origin and path: no arbitrary URL or model-generated script is executed.
 await page.goto(`${baseUrl}/fixtures/${run.fixtureId}`,{waitUntil:'networkidle',timeout:20000});
 const measure=async()=>page.evaluate(selector=>{const el=document.querySelector(selector) as HTMLElement|null;if(!el)throw new Error('Target not found.');const rect=el.getBoundingClientRect();const style=getComputedStyle(el);return {color:style.color,width:rect.width,height:rect.height,x:rect.x,y:rect.y,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth)};},rep.selector);
 const before=await measure();const beforeRatio=calculateContrastRatioRaw(before.color,background);
 if(Math.abs(beforeRatio-Number(rep.measured.contrastRatio))>0.03)throw new Error('Baseline changed since audit. Run a new critique before previewing.');
 const directory=path.resolve(process.cwd(),'public/screenshots');await fs.mkdir(directory,{recursive:true});const token=crypto.randomUUID();
 await page.screenshot({path:path.join(directory,`studio-${token}-before.png`),fullPage:true});
 await page.addStyleTag({content:`${rep.selector} { color: ${selected} !important; }`});
 const after=await measure();const afterRatio=calculateContrastRatioRaw(after.color,background);
 await page.screenshot({path:path.join(directory,`studio-${token}-after.png`),fullPage:true});
 const checks={contrast:afterRatio>=threshold,noNewOverflow:after.overflow<=before.overflow+1,geometryUnchanged:['width','height','x','y'].every(k=>Math.abs(after[k as 'width']-before[k as 'width'])<0.5)};
 const candidate:ColorCandidate={issueId,color:selected,sourceLabel:determinedSource,beforeRatio,afterRatio,threshold,beforeScreenshot:`/screenshots/studio-${token}-before.png`,afterScreenshot:`/screenshots/studio-${token}-after.png`,verified:Object.values(checks).every(Boolean),checks,notChecked:['Task completion and user experience','Full WCAG conformance','Interactions and cross-browser behavior'],applied:false,timestamp:new Date().toISOString()};
 session.candidates[issueId]=candidate;await saveStudio(session);return session;
 }finally{await browser.close();}
}
