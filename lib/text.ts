// Small text helpers shared by collectors and the cleaning stage.

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

/** Turns "&quot;CI&quot; &amp; &#39;tests&#39;" into "\"CI\" & 'tests'". */
export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const isHex = code[1]?.toLowerCase() === "x";
      const num = parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(num) ? String.fromCodePoint(num) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** Removes HTML tags and code blocks, decodes entities and collapses whitespace. */
export function stripHtml(input: string | null | undefined): string {
  if (!input) return "";
  const withoutCode = input.replace(/<pre[\s\S]*?<\/pre>/gi, " [code] ");
  const withoutTags = withoutCode.replace(/<[^>]+>/g, " ");
  return decodeEntities(withoutTags).replace(/\s+/g, " ").trim();
}

/** Cuts text to max characters on a word boundary, adding an ellipsis when cut. */
export function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  const cut = input.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

/** Normalises a URL so the same thread linked two ways is recognised as a duplicate. */
export function normaliseUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_")) url.searchParams.delete(key);
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = url.pathname.replace(/\/+$/, "");
    const search = url.searchParams.toString();
    return `${host}${pathname}${search ? `?${search}` : ""}`;
  } catch {
    return raw.trim().toLowerCase();
  }
}

/** True if the haystack contains the phrase as a case-insensitive substring. */
export function containsPhrase(haystack: string, phrase: string): boolean {
  return haystack.toLowerCase().includes(phrase.toLowerCase());
}
