CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.corpus_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  ministry text NOT NULL DEFAULT 'Unspecified',
  doc_type text NOT NULL DEFAULT 'Other',
  rpjmn_cycle text NOT NULL DEFAULT 'RPJMN 2025-2029',
  leadership_term text NOT NULL DEFAULT 'Prabowo (2024-)',
  doc_year integer,
  page_count integer NOT NULL DEFAULT 0,
  char_count integer NOT NULL DEFAULT 0,
  chunk_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.doc_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  document_id uuid NOT NULL REFERENCES public.corpus_documents(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  page_hint integer,
  content text NOT NULL,
  embedding vector(3072),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX doc_chunks_document_idx ON public.doc_chunks(document_id);
CREATE INDEX doc_chunks_embedding_idx ON public.doc_chunks USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

CREATE TABLE public.analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  mode text NOT NULL DEFAULT 'focused',
  agents text[] NOT NULL DEFAULT '{}',
  document_ids uuid[] NOT NULL DEFAULT '{}',
  slice_label text NOT NULL DEFAULT 'Full corpus',
  year_from integer,
  year_to integer,
  status text NOT NULL DEFAULT 'running',
  executive_summary text,
  coverage_warning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE public.run_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  run_id uuid NOT NULL REFERENCES public.analysis_runs(id) ON DELETE CASCADE,
  agent text NOT NULL,
  title text NOT NULL,
  detail text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  confidence numeric NOT NULL DEFAULT 0.5,
  corroboration integer NOT NULL DEFAULT 1,
  programs text[] NOT NULL DEFAULT '{}',
  ministries text[] NOT NULL DEFAULT '{}',
  citation text,
  source_document_id uuid REFERENCES public.corpus_documents(id) ON DELETE SET NULL,
  recommended_action text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX run_findings_run_idx ON public.run_findings(run_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.corpus_documents TO authenticated;
GRANT ALL ON public.corpus_documents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doc_chunks TO authenticated;
GRANT ALL ON public.doc_chunks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analysis_runs TO authenticated;
GRANT ALL ON public.analysis_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.run_findings TO authenticated;
GRANT ALL ON public.run_findings TO service_role;

ALTER TABLE public.corpus_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.run_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own documents" ON public.corpus_documents FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own chunks" ON public.doc_chunks FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own runs" ON public.analysis_runs FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own findings" ON public.run_findings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector(3072),
  doc_ids uuid[],
  match_count integer DEFAULT 12
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_index integer,
  page_hint integer,
  content text,
  similarity double precision
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT c.id, c.document_id, c.chunk_index, c.page_hint, c.content,
         1 - (c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) AS similarity
  FROM public.doc_chunks c
  WHERE c.embedding IS NOT NULL
    AND (doc_ids IS NULL OR array_length(doc_ids, 1) IS NULL OR c.document_id = ANY(doc_ids))
  ORDER BY c.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_chunks(vector, uuid[], integer) TO authenticated;