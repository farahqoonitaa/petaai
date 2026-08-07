import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CORPUS_STATS,
  FINDINGS,
  LAYERS,
  OBJECTIVES,
  PRODUCT,
} from "@/lib/peta-data";
import { Chip, SectionHeading, SeverityBadge, StatCard } from "@/components/peta/primitives";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PETA-AI — National Planning Coherence Platform" },
      {
        name: "description",
        content:
          "Detect contradictory targets, unfunded commitments and misaligned regional plans across a national planning corpus in days — and forecast what a draft policy breaks before it is signed.",
      },
      { property: "og:title", content: "PETA-AI — National Planning Coherence Platform" },
      {
        property: "og:description",
        content:
          "Govtech SaaS for planning coherence detection and pre-deployment risk forecasting. Reference deployment: Indonesia's RPJMN 2025–2029 with Bappenas.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const topFindings = FINDINGS.slice(0, 3);

  return (
    <div>
      <section className="hero-surface relative overflow-hidden border-b border-border">
        <div className="grid-backdrop absolute inset-0 opacity-[0.35]" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-5 py-20 sm:py-28">
          <p className="label-mono">{PRODUCT.version} · {PRODUCT.status}</p>
          <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-[1.08] sm:text-6xl">
            A national plan can be internally contradictory for{" "}
            <span className="text-gradient">years</span> before anyone notices.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            PETA-AI reads an entire planning corpus and finds the coherence failures inside it —
            contradictory targets, unfunded commitments, misaligned regional plans — in days rather
            than the 90–365 days a manual review cycle takes. Then it forecasts what an unsigned
            draft policy will break downstream, before money or political capital is committed.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              to="/demo"
              className="rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Open the analyst demo
            </Link>
            <Link
              to="/product"
              className="rounded-lg border border-border px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
            >
              How the five layers work
            </Link>
          </div>
          <dl className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CORPUS_STATS.map((s) => (
              <StatCard key={s.label} label={s.label} value={s.value} note={s.note} />
            ))}
          </dl>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <SectionHeading
            eyebrow="the problem, quantified"
            title="Three platforms treated this as a data problem. It isn't."
            lead="Indonesia's national plan requires coordinated execution across 34+ ministries, 34 provinces and 514 districts over 60 months. The monitoring & evaluation function scored 22/100 in an independent 2024 assessment — the lowest-scoring governance function measured — and the next comprehensive check is a single mid-term evaluation in 2027."
          />
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {[
              {
                k: "Past attempts",
                b: "KRISNA, One Data Indonesia and the 2026 Digital Government Master Plan all assumed that centralising data would produce coordination. KRISNA's own 2019 internal audit recommended anomaly detection at program-goal level — still unimplemented five years later.",
              },
              {
                k: "Scale without reasoning",
                b: "One Data Indonesia has grown to 453,865 datasets with documented interoperability gaps still unresolved. More data has not produced coherence.",
              },
              {
                k: "The actual gap",
                b: "No existing system reasons about the relationships between planning documents — only within them. That is a harder problem than aggregation, and it is the one PETA-AI is built to solve.",
              },
            ].map((c) => (
              <article key={c.k} className="panel p-6">
                <h3 className="text-base font-semibold">{c.k}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.b}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-surface/40">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <SectionHeading
            eyebrow="detection, from the demo corpus"
            title="Every finding ships with a citation, a confidence score and a severity."
            lead="No finding triggers an automated action. Decision authority stays with human analysts — required by Indonesian planning law, and the trust mechanism that makes adoption possible at all."
          />
          <div className="mt-10 space-y-4">
            {topFindings.map((f) => (
              <article key={f.id} className="panel p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <SeverityBadge severity={f.severity} />
                  <span className="font-mono text-[11px] text-muted-foreground">{f.id}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    flagged in {f.daysToFlag} days
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{f.detail}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {f.ministries.map((m) => (
                    <Chip key={m}>{m}</Chip>
                  ))}
                </div>
              </article>
            ))}
          </div>
          <Link
            to="/demo"
            className="mt-8 inline-block text-sm text-primary underline-offset-4 hover:underline"
          >
            See all findings, program criticality and the flight simulator →
          </Link>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <SectionHeading
            eyebrow="architecture"
            title="Five layers. The fourth is the one that isn't an LLM wrapper."
          />
          <ol className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {LAYERS.map((l) => (
              <li key={l.n} className="panel flex flex-col p-6">
                <span className="font-mono text-[11px] text-primary">Layer {l.n}</span>
                <h3 className="mt-2 text-base font-semibold">{l.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{l.summary}</p>
              </li>
            ))}
          </ol>
          <Link
            to="/product"
            className="mt-8 inline-block text-sm text-primary underline-offset-4 hover:underline"
          >
            Full architecture, agents and validation methodology →
          </Link>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-5 py-20">
          <SectionHeading
            eyebrow="product objectives"
            title="Measurable outcomes, not research questions."
          />
          <div className="mt-10 divide-y divide-border overflow-hidden rounded-lg border border-border">
            {OBJECTIVES.map((o) => (
              <div key={o.name} className="grid gap-2 bg-card p-5 sm:grid-cols-[10rem_1fr] sm:gap-6">
                <p className="font-display text-sm font-semibold">{o.name}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{o.target}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
