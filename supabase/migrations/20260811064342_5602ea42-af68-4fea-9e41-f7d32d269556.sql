ALTER TABLE public.analysis_runs
  ADD COLUMN IF NOT EXISTS trace_cursor integer NOT NULL DEFAULT 0;

ALTER TABLE public.run_findings
  ADD COLUMN IF NOT EXISTS monetary_amount numeric,
  ADD COLUMN IF NOT EXISTS monetary_currency text,
  ADD COLUMN IF NOT EXISTS monetary_basis text;

CREATE TABLE IF NOT EXISTS public.run_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  run_id uuid NOT NULL REFERENCES public.analysis_runs(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  agent text,
  phase text NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (run_id, seq)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.run_traces TO authenticated;
GRANT ALL ON public.run_traces TO service_role;

ALTER TABLE public.run_traces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own traces" ON public.run_traces
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS run_traces_run_seq_idx ON public.run_traces (run_id, seq);

CREATE OR REPLACE FUNCTION public.emit_trace(_run_id uuid, _agent text, _phase text, _message text)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _seq integer;
BEGIN
  -- Atomic counter: the row lock taken by this UPDATE serialises parallel agents,
  -- so seq is unique and contiguous even when six passes run concurrently.
  UPDATE public.analysis_runs
     SET trace_cursor = trace_cursor + 1
   WHERE id = _run_id AND user_id = auth.uid()
  RETURNING trace_cursor, user_id INTO _seq, _owner;

  IF _seq IS NULL THEN
    RAISE EXCEPTION 'run not found for this user';
  END IF;

  INSERT INTO public.run_traces (user_id, run_id, seq, agent, phase, message)
  VALUES (_owner, _run_id, _seq, _agent, _phase, _message);

  RETURN _seq;
END;
$$;

GRANT EXECUTE ON FUNCTION public.emit_trace(uuid, text, text, text) TO authenticated;