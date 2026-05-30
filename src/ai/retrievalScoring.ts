import { TACTICAL_KEYWORDS } from "./tacticalKeywords.js";

export type RetrievalSourceType =
  | "knowledge"
  | "memory"
  | "observation"
  | "report";

export type RetrievalDocument<T> = {
  id: string;
  sourceType: RetrievalSourceType;
  title: string;
  text: string;
  tags?: string[];
  payload: T;
  recencyScore?: number;
  authorityScore?: number;
};

export type RankedRetrievalDocument<T> = RetrievalDocument<T> & {
  score: number;
  matchedTerms: string[];
  excerpt: string;
};

const STOPWORDS = new Set([
  "a",
  "al",
  "algo",
  "ante",
  "con",
  "como",
  "de",
  "del",
  "desde",
  "el",
  "en",
  "entre",
  "esa",
  "ese",
  "eso",
  "esta",
  "este",
  "esto",
  "la",
  "las",
  "le",
  "lo",
  "los",
  "mas",
  "muy",
  "no",
  "nos",
  "o",
  "para",
  "pero",
  "por",
  "que",
  "se",
  "si",
  "sin",
  "su",
  "sus",
  "un",
  "una",
  "y",
]);

export function rankDocuments<T>(
  query: string,
  documents: Array<RetrievalDocument<T>>,
  options: { limit: number; minScore?: number },
): Array<RankedRetrievalDocument<T>> {
  const queryProfile = buildSearchProfile(query);
  const minScore = options.minScore ?? 0.08;

  return documents
    .map((document) => scoreDocument(document, queryProfile))
    .filter((document) => document.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit);
}

export function buildEvidenceCitation(
  document: {
    id: string;
    sourceType: RetrievalSourceType;
    title: string;
    excerpt: string;
    score: number;
  },
) {
  return {
    sourceType: document.sourceType,
    sourceId: document.id,
    title: document.title,
    excerpt: document.excerpt,
    relevance: Number(Math.min(1, Math.max(0, document.score)).toFixed(3)),
  };
}

function scoreDocument<T>(
  document: RetrievalDocument<T>,
  queryProfile: SearchProfile,
): RankedRetrievalDocument<T> {
  const documentProfile = buildSearchProfile(
    [document.title, document.text, ...(document.tags ?? [])].join(" "),
  );
  const matchedTerms = [...queryProfile.terms].filter((term) =>
    documentProfile.terms.has(term),
  );
  const tagMatches = (document.tags ?? [])
    .flatMap((tag) => [normalize(tag), ...normalizeKeywordGroup(tag)])
    .filter((term) => queryProfile.terms.has(term));
  const phraseMatches = [...queryProfile.phrases].filter((phrase) =>
    documentProfile.normalized.includes(phrase),
  );
  const cosine = cosineSimilarity(queryProfile.weights, documentProfile.weights);
  const coverage =
    queryProfile.terms.size > 0
      ? matchedTerms.length / queryProfile.terms.size
      : 0;
  const tagBoost = Math.min(0.25, tagMatches.length * 0.04);
  const phraseBoost = Math.min(0.3, phraseMatches.length * 0.08);
  const recencyBoost = (document.recencyScore ?? 0) * 0.08;
  const authorityBoost = (document.authorityScore ?? 0) * 0.08;
  const score =
    cosine * 0.52 +
    coverage * 0.22 +
    tagBoost +
    phraseBoost +
    recencyBoost +
    authorityBoost;

  return {
    ...document,
    score,
    matchedTerms: [...new Set([...matchedTerms, ...tagMatches])].slice(0, 12),
    excerpt: makeExcerpt(document.text, [
      ...matchedTerms,
      ...tagMatches,
      ...phraseMatches,
    ]),
  };
}

type SearchProfile = {
  normalized: string;
  terms: Set<string>;
  phrases: Set<string>;
  weights: Map<string, number>;
};

function buildSearchProfile(text: string): SearchProfile {
  const normalized = normalize(text);
  const baseTerms = tokenize(normalized);
  const expandedTerms = expandTerms(normalized, baseTerms);
  const phrases = extractKnownPhrases(normalized);
  const terms = new Set([...baseTerms, ...expandedTerms, ...phrases]);
  const weights = new Map<string, number>();

  for (const term of terms) {
    const baseWeight = baseTerms.includes(term) ? 1 : 0.62;
    const phraseWeight = term.includes(" ") ? 1.35 : 1;
    weights.set(term, Math.max(weights.get(term) ?? 0, baseWeight * phraseWeight));
  }

  return {
    normalized,
    terms,
    phrases: new Set(phrases),
    weights,
  };
}

function expandTerms(normalizedText: string, baseTerms: string[]) {
  const expanded = new Set<string>();
  const baseSet = new Set(baseTerms);

  for (const [tag, keywords] of Object.entries(TACTICAL_KEYWORDS)) {
    const normalizedTag = normalize(tag);
    const normalizedKeywords = keywords.map(normalize);
    const matches =
      normalizedText.includes(normalizedTag) ||
      normalizedKeywords.some((keyword) => normalizedText.includes(keyword)) ||
      normalizedKeywords.some((keyword) =>
        tokenize(keyword).some((token) => baseSet.has(token)),
      );

    if (!matches) continue;
    expanded.add(normalizedTag);
    for (const keyword of normalizedKeywords) {
      expanded.add(keyword);
      for (const token of tokenize(keyword)) expanded.add(token);
    }
  }

  return [...expanded];
}

function normalizeKeywordGroup(tag: string) {
  return (TACTICAL_KEYWORDS[tag] ?? []).flatMap((keyword) => [
    normalize(keyword),
    ...tokenize(keyword),
  ]);
}

function extractKnownPhrases(normalizedText: string) {
  const phrases = new Set<string>();

  for (const [tag, keywords] of Object.entries(TACTICAL_KEYWORDS)) {
    const normalizedTag = normalize(tag);
    if (normalizedTag.includes(" ") && normalizedText.includes(normalizedTag)) {
      phrases.add(normalizedTag);
    }
    for (const keyword of keywords) {
      const normalizedKeyword = normalize(keyword);
      if (
        normalizedKeyword.includes(" ") &&
        normalizedText.includes(normalizedKeyword)
      ) {
        phrases.add(normalizedKeyword);
      }
    }
  }

  return [...phrases];
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const weight of a.values()) normA += weight * weight;
  for (const weight of b.values()) normB += weight * weight;
  for (const [term, weight] of a.entries()) {
    dot += weight * (b.get(term) ?? 0);
  }

  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function makeExcerpt(text: string, terms: string[]) {
  const normalizedText = normalize(text);
  const match = terms.find((term) => term.length >= 4);
  const index = match ? normalizedText.indexOf(normalize(match)) : -1;
  const raw = text.replace(/\s+/g, " ").trim();

  if (index === -1) return raw.slice(0, 220);

  const start = Math.max(0, index - 90);
  const end = Math.min(raw.length, index + 170);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < raw.length ? "..." : "";
  return `${prefix}${raw.slice(start, end)}${suffix}`;
}

function tokenize(text: string) {
  return normalize(text)
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
