import { createFileRoute } from "@tanstack/react-router";
import { AGENTS, LAYERS, VALIDATION } from "@/lib/peta-data";
import { Chip, SectionHeading } from "@/components/peta/primitives";

export const Route = createFileRoute("/product")({
  head: () => ({
    meta: [
      { title: "Architecture — PETA-AI planning coherence platform" },
      {
        name: "description",
        content:
          "Five layers: document intelligence, a six-agent swarm, the coordination graph, predictive simulation, and the human accountability interface.",
      },
      { property: "og:title", content: "PETA-AI architecture — five layers, six agents" },
      {
        property: "og:description",
        content:
          "How PETA-AI resolves entities across 8,000–12,000 pages, weights findings in a coherence graph, and forecasts downstream risk with calibrated confidence intervals.",
      },
    ],
  }),
  component: ProductPage,
});

const priorityTone: Record<string, string> = {
  P0: "text-primary",
  P1: "text-accent",
  P2: "text-muted-foreground",
};

function ProductPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <SectionHeading
        eyebrow="section 5 — system architecture"
        title="Five layers, written so a non-specialist evaluator can follow it."
        lead="Layers 1–3 are detection: they tell you a plan is contradictory as written, after the fact. Layer 4 is forecasting. Layer 5 is what makes either usable inside a government."
      />

      <div className="mt-12 space-y-5">
        {LAYERS.map((l) => (
          <article key={l.n} className="panel p-7">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-xs text-primary">L{l.n}</span>
              <h2 className="text-xl font-semibold">{l.name}</h2>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">{l.summary}</p>
            <ul className="mt-5 space-y-2.5 border-l border-border pl-5">
              {l.details.map((d) => (
                <li key={d} className="text-sm leading-relaxed text-muted-foreground">
                  {d}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <div className="mt-20">
        <SectionHeading
          eyebrow="layer 2 — agent swarm"
          title="Six agents, sequenced — not built in parallel."
          lead="The original design proposed all six at once. For a fundable MVP the sequence is the two P0 agents first: they map directly to the two failure modes buyers pay to fix fastest, and both can be validated against Bappenas' public 2024 evaluation without waiting for 2027."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {AGENTS.map((a) => (
            <article key={a.id} className="panel p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold">{a.name}</h3>
                <span className={`font-mono text-[11px] ${priorityTone[a.priority]}`}>{a.priority}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a.does}</p>
              <p className="mt-4 font-mono text-[11px] text-muted-foreground">{a.buildNote}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-20 panel p-8">
        <SectionHeading
          eyebrow="why this is defensible"
          title="The moat is the historical outcomes dataset, not the LLM calls."
          lead="Causal inference, calibrated uncertainty and cascade simulation are a different discipline from text generation — none of the four Layer 4 components is something a general-purpose LLM does well natively. They also depend on a data asset a competitor cannot easily acquire: labelled historical outcomes for RPJMN 2015–2019 and 2020–2024."
        />
        <div className="mt-6 flex flex-wrap gap-2">
          <Chip>DoWhy / EconML / pgmpy</Chip>
          <Chip>Gaussian Process (SFFM reuse)</Chip>
          <Chip>Mesa ABM</Chip>
          <Chip>lifelines — Cox / Weibull</Chip>
        </div>
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Each deployment also produces labelled outcome data — what the predictive layer forecast
          versus what actually happened — which improves calibration for the next deployment. That is
          the argument for why country #2 is easier to sell and serve than country #1.
        </p>
      </div>

      <div className="mt-20">
        <SectionHeading
          eyebrow="section 5.7 — validation methodology"
          title="A confidence score is meaningless without a process for checking whether it was right."
        />
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {VALIDATION.map((v) => (
            <article key={v.name} className="panel p-6">
              <h3 className="text-base font-semibold">{v.name}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{v.body}</p>
            </article>
          ))}
        </div>
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-accent">
          Until backtesting is run and published, every confidence number shown to an investor or
          pilot buyer is labelled provisional / pre-validation.
        </p>
      </div>
    </div>
  );
}
