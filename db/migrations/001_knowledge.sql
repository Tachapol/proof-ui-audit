-- PostgreSQL 16+. Single shared editorial catalog; audit data stays in its current store.
-- Apply once with psql -v ON_ERROR_STOP=1 -f db/migrations/001_knowledge.sql
BEGIN;
CREATE SCHEMA knowledge;

CREATE TABLE knowledge.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL UNIQUE CHECK (btrim(source_key) <> ''),
  title text NOT NULL,
  canonical_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE knowledge.source_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES knowledge.sources(id),
  upstream_ref text NOT NULL,
  artifact_uri text NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  license_expression text NOT NULL,
  license_notice text NOT NULL,
  fetched_at timestamptz NOT NULL,
  UNIQUE (source_id, upstream_ref, sha256)
);

CREATE TABLE knowledge.entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stable_key text NOT NULL UNIQUE CHECK (btrim(stable_key) <> ''),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One complete guideline/profile per revision. Corrections create new revisions.
CREATE TABLE knowledge.revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES knowledge.entries(id),
  revision integer NOT NULL CHECK (revision > 0),
  kind text NOT NULL CHECK (kind IN ('standard', 'heuristic', 'style', 'implementation')),
  language text NOT NULL DEFAULT 'en',
  title text NOT NULL CHECK (btrim(title) <> ''),
  body text NOT NULL CHECK (btrim(body) <> ''),
  recommendation text NOT NULL,
  limitations text NOT NULL DEFAULT '',
  applicability jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(applicability) = 'object'),
  rule_ids text[] NOT NULL DEFAULT '{}',
  platforms text[] NOT NULL DEFAULT '{}',
  stacks text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  upstream_severity text,
  upstream_confidence numeric CHECK (upstream_confidence BETWEEN 0 AND 1),
  citations jsonb NOT NULL CHECK (jsonb_typeof(citations) = 'array' AND jsonb_array_length(citations) > 0),
  source_snapshot_id uuid NOT NULL REFERENCES knowledge.source_snapshots(id),
  source_locator text NOT NULL CHECK (btrim(source_locator) <> ''),
  raw_record jsonb NOT NULL CHECK (jsonb_typeof(raw_record) = 'object'),
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  search_document tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english'::regconfig, title), 'A') ||
    setweight(to_tsvector('english'::regconfig, body || ' ' || recommendation), 'B')
  ) STORED,
  UNIQUE (entry_id, revision),
  UNIQUE (entry_id, id)
);
CREATE INDEX revisions_search ON knowledge.revisions USING gin(search_document);
CREATE INDEX revisions_rules ON knowledge.revisions USING gin(rule_ids);
CREATE INDEX revisions_platforms ON knowledge.revisions USING gin(platforms);
CREATE INDEX revisions_stacks ON knowledge.revisions USING gin(stacks);
CREATE INDEX revisions_tags ON knowledge.revisions USING gin(tags);
CREATE INDEX revisions_snapshot ON knowledge.revisions(source_snapshot_id);

CREATE TABLE knowledge.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id uuid NOT NULL REFERENCES knowledge.revisions(id),
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected', 'needs_changes')),
  reviewer_id text NOT NULL CHECK (btrim(reviewer_id) <> ''),
  rationale text NOT NULL CHECK (btrim(rationale) <> ''),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (revision_id, id)
);
CREATE INDEX reviews_revision ON knowledge.reviews(revision_id);

-- Explicit publication; importing or reviewing never makes a revision searchable by itself.
CREATE TABLE knowledge.publication_events (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entry_id uuid NOT NULL REFERENCES knowledge.entries(id),
  revision_id uuid NOT NULL,
  review_id uuid,
  action text NOT NULL CHECK (action IN ('publish', 'withdraw')),
  actor_id text NOT NULL CHECK (btrim(actor_id) <> ''),
  rationale text NOT NULL CHECK (btrim(rationale) <> ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (entry_id, revision_id) REFERENCES knowledge.revisions(entry_id, id),
  FOREIGN KEY (revision_id, review_id) REFERENCES knowledge.reviews(revision_id, id),
  CHECK (action <> 'publish' OR review_id IS NOT NULL)
);
CREATE INDEX publication_latest ON knowledge.publication_events(entry_id, sequence DESC);

CREATE FUNCTION knowledge.guard_publication() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Serialize publication for the same entry, including concurrent transactions.
  PERFORM 1 FROM knowledge.entries WHERE id = NEW.entry_id FOR UPDATE;
  IF NEW.action = 'publish' AND NOT EXISTS (
    SELECT 1 FROM knowledge.reviews
    WHERE id = NEW.review_id AND revision_id = NEW.revision_id AND decision = 'approved'
  ) THEN
    RAISE EXCEPTION 'Publication requires an approved review of the same revision';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER publication_guard BEFORE INSERT ON knowledge.publication_events
FOR EACH ROW EXECUTE FUNCTION knowledge.guard_publication();

CREATE VIEW knowledge.published_revisions AS
SELECT r.* FROM knowledge.revisions r
JOIN (
  SELECT DISTINCT ON (entry_id) entry_id, revision_id, action
  FROM knowledge.publication_events ORDER BY entry_id, sequence DESC
) p ON p.revision_id = r.id WHERE p.action = 'publish';

CREATE FUNCTION knowledge.prevent_history_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Knowledge history is append-only; create a new revision or event';
END;
$$;
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['source_snapshots', 'revisions', 'reviews', 'publication_events'] LOOP
    EXECUTE format('CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON knowledge.%I FOR EACH ROW EXECUTE FUNCTION knowledge.prevent_history_change()', table_name);
  END LOOP;
END;
$$;

CREATE TABLE knowledge.retrievals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Existing JSON-store IDs: no FK until audit storage is migrated.
  audit_run_id text,
  issue_id text,
  query_text text, -- optional: avoid retaining sensitive free-text by default
  filters jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(filters) = 'object'),
  retriever_version text NOT NULL,
  prompt_version text NOT NULL,
  generation_id text,
  latency_ms integer CHECK (latency_ms >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE knowledge.retrieval_items (
  retrieval_id uuid NOT NULL REFERENCES knowledge.retrievals(id) ON DELETE CASCADE,
  rank integer NOT NULL CHECK (rank > 0),
  revision_id uuid NOT NULL REFERENCES knowledge.revisions(id),
  channel text NOT NULL CHECK (channel IN ('exact', 'lexical', 'semantic', 'hybrid')),
  scores jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(scores) = 'object'),
  included_in_prompt boolean NOT NULL,
  PRIMARY KEY (retrieval_id, rank),
  UNIQUE (retrieval_id, revision_id)
);
CREATE INDEX retrieval_items_revision ON knowledge.retrieval_items(revision_id);
CREATE INDEX retrievals_run ON knowledge.retrievals(audit_run_id);
COMMIT;
