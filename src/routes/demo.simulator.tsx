import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SIM_SCENARIOS } from "@/lib/peta-data";
import { Chip, ConfidenceBar } from "@/components/peta/primitives";

export const Route = createFileRoute("/demo/simulator")({
  head: () => ({
    meta: [
      { title: "Policy flight simulator — PETA-AI demo workspace" },
      {
        name: "description",
        content:
          "Feed an unsigned draft policy into the coherence graph and see the forecast cascade: hazard with a calibrated confidence interval, never a bare point prediction.",
      },
      { property: "og:title", content: "PETA-AI demo — policy flight simulator" },
      {
        property: "og:description",
        content:
          "Includes the KRISNA irrigation retrodiction: run the forecast blind on a decision already taken, then reveal the recorded outcome.",
      },
    ],
  }),
  component: SimulatorPage,
});

function SimulatorPage() {
  const [activeId, setActiveId] = useState(SIM_SCENARIOS[0].id);
  const [revealed, setRevealed] = useState(false);
  const scenario = SIM_SCENARIOS.find((s) => s.id === activeId) ?? SIM_SCENARIOS[0];

  return (
    <div className="grid gap-8 lg:grid-cols-[19rem_1fr]">
      <aside>
        <p className="label-mono">draft scenarios</p>
        <div className="mt-3 space-y-2">
          {SIM_SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setActiveId(s.id);
                setRevealed(false);
              }}
              className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                s.id === activeId
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-surface-2"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          Layers 1–3 tell you a plan is contradictory as written, after the fact. This layer forecasts
          what an unsigned draft breaks downstream — before money or political capital is committed.
        </p>
      </aside>

      <section>
        <div className="panel p-6">
          <p className="label-mono">draft under simulation</p>
          <h2 className="mt-2 text-xl font-semibold">{scenario.label}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {scenario.draft}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Chip>{scenario.lever}</Chip>
            <Chip>{scenario.magnitude}</Chip>
          </div>
        </div>

        <div className="mt-6 panel overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
            <p className="label-mono">forecast cascade · probability of missing target</p>
            <span className="font-mono text-[11px] text-muted-foreground">
              interval shown, never a bare point estimate
            </span>
          </div>
          <ul className="divide-y divide-border">
            {scenario.cascade.map((c) => (
              <li key={c.program} className="px-6 py-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="text-sm font-semibold">{c.program}</h3>
                  <span className="font-mono text-[11px] text-muted-foreground">{c.ministry}</span>
                </div>
                <div className="mt-3 max-w-md">
                  <ConfidenceBar value={c.hazard} low={c.ciLow} high={c.ciHigh} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Chip>{c.horizonMonths}-month horizon</Chip>
                  <Chip>{c.basis}</Chip>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-border px-6 py-4">
            <p className="text-xs leading-relaxed text-muted-foreground">{scenario.patternNote}</p>
          </div>
        </div>

        {scenario.retrodiction ? (
          <div className="mt-6 panel p-6">
            <p className="label-mono">retrodiction check</p>
            {revealed ? (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground">
                {scenario.retrodiction}
              </p>
            ) : (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                This scenario has a recorded historical outcome. Run the forecast first, then reveal
                it — that ordering is what makes the match checkable rather than asserted.
              </p>
            )}
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className="mt-5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              {revealed ? "Hide recorded outcome" : "Reveal recorded outcome"}
            </button>
          </div>
        ) : null}

        <p className="mt-6 text-xs leading-relaxed text-accent">
          Forecast backtesting (train on RPJMN 2015–2019, test against 2020–2024) has not been run.
          Every hazard and interval above is illustrative demo data labelled provisional.
        </p>
      </section>
    </div>
  );
}
