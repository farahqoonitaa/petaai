import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AGENT_SPECS, EPOCHS, type AgentId } from "@/lib/peta-agents";
import { finalizeRun, runAgentPass, startRun } from "@/lib/analysis.functions";
import { friendlyAiError, isCreditError } from "@/lib/gateway-error";
import { Chip } from "@/components/peta/primitives";

export const Route = createFileRoute("/workspace/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Run the agent swarm — PETA-AI workspace" },
      {
        name: "description",
        content:
          "Choose a focused agent or the full swarm, pick a temporal slice and run coherence analysis over your indexed planning corpus with live per-agent traces.",
      },
      { property: "og:title", content: "PETA-AI — run the agent swarm" },
      {
        property: "og:description",
        content:
          "Six specialised agents retrieve from your corpus, deposit traces into the coherence graph and return cited findings. No automated execution.",
      },
    ],
  }),
  component: RunConsole,
});

interface DocOption {
  id: string;
  title: string;
  ministry: string;
  doc_type: string;
  doc_year: number | null;
  chunk_count: number;
  status: string;
}

type PassState = "queued" | "retrieving" | "done" | "empty" | "failed";

interface Pass {
  agent: AgentId;
  state: PassState;
  retrieved?: number;
  inserted?: number;
  note?: string | null;
}

