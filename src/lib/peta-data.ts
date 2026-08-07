/**
 * PETA-AI demo dataset.
 *
 * IMPORTANT: every record below is hand-authored ILLUSTRATIVE demo content
 * built to match the structures described in the PRD (v4.0). None of it is
 * a real Bappenas/RPJMN output, and no forecast here has been backtested.
 * The UI must always label it as demo / pre-validation.
 */

export const PRODUCT = {
  name: "PETA-AI",
  tagline: "National Planning Coherence Platform",
  version: "PRD v4.0 — July 2026",
  author: "Farah Qoonita Syuhaila",
  referenceCustomer: "Bappenas — Ministry of National Development Planning, Indonesia",
  status: "Pre-pilot. No signed commercial agreement.",
};

export type Severity = "critical" | "high" | "medium";

export type AgentId =
  | "contradiction"
  | "budget"
  | "stigmergic"
  | "regional"
  | "precedent"
  | "sdg";

export const AGENTS: {
  id: AgentId;
  name: string;
  does: string;
  priority: "P0" | "P1" | "P2";
  buildNote: string;
}[] = [
  {
    id: "contradiction",
    name: "Contradiction Detector",
    does: "Flags directionally incompatible targets across ministries using semantic entailment, not keyword matching.",
    priority: "P0",
    buildNote: "Build first — maps to the failure mode buyers pay to fix fastest.",
  },
  {
    id: "budget",
    name: "Budget Coherence Agent",
    does: "Matches budget allocations against strategic-plan commitments; flags unfunded commitments and orphaned budget lines.",
    priority: "P0",
    buildNote: "Build first — validatable against the public 2024 evaluation.",
  },
  {
    id: "stigmergic",
    name: "Stigmergic Tracer",
    does: "Maps cross-ministry dependencies by accumulating confirmed connections over repeated passes.",
    priority: "P1",
    buildNote: "Feeds edge weight into the Coherence Graph.",
  },
  {
    id: "regional",
    name: "Regional Signal Agent",
    does: "One lightweight instance per province; flags divergence between regional and national targets.",
    priority: "P1",
    buildNote: "34 provincial instances at full deployment.",
  },
  {
    id: "precedent",
    name: "Historical Precedent Agent",
    does: "Benchmarks current programs against historical delivery rates for analogous past programs.",
    priority: "P2",
    buildNote: "Upgraded to survival analysis inside Layer 4.",
  },
  {
    id: "sdg",
    name: "SDG / Reporting Alignment Agent",
    does: "Maps programs to reporting taxonomies (e.g. SDGs); flags coverage gaps and double-counting.",
    priority: "P2",
    buildNote: "Reporting surface, not a detection primitive.",
  },
];

