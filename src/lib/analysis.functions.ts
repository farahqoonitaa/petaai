import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { AGENT_BY_ID, type AgentId } from "./peta-agents";
import { verifyQuote } from "./citation-verify";
import { attributeMonetary, buildCascade, dedupeMinistries } from "./grounding";

const AGENT_IDS = [
  "stigmergic_tracer",
  "contradiction_detector",
  "budget_coherence",
  "regional_signal",
  "historical_precedent",
  "sdg_alignment",
] as const;

const StartRun = z.object({
  mode: z.enum(["focused", "full_swarm"]),
  agents: z.array(z.enum(AGENT_IDS)).min(1).max(6),
  documentIds: z.array(z.string().uuid()).min(1).max(60),
  sliceLabel: z.string().trim().min(1).max(120),
  yearFrom: z.number().int().min(1990).max(2060).nullable(),
  yearTo: z.number().int().min(1990).max(2060).nullable(),
  /** Institution running the evaluation. Null = central cross-government review. */
  evaluatorMinistry: z.string().trim().min(1).max(200).nullable().default(null),
  evaluationMode: z.enum(["self_evaluation", "central_review"]).default("central_review"),
  /** Exception: pull in other ministries' documents even in a self-evaluation. */
  crossMinistry: z.boolean().default(true),
});


export const startRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StartRun.parse(input))
  .handler(async ({ data, context }) => {
    const { data: docs, error: docErr } = await context.supabase
      .from("corpus_documents")
      .select("id, title, ministry, doc_year, status, chunk_count")
      .in("id", data.documentIds);
    if (docErr) throw new Error(docErr.message);

    const indexed = (docs ?? []).filter((d) => d.status === "ready" && (d.chunk_count ?? 0) > 0);
    if (indexed.length === 0)
      throw new Error("None of the selected documents finished indexing — nothing to analyse.");

    const warnings: string[] = [];
    const sameMinistry = (d: { ministry: string | null }) =>
      !!data.evaluatorMinistry &&
      (d.ministry ?? "").trim().toLowerCase() === data.evaluatorMinistry.trim().toLowerCase();

    // Institutional scoping: a self-evaluation reads its own ministry's documents
    // unless the analyst explicitly grants the cross-ministry exception.
    let ready = indexed;
    if (data.evaluationMode === "self_evaluation" && data.evaluatorMinistry && !data.crossMinistry) {
      const own = indexed.filter(sameMinistry);
      if (own.length === 0)
        throw new Error(
          `No indexed document belongs to ${data.evaluatorMinistry}. Index one of its documents, or enable the cross-ministry exception.`,
        );
      if (own.length < indexed.length)
        warnings.push(
          `${indexed.length - own.length} document(s) from other institutions were excluded: this run is scoped to ${data.evaluatorMinistry} only.`,
        );
      ready = own;
    } else if (data.evaluationMode === "self_evaluation" && data.evaluatorMinistry) {
      const own = indexed.filter(sameMinistry);
      warnings.push(
        own.length
          ? `Cross-ministry exception is on: ${data.evaluatorMinistry} is evaluated against ${indexed.length - own.length} document(s) from other institutions.`
          : `Cross-ministry exception is on, but no document belongs to ${data.evaluatorMinistry} — findings describe other institutions, not the evaluating one.`,
      );
    }

    if (ready.length < data.documentIds.length)
      warnings.push(
        `${data.documentIds.length - ready.length} selected document(s) were excluded before analysis.`,
      );
    if (data.yearFrom !== null && data.yearTo !== null) {
      const outside = ready.filter(
        (d) => d.doc_year !== null && (d.doc_year < data.yearFrom! || d.doc_year > data.yearTo!),
      );
      if (outside.length)
        warnings.push(
          `${outside.length} document(s) fall outside ${data.sliceLabel}; findings from them are slice-inconsistent.`,
        );
      const inside = ready.filter(
        (d) => d.doc_year === null || (d.doc_year >= data.yearFrom! && d.doc_year <= data.yearTo!),
      );
      if (inside.length === 0)
        warnings.push("No document in this slice matches the selected epoch — coverage is empty.");
    }
    if (ready.length < 3)
      warnings.push(
        "Thin corpus: cross-document contradiction and dependency detection needs several ministries' documents to be meaningful.",
      );

    const { data: run, error } = await context.supabase
      .from("analysis_runs")
      .insert({
        user_id: context.userId,
        mode: data.mode,
        agents: data.agents,
        document_ids: ready.map((d) => d.id),
        slice_label: data.sliceLabel,
        year_from: data.yearFrom,
        year_to: data.yearTo,
        evaluator_ministry: data.evaluatorMinistry,
        evaluation_mode: data.evaluationMode,
        cross_ministry: data.crossMinistry,
        status: "running",
        coverage_warning: warnings.length ? warnings.join(" ") : null,
      })
      .select("id, coverage_warning")
      .single();
    if (error) throw new Error(error.message);


    return {
      runId: run.id as string,
      documentCount: ready.length,
      coverageWarning: (run.coverage_warning as string | null) ?? null,
    };
  });

