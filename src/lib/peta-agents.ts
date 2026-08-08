// Agent registry — mirrors PRD v1.1 §4.2 (Agent Swarm Specification).
// Client-safe: no server imports, no env reads.

export type AgentId =
  | "stigmergic_tracer"
  | "contradiction_detector"
  | "budget_coherence"
  | "regional_signal"
  | "historical_precedent"
  | "sdg_alignment";

export interface AgentSpec {
  id: AgentId;
  name: string;
  short: string;
  bottlenecks: string;
  mechanism: string;
  output: string;
  /** Retrieval probes: what this agent reads out of the corpus before reasoning. */
  probes: string[];
  /** The analytical mandate handed to the model for this agent. */
  mandate: string;
}

export const AGENT_SPECS: AgentSpec[] = [
  {
    id: "stigmergic_tracer",
    name: "Stigmergic Tracer",
    short: "Dependency traces",
    bottlenecks: "B1 · B4",
    mechanism:
      "Reads Renstra-KL per ministry; deposits weighted traces on cross-ministry references; accumulates over N iterations.",
    output: "Ranked cross-ministry dependency list; load-bearing nodes by betweenness centrality.",
    probes: [
      "cross-ministry coordination, joint responsibility, koordinasi lintas kementerian",
      "program depends on another ministry's output, prasyarat, dukungan kementerian lain",
      "lead ministry and supporting ministries for a national priority program",
    ],
    mandate:
      "Trace dependencies between programs that sit in different ministries or tiers. A finding is a load-bearing dependency: program A cannot deliver unless program B (owned elsewhere) delivers first, and the documents do not name a coordination mechanism for it. Rank by how many other programs sit downstream.",
  },
  {
    id: "contradiction_detector",
    name: "Contradiction Detector",
    short: "Contradictions",
    bottlenecks: "B1 · B2 · B4",
    mechanism:
      "Semantic entailment (not keyword matching) to identify directionally incompatible targets across ministry documents.",
    output: "Contradiction register with clauses, population, geography, severity, escalation path.",
    probes: [
      "target increase expansion perluasan peningkatan hectares coverage",
      "moratorium restriction protection conversion ban pembatasan perlindungan alih fungsi",
      "quantified national target with year, baseline and responsible ministry",
    ],
    mandate:
      "Find pairs of commitments that are directionally incompatible — one clause requires expansion of the same resource another clause protects or caps, or two documents set conflicting quantities for the same population or geography. Only report a contradiction when both sides are traceable to passages in the retrieved corpus.",
  },
  {
    id: "budget_coherence",
    name: "Budget Coherence Agent",
    short: "Budget gaps",
    bottlenecks: "B2 · B6",
    mechanism:
      "Cross-checks DIPA allocations vs. Renstra-KL KPIs; flags unmatched commitments and budget lines with no strategic objective.",
    output: "Budget gap registry with funding shortfall estimates per year by ministry.",
    probes: [
      "anggaran alokasi pagu indikatif budget allocation rupiah triliun miliar",
      "target output volume unit cost per beneficiary per kilometer per hectare",
      "program with a stated target but no stated budget line or funding source",
    ],
    mandate:
      "Match every quantified commitment to a stated allocation. Report unfunded or under-funded commitments and allocations with no strategic objective attached. Give a shortfall estimate only when the arithmetic is visible in the retrieved passages; otherwise say the magnitude is unquantifiable from this slice.",
  },
  {
    id: "regional_signal",
    name: "Regional Signal Swarm",
    short: "Regional divergence",
    bottlenecks: "B3 · B5 · B7",
    mechanism:
      "One agent per province ingesting BPS stats, RPJMD targets and APBD allocations; signals shared via the PCG pheromone layer.",
    output: "Provincial early warning index: risk score, trend, comparison, attention level.",
    probes: [
      "provinsi kabupaten daerah regional target RPJMD APBD provincial allocation",
      "regional disparity east west Java Papua Sumatera divergence kesenjangan",
      "national target disaggregated by province or district with responsibility",
    ],
    mandate:
      "Find places where a national target is not reproduced, is contradicted, or is arithmetically impossible at the sub-national tier in the retrieved passages. Name the province or district explicitly and say which tier the failure sits in (central, provincial, district).",
  },
  {
    id: "historical_precedent",
    name: "Historical Precedent Agent",
    short: "Precedent risk",
    bottlenecks: "B2 · B5 · B7",
    mechanism:
      "RAG over RPJMN 2015–2024 outcome data; retrieves analogous programs by sector, scale, ministry and target population.",
    output: "Program risk profile with historical delivery rates, overcommitment flags, adjustment ranges.",
    probes: [
      "realisasi capaian outcome achieved versus target previous period evaluation",
      "carried over unfinished program repeated target from earlier RPJMN cycle",
      "delivery rate shortfall underachievement revised target",
    ],
    mandate:
      "Compare current commitments against analogous earlier commitments present in the retrieved corpus. Flag overcommitment where a target repeats or escalates a target that a prior cycle did not deliver. If the slice contains no historical material, say so plainly rather than inferring a precedent.",
  },
  {
    id: "sdg_alignment",
    name: "SDG Alignment Scorer",
    short: "SDG coherence",
    bottlenecks: "B2 · B4 · B7",
    mechanism:
      "Auto-maps every program to the SDG taxonomy; identifies coverage gaps, double-counting and SDG-RPJMN misalignment.",
    output: "SDG coherence matrix; double-counting flags; VNR reporting readiness score.",
    probes: [
      "SDG TPB tujuan pembangunan berkelanjutan indicator goal target",
      "poverty health education climate gender indicator national target",
      "same outcome counted under more than one program or goal",
    ],
    mandate:
      "Map retrieved commitments to SDG goals and report misalignment: an SDG-relevant commitment with no measurable indicator, the same outcome counted under multiple programs, or a goal with national coverage but no program attached in this slice.",
  },
];

