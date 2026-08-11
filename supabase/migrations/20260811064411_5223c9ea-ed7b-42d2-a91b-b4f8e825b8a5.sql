CREATE OR REPLACE FUNCTION public.emit_trace(_run_id uuid, _agent text, _phase text, _message text)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
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

REVOKE ALL ON FUNCTION public.emit_trace(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.emit_trace(uuid, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.emit_trace(uuid, text, text, text) TO authenticated;