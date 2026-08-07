import { createFileRoute } from "@tanstack/react-router";
import { OPEN_GAPS, RISKS, ROADMAP } from "@/lib/peta-data";
import { SectionHeading } from "@/components/peta/primitives";

export const Route = createFileRoute("/roadmap")({
  head: () => ({
    meta: [
      { title: "Roadmap, risks & status — PETA-AI" },
      {
        name: "description",
        content:
          "Four phases with commercial milestones, business and technical risk with mitigations, and an honest list of open gaps as of PRD v4.0.",
      },
      { property: "og:title", content: "PETA-AI roadmap, risks and current status" },
      {
        property: "og:description",
        content:
          "Phase 4 is graph-dependent, not calendar-parallel: a cascade simulation run on a sparse graph produces noise, not forecasts.",
      },
    ],
  }),
  component: RoadmapPage,
});

function RoadmapPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <SectionHeading
        eyebrow="section 7 — go-to-market & roadmap"
        title="Each phase carries a commercial milestone, not just a technical one."
      />

      <ol className="mt-12 space-y-4">
        {ROADMAP.map((p) => (
          <li key={p.phase} className="panel grid gap-4 p-6 lg:grid-cols-[16rem_1fr]">
            <div>
              <h2 className="text-base font-semibold">{p.phase}</h2>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-primary">
                {p.timeline}
              </p>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{p.milestone}</p>
          </li>
        ))}
      </ol>

      <p className="mt-6 max-w-3xl text-sm leading-relaxed text-accent">
        Sequencing note: the predictive layer cannot meaningfully start before the Coherence Graph
        has enough real, weighted relationships to model. A causal or ABM simulation run on a sparse
        graph produces noise, not forecasts. Phase 4 is graph-dependent, not calendar-parallel.
      </p>

      <div className="mt-20 grid gap-8 lg:grid-cols-2">
        {[
          { title: "8.1 Business & political risk", rows: RISKS.business },
          { title: "8.2 Technical & model risk", rows: RISKS.technical },
        ].map((group) => (
          <section key={group.title}>
            <h2 className="font-display text-xl font-semibold">{group.title}</h2>
            <div className="mt-5 space-y-3">
              {group.rows.map((r) => (
                <article key={r.risk} className="panel p-5">
                  <h3 className="text-sm font-semibold">{r.risk}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.mitigation}</p>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-20">
        <SectionHeading
          eyebrow="section 9 — current status & open gaps"
          title="Stated plainly, because overclaiming is the fastest way to lose a technical evaluator."
        />
        <ul className="mt-8 space-y-3">
          {OPEN_GAPS.map((g) => (
            <li key={g} className="flex gap-3 rounded-lg border border-border bg-card px-5 py-4">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
              <p className="text-sm leading-relaxed text-muted-foreground">{g}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
