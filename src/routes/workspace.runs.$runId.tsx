import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { agentName } from "@/lib/peta-agents";
import { Chip, ConfidenceBar, SeverityBadge } from "@/components/peta/primitives";
import { CitationInspector, VerificationBadge } from "@/components/peta/citation";
import { RunAnalytics } from "@/components/peta/cascade";
import { formatRupiah } from "@/lib/grounding";
import type { Verification } from "@/lib/citation-verify";
import type { Severity } from "@/lib/peta-data";

export const Route = createFileRoute("/workspace/runs/$runId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Run report — PETA-AI workspace" },
      {
        name: "description",
        content:
          "Cited coherence findings from a swarm run: severity, confidence with cross-agent corroboration, source passage and a recommended analyst action.",
      },
      { property: "og:title", content: "PETA-AI — run report" },
      {
        property: "og:description",
        content:
          "Every finding is grounded in a retrieved passage from your own corpus. No finding triggers an automated action.",
      },
    ],
  }),
  component: RunReport,
});

interface Finding {
  id: string;
  agent: string;
  title: string;
  detail: string;
  severity: Severity;
  confidence: number;
  corroboration: number;
  programs: string[];
  ministries: string[];
  citation: string | null;
  recommended_action: string | null;
  verification: string | null;
  match_score: number | null;
  monetary_amount: number | null;
  monetary_currency: string | null;
  monetary_basis: string | null;
}

const verificationOf = (f: Finding): Verification =>
  f.verification === "verified" || f.verification === "partial" ? f.verification : "unverified";


interface Run {
  id: string;
  mode: string;
  agents: string[];
  document_ids: string[];
  slice_label: string;
  status: string;
  executive_summary: string | null;
  coverage_warning: string | null;
  created_at: string;
  evaluator_ministry: string | null;
  evaluation_mode: string | null;
  cross_ministry: boolean | null;
}


