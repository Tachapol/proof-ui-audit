import fs from 'node:fs';
import path from 'node:path';
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

async function main() {
  const rootDir = process.cwd();
  loadLocalEnv(rootDir);

  const includeVectors = process.argv.includes('--vectors');
  const sql = getKnowledgeSql();

  try {
    const [existing] = await sql<{ exists: boolean }[]>`
      SELECT to_regclass('knowledge.entries') IS NOT NULL AS exists
    `;

    if (existing?.exists) {
      console.log('Schema `knowledge` already exists — skipping 001_knowledge.sql.');
    } else {
      const sql001 = fs.readFileSync(path.join(rootDir, 'db/migrations/001_knowledge.sql'), 'utf-8');
      await sql.unsafe(sql001);
      console.log('Applied db/migrations/001_knowledge.sql');
    }

    if (includeVectors) {
      const [vecExists] = await sql<{ exists: boolean }[]>`
        SELECT to_regclass('knowledge.embeddings') IS NOT NULL AS exists
      `;
      if (vecExists?.exists) {
        console.log('Table `knowledge.embeddings` already exists — skipping 002_knowledge_vectors.optional.sql.');
      } else {
        const sql002 = fs.readFileSync(
          path.join(rootDir, 'db/migrations/002_knowledge_vectors.optional.sql'),
          'utf-8'
        );
        await sql.unsafe(sql002);
        console.log('Applied db/migrations/002_knowledge_vectors.optional.sql');
      }
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
