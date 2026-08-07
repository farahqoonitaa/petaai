import { createFileRoute } from "@tanstack/react-router";
import { COMPETITORS, MARKET } from "@/lib/peta-data";
import { SectionHeading } from "@/components/peta/primitives";

export const Route = createFileRoute("/market")({
  head: () => ({
    meta: [
      { title: "Market & competition — PETA-AI" },
      {
        name: "description",
        content:
          "Buyer profile, TAM/SAM/SOM with stated caveats, and honest positioning against consulting practices, generic RAG vendors and incumbent government platforms.",
      },
      { property: "og:title", content: "PETA-AI market and competitive landscape" },
      {
        property: "og:description",
        content:
          "~134 countries run a formal national development plan. 35–45 share the RPJMN multi-tier structure — a working estimate pending a validated target-country list.",
      },
    ],
  }),
  component: MarketPage,
});

function MarketPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <SectionHeading
        eyebrow="section 4 — target customer & market"
        title="National planning ministries with a legally mandated periodic review."
        lead="The buying unit is typically the planning ministry's M&E or digital transformation directorate. Funding in year one is more often a multilateral or bilateral donor grant than the ministry's own discretionary budget."
      />

      <div className="mt-12 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2">
            <tr>
              <th className="px-5 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Layer
              </th>
              <th className="px-5 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Definition
              </th>
              <th className="px-5 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Estimate
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {MARKET.map((m) => (
              <tr key={m.layer}>
                <td className="px-5 py-4 font-display font-semibold">{m.layer}</td>
                <td className="px-5 py-4 text-muted-foreground">{m.definition}</td>
                <td className="px-5 py-4">
                  <span className="font-mono">{m.estimate}</span>
                  {m.caveat ? (
                    <span className="mt-1 block font-mono text-[11px] text-accent">
                      working estimate — needs primary validation
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-5 max-w-3xl text-sm leading-relaxed text-accent">
        Flag: SAM and SOM are working estimates, not validated figures. Before this is used
        externally, build an actual candidate-country list — planning structure, digital-government
        budget line, no existing incumbent vendor — rather than citing a round number.
      </p>

      <div className="mt-20">
        <SectionHeading
          eyebrow="section 6 — competitive landscape"
          title="No credible pitch pretends this space is empty."
          lead="Three categories of alternative exist, and the honest positioning against each is different."
        />
        <div className="mt-10 space-y-4">
          {COMPETITORS.map((c) => (
            <article key={c.category} className="panel grid gap-5 p-6 lg:grid-cols-[14rem_1fr]">
              <div>
                <h3 className="text-base font-semibold">{c.category}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.example}</p>
              </div>
              <div className="border-border lg:border-l lg:pl-6">
                <p className="label-mono">why PETA-AI is different</p>
                <p className="mt-2 text-sm leading-relaxed text-foreground">{c.difference}</p>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-accent">
          Still needed before this goes in front of an investor: a direct check for whether any
          startup, anywhere, already sells AI-based policy coherence detection to a national
          government. If one exists, name it and state the differentiation directly.
        </p>
      </div>
    </div>
  );
}