function RunReport() {
  const { runId } = Route.useParams();
  const [run, setRun] = useState<Run | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [docTitles, setDocTitles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data: r } = await supabase
        .from("analysis_runs")
        .select("*")
        .eq("id", runId)
        .maybeSingle();
      setRun((r as Run) ?? null);
      const { data: f } = await supabase
        .from("run_findings")
        .select("*")
        .eq("run_id", runId)
        .order("confidence", { ascending: false });
      const rows = (f as Finding[]) ?? [];
      setFindings(rows);
      setOpenId(rows[0]?.id ?? null);
      if (r) {
        const { data: docs } = await supabase
          .from("corpus_documents")
          .select("title")
          .in("id", (r as Run).document_ids);
        setDocTitles(((docs as { title: string }[]) ?? []).map((d) => d.title));
      }
      setLoading(false);
    })();
  }, [runId]);

  const bySeverity = useMemo(() => {
    const order: Severity[] = ["critical", "high", "medium"];
    return order.map((s) => ({ s, n: findings.filter((f) => f.severity === s).length }));
  }, [findings]);

  const verifiedCount = useMemo(
    () => findings.filter((f) => verificationOf(f) === "verified").length,
    [findings],
  );


  if (loading) return <p className="text-sm text-muted-foreground">Loading report…</p>;
  if (!run) return <p className="text-sm text-muted-foreground">This run no longer exists.</p>;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="label-mono">
            {run.mode === "full_swarm" ? "full swarm analysis" : "focused analysis"} ·{" "}
            {run.slice_label}
          </p>
          <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
            {run.evaluator_ministry
              ? `evaluated by ${run.evaluator_ministry} · ${run.cross_ministry ? "cross-ministry exception granted" : "own documents only"}`
              : "central cross-government review · all institutions in scope"}
          </p>
          <h2 className="mt-2 text-xl font-semibold">
            {findings.length} finding{findings.length === 1 ? "" : "s"} across{" "}
            {run.document_ids.length} document{run.document_ids.length === 1 ? "" : "s"}
          </h2>

        </div>
        <span className="font-mono text-[11px] text-muted-foreground">
          {new Date(run.created_at).toLocaleString()} · {run.status}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {run.agents.map((a) => (
          <Chip key={a}>{agentName(a)}</Chip>
        ))}
        {docTitles.map((t) => (
          <Chip key={t}>{t}</Chip>
        ))}
      </div>

      {run.coverage_warning ? (
        <div className="mt-6 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
            coverage warning
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {run.coverage_warning}
          </p>
        </div>
      ) : null}

      {run.executive_summary ? (
        <div className="mt-6 panel p-6">
          <p className="label-mono">executive summary</p>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground">
            {run.executive_summary}
          </p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {bySeverity.map(({ s, n }) => (
          <div key={s} className="panel p-5">
            <p className="label-mono">{s} findings</p>
            <p className="mt-2 font-display text-3xl font-semibold">{n}</p>
          </div>
        ))}
      </div>

      {findings.length ? (
        <div className="mt-4 rounded-lg border border-border bg-surface-2 px-4 py-3">
          <p className="label-mono">citation verification</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {verifiedCount} of {findings.length} finding{findings.length === 1 ? "" : "s"} quote a
            span found verbatim in an indexed passage.
            {findings.length - verifiedCount > 0
              ? ` ${findings.length - verifiedCount} low-confidence match${
                  findings.length - verifiedCount === 1 ? " is" : "es are"
                } flagged below and capped in confidence — open the excerpt to check the wording against your own document.`
              : " Open any excerpt to read the source span with the quote highlighted."}
          </p>
        </div>
      ) : null}


      {findings.length === 0 ? (
        <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          This run produced no findings. That is a legitimate outcome: each agent only reports what it
          can ground in a retrieved passage. Widen the corpus or select a different agent mandate.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {findings.map((f) => {
            const open = openId === f.id;
            return (
              <article key={f.id} className="panel overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : f.id)}
                  className="w-full px-6 py-5 text-left transition-colors hover:bg-surface-2"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <SeverityBadge severity={f.severity} />
                    <VerificationBadge
                      verification={verificationOf(f)}
                      matchScore={Number(f.match_score ?? 0)}
                    />
                    <Chip>{agentName(f.agent)}</Chip>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {f.corroboration} agent{f.corroboration === 1 ? "" : "s"} touching these programs
                    </span>
                  </div>

                  <h3 className="mt-3 text-base font-semibold">{f.title}</h3>
                  <div className="mt-4 max-w-xs">
                    <ConfidenceBar value={Number(f.confidence)} />
                  </div>
                </button>

                {open ? (
                  <div className="border-t border-border px-6 py-5">
                    <p className="text-sm leading-relaxed text-muted-foreground">{f.detail}</p>
                    <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                      {f.programs.length ? (
                        <div>
                          <dt className="label-mono">Programs</dt>
                          <dd className="mt-2 flex flex-wrap gap-2">
                            {f.programs.map((p) => (
                              <Chip key={p}>{p}</Chip>
                            ))}
                          </dd>
                        </div>
                      ) : null}
                      {f.ministries.length ? (
                        <div>
                          <dt className="label-mono">Ministries</dt>
                          <dd className="mt-2 flex flex-wrap gap-2">
                            {f.ministries.map((m) => (
                              <Chip key={m}>{m}</Chip>
                            ))}
                          </dd>
                        </div>
                      ) : null}
                      <div className="sm:col-span-2">
                        <dt className="label-mono">Source passage · citation verification</dt>
                        <dd className="mt-2">
                          <CitationInspector
                            findingId={f.id}
                            citation={f.citation}
                            verification={verificationOf(f)}
                            matchScore={Number(f.match_score ?? 0)}
                          />
                        </dd>
                      </div>

                      {f.monetary_amount != null ? (
                        <div className="sm:col-span-2">
                          <dt className="label-mono">
                            Attributed budget exposure (nearest-program rule)
                          </dt>
                          <dd className="mt-2 text-sm leading-relaxed text-foreground">
                            {formatRupiah(Number(f.monetary_amount))}
                            {f.monetary_basis ? (
                              <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                                read verbatim as "{f.monetary_basis}"
                              </span>
                            ) : null}
                          </dd>
                        </div>
                      ) : null}

                      {f.recommended_action ? (
                        <div className="sm:col-span-2">
                          <dt className="label-mono">
                            Recommended action (no automated execution)
                          </dt>
                          <dd className="mt-2 text-sm leading-relaxed text-foreground">
                            {f.recommended_action}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <RunAnalytics runId={runId} />
    </div>
  );
}
