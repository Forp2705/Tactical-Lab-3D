import { buildCoachRagIndex } from "../src/ai/ragIndex.js";

const index = await buildCoachRagIndex();

console.log(
  JSON.stringify(
    {
      builtAt: index.builtAt,
      embeddingModel: index.embeddingModel,
      dimensions: index.dimensions,
      documentCount: index.documentCount,
    },
    null,
    2,
  ),
);
