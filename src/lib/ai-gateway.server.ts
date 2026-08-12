// Model access for PETA-AI. Server-only.
//
// Primary provider: Google Gemini, called directly with the workspace's own
// GEMINI_API_KEY. If that secret is absent the module falls back to the Lovable
// AI Gateway so the workspace keeps working instead of hard-failing.
const GOOGLE = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_EMBED_MODEL = "gemini-embedding-001";
const GEMINI_CHAT_MODEL = "gemini-2.5-flash";
const EMBED_DIMS = 3072;

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const GATEWAY_EMBED_MODEL = "google/gemini-embedding-2";
const GATEWAY_CHAT_MODEL = "openai/gpt-5.6-sol";

function geminiKey(): string | null {
  return process.env["GEMINI_API_KEY"] ?? null;
}

function lovableKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("No model provider configured: add a GEMINI_API_KEY.");
  return key;
}

/** Which provider is actually serving this workspace — surfaced in the UI. */
export function activeProvider(): "gemini" | "lovable" {
  return geminiKey() ? "gemini" : "lovable";
}

function gatewayHeaders() {
  return {
    "Content-Type": "application/json",
    "Lovable-API-Key": lovableKey(),
    "X-Lovable-AIG-SDK": "fetch",
  };
}

function relay(status: number, body: string, provider: string): never {
  if (status === 429)
    throw new Error(`${provider} rate limit reached — wait a moment and re-run this pass.`);
  if (status === 402) throw new Error(`${provider} credits/quota exhausted.`);
  if (status === 400 && /API key not valid/i.test(body))
    throw new Error("The Gemini API key was rejected. Update GEMINI_API_KEY and try again.");
  if (status === 403)
    throw new Error(
      "Gemini rejected this request (403). Check that the API key has the Generative Language API enabled.",
    );
  throw new Error(`${provider} request failed [${status}]: ${body.slice(0, 400)}`);
}

/* ------------------------------------------------------------------ embeddings */

async function embedWithGemini(key: string, texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  // Google caps batchEmbedContents at 100 requests; stay well under it.
  for (let i = 0; i < texts.length; i += 40) {
    const batch = texts.slice(i, i + 40);
    const res = await fetch(
      `${GOOGLE}/models/${GEMINI_EMBED_MODEL}:batchEmbedContents?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: batch.map((text) => ({
            model: `models/${GEMINI_EMBED_MODEL}`,
            content: { parts: [{ text }] },
            outputDimensionality: EMBED_DIMS,
            taskType: "RETRIEVAL_DOCUMENT",
          })),
        }),
      },
    );
    if (!res.ok) relay(res.status, await res.text(), "Gemini");
    const json = (await res.json()) as { embeddings?: { values: number[] }[] };
    const vectors = json.embeddings ?? [];
    if (vectors.length !== batch.length)
      throw new Error("Gemini returned fewer embeddings than passages sent.");
    out.push(...vectors.map((v) => v.values));
  }
  return out;
}

async function embedWithGateway(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 40) {
    const batch = texts.slice(i, i + 40);
    const res = await fetch(`${GATEWAY}/embeddings`, {
      method: "POST",
      headers: gatewayHeaders(),
      body: JSON.stringify({ model: GATEWAY_EMBED_MODEL, input: batch }),
    });
    if (!res.ok) relay(res.status, await res.text(), "AI");
    const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
    const sorted = [...json.data].sort((a, b) => a.index - b.index);
    out.push(...sorted.map((d) => d.embedding));
  }
  return out;
}

/** Embeds text into 3072-dim vectors matching the doc_chunks column. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const key = geminiKey();
  return key ? embedWithGemini(key, texts) : embedWithGateway(texts);
}

/** pgvector literal form for a Postgres `vector` column. */
export const toVector = (v: number[]) => JSON.stringify(v);

/* ---------------------------------------------------------- structured output */

interface StructuredArgs {
  instructions: string;
  input: string;
  schemaName: string;
  schema: Record<string, unknown>;
}

/**
 * Gemini's responseSchema accepts only a subset of JSON Schema. Strip the
 * OpenAI-strict keywords rather than maintaining two schema definitions.
 */
function toGeminiSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toGeminiSchema);
  if (!node || typeof node !== "object") return node;
  const src = node as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    if (k === "additionalProperties" || k === "$schema" || k === "strict" || k === "default")
      continue;
    if (k === "properties" && v && typeof v === "object") {
      const props: Record<string, unknown> = {};
      for (const [pk, pv] of Object.entries(v as Record<string, unknown>))
        props[pk] = toGeminiSchema(pv);
      out[k] = props;
      continue;
    }
    if (k === "type" && Array.isArray(v)) {
      out[k] = (v as string[]).find((t) => t !== "null") ?? "string";
      out["nullable"] = true;
      continue;
    }
    out[k] = toGeminiSchema(v);
  }
  return out;
}

function parseJson<T>(text: string): T {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("The model returned an empty result for this pass.");
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1)) as T;
    throw new Error("The model returned output that was not valid JSON.");
  }
}

async function structuredWithGemini<T>(key: string, args: StructuredArgs): Promise<T> {
  const res = await fetch(
    `${GOOGLE}/models/${GEMINI_CHAT_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: args.instructions }] },
        contents: [{ role: "user", parts: [{ text: args.input }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: toGeminiSchema(args.schema),
          temperature: 0.2,
        },
      }),
    },
  );
  if (!res.ok) relay(res.status, await res.text(), "Gemini");
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };
  if (json.promptFeedback?.blockReason)
    throw new Error(`Gemini blocked this passage (${json.promptFeedback.blockReason}).`);
  const text = (json.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  return parseJson<T>(text);
}