interface Passage {
  id: string;
  documentId: string;
  title: string;
  page: number;
  content: string;
  similarity: number;
}

const FINDINGS_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["findings", "no_findings_reason"],
  properties: {
    no_findings_reason: {
      type: ["string", "null"],
      description: "If findings is empty, why this slice yielded nothing for this agent.",
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "detail",
          "severity",
          "confidence",
          "programs",
          "ministries",
          "passage_number",
          "quote",
          "recommended_action",
        ],
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          severity: { type: "string", enum: ["critical", "high", "medium"] },
          confidence: { type: "number" },
          programs: { type: "array", items: { type: "string" } },
          ministries: { type: "array", items: { type: "string" } },
          passage_number: {
            type: ["integer", "null"],
            description: "The [P#] number of the passage this finding is grounded in.",
          },
          quote: { type: "string", description: "Verbatim span from that passage." },
          recommended_action: { type: "string" },
        },
      },
    },
  },
};

interface AgentOutput {
  no_findings_reason: string | null;
  findings: {
    title: string;
    detail: string;
    severity: "critical" | "high" | "medium";
    confidence: number;
    programs: string[];
    ministries: string[];
    passage_number: number | null;
    quote: string;
    recommended_action: string;
  }[];
}

export const runAgentPass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ runId: z.string().uuid(), agent: z.enum(AGENT_IDS) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const spec = AGENT_BY_ID.get(data.agent as AgentId);
    if (!spec) throw new Error("Unknown agent");

    const trace = async (phase: string, message: string) => {
      // Atomic per-run counter in the database: parallel agents still get a
      // unique, contiguous step number.
      await context.supabase.rpc("emit_trace", {
        _run_id: data.runId,
        _agent: data.agent,
        _phase: phase,
        _message: message,
      });
    };

    const { data: run, error: runErr } = await context.supabase
      .from("analysis_runs")
      .select(
        "id, document_ids, slice_label, year_from, year_to, evaluator_ministry, evaluation_mode, cross_ministry",
      )

      .eq("id", data.runId)
      .single();
    if (runErr) throw new Error(runErr.message);

    const documentIds = (run.document_ids as string[]) ?? [];
    const { data: docs } = await context.supabase
      .from("corpus_documents")
      .select("id, title, ministry, doc_type, doc_year")
      .in("id", documentIds);
    const docById = new Map((docs ?? []).map((d) => [d.id as string, d]));

    const { embedTexts, generateStructured } = await import("./ai-gateway.server");

    // Stage 1 — dense retrieval across this agent's probes.
    await trace("retrieval", `Embedding ${spec.probes.length} retrieval probes.`);
    const probeVectors = await embedTexts(spec.probes);
    const byId = new Map<string, Passage>();
    for (const vec of probeVectors) {
      const { data: matches, error } = await context.supabase.rpc("match_chunks", {
        query_embedding: JSON.stringify(vec),
        doc_ids: documentIds,
        match_count: 8,
      });
      if (error) throw new Error(error.message);
      for (const m of (matches ?? []) as {
        id: string;
        document_id: string;
        page_hint: number | null;
        content: string;
        similarity: number;
      }[]) {
        if (byId.has(m.id)) continue;
        const doc = docById.get(m.document_id);
        byId.set(m.id, {
          id: m.id,
          documentId: m.document_id,
          title: (doc?.title as string) ?? "Untitled document",
          page: m.page_hint ?? 1,
          content: m.content,
          similarity: m.similarity,
        });
      }
    }

    // Stage 2 — rank and cap the evidence window.
    const passages = [...byId.values()].sort((a, b) => b.similarity - a.similarity).slice(0, 18);
    if (passages.length === 0) {
      await trace("empty", "No passages retrieved for this mandate.");
      return {
        agent: data.agent,
        retrieved: 0,
        inserted: 0,
        dropped: 0,
        note: "No passages retrieved.",
      };
    }
    await trace(
      "retrieval",
      `${passages.length} passages ranked, top relevance ${passages[0]!.similarity.toFixed(3)}.`,
    );

    const corpusManifest = (docs ?? [])
      .map((d) => `- ${d.title} · ${d.ministry} · ${d.doc_type}${d.doc_year ? ` · ${d.doc_year}` : ""}`)
      .join("\n");

    const evidence = passages
      .map(
        (p, i) =>
          `[P${i + 1}] ${p.title} · page ${p.page} · relevance ${p.similarity.toFixed(3)}\n${p.content}`,
      )
      .join("\n\n");

    const instructions = [
      `You are the ${spec.name} inside PETA-AI, a national planning coherence analyser for Bappenas.`,
      `Mandate: ${spec.mandate}`,
      `Mechanism you implement: ${spec.mechanism}`,
      "Rules that are not negotiable:",
      "1. Every finding must be grounded in one of the numbered passages. Set passage_number to that passage and quote a verbatim span from it.",
      "2. Never invent programs, ministries, figures, or documents that are absent from the passages.",
      "3. If the retrieved evidence does not support a finding for your mandate, return an empty findings array and explain why in no_findings_reason. An empty result is a correct result.",
      "4. confidence is 0-1 and must reflect evidential strength: below 0.6 when the passage is suggestive rather than explicit.",
      "5. severity: critical = a national target is unreachable as written; high = material delivery risk; medium = coordination or reporting defect.",
      "6. Recommend an analyst action. You have no authority to execute anything.",
      "Return at most 4 findings, the strongest ones only.",
    ].join("\n");

    const input = [
      `Temporal slice: ${run.slice_label}${run.year_from ? ` (${run.year_from}-${run.year_to})` : ""}`,
      `Corpus in scope:\n${corpusManifest}`,
      `Retrieved passages:\n\n${evidence}`,
    ].join("\n\n");

    await trace("reasoning", "Reasoning over the retrieved evidence window.");
    const output = await generateStructured<AgentOutput>({
      instructions,
      input,
      schemaName: "agent_findings",
      schema: FINDINGS_SCHEMA,
    });

    const candidates = (output.findings ?? []).slice(0, 4);
    const dropped: string[] = [];

    const rows = candidates.flatMap((f) => {
      const p = f.passage_number ? passages[f.passage_number - 1] : undefined;
      const quote = f.quote?.trim().slice(0, 600) ?? "";
      const { verification, matchScore } = verifyQuote(quote, p?.content);

      // Hard grounding gate: an ungrounded claim never reaches the database.
      if (!p || verification === "unverified") {
        dropped.push(f.title.slice(0, 120));
        return [];
      }

      const rawConfidence = Math.min(1, Math.max(0, Number(f.confidence) || 0.5));
      const confidence = verification === "verified" ? rawConfidence : Math.min(rawConfidence, 0.55);

      const programs = (f.programs ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 8);
      const ministries = dedupeMinistries((f.ministries ?? []).slice(0, 8));

      // Deterministic monetary attribution: nearest-program rule with currency
      // validation, read from the passage itself — never from the model.
      let money: ReturnType<typeof attributeMonetary> = null;
      for (const program of programs) {
        const hit = attributeMonetary(p.content, program, { otherPrograms: programs });
        if (hit && (!money || hit.distance < money.distance)) money = hit;
      }

      return [
        {
          user_id: context.userId,
          run_id: data.runId,
          agent: data.agent,
          title: f.title.slice(0, 300),
          detail: f.detail,
          severity: ["critical", "high", "medium"].includes(f.severity) ? f.severity : "medium",
          confidence,
          programs,
          ministries,
          citation: `${p.title} · page ${p.page}${quote ? ` — "${quote}"` : ""}`,
          source_document_id: p.documentId,
          source_chunk_id: p.id,
          quote: quote || null,
          page_hint: p.page,
          match_score: matchScore,
          verification,
          monetary_amount: money?.amount ?? null,
          monetary_currency: money ? money.currency : null,
          monetary_basis: money?.basis ?? null,
          recommended_action: f.recommended_action,
        },
      ];
    });

    if (rows.length) {
      const { error } = await context.supabase.from("run_findings").insert(rows);
      if (error) throw new Error(error.message);
    }

    if (dropped.length)
      await trace(
        "dropped",
        `${dropped.length} ungrounded claim(s) discarded before storage: ${dropped.join("; ")}`,
      );
    await trace(
      rows.length ? "deposited" : "empty",
      rows.length
        ? `${rows.length} grounded finding(s) deposited into the coherence graph.`
        : (output.no_findings_reason ?? "No findings for this mandate."),
    );

    return {
      agent: data.agent,
      retrieved: passages.length,
      inserted: rows.length,
      dropped: dropped.length,
      note: rows.length
        ? dropped.length
          ? `${dropped.length} ungrounded claim(s) discarded.`
          : null
        : (output.no_findings_reason ?? "No findings for this mandate."),
    };
  });