export const LAYERS = [
  {
    n: 1,
    name: "Document Intelligence",
    summary:
      "Ingests the full planning corpus (~8,000–12,000 pages) and builds a normalised index. Core challenge is entity resolution: the same program appears under different names across ministries and cycles.",
    details: [
      "Two-stage pipeline: named-entity extraction, then embedding-based alias matching against a verified anchor list.",
      "Target ontology: 1,200–1,500 normalised programs; entity-resolution accuracy >85% as a go/no-go gate.",
      "Retrieval is two-stage: dense embedding search for recall, cross-encoder re-ranking for precision — this is what keeps unsupported-claim rates low enough for government use.",
    ],
  },
  {
    n: 2,
    name: "Agent Swarm",
    summary:
      "Six specialised agents, sequenced by build priority. The fundable MVP is the two P0 agents, not all six in parallel.",
    details: AGENTS.map((a) => `${a.name} (${a.priority}) — ${a.does}`),
  },
  {
    n: 3,
    name: "Coordination Graph",
    summary:
      "Agents never message each other. Each writes findings into a shared graph: nodes are programs, edges are detected relationships.",
    details: [
      "A finding confirmed independently across multiple passes gets weighted up; an unconfirmed one decays.",
      "After each pass the graph is analysed for structural criticality — which programs would disrupt the most others if they failed.",
      "This produces prioritisation without anyone hand-specifying what 'important' means.",
    ],
  },
  {
    n: 4,
    name: 'Predictive Simulation — "Policy Flight Simulator"',
    summary:
      "Layers 1–3 detect contradictions after publication. Layer 4 forecasts what a draft policy breaks downstream, before money or political capital is committed.",
    details: [
      "Causal/structural model over the Coherence Graph — structural causal models / Bayesian networks (DoWhy, EconML, pgmpy).",
      "Gaussian Process forecasting — point forecast plus calibrated confidence interval; direct reuse of the author's existing SFFM reliability model.",
      "Agent-based / system-dynamics simulation — cascade effects across the 34-ministry system (Mesa); output is a distribution of futures, not one prediction.",
      "Survival analysis on historical outcomes — Cox proportional hazards / Weibull (lifelines) on RPJMN 2015–2024 outcome data.",
    ],
  },
  {
    n: 5,
    name: "Human Interface & Accountability",
    summary:
      "Every output carries source passage or model basis, confidence score, severity, and a recommended action. No finding triggers an automated action.",
    details: [
      "Decision authority stays with human analysts — required by Indonesian planning law and the trust mechanism that makes adoption possible.",
      "Forecasts always show the confidence interval, never a bare point prediction.",
    ],
  },
];

export const OBJECTIVES = [
  {
    name: "Speed",
    target:
      "Cut time-to-flag for a coherence failure from a 90-day quarterly review cycle to under 7 days from document publication.",
  },
  {
    name: "Precision",
    target:
      ">70% precision on contradiction detection, validated against official government evaluation records.",
  },
  {
    name: "Prioritisation",
    target:
      "Rank programs by structural criticality so analysts know which 20% of programs are load-bearing for 80% of national targets.",
  },
  {
    name: "Trust",
    target:
      "Every finding ships with source-passage citation, confidence score, and severity — required for analyst adoption, not optional.",
  },
  {
    name: "Prediction",
    target:
      "For a draft policy not yet deployed, forecast downstream coherence risk with a calibrated confidence interval.",
  },
  {
    name: "Commercial validation",
    target:
      "Publish a precision/recall/lead-time result set against Bappenas' 2027 mid-term evaluation as the flagship case study.",
  },
];

export const MARKET = [
  {
    layer: "TAM",
    definition: "Countries with a formal national development plan",
    estimate: "~134 countries",
    caveat: false,
  },
  {
    layer: "SAM",
    definition: "Subset with RPJMN-equivalent multi-tier structure and a mandated mid-term review",
    estimate: "35–45 countries",
    caveat: true,
  },
  {
    layer: "SOM (3-yr)",
    definition: "Reachable via Indonesia case study + multilateral procurement channel",
    estimate: "3–6 government contracts",
    caveat: true,
  },
];

export const COMPETITORS = [
  {
    category: "Manual consulting",
    example: "McKinsey / BCG / Deloitte public-sector practices already doing parts of this analysis manually",
    difference:
      "Consulting is a one-off, expensive, non-continuous engagement. PETA-AI is a standing system that re-checks coherence every time a new document is published, at a fraction of the cost of repeat engagements.",
  },
  {
    category: "Generic AI/RAG vendors",
    example: "Any team standing up an LLM + vector database over the same government documents",
    difference:
      "Can replicate Layers 1–3 in months. Cannot replicate Layer 4 without the historical outcomes dataset and the calibration discipline — that data asset is the barrier to entry, not the code.",
  },
  {
    category: "Government digital-platform incumbents",
    example: "KRISNA, One Data Indonesia and similar centralised platforms already contracted to Bappenas",
    difference:
      "Data-aggregation platforms, not reasoning systems — structurally unable to do program-goal-level anomaly detection. PETA-AI sits on top of this infrastructure rather than replacing it, which lowers the political barrier to adoption.",
  },
];

