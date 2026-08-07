import { createFileRoute } from "@tanstack/react-router";
import { CRITICAL_PROGRAMS, FINDINGS } from "@/lib/peta-data";
import { Chip, SeverityBadge } from "@/components/peta/primitives";

export const Route = createFileRoute("/demo/graph")({
  head: () => ({
    meta: [
      { title: "Program criticality — PETA-AI demo workspace" },
      {
        name: "description",
        content:
          "Structural criticality ranking from the coordination graph: which programs would disrupt the most others if they failed, without anyone hand-specifying importance.",
      },
      { property: "og:title", content: "PETA-AI demo — program criticality" },
      {
        property: "og:description",
        content:
          "Nodes are programs, edges are detected relationships. Confirmed findings gain weight across passes; unconfirmed ones decay.",
      },
    ],
  }),
  component: GraphPage,
});

function GraphPage() {
  const max = Math.max(...CRITICAL_PROGRAMS.map((p) => p.criticality));

  return (
    <div>
      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
        The coordination graph is analysed after each full pass to rank structural criticality — which
        programs would disrupt the most others if they failed. This produces prioritisation without
        anyone having to hand-specify what "important" means. Findings confirmed independently across
        multiple passes gain weight; unconfirmed ones decay.
      </p>

      <div className="mt-8 panel overflow-hidden">
        <div className="border-b border-border px-6 py-4">
          <p className="label-mono">structural criticality · demo corpus</p>
        </div>
        <ul className="divide-y divide-border">
          {CRITICAL_PROGRAMS.map((p) => {
            const related = FINDINGS.filter((f) => f.programs.includes(p.program));
            return (
              <li key={p.program} className="px-6 py-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-xs text-muted-foreground">#{p.rank}</span>
                    <h2 className="text-base font-semibold">{p.program}</h2>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{p.ministry}</span>
                </div>

                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                  <span
                    className="block h-full rounded-full bg-primary/70"
                    style={{ width: `${(p.criticality / max) * 100}%` }}
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Chip>criticality {p.criticality.toFixed(2)}</Chip>
                  <Chip>{p.dependents} dependent programs</Chip>
                  <Chip>{p.targetsTouched} national targets</Chip>
                  {related.map((f) => (
                    <span key={f.id} className="flex items-center gap-2">
                      <SeverityBadge severity={f.severity} />
                      <span className="font-mono text-[11px] text-muted-foreground">{f.id}</span>
                    </span>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Prioritisation objective: surface the ~20% of programs that are load-bearing for ~80% of
        national targets. In this demo corpus the top three nodes alone carry 26 of the 41 tracked
        dependencies.
      </p>
    </div>
  );
}