/** Full indexed excerpt behind one finding, for citation-level inspection. */
export const getFindingEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ findingId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: finding, error } = await context.supabase
      .from("run_findings")
      .select("id, quote, page_hint, match_score, verification, source_chunk_id, source_document_id")
      .eq("id", data.findingId)
      .single();
    if (error) throw new Error(error.message);

    let excerpt: string | null = null;
    let chunkIndex: number | null = null;
    if (finding.source_chunk_id) {
      const { data: chunk } = await context.supabase
        .from("doc_chunks")
        .select("content, chunk_index")
        .eq("id", finding.source_chunk_id as string)
        .maybeSingle();
      excerpt = (chunk?.content as string) ?? null;
      chunkIndex = (chunk?.chunk_index as number) ?? null;
    }

    let documentTitle: string | null = null;
    let ministry: string | null = null;
    if (finding.source_document_id) {
      const { data: doc } = await context.supabase
        .from("corpus_documents")
        .select("title, ministry")
        .eq("id", finding.source_document_id as string)
        .maybeSingle();
      documentTitle = (doc?.title as string) ?? null;
      ministry = (doc?.ministry as string) ?? null;
    }

    return {
      quote: (finding.quote as string | null) ?? null,
      page: (finding.page_hint as number | null) ?? null,
      matchScore: Number(finding.match_score ?? 0),
      verification: (finding.verification as string) ?? "unverified",
      excerpt,
      chunkIndex,
      documentTitle,
      ministry,
    };
  });


