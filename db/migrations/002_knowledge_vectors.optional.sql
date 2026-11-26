-- Optional: apply after 001 when the server provides pgvector.
BEGIN;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE knowledge.embedding_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  model text NOT NULL,
  model_revision text NOT NULL,
  dimensions integer NOT NULL CHECK (dimensions > 0),
  preprocessing_version text NOT NULL,
  UNIQUE (provider, model, model_revision, dimensions, preprocessing_version)
);
CREATE TABLE knowledge.embeddings (
  revision_id uuid NOT NULL REFERENCES knowledge.revisions(id),
  model_id uuid NOT NULL REFERENCES knowledge.embedding_models(id),
  input_sha256 text NOT NULL CHECK (input_sha256 ~ '^[0-9a-f]{64}$'),
  embedding vector NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (revision_id, model_id),
  CHECK (vector_norm(embedding) > 0)
);
CREATE FUNCTION knowledge.check_embedding_dimensions() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF vector_dims(NEW.embedding) <> (
    SELECT dimensions FROM knowledge.embedding_models WHERE id = NEW.model_id
  ) THEN
    RAISE EXCEPTION 'Embedding dimensions do not match the registered model';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER embedding_dimensions BEFORE INSERT OR UPDATE ON knowledge.embeddings
FOR EACH ROW EXECUTE FUNCTION knowledge.check_embedding_dimensions();
CREATE TRIGGER immutable_model BEFORE UPDATE OR DELETE ON knowledge.embedding_models
FOR EACH ROW EXECUTE FUNCTION knowledge.prevent_history_change();
-- Start with exact cosine search filtered to ONE model. Add model-specific,
-- fixed-dimension partial HNSW indexes only after choosing a model and benchmarking.
COMMIT;
