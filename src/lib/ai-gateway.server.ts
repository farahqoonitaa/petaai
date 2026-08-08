// Lovable AI Gateway helpers. Server-only.
const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const EMBED_MODEL = "google/gemini-embedding-2";
const CHAT_MODEL = "openai/gpt-5.6-sol";

function apiKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return key;
}

function headers() {
  return {
    "Content-Type": "application/json",
    "Lovable-API-Key": apiKey(),
    "X-Lovable-AIG-SDK": "fetch",
  };
}

function relay(status: number, body: string): never {
  if (status === 429) throw new Error("AI rate limit reached — wait a moment and re-run this pass.");
  if (status === 402) throw new Error("AI credits exhausted for this workspace.");
  throw new Error(`AI request failed [${status}]: ${body.slice(0, 400)}`);
}

/** Embeds text. Batched to stay inside the provider's 100-input cap. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 40) {
    const batch = texts.slice(i, i + 40);
    const res = await fetch(`${GATEWAY}/embeddings`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ model: EMBED_MODEL, input: batch }),
    });
    if (!res.ok) relay(res.status, await res.text());
    const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
    const sorted = [...json.data].sort((a, b) => a.index - b.index);
    out.push(...sorted.map((d) => d.embedding));
  }
  return out;
}

/** pgvector literal form for a Postgres `vector` column. */
export const toVector = (v: number[]) => JSON.stringify(v);

interface StructuredArgs {
  instructions: string;
  input: string;
  schemaName: string;
  schema: Record<string, unknown>;
}

/**
 * Structured generation over the Responses API. Streaming is mandatory here:
 * these passes routinely run past a buffered request's lifetime.
 */
export async function generateStructured<T>({
  instructions,
  input,
  schemaName,
  schema,
}: StructuredArgs): Promise<T> {
  const res = await fetch(`${GATEWAY}/responses`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: CHAT_MODEL,
      instructions,
      input: [{ role: "user", content: [{ type: "input_text", text: input }] }],
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      text: { format: { type: "json_schema", name: schemaName, strict: true, schema } },
    }),
  });
  if (!res.ok) relay(res.status, await res.text());
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
