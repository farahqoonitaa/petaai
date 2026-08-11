// Deterministic grounding utilities. No model calls, no randomness — every
// value here is reproducible from the passage text, so it can be unit-checked.

/* ------------------------------------------------------------------ *
 * Ministry canonicalisation
 * ------------------------------------------------------------------ */

const MINISTRY_PREFIXES = [
  "ministry of",
  "kementerian negara",
  "kementerian",
  "kemenko",
  "kemen",
  "the ministry of",
  "department of",
  "badan",
];

const MINISTRY_ALIASES: Record<string, string> = {
  "public works": "Ministry of Public Works",
  "public works and housing": "Ministry of Public Works",
  pupr: "Ministry of Public Works",
  agriculture: "Ministry of Agriculture",
  pertanian: "Ministry of Agriculture",
  bappenas: "Bappenas",
  "national development planning": "Bappenas",
  ppn: "Bappenas",
  finance: "Ministry of Finance",
  keuangan: "Ministry of Finance",
  "home affairs": "Ministry of Home Affairs",
  "dalam negeri": "Ministry of Home Affairs",
  health: "Ministry of Health",
  kesehatan: "Ministry of Health",
  education: "Ministry of Education",
  "environment and forestry": "Ministry of Environment and Forestry",
  "lingkungan hidup dan kehutanan": "Ministry of Environment and Forestry",
  klhk: "Ministry of Environment and Forestry",
  "communication and informatics": "Ministry of Communication and Informatics",
  kominfo: "Ministry of Communication and Informatics",
  bps: "BPS",
};

const titleCase = (s: string) =>
  s
    .split(/\s+/)
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join(" ");

/**
 * "Public Works", "Ministry of Public Works", "Kementerian PUPR" collapse to one
 * label so the graph does not show the same ministry as two nodes.
 */
export function canonicalMinistry(raw: string): string {
  let s = raw.trim().replace(/\s+/g, " ").replace(/[.,;]+$/, "");
  if (!s) return s;
  let core = s.toLowerCase();
  for (const p of MINISTRY_PREFIXES) {
    if (core.startsWith(`${p} `)) {
      core = core.slice(p.length + 1).trim();
      break;
    }
  }
  core = core.replace(/^republic of indonesia\s*/, "").replace(/\s*\(.*\)$/, "").trim();
  const alias = MINISTRY_ALIASES[core];
  if (alias) return alias;
  if (/^kementerian|^ministry of/i.test(s)) {
    s = s.replace(/^kementerian\s+/i, "Ministry of ").replace(/^ministry of\s+/i, "Ministry of ");
    return s;
  }
  return `Ministry of ${titleCase(core)}`.replace(/^Ministry of (BPS|Bappenas)$/i, "$1");
}

export function dedupeMinistries(names: string[]): string[] {
  const seen = new Map<string, string>();
  for (const n of names) {
    if (!n?.trim()) continue;
    const c = canonicalMinistry(n);
    if (!seen.has(c.toLowerCase())) seen.set(c.toLowerCase(), c);
  }
  return [...seen.values()];
}

/* ------------------------------------------------------------------ *
 * Monetary attribution
 * ------------------------------------------------------------------ */

export interface MonetaryHit {
  /** Amount in rupiah. */
  amount: number;
  currency: "IDR";
  /** Verbatim wording the figure was read from. */
  basis: string;
  /** Distance in characters between the program mention and the figure. */
  distance: number;
}

const SCALES: { re: RegExp; factor: number; label: string }[] = [
  { re: /^(triliun|trilyun|trillion)$/i, factor: 1e12, label: "trillion" },
  { re: /^(miliar|milyar|billion|bn)$/i, factor: 1e9, label: "billion" },
  { re: /^(juta|million|mn)$/i, factor: 1e6, label: "million" },
  { re: /^(ribu|thousand|k)$/i, factor: 1e3, label: "thousand" },
];

/** Units that prove the figure is not money, no matter what precedes it. */
const NON_MONEY_UNIT =
  /^\s*(?:%|persen|percent|persentase|ha\b|hektar\w*|hectare\w*|km\b|kilometer\w*|m2\b|meter\w*|orang\b|jiwa\b|penduduk\b|unit\b|kk\b|desa\b|siswa\b|ton\b|kwh\b|mw\b|liter\b|hari\b|bulan\b|tahun\b)/i;

const CURRENCY_TIGHT_PREFIX = /(?:rp\.?|idr|usd|\$)\s*$/i;
const CURRENCY_SUFFIX = /^\s*(?:rupiah|rp\.?|idr)\b/i;

