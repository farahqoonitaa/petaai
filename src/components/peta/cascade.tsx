import { useEffect, useState } from "react";
import { getRunAnalytics } from "@/lib/analysis.functions";
import { formatRupiah, type CascadeNode } from "@/lib/grounding";
import { friendlyAiError } from "@/lib/gateway-error";
import { agentName } from "@/lib/peta-agents";

interface Exposure {
  findingId: string;
  title: string;
  agent: string;
  program: string | null;
  amount: number;
  currency: string;
  basis: string | null;
}

interface Trace {
  seq: number;
  agent: string;
  phase: string;
  message: string;
  at: string;
}

interface Analytics {
  cascade: CascadeNode[];
  exposure: Exposure[];
  exposureTotal: number;
  ministries: string[];
  traces: Trace[];
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

const PHASE_TONE: Record<string, string> = {
  retrieval: "text-muted-foreground",
  reasoning: "text-accent",
  deposited: "text-primary",
  dropped: "text-critical",
  empty: "text-muted-foreground",
};

/**
 * Deterministic run analytics. Every number here is computed without the AI
 * gateway, so this panel keeps working when AI credits run out.
 */
export function RunAnalytics({ runId }: { runId: string }) {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTrace, setShowTrace] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const result = (await getRunAnalytics({ data: { runId } })) as Analytics;
        if (alive) setData(result);
      } catch (e) {
        if (alive) setError(friendlyAiError(e, "Could not load run analytics."));
      }
    })();
    return () => {
      alive = false;
    };
  }, [runId]);

  if (error) return <p className="mt-6 text-sm text-critical">{error}</p>;
  if (!data) return null;

  return (
    <>
      {data.cascade.length ? (
        <section className="mt-8 panel p-6">
          <p className="label-mono">delivery failure cascade · noisy-or over grounded findings</p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Each program's risk combines its findings as independent causes,
            <span className="font-mono"> P = 1 − Π(1 − wᵢ)</span>. Intervals widen where a citation
            is only partially verified. These are structural estimates for triage, not forecasts.
          </p>
          <ul className="mt-5 space-y-4">
            {data.cascade.map((node) => (
              <li key={node.program}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{node.program}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {pct(node.probability)} · range {pct(node.low)}–{pct(node.high)} ·{" "}
                    {node.findings} finding{node.findings === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="relative h-full rounded-full bg-critical/70"
                    style={{ width: `${Math.max(2, node.probability * 100)}%` }}
                  />
                </div>
                {node.drivers.length ? (
                  <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    driven by {node.drivers.map(agentName).join(" · ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.exposure.length ? (
        <section className="mt-6 panel p-6">
          <p className="label-mono">monetary exposure · nearest-program attribution</p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            A figure is attributed only when the currency is explicit in the passage and no other
            named program sits closer to it. Programs without such a figure are left blank rather
            than assigned a neighbour's budget.
          </p>
          <p className="mt-4 font-display text-3xl font-semibold">
            {formatRupiah(data.exposureTotal)}
          </p>
          <ul className="mt-4 divide-y divide-border">
            {data.exposure.map((e) => (
              <li key={e.findingId} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                <span className="text-sm">
                  {e.program ?? e.title}
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {agentName(e.agent)}
                  </span>
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {formatRupiah(e.amount)}
                  {e.basis ? ` · "${e.basis}"` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.traces.length ? (
        <section className="mt-6 panel p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="label-mono">stigmergic trace log · {data.traces.length} steps</p>
            <button
              type="button"
              onClick={() => setShowTrace((v) => !v)}
              className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent hover:underline"
            >
              {showTrace ? "hide" : "show"}
            </button>
          </div>
          {showTrace ? (
            <ol className="mt-4 space-y-2">
              {data.traces.map((t) => (
                <li key={t.seq} className="font-mono text-[11px] leading-relaxed">
                  <span className="text-muted-foreground">
                    #{String(t.seq).padStart(3, "0")} {agentName(t.agent)} ·{" "}
                  </span>
                  <span className={PHASE_TONE[t.phase] ?? "text-foreground"}>
                    [{t.phase}] {t.message}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Contiguous, uniquely sequenced record of every retrieval, reasoning pass, discarded
              claim and deposited trace in this run — written by an atomic counter so parallel agents
              never collide.
            </p>
          )}
        </section>
      ) : null}
    </>
  );
}