export const AGENT_BY_ID = new Map(AGENT_SPECS.map((a) => [a.id, a]));

export const agentName = (id: string) => AGENT_BY_ID.get(id as AgentId)?.name ?? id;

export const DOC_TYPES = [
  "RPJMN",
  "Renstra-KL",
  "RPJMD",
  "RKP",
  "DIPA / Budget",
  "Evaluation / Audit",
  "Regulation",
  "Statistics (BPS)",
  "Other",
] as const;

export const RPJMN_CYCLES = [
  "RPJMN 2015-2019",
  "RPJMN 2020-2024",
  "RPJMN 2025-2029",
  "Cross-cycle",
] as const;

export const LEADERSHIP_TERMS = [
  "Jokowi Term 1 (2014-2019)",
  "Jokowi Term 2 (2019-2024)",
  "Prabowo (2024-)",
  "Pre-2014",
] as const;

export interface EpochTag {
  id: string;
  label: string;
  yearFrom: number | null;
  yearTo: number | null;
  note: string;
}

/** Pre-defined epoch tags — PRD §4.5, reduces analyst input friction. */
export const EPOCHS: EpochTag[] = [
  { id: "all", label: "Full corpus", yearFrom: null, yearTo: null, note: "No temporal constraint" },
  {
    id: "rpjmn2529",
    label: "RPJMN 2025-2029",
    yearFrom: 2025,
    yearTo: 2029,
    note: "Current cycle, first implementation year",
  },
  {
    id: "rpjmn2024",
    label: "RPJMN 2020-2024",
    yearFrom: 2020,
    yearTo: 2024,
    note: "Includes the 2024 election epoch (CV2)",
  },
  {
    id: "rpjmn1519",
    label: "RPJMN 2015-2019",
    yearFrom: 2015,
    yearTo: 2019,
    note: "Historical baseline for precedent analysis",
  },
  {
    id: "jokowi2",
    label: "Jokowi Term 2",
    yearFrom: 2019,
    yearTo: 2024,
    note: "Leadership slice, spans two planning cycles",
  },
  {
    id: "prepandemic",
    label: "Pre-pandemic",
    yearFrom: 2015,
    yearTo: 2019,
    note: "Excludes pandemic-distorted compliance patterns",
  },
];

export const SEVERITIES = ["critical", "high", "medium"] as const;
