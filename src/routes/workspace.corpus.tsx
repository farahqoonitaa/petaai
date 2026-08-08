import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { chunkDocument } from "@/lib/chunk";
import { DOC_TYPES, LEADERSHIP_TERMS, RPJMN_CYCLES } from "@/lib/peta-agents";
import {
  createCorpusDocument,
  deleteCorpusDocument,
  finalizeCorpusDocument,
  indexChunkBatch,
} from "@/lib/corpus.functions";
import { Chip } from "@/components/peta/primitives";

export const Route = createFileRoute("/workspace/corpus")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Corpus indexing — PETA-AI workspace" },
      {
        name: "description",
        content:
          "Index real planning documents into PETA-AI: page-aware chunking, dense embeddings and a searchable corpus the agent swarm reads from.",
      },
      { property: "og:title", content: "PETA-AI — corpus indexing" },
      {
        property: "og:description",
        content:
          "Upload RPJMN, Renstra-KL, RPJMD, budget and evaluation documents. Text is extracted in your browser, then embedded for retrieval.",
      },
    ],
  }),
  component: CorpusPage,
});

interface DocRow {
  id: string;
  title: string;
  ministry: string;
  doc_type: string;
  rpjmn_cycle: string;
  leadership_term: string;
  doc_year: number | null;
  page_count: number;
  char_count: number;
  chunk_count: number;
  status: string;
  error: string | null;
  created_at: string;
}

function CorpusPage() {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [ministry, setMinistry] = useState("");
  const [docType, setDocType] = useState<string>(DOC_TYPES[0]);
  const [cycle, setCycle] = useState<string>(RPJMN_CYCLES[2]);
  const [term, setTerm] = useState<string>(LEADERSHIP_TERMS[2]);
  const [year, setYear] = useState<string>("");
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("corpus_documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (err) setError(err.message);
    setDocs((data as DocRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function index() {
    if (!file) return;
    setError(null);
    let documentId: string | null = null;
    try {
      setProgress("Extracting text in your browser…");
      const { extractText } = await import("@/lib/pdf-text");
      const { text, pages } = await extractText(file);
      if (text.replace(/\s/g, "").length < 200)
        throw new Error(
          "Almost no extractable text — this looks like a scanned document. Provide a text-layer PDF or paste the text as .txt.",
        );

      const chunks = chunkDocument(text);
      if (chunks.length === 0) throw new Error("No usable passages found in this document.");

      const created = await createCorpusDocument({
        data: {
          title: title.trim() || file.name.replace(/\.[^.]+$/, ""),
          ministry: ministry.trim() || "Unspecified",
          docType,
          cycle,
          term,
          year: year ? Number(year) : null,
          pageCount: pages,
          charCount: text.length,
        },
      });
      documentId = created.id;

      const batchSize = 20;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        setProgress(
          `Embedding passages ${i + 1}–${Math.min(i + batchSize, chunks.length)} of ${chunks.length}…`,
        );
        await indexChunkBatch({ data: { documentId, chunks: batch } });
      }

      await finalizeCorpusDocument({
        data: { documentId, chunkCount: chunks.length, error: null },
      });
      setProgress(`Indexed ${chunks.length} passages across ${pages} pages.`);
      setFile(null);
      setTitle("");
      if (inputRef.current) inputRef.current.value = "";
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Indexing failed.";
      setError(msg);
      setProgress(null);
      if (documentId)
        await finalizeCorpusDocument({
          data: { documentId, chunkCount: 0, error: msg.slice(0, 400) },
        }).catch(() => undefined);
      await load();
    }
  }

  async function remove(id: string) {
    await deleteCorpusDocument({ data: { documentId: id } });
    await load();
  }

  const readyCount = docs.filter((d) => d.status === "ready").length;
  const totalChunks = docs.reduce((n, d) => n + d.chunk_count, 0);
  const totalPages = docs.reduce((n, d) => n + d.page_count, 0);

  return (
    <div className="grid gap-8 lg:grid-cols-[22rem_1fr]">
      <aside>
        <p className="label-mono">index a document</p>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Text is extracted in your browser, split page-aware, then embedded server-side. Layer 1 of
          the architecture: no analysis happens until a document is retrievable.
        </p>

        <div className="mt-5 space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.txt,.md,.csv"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
            }}
            className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-xs file:mr-3 file:rounded file:border-0 file:bg-surface-2 file:px-2 file:py-1 file:text-xs file:text-foreground"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title"
            className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <input
            value={ministry}
            onChange={(e) => setMinistry(e.target.value)}
            placeholder="Owning ministry / agency"
            className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
          >
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={cycle}
            onChange={(e) => setCycle(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
          >
            {RPJMN_CYCLES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
          >
            {LEADERSHIP_TERMS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
            placeholder="Document year (e.g. 2025)"
            className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          <button
            type="button"
            disabled={!file || progress?.endsWith("…")}
            onClick={index}
            className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {progress?.endsWith("…") ? "Indexing…" : "Index document"}
          </button>
        </div>

        {progress ? <p className="mt-4 font-mono text-[11px] text-primary">{progress}</p> : null}
        {error ? <p className="mt-3 text-xs leading-relaxed text-critical">{error}</p> : null}
      </aside>

      <section>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="panel p-5">
            <p className="label-mono">indexed documents</p>
            <p className="mt-2 font-display text-2xl font-semibold">{readyCount}</p>
          </div>
          <div className="panel p-5">
            <p className="label-mono">retrievable passages</p>
            <p className="mt-2 font-display text-2xl font-semibold">
              {totalChunks.toLocaleString()}
            </p>
          </div>
          <div className="panel p-5">
            <p className="label-mono">pages ingested</p>
            <p className="mt-2 font-display text-2xl font-semibold">{totalPages.toLocaleString()}</p>
          </div>
        </div>

        <div className="mt-6 panel overflow-hidden">
          <div className="border-b border-border px-6 py-4">
            <p className="label-mono">corpus</p>
          </div>
          {loading ? (
            <p className="px-6 py-8 text-sm text-muted-foreground">Loading corpus…</p>
          ) : docs.length === 0 ? (
            <p className="px-6 py-8 text-sm leading-relaxed text-muted-foreground">
              Nothing indexed yet. Start with one RPJMN chapter and one Renstra-KL from a different
              ministry — cross-document contradiction detection needs at least two owners.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {docs.map((d) => (
                <li key={d.id} className="px-6 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold">{d.title}</h2>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Chip>{d.ministry}</Chip>
                        <Chip>{d.doc_type}</Chip>
                        <Chip>{d.rpjmn_cycle}</Chip>
                        {d.doc_year ? <Chip>{d.doc_year}</Chip> : null}
                        <Chip>{d.page_count} pages</Chip>
                        <Chip>{d.chunk_count} passages</Chip>
                      </div>
                      {d.error ? (
                        <p className="mt-2 text-xs text-critical">{d.error}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`font-mono text-[10px] uppercase tracking-[0.14em] ${
                          d.status === "ready"
                            ? "text-primary"
                            : d.status === "error"
                              ? "text-critical"
                              : "text-accent"
                        }`}
                      >
                        {d.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => remove(d.id)}
                        className="font-mono text-[11px] text-muted-foreground hover:text-critical"
                      >
                        delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