const numeric = (raw: string) => {
  // Indonesian documents use "." as thousands and "," as decimal separator.
  const cleaned = raw.replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

const normalizeName = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

/** Every position where the program is mentioned in the text. */
function programMentions(text: string, program: string): number[] {
  const hay = normalizeName(text);
  const needle = normalizeName(program);
  if (!needle || needle.length < 4) return [];
  const out: number[] = [];
  // Map normalised offsets back onto the raw string approximately by scanning
  // the raw text for the program's distinctive words.
  const words = needle.split(" ").filter((w) => w.length > 3);
  const probe = words.length ? words[words.length - 1]! : needle;
  const rawLower = text.toLowerCase();
  let from = 0;
  for (;;) {
    const i = rawLower.indexOf(probe, from);
    if (i < 0) break;
    out.push(i);
    from = i + probe.length;
  }
  if (out.length === 0 && hay.includes(needle)) out.push(0);
  return out;
}

/**
 * Nearest-program monetary attribution with currency validation.
 *
 * A figure only counts as this program's money when (a) currency evidence sits
 * inside the match or in a tight prefix, (b) no non-money unit follows it,
 * (c) the program itself is named nearby, and (d) no *other* program in the
 * finding is named closer to that figure. Anything else returns null rather
 * than borrowing a neighbouring program's budget.
 */
export function attributeMonetary(
  text: string | null | undefined,
  program: string | null | undefined,
  options: { otherPrograms?: string[]; maxDistance?: number } = {},
): MonetaryHit | null {
  const { otherPrograms = [], maxDistance = 200 } = options;
  const body = text ?? "";
  if (!body || !program) return null;
  const mentions = programMentions(body, program);
  if (mentions.length === 0) return null;

  const rivals = otherPrograms
    .filter((p) => p && normalizeName(p) !== normalizeName(program))
    .flatMap((p) => programMentions(body, p));

  const re = /(?:rp\.?\s*|idr\s*)?(\d[\d.,]*)\s*(triliun|trilyun|trillion|miliar|milyar|billion|bn|juta|million|mn|ribu|thousand|k)?/gi;
  let best: MonetaryHit | null = null;

  for (let m = re.exec(body); m !== null; m = re.exec(body)) {
    const whole = m[0];
    const digits = m[1]!;
    const scaleWord = m[2];
    const start = m.index;
    const end = start + whole.length;

    const value = numeric(digits);
    if (value === null || value === 0) continue;

    const after = body.slice(end, end + 24);
    if (NON_MONEY_UNIT.test(after)) continue; // hectares, percent, people — not money

    const tightPrefix = body.slice(Math.max(0, start - 8), start);
    const hasCurrency =
      /rp|idr/i.test(whole) || CURRENCY_TIGHT_PREFIX.test(tightPrefix) || CURRENCY_SUFFIX.test(after);
    if (!hasCurrency) continue;

    const scale = scaleWord ? SCALES.find((s) => s.re.test(scaleWord)) : undefined;
    if (!scale && value < 1_000_000) continue; // a bare small number is not a budget
    const amount = value * (scale?.factor ?? 1);

    const distance = Math.min(...mentions.map((i) => Math.abs(i - start)));
    if (distance > maxDistance) continue;

    // Nearest-program rule: a joint finding must not hand this figure to the
    // program that merely happens to be mentioned in the same passage.
    const rivalDistance = rivals.length
      ? Math.min(...rivals.map((i) => Math.abs(i - start)))
      : Number.POSITIVE_INFINITY;
    if (rivalDistance <= distance) continue;

    const basis = body.slice(start, Math.min(body.length, end + (CURRENCY_SUFFIX.test(after) ? 8 : 0))).trim();
    if (!best || distance < best.distance) best = { amount, currency: "IDR", basis, distance };
  }

  return best;
}


export function formatRupiah(amount: number): string {
  if (amount >= 1e12) return `Rp ${+(amount / 1e12).toFixed(2)} triliun`;
  if (amount >= 1e9) return `Rp ${+(amount / 1e9).toFixed(2)} miliar`;
  if (amount >= 1e6) return `Rp ${+(amount / 1e6).toFixed(2)} juta`;
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

/* ------------------------------------------------------------------ *
 * Noisy-OR failure cascade
 * ------------------------------------------------------------------ */

const SEVERITY_WEIGHT: Record<string, number> = { critical: 0.55, high: 0.35, medium: 0.18 };

export interface CascadeInput {
  programs: string[];
  severity: string;
  confidence: number;
  corroboration: number;
  verification: string | null;
}

export interface CascadeNode {
  program: string;
  /** Point estimate of delivery failure risk, bounded [0,1]. */
  probability: number;
  low: number;
  high: number;
  findings: number;
  drivers: string[];
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Independent-cause (noisy-OR) combination: P(fail) = 1 - Π(1 - wᵢ).
 * Each contribution wᵢ = severity weight × evidential confidence, lifted a
 * little when several agents independently touched the same program. The
 * interval widens for partially verified citations — it never leaves [0,1] and
 * always satisfies low ≤ probability ≤ high.
 */
export function buildCascade(findings: CascadeInput[]): CascadeNode[] {
  const byProgram = new Map<string, { label: string; items: CascadeInput[] }>();
  for (const f of findings) {
    for (const raw of f.programs ?? []) {
      const label = raw.trim();
      if (!label) continue;
      const key = normalizeName(label);
      if (!key) continue;
      const slot = byProgram.get(key) ?? { label, items: [] };
      slot.items.push(f);
      byProgram.set(key, slot);
    }
  }

  const nodes: CascadeNode[] = [];
  for (const { label, items } of byProgram.values()) {
    let survivePoint = 1;
    let surviveLow = 1;
    let surviveHigh = 1;
    for (const f of items) {
      const w = SEVERITY_WEIGHT[f.severity] ?? SEVERITY_WEIGHT["medium"]!;
      const conf = clamp01(Number(f.confidence) || 0);
      const lift = Math.min(0.15, Math.max(0, (f.corroboration || 1) - 1) * 0.05);
      const slack = f.verification === "verified" ? 0.08 : f.verification === "partial" ? 0.18 : 0.3;
      const point = clamp01(w * conf + lift);
      survivePoint *= 1 - point;
      surviveLow *= 1 - clamp01(point - w * slack);
      surviveHigh *= 1 - clamp01(point + w * slack);
    }
    const probability = clamp01(1 - survivePoint);
    const low = clamp01(Math.min(1 - surviveLow, probability));
    const high = clamp01(Math.max(1 - surviveHigh, probability));
    nodes.push({
      program: label,
      probability,
      low,
      high,
      findings: items.length,
      drivers: [...new Set(items.map((i) => i.severity))],
    });
  }

  return nodes.sort((a, b) => b.probability - a.probability);
}
