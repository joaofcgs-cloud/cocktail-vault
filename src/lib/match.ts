// Lightweight fuzzy string matching for invoice line items → inventory names.

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b\d+\s?(ml|cl|l|lt|litros?|un|und|cx)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1);
  const cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = cur[j];
  }
  return prev[n];
}

/** Similarity 0..1 combining edit distance with token containment. */
export function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const lev = 1 - levenshtein(na, nb) / Math.max(na.length, nb.length);

  // token overlap: reward when inventory name appears within product text
  const at = new Set(na.split(" "));
  const bt = new Set(nb.split(" "));
  let shared = 0;
  for (const t of bt) if (at.has(t)) shared++;
  const overlap = shared / bt.size;
  const contains = na.includes(nb) || nb.includes(na) ? 0.9 : 0;

  return Math.max(lev, overlap, contains);
}

export interface MatchCandidate {
  id: string;
  name: string;
}

export interface MatchResult {
  id: string | null;
  confidence: number; // 0..100
}

/** Best inventory match for a product name. */
export function bestMatch(product: string, candidates: MatchCandidate[]): MatchResult {
  let best: MatchResult = { id: null, confidence: 0 };
  for (const c of candidates) {
    const score = Math.round(similarity(product, c.name) * 100);
    if (score > best.confidence) best = { id: c.id, confidence: score };
  }
  return best;
}