export const ROADMAP = [
  {
    phase: "Phase 1 — Foundation",
    timeline: "Months 1–4",
    milestone:
      "Corpus + ontology + Layer 1 live. Commercial goal: convert the incubation relationship into a signed, funded pilot (grant or donor co-funded) with Bappenas.",
  },
  {
    phase: "Phase 2 — MVP Swarm",
    timeline: "Months 5–8",
    milestone:
      "Contradiction Detector + Budget Coherence Agent validated against Bappenas' public 2024 evaluation. Commercial goal: first published precision/recall numbers.",
  },
  {
    phase: "Phase 3 — Full System + Expansion",
    timeline: "Months 9–12",
    milestone:
      "Full swarm + dashboard live; sealed predictions logged ahead of the 2027 evaluation. Commercial goal: at least one active second-government or multilateral conversation underway.",
  },
  {
    phase: "Phase 4 — Predictive Layer",
    timeline: "Graph-dependent (from mid-to-late Phase 2, through month 14)",
    milestone:
      "Gaussian Process forecasting first, then the survival-analysis upgrade, then causal/ABM cascade simulation last. Commercial goal: the KRISNA retrodiction demo ready for investors and pilot buyers.",
  },
];

export const RISKS = {
  business: [
    {
      risk: "Single-customer dependency on Bappenas",
      mitigation:
        "Run multilateral channel conversations (World Bank GovTech, ADB, GIZ) in parallel from Phase 1, not after Bappenas succeeds.",
    },
    {
      risk: "Political / leadership change risk",
      mitigation: "Anchor the relationship and funding to the institution and donor, not an individual official.",
    },
    {
      risk: "Long sales cycle vs. runway",
      mitigation: "Treat govtech as one of two revenue tracks rather than the sole path to revenue.",
    },
    {
      risk: "Single validation event (2027)",
      mitigation: "Publish interim results against the already-public 2024 evaluation well before 2027.",
    },
  ],
  technical: [
    {
      risk: "Entity resolution underperforms on inconsistent Indonesian bureaucratic language",
      mitigation:
        "Maintain a manually verified anchor set of canonical program names; treat >85% entity-resolution accuracy as a go/no-go gate before Layer 2 agents are trusted.",
    },
    {
      risk: "Causal model assumptions don't hold in a politically dynamic system",
      mitigation:
        "Be explicit that causal estimates are directional and confidence-scored, not deterministic; pair with the ABM layer as a cross-check.",
    },
    {
      risk: "ABM/cascade simulation poorly calibrated with only two prior RPJMN cycles",
      mitigation:
        "Ship cascade simulation last and validate pattern-level rather than exact-magnitude agreement.",
    },
    {
      risk: "Hallucination / unsupported claims in a government-facing output",
      mitigation:
        "Two-stage retrieval + mandatory source-passage citation on every output; no finding ships without a traceable source or model basis.",
    },
  ],
};

export const OPEN_GAPS = [
  "Selected into the UK–Indonesia AI Incubation for Public Sector 2026, Bappenas track — not yet a signed commercial engagement.",
  "No LOI or paid pilot commitment secured yet — highest-priority open item.",
  "SAM/SOM figures are working estimates pending a validated target-country list.",
  "Team is a single technical/product founder; likely needs a named technical co-founder before a priced round.",
  "Build status per layer/agent needs to be stated accurately before external sharing.",
  "Competitive landscape needs one primary-research pass for direct AI-govtech-coherence competitors.",
  "Forecast backtesting has not been run — every confidence number shown externally is provisional.",
];

export const VALIDATION = [
  {
    name: "Backtest design",
    body: "Train the Gaussian Process and survival models on RPJMN 2015–2019 program data and outcomes; test predictions against what actually happened in RPJMN 2020–2024, which is already known. This gives a real accuracy/calibration number before the 2027 evaluation exists.",
  },
  {
    name: "Calibration check, not just accuracy",
    body: "For forecasts issued at 80% confidence, roughly 80% should actually occur over enough predictions. Report calibration curves, not only point accuracy.",
  },
  {
    name: "ABM/cascade validation",
    body: "The hardest of the four: validated by checking whether the pattern of downstream effects matches historical cascades, not by expecting exact numeric agreement.",
  },
];

