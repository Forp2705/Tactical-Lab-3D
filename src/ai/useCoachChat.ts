// W22-C2 — local (non-persisted) state for the "Chat coach" tab, built against
// the mc-17 contract (CoachChatSchemas.ts). History lives only in this hook's
// state: it resets on AiView unmount (nav away from Diagnostico, reload) but
// survives switching between the Consulta/Chat sub-tabs, since AiView owns
// the hook instance. No IndexedDB/store write — "no persistencia esta ola".
import { useCallback, useState } from "react";
import {
  type CoachAgentRuntimeContext,
  requestCoachChatTurn,
} from "@/ai/coachAgentClient";
import type {
  CoachChatEvidenceRef,
  CoachChatHistory,
  CoachChatHistoryTurn,
} from "@/ai/CoachChatSchemas";
import type { CoachMatchAdvice } from "@/ai/CoachSchemas";

export type ChatUiTurn =
  | { id: string; role: "staff"; content: string }
  | {
      id: string;
      role: "coach";
      content: string;
      grounded: boolean;
      followUpQuestions: string[];
      evidenceRefs: CoachChatEvidenceRef[];
      confidence?: number;
    };

function makeTurnId(): string {
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toRequestHistory(turns: ChatUiTurn[]): CoachChatHistory {
  return turns.map((turn) => ({ role: turn.role, content: turn.content }));
}

// El resumen que ancla el follow-up a un informe ya generado — solo campos
// reales de CoachMatchAdvice, mismo tono que el caso "informe como semilla"
// del fixture del contrato (reportSeedHistory). Cero texto inventado.
export function buildChatSeedFromAdvice(advice: CoachMatchAdvice): string {
  const confidencePct = Math.round(advice.reflection.confidence * 100);
  return `Informe: ${advice.tacticalReading} Ajuste principal: ${advice.mainAdjustment} Confianza: ${confidencePct}%.`;
}

export function useCoachChat() {
  const [turns, setTurns] = useState<ChatUiTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<{
    input: string;
    history: CoachChatHistoryTurn[];
  } | null>(null);

  const runTurn = useCallback(
    async (
      input: string,
      history: CoachChatHistoryTurn[],
      coachContext: CoachAgentRuntimeContext,
    ) => {
      setLoading(true);
      setError(null);
      setPendingRequest({ input, history });
      try {
        const reply = await requestCoachChatTurn(input, history, coachContext);
        setTurns((current) => [
          ...current,
          {
            id: makeTurnId(),
            role: "coach",
            content: reply.reply,
            grounded: reply.grounded,
            followUpQuestions: reply.followUpQuestions,
            evidenceRefs: reply.evidenceRefs,
            confidence: reply.confidence,
          },
        ]);
        setPendingRequest(null);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "No se pudo consultar al coach.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const send = useCallback(
    (text: string, coachContext: CoachAgentRuntimeContext) => {
      const content = text.trim();
      if (!content || loading) return;
      const historySnapshot = toRequestHistory(turns);
      setTurns((current) => [
        ...current,
        { id: makeTurnId(), role: "staff", content },
      ]);
      setDraft("");
      void runTurn(content, historySnapshot, coachContext);
    },
    [loading, runTurn, turns],
  );

  const retry = useCallback(
    (coachContext: CoachAgentRuntimeContext) => {
      if (!pendingRequest || loading) return;
      void runTurn(pendingRequest.input, pendingRequest.history, coachContext);
    },
    [loading, pendingRequest, runTurn],
  );

  const useFollowUp = useCallback((question: string) => {
    setDraft(question);
  }, []);

  // Arranca (reemplaza) la conversacion con el resumen del informe como
  // turno 0 del coach — caso "informe como semilla" del contrato.
  const seedFromReport = useCallback((summary: string) => {
    setTurns([
      {
        id: makeTurnId(),
        role: "coach",
        content: summary,
        grounded: false,
        followUpQuestions: [],
        evidenceRefs: [],
      },
    ]);
    setDraft("");
    setError(null);
    setPendingRequest(null);
  }, []);

  return {
    turns,
    draft,
    setDraft,
    loading,
    error,
    send,
    retry,
    useFollowUp,
    seedFromReport,
  };
}
