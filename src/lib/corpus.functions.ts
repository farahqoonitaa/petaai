import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const DocMeta = z.object({
  title: z.string().trim().min(2).max(300),
  ministry: z.string().trim().min(1).max(200),
  docType: z.string().trim().min(1).max(80),
  cycle: z.string().trim().min(1).max(80),
  term: z.string().trim().min(1).max(80),
  year: z.number().int().min(1990).max(2060).nullable(),
  pageCount: z.number().int().min(0).max(100000),
  charCount: z.number().int().min(0),
});

export const createCorpusDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DocMeta.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("corpus_documents")
      .insert({
        user_id: context.userId,
        title: data.title,
        ministry: data.ministry,
        doc_type: data.docType,
        rpjmn_cycle: data.cycle,
        leadership_term: data.term,
        doc_year: data.year,
        page_count: data.pageCount,
        char_count: data.charCount,
        status: "indexing",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

const ChunkBatch = z.object({
  documentId: z.string().uuid(),
  chunks: z
    .array(
      z.object({
        index: z.number().int().min(0),
        pageHint: z.number().int().min(1),
        content: z.string().min(1).max(8000),
      }),
    )
    .min(1)
    .max(24),
});

export const indexChunkBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ChunkBatch.parse(input))
  .handler(async ({ data, context }) => {
    const { embedTexts, toVector } = await import("./ai-gateway.server");
    const vectors = await embedTexts(data.chunks.map((c) => c.content));
    const rows = data.chunks.map((c, i) => ({
      user_id: context.userId,
      document_id: data.documentId,
      chunk_index: c.index,
      page_hint: c.pageHint,
      content: c.content,
      embedding: toVector(vectors[i]!),
    }));
    const { error } = await context.supabase.from("doc_chunks").insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });

export const finalizeCorpusDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        documentId: z.string().uuid(),
        chunkCount: z.number().int().min(0),
        error: z.string().max(500).nullable().default(null),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("corpus_documents")
      .update({
        chunk_count: data.chunkCount,
        status: data.error ? "error" : "ready",
        error: data.error,
      })
      .eq("id", data.documentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCorpusDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ documentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("corpus_documents")
      .delete()
      .eq("id", data.documentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