/* ------------------------------------------------------------------ */
/* Demo product data                                                   */
/* ------------------------------------------------------------------ */

export type Finding = {
  id: string;
  severity: Severity;
  agent: AgentId;
  title: string;
  detail: string;
  programs: string[];
  ministries: string[];
  confidence: number;
  daysToFlag: number;
  citation: string;
  recommendedAction: string;
  passesConfirmed: number;
};

export const FINDINGS: Finding[] = [
  {
    id: "PA-0141",
    severity: "critical",
    agent: "contradiction",
    title: "Irrigation expansion target incompatible with paddy-land conversion moratorium",
    detail:
      "Two ministry strategic plans commit to opposite directions on the same land base: one expands irrigated hectarage, the other freezes conversion of the parcels that expansion depends on. Semantic entailment marks these as directionally incompatible, not merely differently worded.",
    programs: ["Irrigation Network Rehabilitation", "Sustainable Paddy Field Protection"],
    ministries: ["Public Works", "Agriculture"],
    confidence: 0.86,
    daysToFlag: 4,
    citation: "Renstra 2025–2029 · Ch. 3 targets table, p. 61 ↔ Renstra 2025–2029 · Ch. 2, p. 24",
    recommendedAction:
      "Route to the inter-ministerial land-use working group with both source passages attached; request a reconciled hectarage figure before the next budget ceiling is set.",
    passesConfirmed: 4,
  },
  {
    id: "PA-0139",
    severity: "critical",
    agent: "budget",
    title: "Unfunded commitment: stunting reduction target with no matching allocation line",
    detail:
      "A national headline target has an owning program in the strategic plan but no traceable allocation in the corresponding budget document for the first two fiscal years. Flagged as an unfunded commitment rather than a reporting lag because the program code is absent, not zero-valued.",
    programs: ["Integrated Nutrition Intervention"],
    ministries: ["Health", "Finance"],
    confidence: 0.79,
    daysToFlag: 3,
    citation: "Strategic plan commitment table, p. 88 ↔ budget program codes appendix, pp. 12–19",
    recommendedAction:
      "Confirm whether the commitment is funded under a different program code before escalating; if not, surface as a Phase-1 budget reconciliation item.",
    passesConfirmed: 3,
  },
  {
    id: "PA-0132",
    severity: "high",
    agent: "regional",
    title: "Provincial target divergence on renewable capacity across 6 provinces",
    detail:
      "Aggregated provincial plans sum to materially less than the national renewable-capacity target. Divergence is concentrated in six provinces whose plans reference an earlier national figure.",
    programs: ["Renewable Generation Capacity Build-out"],
    ministries: ["Energy & Mineral Resources"],
    confidence: 0.72,
    daysToFlag: 6,
    citation: "6 provincial RPJMD target tables ↔ national plan Annex II",
    recommendedAction:
      "Issue a target-restatement notice to the six provinces; re-run the regional agent after the next RPJMD revision cycle.",
    passesConfirmed: 3,
  },
  {
    id: "PA-0128",
    severity: "high",
    agent: "stigmergic",
    title: "Undeclared dependency: digital-ID rollout gating three social-assistance programs",
    detail:
      "Three programs across two ministries assume identity coverage that only the digital-ID rollout produces, but none of them declares that dependency. Edge weight accumulated over four passes.",
    programs: [
      "Digital Identity Coverage",
      "Conditional Cash Transfer Modernisation",
      "Subsidised Health Enrolment",
    ],
    ministries: ["Home Affairs", "Social Affairs", "Health"],
    confidence: 0.68,
    daysToFlag: 5,
    citation: "Cross-document dependency trace, 4 confirming passes",
    recommendedAction:
      "Register the dependency explicitly in the coordination graph and flag the three dependents if the ID rollout slips.",
    passesConfirmed: 4,
  },
  {
    id: "PA-0121",
    severity: "medium",
    agent: "sdq" as AgentId,
    title: "Double-counting risk in SDG reporting across two water programs",
    detail:
      "Two programs map to the same SDG indicator with overlapping beneficiary definitions, creating a plausible double-count in national reporting.",
    programs: ["Rural Water Access", "Urban Water Utility Reform"],
    ministries: ["Public Works"],
    confidence: 0.61,
    daysToFlag: 7,
    citation: "Reporting taxonomy mapping, indicator 6.1.1",
    recommendedAction: "Ask the reporting directorate to fix beneficiary definitions before the next submission.",
    passesConfirmed: 2,
  },
  {
    id: "PA-0117",
    severity: "medium",
    agent: "precedent",
    title: "Delivery-rate benchmark: analogous past program delivered 46% of target",
    detail:
      "The closest historical analogue from the previous planning cycle delivered well under target on a comparable timeline and budget profile. Retrieval-based benchmark only — not yet a survival-model forecast.",
    programs: ["Vocational Training Expansion"],
    ministries: ["Manpower"],
    confidence: 0.58,
    daysToFlag: 7,
    citation: "Historical outcome report, prior cycle, program family match",
    recommendedAction: "Treat the current target as optimistic pending a survival-analysis forecast in Layer 4.",
    passesConfirmed: 2,
  },
];

