import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AGENTS, FINDINGS, type Severity } from "@/lib/peta-data";
import { Chip, ConfidenceBar, SeverityBadge } from "@/components/peta/primitives";

export const Route = createFileRoute("/demo/")({
  head: () => ({
    meta: [
      { title: "Coherence findings — PETA-AI demo workspace" },
      {
        name: "description",
        content:
          "Demo analyst view: contradictions, unfunded commitments and regional divergence, each with source citation, confidence score, severity and a recommended action.",
      },
      { property: "og:title", content: "PETA-AI demo — coherence findings" },
      {
        property: "og:description",
        content:
          "Illustrative findings from a demo RPJMN corpus. No finding triggers an automated action; decision authority stays with human analysts.",
      },
    ],
  }),
  component: FindingsPage,
});

const severities: Severity[] = ["critical", "high", "medium"];
const agentName = (id: string) => AGENTS.find((a) => a.id === id)?.name ?? id;

function FindingsPage() {
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [openId, setOpenId] = useState<string | null>(FINDINGS[0]?.id ?? null);

  const list = useMemo(
    () => (severity === "all" ? FINDINGS : FINDINGS.filter((f) => f.severity === severity)),
    [severity],
  );

  const counts = useMemo(
    () =>
      severities.map((s) => ({ s, n: FINDINGS.filter((f) => f.severity === s).length })),
    [],
  );

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        {counts.map(({ s, n }) => (
          <button
            key={s}
            type="button"
            onClick={() => setSeverity(severity === s ? "all" : s)}
            className={`panel p-5 text-left transition-colors ${
              severity === s ? "ring-1 ring-primary" : "hover:bg-surface-2"
            }`}
          >
            <p className="label-mono">{s} findings</p>
            <p className="mt-2 font-display text-3xl font-semibold">{n}</p>
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Showing {list.length} of {FINDINGS.length} findings
          {severity !== "all" ? ` · filtered to ${severity}` : ""}
        </p>
        {severity !== "all" ? (
          <button
            type="button"
            onClick={() => setSeverity("all")}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Clear filter
          </button>
        ) : null}
      </div>

      <div className="mt-4 space-y-3">
        {list.map((f) => {
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
                  <span className="font-mono text-[11px] text-muted-foreground">{f.id}</span>
                  <Chip>{agentName(f.agent)}</Chip>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {f.passesConfirmed} confirming passes
                  </span>
                </div>
                <h2 className="mt-3 text-base font-semibold">{f.title}</h2>
                <div className="mt-4 max-w-xs">
                  <ConfidenceBar value={f.confidence} />
                </div>
              </button>

              {open ? (
                <div className="border-t border-border px-6 py-5">
                  <p className="text-sm leading-relaxed text-muted-foreground">{f.detail}</p>

                  <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                    <div>
                      <dt className="label-mono">Programs</dt>
                      <dd className="mt-2 flex flex-wrap gap-2">
                        {f.programs.map((p) => (
                          <Chip key={p}>{p}</Chip>
                        ))}
                      </dd>
                    </div>
                    <div>
                      <dt className="label-mono">Ministries</dt>
                      <dd className="mt-2 flex flex-wrap gap-2">
                        {f.ministries.map((m) => (
                          <Chip key={m}>{m}</Chip>
                        ))}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="label-mono">Source passage</dt>
                      <dd className="mt-2 rounded-md border border-border bg-surface-2 px-4 py-3 font-mono text-xs leading-relaxed text-muted-foreground">
                        {f.citation}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="label-mono">Recommended action (no automated execution)</dt>
                      <dd className="mt-2 text-sm leading-relaxed text-foreground">
                        {f.recommendedAction}
                      </dd>
                    </div>
                    <div>
                      <dt className="label-mono">Time to flag</dt>
                      <dd className="mt-2 font-mono text-sm">{f.daysToFlag} days</dd>
                    </div>
                    <div>
                      <dt className="label-mono">Confidence</dt>
                      <dd className="mt-2 max-w-xs">
                        <ConfidenceBar value={f.confidence} />
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
