import fs from 'node:fs/promises';
import path from 'node:path';
import type { StudioSession } from './types';
const directory = () => path.resolve(process.cwd(), '.proofui-data/studio');
const idPattern = /^[a-zA-Z0-9-]{1,80}$/;
export async function readStudio(id: string): Promise<StudioSession> {
  if (!idPattern.test(id)) throw new Error('Invalid session ID.');
  try { return JSON.parse(await fs.readFile(path.join(directory(), id + '.json'), 'utf8')); }
  catch { throw new Error('Critique session not found.'); }
}
export async function saveStudio(session: StudioSession) {
  if (!idPattern.test(session.id)) throw new Error('Invalid session ID.');
  await fs.mkdir(directory(), { recursive: true });
  const target = path.join(directory(), session.id + '.json');
  const tmp = target + '.' + crypto.randomUUID() + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(session, null, 2)); await fs.rename(tmp, target);
}
export async function listStudios() {
  await fs.mkdir(directory(), { recursive: true });
  const names = (await fs.readdir(directory())).filter(n => n.endsWith('.json'));
  const sessions = await Promise.all(names.map(n => readStudio(n.slice(0, -5))));
  return sessions.sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,12).map(s => ({ id:s.id, createdAt:s.createdAt, frames:s.runs.length, goal:s.runs[0]?.productContext?.productGoal || 'Untitled critique' }));
}
const locks = new Map<string, Promise<unknown>>();
export async function withStudioLock<T>(id: string, operation: () => Promise<T>): Promise<T> {
  const pending = (locks.get(id) || Promise.resolve()).catch(() => undefined).then(operation);
  locks.set(id,pending);
  try { return await pending; } finally { if(locks.get(id)===pending) locks.delete(id); }
}