const SUMMARY_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["executive_summary"],
  properties: { executive_summary: { type: "string" } },
};

export const finalizeRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ runId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: findings, error } = await context.supabase
      .from("run_findings")
      .select("id, agent, title, detail, severity, confidence, programs")
      .eq("run_id", data.runId);
    if (error) throw new Error(error.message);

    const list = findings ?? [];

    // Stigmergic reinforcement: a finding whose programs are independently
    // touched by other agents in the same run carries more weight.
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    for (const f of list) {
      const own = new Set((f.programs as string[]).map(norm).filter(Boolean));
      const agents = new Set<string>([f.agent as string]);
      for (const other of list) {
        if (other.id === f.id) continue;
        const shared = (other.programs as string[]).map(norm).some((p) => p && own.has(p));
        if (shared) agents.add(other.agent as string);
      }
      const corroboration = agents.size;
      const boosted = Math.min(0.97, Number(f.confidence) + (corroboration - 1) * 0.04);
      await context.supabase
        .from("run_findings")
        .update({ corroboration, confidence: boosted })
        .eq("id", f.id);
    }

    let summary: string | null = null;
    if (list.length) {
      const { generateStructured } = await import("./ai-gateway.server");
      const digest = list
        .map((f) => `- [${f.severity}] ${f.title} (${f.agent}) :: ${f.detail}`)
        .join("\n");
      const out = await generateStructured<{ executive_summary: string }>({
        instructions:
          "You write the analyst-facing executive summary for a PETA-AI coherence run. Two short paragraphs, plain prose, no bullet points, no invented facts beyond the findings given. Name the sharpest structural risk first and say what the analyst should verify. Decision authority stays with the analyst.",
        input: `Findings from this run:\n${digest}`,
        schemaName: "run_summary",
        schema: SUMMARY_SCHEMA,
      });
      summary = out.executive_summary;
    }

    const { error: upErr } = await context.supabase
      .from("analysis_runs")
      .update({
        status: "complete",
        completed_at: new Date().toISOString(),
        executive_summary: summary,
      })
      .eq("id", data.runId);
    if (upErr) throw new Error(upErr.message);

    return { findings: list.length, summary };
  });

