import type { ReactNode } from "react";
import type { Severity } from "@/lib/peta-data";

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="label-mono">{children}</p>;
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="max-w-3xl">
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">{title}</h2>
      {lead ? <p className="mt-4 text-base leading-relaxed text-muted-foreground">{lead}</p> : null}
    </div>
  );
}

const severityStyles: Record<Severity, string> = {
  critical: "bg-critical/15 text-critical border-critical/40",
  high: "bg-high/15 text-high border-high/40",
  medium: "bg-medium/15 text-medium border-medium/40",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${severityStyles[severity]}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {severity}
    </span>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border border-border bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
      {children}
    </span>
  );
}

export function ProvisionalBanner({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3">
      <span className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-accent">demo</span>
      <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

export function ConfidenceBar({ value, low, high }: { value: number; low?: number; high?: number }) {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return (
    <div className="w-full">
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        {low !== undefined && high !== undefined ? (
          <span
            className="absolute inset-y-0 rounded-full bg-primary/25"
            style={{ left: pct(low), width: `${Math.round((high - low) * 100)}%` }}
          />
        ) : null}
        <span className="absolute inset-y-0 left-0 rounded-full bg-primary/70" style={{ width: pct(value) }} />
      </div>
      <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
        {pct(value)}
        {low !== undefined && high !== undefined ? ` · CI ${pct(low)}–${pct(high)}` : ""}
      </p>
    </div>
  );
}

export function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="panel p-5">
      <p className="label-mono">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold text-foreground">{value}</p>
      {note ? <p className="mt-1 font-mono text-[11px] text-muted-foreground">{note}</p> : null}
    </div>
  );
}