async function structuredWithGateway<T>(args: StructuredArgs): Promise<T> {
  const res = await fetch(`${GATEWAY}/responses`, {
    method: "POST",
    headers: gatewayHeaders(),
    body: JSON.stringify({
      model: GATEWAY_CHAT_MODEL,
      instructions: args.instructions,
      input: [{ role: "user", content: [{ type: "input_text", text: args.input }] }],
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      text: {
        format: { type: "json_schema", name: args.schemaName, strict: true, schema: args.schema },
      },
    }),
  });
  if (!res.ok) relay(res.status, await res.text(), "AI");
  if (!res.body) throw new Error("AI response had no body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let evt: {
        type?: string;
        delta?: string;
        response?: { output_text?: string; error?: { message?: string } };
        error?: { message?: string };
      };
      try {
        evt = JSON.parse(payload);
      } catch {
        continue;
      }
      if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
        text += evt.delta;
      } else if (evt.type === "response.completed" && evt.response?.output_text && !text) {
        text = evt.response.output_text;
      } else if (evt.type === "error" || evt.type === "response.failed") {
        throw new Error(evt.error?.message ?? evt.response?.error?.message ?? "AI stream failed");
      }
    }
  }
  return parseJson<T>(text);
}

/** Structured generation used by every agent pass and the executive summary. */
export async function generateStructured<T>(args: StructuredArgs): Promise<T> {
  const key = geminiKey();
  return key ? structuredWithGemini<T>(key, args) : structuredWithGateway<T>(args);
}

/* ----------------------------------------------------------------------- OCR */

/**
 * Reads text off rendered page images. Used only when a PDF page carries no
 * text layer, so scanned planning documents still enter the corpus verbatim.
 */
export async function ocrImages(images: string[]): Promise<string[]> {
  const key = geminiKey();
  const prompt =
    "Transcribe every word of text visible in this scanned page image, preserving reading order, headings and table rows. Output plain text only, no commentary. If the page has no legible text, output nothing.";

  const results: string[] = [];
  for (const base64 of images) {
    if (key) {
      const res = await fetch(
        `${GOOGLE}/models/${GEMINI_CHAT_MODEL}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: prompt },
                  { inlineData: { mimeType: "image/jpeg", data: base64 } },
                ],
              },
            ],
            generationConfig: { temperature: 0 },
          }),
        },
      );
      if (!res.ok) relay(res.status, await res.text(), "Gemini");
      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      results.push(
        (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim(),
      );
      continue;
    }

    const res = await fetch(`${GATEWAY}/chat/completions`, {
      method: "POST",
      headers: gatewayHeaders(),
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) relay(res.status, await res.text(), "AI");
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    results.push((json.choices?.[0]?.message?.content ?? "").trim());
  }
  return results;
}