/**
 * Non-LLM run analytics: the atomic trace log, the noisy-OR failure cascade and
 * monetary exposure. These stay available even when the AI gateway is out of
 * credit, so a run report degrades gracefully instead of going blank.
 */
export const getRunAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ runId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const [{ data: findings, error }, { data: traces }] = await Promise.all([
      context.supabase
        .from("run_findings")
        .select(
          "id, agent, title, severity, confidence, corroboration, verification, programs, ministries, monetary_amount, monetary_currency, monetary_basis",
        )
        .eq("run_id", data.runId),
      context.supabase
        .from("run_traces")
        .select("seq, agent, phase, message, created_at")
        .eq("run_id", data.runId)
        .order("seq", { ascending: true }),
    ]);
    if (error) throw new Error(error.message);

    const list = findings ?? [];
    const cascade = buildCascade(
      list.map((f) => ({
        programs: (f.programs as string[]) ?? [],
        severity: f.severity as "critical" | "high" | "medium",
        confidence: Number(f.confidence ?? 0),
        corroboration: Number(f.corroboration ?? 1),
        verification: (f.verification as string) ?? "unverified",
      })),
    );

    const exposure = list
      .filter((f) => f.monetary_amount != null)
      .map((f) => ({
        findingId: f.id as string,
        title: f.title as string,
        agent: f.agent as string,
        program: ((f.programs as string[]) ?? [])[0] ?? null,
        amount: Number(f.monetary_amount),
        currency: (f.monetary_currency as string) ?? "IDR",
        basis: (f.monetary_basis as string) ?? null,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      cascade,
      exposure,
      exposureTotal: exposure.reduce((sum, e) => sum + e.amount, 0),
      ministries: dedupeMinistries(list.flatMap((f) => (f.ministries as string[]) ?? [])),
      traces: (traces ?? []).map((t) => ({
        seq: Number(t.seq),
        agent: t.agent as string,
        phase: t.phase as string,
        message: t.message as string,
        at: t.created_at as string,
      })),
    };
  });
