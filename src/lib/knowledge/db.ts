import postgres from 'postgres';
import { collectKnowledgeEntries, type KnowledgeEntry, type KnowledgeKind } from './catalog';

const globalForPg = globalThis as unknown as {
  __knowledgeSql?: ReturnType<typeof postgres>;
};

export function isKnowledgeDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/**
 * Returns a shared postgres.js client configured for Supabase/PostgreSQL.
 */
export function getKnowledgeSql(): ReturnType<typeof postgres> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error('DATABASE_URL is not configured.');
  }

  if (!globalForPg.__knowledgeSql) {
    const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
    globalForPg.__knowledgeSql = postgres(url, {
      prepare: false, // Required for Supabase Transaction Pooler (port 6543)
      max: 5,
      idle_timeout: 20,
      ssl: isLocal ? false : 'require',
    });
  }

  return globalForPg.__knowledgeSql;
}

interface PublishedRow {
  stable_key: string;
  kind: KnowledgeKind;
  source_key: string;
  title: string;
  body: string;
  recommendation: string;
  platforms: string[];
  upstream_severity: string | null;
  applicability: { category?: string } | null;
  citations: Array<{ url?: string }> | null;
  raw_record: { codeGood?: string; codeBad?: string; source?: string } | null;
}

/**
 * Loads published knowledge entries from `knowledge.published_revisions`.
 */
export async function loadPublishedKnowledgeEntries(): Promise<KnowledgeEntry[]> {
  const sql = getKnowledgeSql();
  const rows = await sql<PublishedRow[]>`
    SELECT
      e.stable_key,
      r.kind,
      s.source_key,
      r.title,
      r.body,
      r.recommendation,
      r.platforms,
      r.upstream_severity,
      r.applicability,
      r.citations,
      r.raw_record
    FROM knowledge.published_revisions r
    JOIN knowledge.entries e ON e.id = r.entry_id
    JOIN knowledge.source_snapshots ss ON ss.id = r.source_snapshot_id
    JOIN knowledge.sources s ON s.id = ss.source_id
    ORDER BY e.stable_key ASC
  `;

  return rows.map((row) => ({
    stableKey: row.stable_key,
    kind: row.kind,
    source: row.raw_record?.source || row.source_key,
    category: row.applicability?.category || 'General',
    title: row.title,
    body: row.body,
    recommendation: row.recommendation,
    codeGood: row.raw_record?.codeGood || undefined,
    codeBad: row.raw_record?.codeBad || undefined,
    platforms: row.platforms?.length ? row.platforms : ['web'],
    severity: row.upstream_severity || 'Medium',
    docsUrl: row.citations?.[0]?.url && row.citations[0].url.startsWith('http')
      ? row.citations[0].url
      : undefined,
  }));
}

/**
 * Loads from PostgreSQL when DATABASE_URL is set and published entries exist;
 * otherwise falls back seamlessly to local CSV/TypeScript entries.
 */
export async function loadKnowledgeEntriesWithFallback(
  rootDir = process.cwd()
): Promise<{ entries: KnowledgeEntry[]; backend: 'postgres' | 'local'; dbError?: string }> {
  if (!isKnowledgeDbConfigured()) {
    return { entries: collectKnowledgeEntries(rootDir), backend: 'local' };
  }

  try {
    const dbEntries = await loadPublishedKnowledgeEntries();
    if (dbEntries.length > 0) {
      return { entries: dbEntries, backend: 'postgres' };
    }
    return {
      entries: collectKnowledgeEntries(rootDir),
      backend: 'local',
      dbError: 'Connected to PostgreSQL, but knowledge.published_revisions is empty (showing local fallback).',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      entries: collectKnowledgeEntries(rootDir),
      backend: 'local',
      dbError: `PostgreSQL fallback: ${message}`,
    };
  }
}
