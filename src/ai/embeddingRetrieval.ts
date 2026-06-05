import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import OpenAI from "openai";
import {
  type RankedRetrievalDocument,
  type RetrievalDocument,
  rankDocuments,
} from "./retrievalScoring.js";
import { writableDataPath } from "./serverDataPaths.js";

dotenv.config({ path: ".env.local" });

const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_EMBEDDING_DIMENSIONS = 512;
const CACHE_PATH = "src/ai/generated/embedding-cache.json";
const CACHE_VERSION = 1;

type EmbeddingCache = {
  version: number;
  entries: Record<string, number[]>;
};

type EmbeddingProvider = (texts: string[]) => Promise<number[][]>;

export async function rankDocumentsHybrid<T>(
  query: string,
  documents: Array<RetrievalDocument<T>>,
  options: {
    limit: number;
    minScore?: number;
    keywordWeight?: number;
    semanticWeight?: number;
    embeddingProvider?: EmbeddingProvider;
  },
): Promise<Array<RankedRetrievalDocument<T>>> {
  const keywordRanked = rankDocuments(query, documents, {
    limit: documents.length,
    minScore: 0,
  });
  const fallback = keywordRanked
    .filter((document) => document.score >= (options.minScore ?? 0.08))
    .slice(0, options.limit);

  if (!documents.length || (!options.embeddingProvider && !embeddingsAvailable())) {
    return fallback;
  }

  try {
    const texts = [query, ...documents.map(documentText)];
    const vectors = options.embeddingProvider
      ? await options.embeddingProvider(texts)
      : await embedTexts(texts);

    if (vectors.length !== texts.length) return fallback;

    const [queryVector, ...documentVectors] = vectors;
    const keywordById = new Map(keywordRanked.map((item) => [item.id, item]));
    const keywordWeight = options.keywordWeight ?? 0.32;
    const semanticWeight = options.semanticWeight ?? 0.68;

    return documents
      .map((document, index) => {
        const keyword = keywordById.get(document.id);
        const semantic = Math.max(0, cosineSimilarity(queryVector, documentVectors[index]));
        const keywordScore = Math.min(1, Math.max(0, keyword?.score ?? 0));
        const score =
          semantic * semanticWeight +
          keywordScore * keywordWeight +
          (document.recencyScore ?? 0) * 0.08 +
          (document.authorityScore ?? 0) * 0.08;

        return {
          ...document,
          score,
          matchedTerms: keyword?.matchedTerms ?? [],
          excerpt: keyword?.excerpt ?? makeFallbackExcerpt(document.text),
        };
      })
      .filter((document) => document.score >= (options.minScore ?? 0.18))
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit);
  } catch {
    return fallback;
  }
}

export function embeddingsAvailable() {
  return Boolean(process.env.OPENAI_API_KEY) && !embeddingsDisabled();
}

function embeddingsDisabled() {
  return process.env.COACH_EMBEDDINGS_DISABLED === "1";
}

async function embedTexts(texts: string[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY for embeddings");

  const model = process.env.OPENAI_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL;
  const dimensions = Number(process.env.OPENAI_EMBEDDING_DIMENSIONS) || DEFAULT_EMBEDDING_DIMENSIONS;
  const cache = await loadCache();
  const normalizedTexts = texts.map(normalizeEmbeddingText);
  const keys = normalizedTexts.map((text) => cacheKey(model, dimensions, text));
  const missing = normalizedTexts
    .map((text, index) => ({ text, key: keys[index] }))
    .filter((item) => !cache.entries[item.key]);

  if (missing.length) {
    const client = new OpenAI({ apiKey });
    const response = await client.embeddings.create({
      model,
      input: missing.map((item) => item.text),
      dimensions,
      encoding_format: "float",
    });

    for (const item of response.data) {
      const missingItem = missing[item.index];
      if (missingItem) cache.entries[missingItem.key] = item.embedding;
    }

    await saveCache(cache);
  }

  return keys.map((key) => {
    const vector = cache.entries[key];
    if (!vector) throw new Error("Embedding cache miss after embedding request");
    return vector;
  });
}

async function loadCache(): Promise<EmbeddingCache> {
  try {
    const raw = await fs.readFile(writableDataPath(CACHE_PATH), "utf-8");
    const parsed = JSON.parse(raw) as Partial<EmbeddingCache>;
    if (parsed.version === CACHE_VERSION && parsed.entries && typeof parsed.entries === "object") {
      return {
        version: CACHE_VERSION,
        entries: parsed.entries,
      };
    }
  } catch {
    // Cache is optional; rebuild on demand.
  }

  return { version: CACHE_VERSION, entries: {} };
}

async function saveCache(cache: EmbeddingCache) {
  const runtimePath = writableDataPath(CACHE_PATH);
  await fs.mkdir(path.dirname(runtimePath), { recursive: true });
  await fs.writeFile(runtimePath, `${JSON.stringify(cache, null, 2)}\n`, "utf-8");
}

function documentText<T>(document: RetrievalDocument<T>) {
  return [
    document.title,
    document.text,
    ...(document.tags ?? []),
  ].join("\n");
}

function normalizeEmbeddingText(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 8000);
}

function cacheKey(model: string, dimensions: number, text: string) {
  return crypto
    .createHash("sha256")
    .update(`${CACHE_VERSION}:${model}:${dimensions}:${text}`)
    .digest("hex");
}

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index++) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function makeFallbackExcerpt(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 220);
}
