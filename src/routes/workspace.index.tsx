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

  function toggleAgent(id: AgentId) {
    setSelectedAgents((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  }

  function toggleDoc(id: string) {
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
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="label-mono">step 1 · entry point</p>
              <h2 className="mt-2 text-lg font-semibold">
                {fullSwarm ? "Full swarm analysis" : "Focused agent selection"}
              </h2>
            </div>
            <button
              type="button"
              onClick={() =>
                setSelectedAgents(fullSwarm ? ["stigmergic_tracer"] : AGENT_SPECS.map((a) => a.id))
              }
              className="rounded-md border border-border px-3 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {fullSwarm ? "narrow to the stigmergic tracer" : "select all six agents"}
            </button>

          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {AGENT_SPECS.map((a) => {
              const on = selectedAgents.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAgent(a.id)}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    on
                      ? "border-primary/50 bg-primary/10"
                      : "border-border bg-card hover:bg-surface-2"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">{a.name}</h3>
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
