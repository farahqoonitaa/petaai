/** Page-aware chunking. Text uses \f page separators produced by the extractor. */
export interface RawChunk {
  index: number;
  pageHint: number;
  content: string;
}

const TARGET = 1500;
const OVERLAP = 180;

export function chunkDocument(text: string): RawChunk[] {
  const pages = text.split("\f");
  const chunks: RawChunk[] = [];
  let index = 0;

  pages.forEach((raw, pageIdx) => {
    const clean = raw.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (clean.length < 40) return;
    if (clean.length <= TARGET) {
      chunks.push({ index: index++, pageHint: pageIdx + 1, content: clean });
      return;
    }
    let cursor = 0;
    while (cursor < clean.length) {
      let end = Math.min(cursor + TARGET, clean.length);
      if (end < clean.length) {
        const breakAt = clean.lastIndexOf(". ", end);
        if (breakAt > cursor + TARGET * 0.5) end = breakAt + 1;
      }
      const slice = clean.slice(cursor, end).trim();
      if (slice.length > 40) chunks.push({ index: index++, pageHint: pageIdx + 1, content: slice });
      if (end >= clean.length) break;
      cursor = Math.max(end - OVERLAP, cursor + 1);
    }
  });

  return chunks;
}
