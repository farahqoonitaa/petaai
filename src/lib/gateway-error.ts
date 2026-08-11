/**
 * Turns raw AI gateway failures into something an analyst can act on.
 * Credit exhaustion and rate limiting are operational states, not stack traces.
 */
export function friendlyAiError(e: unknown, fallback = "Something went wrong."): string {
  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  const text = raw.toLowerCase();

  if (/\b402\b|credit|budget|insufficient funds|quota exceeded/.test(text))
    return "AI credits for this workspace are used up, so new swarm passes and executive summaries are paused. Existing findings, the coherence graph and the failure cascade still load. Top up the workspace AI credits to resume analysis.";

  if (/\b429\b|rate limit|too many requests/.test(text))
    return "The AI gateway is rate-limiting this workspace. Wait about a minute, then run the pass again — nothing was lost.";

  if (/\b401\b|unauthorized|missing lovable_api_key/.test(text))
    return "The AI gateway rejected this request as unauthenticated. Re-open the workspace and sign in again.";

  return raw || fallback;
}

/** True when the failure is a billing/credit stop rather than a code defect. */
export function isCreditError(e: unknown): boolean {
  const text = (e instanceof Error ? e.message : String(e ?? "")).toLowerCase();
  return /\b402\b|credit|budget|insufficient funds|quota exceeded/.test(text);
}
