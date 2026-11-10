import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuditRun } from '@/lib/storage/db';
import { createStudio, discussStudio } from '@/lib/studio/service';
import { previewStudio } from '@/lib/studio/preview';
import { readStudio, saveStudio, listStudios, withStudioLock } from '@/lib/studio/store';
import { formatStudioMarkdown } from '@/lib/studio/markdown';
const id=z.string().regex(/^[a-zA-Z0-9-]{1,80}$/);
const role=z.enum(['ux','product','engineering']);
const action=z.discriminatedUnion('action',[
 z.object({action:z.literal('create'),runIds:z.array(id).min(1).max(2),roles:z.array(role).min(1).max(3),model:z.string().trim().max(80).optional()}),
 z.object({action:z.literal('chat'),sessionId:id,issueId:id,role:z.enum(['lead','ux','product','engineering']),message:z.string().trim().min(1).max(1500)}),
 z.object({action:z.literal('preview'),sessionId:id,issueId:id,color:z.string().regex(/^#[0-9a-f]{6}$/i).optional()}),
 z.object({action:z.literal('apply'),sessionId:id,issueId:id}),
 z.object({action:z.literal('revert'),sessionId:id,issueId:id}),
 z.object({action:z.literal('decision'),sessionId:id,issueId:id,decision:z.enum(['accepted','rejected'])}),
]);
export async function GET(req:NextRequest){try{
 const sessionId=req.nextUrl.searchParams.get('id');if(!sessionId)return NextResponse.json({sessions:await listStudios()});
 const session=await readStudio(id.parse(sessionId));const format=req.nextUrl.searchParams.get('format');
 if(format==='json')return new NextResponse(JSON.stringify(session,null,2),{headers:{'Content-Type':'application/json','Content-Disposition':`attachment; filename="proofui-studio-${session.id}.json"`,'Cache-Control':'no-store'}});
 if(format==='markdown'){
 const text=formatStudioMarkdown(session);
 return new NextResponse(text,{headers:{'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':`attachment; filename="proofui-studio-${session.id}.md"`,'Cache-Control':'no-store'}});}
 return NextResponse.json({session},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Could not load critique.'},{status:400});}}
export async function POST(req:NextRequest){try{
 const parsed=action.safeParse(await req.json());if(!parsed.success)return NextResponse.json({error:'Invalid critique request.'},{status:400});const data=parsed.data;
 if(data.action==='create'){
 const runs=await Promise.all([...new Set(data.runIds)].map(getAuditRun));if(runs.some(r=>!r))throw new Error('Audit run not found.');

 return NextResponse.json({session:await createStudio(runs.filter((r):r is NonNullable<typeof r>=>!!r),[...new Set(data.roles)],data.model)});}
 return await withStudioLock(data.sessionId,async()=>{
 const session=await readStudio(data.sessionId);const item=session.agenda.find(a=>a.id===data.issueId);if(!item)throw new Error('Issue not found.');
 if(data.action==='chat')return NextResponse.json({session:await discussStudio(session,data.issueId,data.role,data.message)});
 if(data.action==='preview')return NextResponse.json({session:await previewStudio(session,data.issueId,data.color,req.nextUrl.origin)});
 if(data.action==='apply'){const candidate=session.candidates[data.issueId];if(!candidate?.verified)throw new Error('A verified candidate preview is required before applying.');candidate.applied=true;item.decision='accepted';}
 if(data.action==='revert'){const candidate=session.candidates[data.issueId];if(candidate)candidate.applied=false;item.decision=undefined;}
 if(data.action==='decision')item.decision=data.decision;
 await saveStudio(session);return NextResponse.json({session});});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Critique operation failed.'},{status:400});}}