export type CriticalProgram = {
  rank: number;
  program: string;
  ministry: string;
  criticality: number;
  dependents: number;
  targetsTouched: number;
};

export const CRITICAL_PROGRAMS: CriticalProgram[] = [
  { rank: 1, program: "Digital Identity Coverage", ministry: "Home Affairs", criticality: 0.94, dependents: 27, targetsTouched: 11 },
  { rank: 2, program: "Irrigation Network Rehabilitation", ministry: "Public Works", criticality: 0.88, dependents: 19, targetsTouched: 8 },
  { rank: 3, program: "Integrated Nutrition Intervention", ministry: "Health", criticality: 0.81, dependents: 16, targetsTouched: 7 },
  { rank: 4, program: "Renewable Generation Capacity Build-out", ministry: "Energy & Mineral Resources", criticality: 0.77, dependents: 14, targetsTouched: 6 },
  { rank: 5, program: "Conditional Cash Transfer Modernisation", ministry: "Social Affairs", criticality: 0.69, dependents: 12, targetsTouched: 5 },
  { rank: 6, program: "Vocational Training Expansion", ministry: "Manpower", criticality: 0.54, dependents: 8, targetsTouched: 4 },
];

export const CORPUS_STATS = [
  { label: "Pages indexed", value: "9,412", note: "corpus target 8,000–12,000" },
  { label: "Canonical programs", value: "1,286", note: "ontology target 1,200–1,500" },
  { label: "Entity resolution", value: "87.4%", note: "go/no-go gate >85%" },
  { label: "Median time-to-flag", value: "5.2 days", note: "objective <7 days" },
];

/* Policy Flight Simulator — demo scenarios */

export type SimScenario = {
  id: string;
  label: string;
  draft: string;
  lever: string;
  magnitude: string;
  retrodiction?: string;
  cascade: {
    program: string;
    ministry: string;
    hazard: number;
    ciLow: number;
    ciHigh: number;
    horizonMonths: number;
    basis: string;
  }[];
  patternNote: string;
};

