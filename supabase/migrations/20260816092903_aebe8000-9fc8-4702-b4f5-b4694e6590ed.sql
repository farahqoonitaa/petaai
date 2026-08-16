ALTER TABLE public.analysis_runs
  ADD COLUMN IF NOT EXISTS evaluator_ministry text,
  ADD COLUMN IF NOT EXISTS evaluation_mode text NOT NULL DEFAULT 'central_review',
  ADD COLUMN IF NOT EXISTS cross_ministry boolean NOT NULL DEFAULT true;