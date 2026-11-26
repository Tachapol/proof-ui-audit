import { loadKnowledgeEntriesWithFallback } from '@/lib/knowledge/db';
import { KnowledgeWiki } from '@/components/KnowledgeWiki';

export const dynamic = 'force-dynamic';

export default async function KnowledgePage() {
  const { entries, backend, dbError } = await loadKnowledgeEntriesWithFallback(process.cwd());
  return <KnowledgeWiki entries={entries} backend={backend} dbNotice={dbError} />;
}
