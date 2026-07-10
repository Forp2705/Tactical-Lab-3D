// W22-C1 — shared fixtures for the coach multi-turn chat contract.
//
// Consumed by:
//   - the schema unit test (coachChatSchema.test.ts) to prove request/response
//     validity + caps,
//   - mc-18's UI development WITHOUT an API key (intercept-fetch pattern, W17):
//     stub `/api/coach-agent` to return `chatResponse()` and drive the Chat tab.
//
// Pure builders — no behavior, just valid request/response factories with
// override hooks. Kept client-safe (only imports the client-safe schema types).
import type { CoachChatHistory, CoachChatTurn } from "@/ai/CoachChatSchemas";

// ── Request: a plain chat turn ────────────────────────────────────────────────
export const chatHistory: CoachChatHistory = [
  {
    role: "staff",
    content: "El rival nos hizo daño por izquierda en el segundo tiempo.",
  },
  {
    role: "coach",
    content:
      "¿Fue por la espalda del lateral o por dentro, entre lateral y central?",
  },
  {
    role: "staff",
    content: "Por la espalda del lateral, cuando subía a presionar.",
  },
];

export function chatRequest(
  over: {
    input?: string;
    history?: CoachChatHistory;
    coachContext?: unknown;
  } = {},
) {
  return {
    input: over.input ?? "¿Cómo cubro esa espalda sin bajar la presión?",
    mode: "chat" as const,
    history: over.history ?? chatHistory,
    ...(over.coachContext !== undefined
      ? { coachContext: over.coachContext }
      : {}),
  };
}

// ── Request: "informe como semilla" ──────────────────────────────────────────
// The report follow-up case: the FIRST turn is a `role: "coach"` summary of a
// Consulta report, so the chat anchors follow-ups to that report without
// re-sending the whole structured advice.
export function reportSeedHistory(): CoachChatHistory {
  return [
    {
      role: "coach",
      content:
        "Informe: el problema es la espalda del lateral izquierdo al saltar a " +
        "presionar. Ajuste principal: coordinar el salto con el achique de la " +
        "última línea. Confianza media, falta velocidad del extremo rival.",
    },
    {
      role: "staff",
      content: "¿Y si en vez de achicar bajo un poco el bloque?",
    },
  ];
}

export function reportFollowUpRequest(over: { input?: string } = {}) {
  return {
    input:
      over.input ?? "¿Bajar el bloque no me deja lejos para la segunda pelota?",
    mode: "chat" as const,
    history: reportSeedHistory(),
  };
}

// ── Response: a valid chat turn ──────────────────────────────────────────────
export function chatResponse(over: Partial<CoachChatTurn> = {}): CoachChatTurn {
  return {
    mode: "chat",
    reply:
      "Para cubrir esa espalda sin bajar la presión, el central del lado " +
      "acompaña el salto del lateral y el volante cierra el pasillo interior. " +
      "Así mantenés la presión arriba pero no dejás el hueco a la espalda.",
    grounded: true,
    followUpQuestions: [
      "¿El extremo rival es de encarar o de buscar la diagonal a la espalda?",
    ],
    evidenceRefs: [
      {
        sourceType: "report",
        sourceId: "REP-espalda-lateral",
        excerpt: "Daño recurrente por la espalda del lateral al presionar.",
      },
    ],
    confidence: 0.55,
    ...over,
  };
}

// A clarifying/hedged chat turn: no evidence yet, so `grounded: false` and no
// confidence asserted — the honest "I need more before I claim" shape.
export function chatClarifyingResponse(): CoachChatTurn {
  return {
    mode: "chat",
    reply:
      "Antes de darte un ajuste concreto necesito ubicar el problema: " +
      "¿el daño llega por la espalda del lateral o por dentro?",
    grounded: false,
    followUpQuestions: [
      "¿Por la espalda del lateral o entre lateral y central?",
    ],
    evidenceRefs: [],
  };
}
