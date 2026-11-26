import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { collectKnowledgeEntries } from '@/lib/knowledge/catalog';
import { getKnowledgeSql } from '@/lib/knowledge/db';

function loadLocalEnv(rootDir: string) {
  for (const file of ['.env.local', '.env']) {
    const fullPath = path.join(rootDir, file);
    if (!fs.existsSync(fullPath)) continue;
    const lines = fs.readFileSync(fullPath, 'utf-8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf-8').digest('hex');
}

async function main() {
  const rootDir = process.cwd();
  loadLocalEnv(rootDir);

  const shouldPublish = process.argv.includes('--publish');
  const entries = collectKnowledgeEntries(rootDir);
  const sql = getKnowledgeSql();

  let createdRevisions = 0;
  let skippedExisting = 0;
  let publishedCount = 0;

  try {
    // 1. Ensure source & snapshot per distinct source key
    const sourceNames = Array.from(new Set(entries.map((e) => e.source)));
    const snapshotIds = new Map<string, string>();

    for (const src of sourceNames) {
      const canonicalUrl = src === 'proofui'
        ? 'https://www.w3.org/TR/WCAG22/'
        : `local://.agents/skills/ui-ux-pro-max/data/${src}`;

      const [sourceRow] = await sql<{ id: string }[]>`
        INSERT INTO knowledge.sources (source_key, title, canonical_url)
        VALUES (${src}, ${src}, ${canonicalUrl})
        ON CONFLICT (source_key) DO UPDATE SET title = EXCLUDED.title
        RETURNING id
      `;

      const sourceEntries = entries.filter((e) => e.source === src);
      const snapshotHash = sha256(JSON.stringify(sourceEntries));
      const upstreamRef = `import-${new Date().toISOString().slice(0, 10)}`;

      const [snapRow] = await sql<{ id: string }[]>`
        INSERT INTO knowledge.source_snapshots (
          source_id, upstream_ref, artifact_uri, sha256, license_expression, license_notice, fetched_at
        )
        VALUES (
          ${sourceRow.id},
          ${upstreamRef},
          ${canonicalUrl},
          ${snapshotHash},
          'UNSPECIFIED-INTERNAL',
          'Imported from local ProofUI repository catalog; verify upstream license before external redistribution.',
          now()
        )
        ON CONFLICT (source_id, upstream_ref, sha256) DO UPDATE SET fetched_at = knowledge.source_snapshots.fetched_at
        RETURNING id
      `;

      snapshotIds.set(src, snapRow.id);
    }

    // 2. Import entries & revisions inside transactions
    for (const item of entries) {
      const snapshotId = snapshotIds.get(item.source)!;
      const citations = [
        {
          url: item.docsUrl || `local://${item.source}`,
          locator: item.stableKey,
          relationship: 'upstream_source',
        },
      ];
      const applicability = { category: item.category };
      const rawRecord = {
        source: item.source,
        codeGood: item.codeGood ?? null,
        codeBad: item.codeBad ?? null,
      };
      const contentHash = sha256(
        JSON.stringify({
          kind: item.kind,
          title: item.title,
          body: item.body,
          recommendation: item.recommendation,
          applicability,
          platforms: item.platforms,
          severity: item.severity,
          citations,
        })
      );

      await sql.begin(async (tx) => {
        const q = tx as unknown as typeof sql;
        const [entryRow] = await q<{ id: string }[]>`
          INSERT INTO knowledge.entries (stable_key)
          VALUES (${item.stableKey})
          ON CONFLICT (stable_key) DO UPDATE SET stable_key = EXCLUDED.stable_key
          RETURNING id
        `;

        // Lock entry row for safe revision allocation
        await q`SELECT 1 FROM knowledge.entries WHERE id = ${entryRow.id} FOR UPDATE`;

        const [latestRev] = await q<{ id: string; revision: number; content_sha256: string }[]>`
          SELECT id, revision, content_sha256
          FROM knowledge.revisions
          WHERE entry_id = ${entryRow.id}
          ORDER BY revision DESC
          LIMIT 1
        `;

        let revisionId = latestRev?.id;

        if (latestRev && latestRev.content_sha256 === contentHash) {
          skippedExisting++;
        } else {
          const nextRev = (latestRev?.revision ?? 0) + 1;
          const [inserted] = await q<{ id: string }[]>`
            INSERT INTO knowledge.revisions (
              entry_id, revision, kind, language, title, body, recommendation,
              applicability, platforms, tags, upstream_severity, citations,
              source_snapshot_id, source_locator, raw_record, content_sha256, created_by
            )
            VALUES (
              ${entryRow.id},
              ${nextRev},
              ${item.kind},
              'en',
              ${item.title || item.stableKey},
              ${item.body || item.title || item.stableKey},
              ${item.recommendation || ''},
              ${q.json(applicability)},
              ${item.platforms},
              ${[item.category.toLowerCase()]},
              ${item.severity},
              ${q.json(citations)},
              ${snapshotId},
              ${item.stableKey},
              ${q.json(rawRecord)},
              ${contentHash},
              'knowledge-import-cli'
            )
            RETURNING id
          `;
          revisionId = inserted.id;
          createdRevisions++;
        }

        if (shouldPublish && revisionId) {
          const [alreadyPublished] = await q<{ revision_id: string; action: string }[]>`
            SELECT revision_id, action
            FROM knowledge.publication_events
            WHERE entry_id = ${entryRow.id}
            ORDER BY sequence DESC
            LIMIT 1
          `;

          if (!alreadyPublished || alreadyPublished.revision_id !== revisionId || alreadyPublished.action !== 'publish') {
            const [review] = await q<{ id: string }[]>`
              INSERT INTO knowledge.reviews (revision_id, decision, reviewer_id, rationale)
              VALUES (${revisionId}, 'approved', 'knowledge-import-cli', 'Initial batch import with --publish flag')
              RETURNING id
            `;
            await q`
              INSERT INTO knowledge.publication_events (entry_id, revision_id, review_id, action, actor_id, rationale)
              VALUES (${entryRow.id}, ${revisionId}, ${review.id}, 'publish', 'knowledge-import-cli', 'Initial batch import')
            `;
            publishedCount++;
          }
        }
      });
    }

    console.log(
      `Import complete: ${createdRevisions} created, ${skippedExisting} unchanged, ${publishedCount} published.`
    );
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
