import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { agentName } from "@/lib/peta-agents";
import { Chip } from "@/components/peta/primitives";

export const Route = createFileRoute("/workspace/runs/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Analysis runs — PETA-AI workspace" },
      {
        name: "description",
        content:
          "Every coherence run you have executed: agents used, corpus in scope, temporal slice and the findings each pass deposited.",
      },
      { property: "og:title", content: "PETA-AI — analysis runs" },
      {
        property: "og:description",
        content: "An auditable history of swarm runs over your indexed planning corpus.",
      },
    ],
  }),
  component: RunsPage,
});

interface RunRow {
  id: string;
  mode: string;
  agents: string[];
  document_ids: string[];
  slice_label: string;
  status: string;
  created_at: string;
}

function RunsPage() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("analysis_runs")
        .select("id, mode, agents, document_ids, slice_label, status, created_at")
        .order("created_at", { ascending: false });
      const rows = (data as RunRow[]) ?? [];
      setRuns(rows);
      const { data: findings } = await supabase.from("run_findings").select("run_id");
      const tally: Record<string, number> = {};
      for (const f of (findings as { run_id: string }[]) ?? [])
        tally[f.run_id] = (tally[f.run_id] ?? 0) + 1;
      setCounts(tally);
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Loading runs…</p>;

  if (runs.length === 0)
    return (
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        No runs yet. Index a corpus, then run either a focused agent or the full swarm from the Run
        analysis tab.
      </p>
    );

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-border px-6 py-4">
        <p className="label-mono">run history</p>
      </div>
      <ul className="divide-y divide-border">
        {runs.map((r) => (
          <li key={r.id}>
            <Link
              to="/workspace/runs/$runId"
              params={{ runId: r.id }}
              className="block px-6 py-5 transition-colors hover:bg-surface-2"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold">
                  {r.mode === "full_swarm" ? "Full swarm analysis" : "Focused analysis"} ·{" "}
                  {r.slice_label}
                </h2>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Chip>{counts[r.id] ?? 0} findings</Chip>
                <Chip>{r.document_ids.length} documents</Chip>
                {r.agents.map((a) => (
                  <Chip key={a}>{agentName(a)}</Chip>
                ))}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