export const SIM_SCENARIOS: SimScenario[] = [
  {
    id: "krisna-retro",
    label: "KRISNA irrigation / paddy-land retrodiction",
    draft:
      "A historical planning decision already known to have caused downstream problems, fed back into the system as if it were still an unsigned draft.",
    lever: "Irrigated-hectarage target raised without reconciling the paddy-land data base",
    magnitude: "+18% target, unchanged land-conversion rules",
    retrodiction:
      "This decision was already taken in a previous cycle. The demo runs the forecast blind, then reveals the recorded outcome so the pattern match is checkable rather than asserted.",
    cascade: [
      { program: "Irrigation Network Rehabilitation", ministry: "Public Works", hazard: 0.81, ciLow: 0.66, ciHigh: 0.91, horizonMonths: 12, basis: "GP forecast + survival analogue" },
      { program: "Sustainable Paddy Field Protection", ministry: "Agriculture", hazard: 0.74, ciLow: 0.55, ciHigh: 0.88, horizonMonths: 18, basis: "Causal model over coherence graph" },
      { program: "Rural Water Access", ministry: "Public Works", hazard: 0.49, ciLow: 0.3, ciHigh: 0.68, horizonMonths: 24, basis: "ABM cascade, 2,000 runs" },
      { program: "Food Price Stabilisation", ministry: "Trade", hazard: 0.38, ciLow: 0.19, ciHigh: 0.6, horizonMonths: 24, basis: "ABM cascade, 2,000 runs" },
    ],
    patternNote:
      "Cascade output is validated at pattern level — which programs are affected and roughly what magnitude — not exact numeric agreement.",
  },
  {
    id: "budget-cut",
    label: "Draft: 12% cut to digital identity allocation",
    draft: "An unsigned budget revision reducing the allocation to the highest-criticality node in the graph.",
    lever: "Allocation reduced on Digital Identity Coverage",
    magnitude: "−12% allocation, timeline unchanged",
    cascade: [
      { program: "Digital Identity Coverage", ministry: "Home Affairs", hazard: 0.77, ciLow: 0.6, ciHigh: 0.89, horizonMonths: 12, basis: "GP forecast (SFFM reuse)" },
      { program: "Conditional Cash Transfer Modernisation", ministry: "Social Affairs", hazard: 0.63, ciLow: 0.44, ciHigh: 0.79, horizonMonths: 18, basis: "Causal model over coherence graph" },
      { program: "Subsidised Health Enrolment", ministry: "Health", hazard: 0.57, ciLow: 0.37, ciHigh: 0.75, horizonMonths: 18, basis: "Causal model over coherence graph" },
      { program: "Integrated Nutrition Intervention", ministry: "Health", hazard: 0.31, ciLow: 0.15, ciHigh: 0.52, horizonMonths: 24, basis: "ABM cascade, 2,000 runs" },
    ],
    patternNote:
      "The undeclared dependency in finding PA-0128 is what makes this cascade visible; without the graph edge the cut looks locally contained.",
  },
  {
    id: "target-raise",
    label: "Draft: renewable capacity target raised mid-cycle",
    draft: "An unsigned commitment raising a national headline target without changing provincial plans.",
    lever: "National renewable-capacity target raised, provincial targets untouched",
    magnitude: "+9 GW national, no RPJMD restatement",
    cascade: [
      { program: "Renewable Generation Capacity Build-out", ministry: "Energy & Mineral Resources", hazard: 0.69, ciLow: 0.5, ciHigh: 0.84, horizonMonths: 18, basis: "GP forecast + regional divergence signal" },
      { program: "Grid Interconnection Upgrade", ministry: "Energy & Mineral Resources", hazard: 0.52, ciLow: 0.33, ciHigh: 0.71, horizonMonths: 24, basis: "Causal model over coherence graph" },
      { program: "Vocational Training Expansion", ministry: "Manpower", hazard: 0.29, ciLow: 0.13, ciHigh: 0.49, horizonMonths: 24, basis: "Survival analogue, prior cycle" },
    ],
    patternNote:
      "Divergence between national and provincial targets is already flagged as PA-0132; the forecast quantifies what that divergence costs if the target is raised anyway.",
  },
];

export const PROVISIONAL_NOTICE =
  "Provisional / pre-validation. Backtesting against RPJMN 2015–2019 → 2020–2024 has not been run. Every number on this screen is illustrative demo data.";