function RunConsole() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<DocOption[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  // Stigmergic Tracer is the swarm's coordination layer — on by default.
  const [selectedAgents, setSelectedAgents] = useState<AgentId[]>([
    "stigmergic_tracer",
    "contradiction_detector",
  ]);
  const [epochId, setEpochId] = useState(EPOCHS[0]!.id);
  // Institutional entry point: who is running this evaluation.
  const [evaluator, setEvaluator] = useState<string | null>(null);
  const [crossMinistry, setCrossMinistry] = useState(true);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);


  const load = useCallback(async () => {
    const { data } = await supabase
      .from("corpus_documents")
      .select("id, title, ministry, doc_type, doc_year, chunk_count, status")
      .eq("status", "ready")
      .order("created_at", { ascending: false });
    const rows = (data as DocOption[]) ?? [];
    setDocs(rows);
    setSelectedDocs(rows.map((d) => d.id));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const epoch = EPOCHS.find((e) => e.id === epochId) ?? EPOCHS[0]!;
  const fullSwarm = selectedAgents.length === AGENT_SPECS.length;
  const tracerOn = selectedAgents.includes("stigmergic_tracer");

  const ministries = [...new Set(docs.map((d) => d.ministry).filter(Boolean))].sort();
  const norm = (s: string) => s.trim().toLowerCase();
  const ownDocs = evaluator ? docs.filter((d) => norm(d.ministry) === norm(evaluator)) : docs;
  const foreignDocs = evaluator ? docs.filter((d) => norm(d.ministry) !== norm(evaluator)) : [];
  const scopedOut = evaluator && !crossMinistry ? foreignDocs.map((d) => d.id) : [];

  // A self-evaluation without the exception may only read its own documents.
  function pickEvaluator(ministry: string | null, cross = crossMinistry) {
    setEvaluator(ministry);
    if (ministry && !cross) setSelectedDocs(docs.filter((d) => norm(d.ministry) === norm(ministry)).map((d) => d.id));
    else setSelectedDocs(docs.map((d) => d.id));
  }

  function setException(next: boolean) {
    setCrossMinistry(next);
    if (evaluator) pickEvaluator(evaluator, next);
  }

  function toggleAgent(id: AgentId) {
    setSelectedAgents((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  }

  function toggleDoc(id: string) {
    if (scopedOut.includes(id)) return;
    setSelectedDocs((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  }


  async function run() {
    setError(null);
    setCoverage(null);
    setRunId(null);
    setRunning(true);
    setPasses(selectedAgents.map((a) => ({ agent: a, state: "queued" })));

    try {
      const started = await startRun({
        data: {
          mode: fullSwarm ? "full_swarm" : "focused",
          agents: selectedAgents,
          documentIds: selectedDocs,
          sliceLabel: epoch.label,
          yearFrom: epoch.yearFrom,
          yearTo: epoch.yearTo,
          evaluatorMinistry: evaluator,
          evaluationMode: evaluator ? "self_evaluation" : "central_review",
          crossMinistry: evaluator ? crossMinistry : true,
        },

      });
      setRunId(started.runId);
      setCoverage(started.coverageWarning);

      // Agents run concurrently — the swarm is parallel by design, and trace
      // sequencing is kept unique by the atomic counter in the database.
      setPasses((prev) => prev.map((p) => ({ ...p, state: "retrieving" })));
      await Promise.all(
        selectedAgents.map(async (agent) => {
          try {
            const result = await runAgentPass({ data: { runId: started.runId, agent } });
            setPasses((prev) =>
              prev.map((p) =>
                p.agent === agent
                  ? {
                      ...p,
                      state: result.inserted > 0 ? "done" : "empty",
                      retrieved: result.retrieved,
                      inserted: result.inserted,
                      note: result.note,
                    }
                  : p,
              ),
            );
          } catch (e) {
            if (isCreditError(e)) setError(friendlyAiError(e));
            setPasses((prev) =>
              prev.map((p) =>
                p.agent === agent
                  ? { ...p, state: "failed", note: friendlyAiError(e, "Pass failed.") }
                  : p,
              ),
            );
          }
        }),
      );

      try {
        await finalizeRun({ data: { runId: started.runId } });
      } catch (e) {
        // A missing summary must not hide the grounded findings already stored.
        setError(friendlyAiError(e));
      }
      void navigate({ to: "/workspace/runs/$runId", params: { runId: started.runId } });
    } catch (e) {
      setError(friendlyAiError(e, "Run failed to start."));
    } finally {
      setRunning(false);
    }
  }


  const canRun = !running && selectedAgents.length > 0 && selectedDocs.length > 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div>
        <section>
          <p className="label-mono">step 1 · evaluating institution</p>
          <h2 className="mt-2 text-lg font-semibold">
            {evaluator ? `${evaluator} self-evaluation` : "Central cross-government review"}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Who is running this evaluation decides what counts as a finding. A ministry evaluating
            itself is judged on its own documents; a central review compares institutions against
            each other.
          </p>

          {ministries.length === 0 ? (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Index a document first — the list of institutions is derived from your own corpus, never
              invented.
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                role="radio"
                aria-checked={evaluator === null}
                onClick={() => pickEvaluator(null)}
                className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
                  evaluator === null
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-surface-2"
                }`}
              >
                Bappenas · all institutions
              </button>
              {ministries.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={evaluator === m}
                  onClick={() => pickEvaluator(m)}
                  className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
                    evaluator === m
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-surface-2"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}

          {evaluator ? (
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <button
                type="button"
                role="checkbox"
                aria-checked={crossMinistry}
                onClick={() => setException(!crossMinistry)}
                className="flex w-full items-start gap-3 text-left"
              >
                <span
                  aria-hidden
                  className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border font-mono text-[9px] ${
                    crossMinistry
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span>
                  <span className="text-sm font-semibold">Cross-ministry exception</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {crossMinistry
                      ? `On — ${foreignDocs.length} document(s) from other institutions stay in scope, so dependencies and contradictions at ${evaluator}'s boundaries can be detected.`
                      : `Off — scoped to ${evaluator} only (${ownDocs.length} document(s)). Cross-boundary contradictions cannot be detected in this posture.`}
                  </span>
                </span>
              </button>
            </div>
          ) : null}
        </section>

        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="label-mono">step 2 · entry point</p>

              <h2 className="mt-2 text-lg font-semibold">
                {fullSwarm ? "Full swarm analysis" : "Focused agent selection"}
              </h2>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                {selectedAgents.length} of {AGENT_SPECS.length} agents will deposit traces
                {tracerOn ? "" : " · tracer off, no coordination layer"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedAgents(AGENT_SPECS.map((a) => a.id))}
                className="rounded-md border border-border px-3 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                full swarm
              </button>
              <button
                type="button"
                onClick={() => setSelectedAgents(["stigmergic_tracer"])}
                className="rounded-md border border-border px-3 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                tracer only
              </button>
              <button
                type="button"
                onClick={() => setSelectedAgents([])}
                className="rounded-md border border-border px-3 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                clear
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2" role="group" aria-label="Agents in this run">
            {AGENT_SPECS.map((a) => {
              const on = selectedAgents.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  aria-label={`${a.name} — ${on ? "selected" : "not selected"}`}
                  onClick={() => toggleAgent(a.id)}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    on
                      ? "border-primary/50 bg-primary/10"
                      : "border-border bg-card hover:bg-surface-2"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <span
                        aria-hidden
                        className={`grid h-4 w-4 shrink-0 place-items-center rounded border font-mono text-[9px] ${
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                      {a.name}
                    </h3>
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {a.bottlenecks}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{a.mechanism}</p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
                    {on ? "selected" : a.short}
                  </p>
                </button>
              );
            })}
          </div>
          {selectedAgents.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Select at least one agent — an empty swarm has nothing to deposit.
            </p>
          ) : null}
        </section>

        <section className="mt-10">
          <p className="label-mono">step 2 · temporal slice</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {EPOCHS.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setEpochId(e.id)}
                className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
                  e.id === epochId
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-surface-2"
                }`}
              >
                {e.label}
              </button>
            ))}
          </div>
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">{epoch.note}</p>
        </section>

        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="label-mono">step 3 · corpus in scope</p>
            <button
              type="button"
              onClick={() =>
                setSelectedDocs(selectedDocs.length === docs.length ? [] : docs.map((d) => d.id))
              }
              className="font-mono text-[11px] text-muted-foreground hover:text-foreground"
            >
              {selectedDocs.length === docs.length ? "clear all" : "select all"}
            </button>
          </div>

          {docs.length === 0 ? (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              No indexed documents yet. Index at least two documents from different ministries on the
              Corpus tab — the swarm reasons over retrieved passages only, so an empty corpus produces
              nothing rather than guesses.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {docs.map((d) => {
                const on = selectedDocs.includes(d.id);
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => toggleDoc(d.id)}
                      className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                        on ? "border-primary/50 bg-primary/10" : "border-border bg-card hover:bg-surface-2"
                      }`}
                    >
                      <span className="text-sm">{d.title}</span>
                      <span className="flex flex-wrap gap-2">
                        <Chip>{d.ministry}</Chip>
                        <Chip>{d.doc_type}</Chip>
                        <Chip>{d.chunk_count} passages</Chip>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <button
          type="button"
          disabled={!canRun}
          onClick={run}
          className="mt-8 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {running
            ? "Swarm running…"
            : `Run ${selectedAgents.length} agent${selectedAgents.length === 1 ? "" : "s"} over ${selectedDocs.length} document${selectedDocs.length === 1 ? "" : "s"}`}
        </button>
        {error ? <p className="mt-3 text-sm text-critical">{error}</p> : null}
      </div>

      <aside>
        <p className="label-mono">stigmergic trace log</p>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Agents do not talk to each other. Each retrieves independently and deposits findings into
          the shared coherence graph; overlap between deposits is what raises confidence at the end of
          the run.
        </p>

        <div className="mt-5 space-y-2">
          {passes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center font-mono text-[11px] text-muted-foreground">
              no active run
            </p>
          ) : (
            passes.map((p) => {
              const spec = AGENT_SPECS.find((a) => a.id === p.agent)!;
              return (
                <div key={p.agent} className="rounded-lg border border-border bg-card px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold">{spec.name}</span>
                    <span
                      className={`font-mono text-[10px] uppercase tracking-[0.14em] ${
                        p.state === "done"
                          ? "text-primary"
                          : p.state === "failed"
                            ? "text-critical"
                            : p.state === "retrieving"
                              ? "text-accent"
                              : "text-muted-foreground"
                      }`}
                    >
                      {p.state === "retrieving" ? "reasoning…" : p.state}
                    </span>
                  </div>
                  {p.retrieved !== undefined ? (
                    <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
                      {p.retrieved} passages retrieved · {p.inserted} deposited
                    </p>
                  ) : null}
                  {p.note ? (
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{p.note}</p>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        {coverage ? (
          <div className="mt-5 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
              coverage warning
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{coverage}</p>
          </div>
        ) : null}

        {runId && !running ? (
          <button
            type="button"
            onClick={() => navigate({ to: "/workspace/runs/$runId", params: { runId } })}
            className="mt-5 w-full rounded-lg border border-border px-4 py-2.5 text-xs transition-colors hover:bg-surface-2"
          >
            Open run report
          </button>
        ) : null}
      </aside>
    </div>
  );
}
