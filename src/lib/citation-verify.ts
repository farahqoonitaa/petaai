export type Verification = "verified" | "partial" | "unverified";

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .trim();

const tokens = (s: string) => norm(s).split(" ").filter(Boolean);

/**
 * Citation-level verification: check that the model's quote actually exists in
 * the retrieved passage. Exact (normalised) substring match => verified.
 * Otherwise we score token recall of the quote against the passage.
 */
export function verifyQuote(
  quote: string | null | undefined,
  passage: string | null | undefined,
): { verification: Verification; matchScore: number } {
  const q = (quote ?? "").trim();
  const p = passage ?? "";
  if (!q || !p) return { verification: "unverified", matchScore: 0 };

  const nq = norm(q);
  const np = norm(p);
  if (nq.length >= 12 && np.includes(nq)) return { verification: "verified", matchScore: 1 };

  const qt = tokens(q);
  if (qt.length === 0) return { verification: "unverified", matchScore: 0 };
  const pset = new Set(tokens(p));
  const hits = qt.filter((t) => pset.has(t)).length;
  const score = Math.round((hits / qt.length) * 100) / 100;

  if (score >= 0.85) return { verification: "verified", matchScore: score };
  if (score >= 0.5) return { verification: "partial", matchScore: score };
  return { verification: "unverified", matchScore: score };
}

export const VERIFICATION_LABEL: Record<Verification, string> = {
  verified: "quote verified against indexed passage",
  partial: "partial match — wording differs from the source passage",
  unverified: "unverified — quote not found in the retrieved passage",
};

/** Locate the quote inside the passage so the UI can highlight it. */
export function locateQuote(passage: string, quote: string): [number, number] | null {
  const q = quote.trim();
  if (!q) return null;
  const direct = passage.toLowerCase().indexOf(q.toLowerCase());
  if (direct >= 0) return [direct, direct + q.length];
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length < 3) return null;
  const head = words.slice(0, 4).join(" ").toLowerCase();
  const i = passage.toLowerCase().indexOf(head);
  if (i < 0) return null;
  return [i, Math.min(passage.length, i + q.length)];
}
