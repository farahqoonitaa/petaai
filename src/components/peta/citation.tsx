import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getFindingEvidence } from "@/lib/analysis.functions";
import { VERIFICATION_LABEL, locateQuote, type Verification } from "@/lib/citation-verify";

const badgeStyles: Record<Verification, string> = {
  verified: "border-primary/40 bg-primary/10 text-primary",
  partial: "border-accent/40 bg-accent/10 text-accent",
  unverified: "border-critical/40 bg-critical/10 text-critical",
};

export function VerificationBadge({
  verification,
  matchScore,
}: {
  verification: Verification;
  matchScore?: number;
}) {
  return (
    <span
      title={VERIFICATION_LABEL[verification]}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${badgeStyles[verification]}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {verification}
      {matchScore !== undefined ? ` ${Math.round(matchScore * 100)}%` : ""}
    </span>
  );
}

interface Evidence {
  quote: string | null;
  page: number | null;
  matchScore: number;
  verification: string;
  excerpt: string | null;
  chunkIndex: number | null;
  documentTitle: string | null;
  ministry: string | null;
}

function Highlighted({ excerpt, quote }: { excerpt: string; quote: string | null }) {
  const span = quote ? locateQuote(excerpt, quote) : null;
  if (!span) return <>{excerpt}</>;
  return (
    <>
      {excerpt.slice(0, span[0])}
      <mark className="rounded bg-primary/25 px-0.5 text-foreground">
        {excerpt.slice(span[0], span[1])}
      </mark>
      {excerpt.slice(span[1])}
    </>
  );
}

/** Clickable citation: opens the verbatim indexed excerpt behind a finding. */
export function CitationInspector({
  findingId,
  citation,
  verification,
  matchScore,
}: {
  findingId: string;
  citation: string | null;
  verification: Verification;
  matchScore: number;
}) {
  const fetchEvidence = useServerFn(getFindingEvidence);
  const [open, setOpen] = useState(false);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (evidence || state === "loading") return;
    setState("loading");
    try {
      const result = (await fetchEvidence({ data: { findingId } })) as Evidence;
      setEvidence(result);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <VerificationBadge verification={verification} matchScore={matchScore} />
        <button
          type="button"
          onClick={() => void toggle()}
          className="rounded-md border border-border bg-surface-2 px-2.5 py-1 font-mono text-[11px] text-primary transition-colors hover:bg-primary/10"
        >
          {open ? "hide indexed excerpt" : "view indexed excerpt"}
        </button>
      </div>

      {citation ? (
        <p className="mt-2 rounded-md border border-border bg-surface-2 px-4 py-3 font-mono text-xs leading-relaxed text-muted-foreground">
          {citation}
        </p>
      ) : null}

      {verification !== "verified" ? (
        <p className="mt-2 font-mono text-[11px] leading-relaxed text-accent">
          {VERIFICATION_LABEL[verification]} — confidence is capped and this finding must be checked
          against the source document before use.
        </p>
      ) : null}

      {open ? (
        <div className="mt-3 rounded-lg border border-border bg-surface-2 p-4">
          {state === "loading" ? (
            <p className="font-mono text-[11px] text-muted-foreground">Loading excerpt…</p>
          ) : state === "error" ? (
            <p className="font-mono text-[11px] text-critical">
              Could not load the excerpt for this citation.
            </p>
          ) : evidence?.excerpt ? (
            <>
              <p className="label-mono">
                {evidence.documentTitle ?? "Indexed document"}
                {evidence.ministry ? ` · ${evidence.ministry}` : ""}
                {evidence.page ? ` · page ${evidence.page}` : ""}
                {evidence.chunkIndex !== null ? ` · chunk ${evidence.chunkIndex}` : ""}
              </p>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                <Highlighted excerpt={evidence.excerpt} quote={evidence.quote} />
              </p>
            </>
          ) : (
            <p className="font-mono text-[11px] text-muted-foreground">
              No indexed passage is linked to this finding — treat it as unverified.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
