ALTER TABLE public.run_findings
  ADD COLUMN IF NOT EXISTS source_chunk_id uuid REFERENCES public.doc_chunks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quote text,
  ADD COLUMN IF NOT EXISTS page_hint integer,
  ADD COLUMN IF NOT EXISTS match_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verification text NOT NULL DEFAULT 'unverified';